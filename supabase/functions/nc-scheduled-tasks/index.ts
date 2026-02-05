import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'QMS Guard <noreply@qms-guard.lovable.app>',
        to: [to],
        subject,
        html,
      }),
    });
    console.log(`Email to ${to}: ${res.ok ? 'sent' : 'failed'}`);
    return res.ok;
  } catch (e) {
    console.error('Email error:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split('T')[0];
    const LOCKOUT_THRESHOLD = 5;
    let remindersSent = 0;
    let overdueNotifications = 0;
    let lockoutsTriggered = 0;

    // Get all open NCs with responsible person info
    const { data: openNCs, error: ncError } = await supabase
      .from('non_conformances')
      .select('id, nc_number, description, due_date, status, severity, responsible_person, tenant_id')
      .not('status', 'eq', 'closed')
      .not('status', 'eq', 'rejected');

    if (ncError) throw ncError;

    // Group by responsible person
    const byResponsible: Record<string, { ncs: typeof openNCs; tenant_id: string }> = {};
    for (const nc of openNCs || []) {
      if (!nc.responsible_person) continue;
      if (!byResponsible[nc.responsible_person]) {
        byResponsible[nc.responsible_person] = { ncs: [], tenant_id: nc.tenant_id };
      }
      byResponsible[nc.responsible_person].ncs.push(nc);
    }

    // Process each responsible person
    for (const [userId, data] of Object.entries(byResponsible)) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) continue;

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const overdueNCs = data.ncs.filter(nc => new Date(nc.due_date) < new Date());
      
      // Send reminder for open NCs
      if (data.ncs.length > 0) {
        const isOverdue = overdueNCs.length > 0;
        const subject = isOverdue 
          ? `⚠️ OVERDUE: You have ${overdueNCs.length} overdue NC(s)`
          : `Reminder: You have ${data.ncs.length} open NC(s)`;
        
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: ${isOverdue ? '#dc2626' : '#f59e0b'};">
              ${isOverdue ? '⚠️ Overdue Actions Required' : '📋 NC Reminder'}
            </h2>
            <p>Hello ${profile?.full_name || 'User'},</p>
            <p>You have <strong>${data.ncs.length}</strong> open non-conformance(s)${isOverdue ? `, including <strong>${overdueNCs.length}</strong> overdue` : ''}.</p>
            <p>Please log in to QMS Guard to take action.</p>
          </div>
        `;
        
        if (await sendEmail(email, subject, html)) remindersSent++;
      }

      // Check lockout threshold
      if (overdueNCs.length >= LOCKOUT_THRESHOLD) {
        lockoutsTriggered++;
        
        // Notify managers
        const { data: managers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('tenant_id', data.tenant_id)
          .eq('role', 'manager');

        for (const mgr of managers || []) {
          const { data: mgrAuth } = await supabase.auth.admin.getUserById(mgr.user_id);
          if (mgrAuth?.user?.email) {
            await sendEmail(
              mgrAuth.user.email,
              `🔒 User Lockout: ${profile?.full_name || 'User'}`,
              `<p><strong>${profile?.full_name}</strong> has ${overdueNCs.length} overdue NCs and is now restricted.</p>`
            );
          }
        }
      }
    }

    const result = { success: true, remindersSent, overdueNotifications, lockoutsTriggered, timestamp: new Date().toISOString() };
    console.log('Scheduled tasks completed:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
