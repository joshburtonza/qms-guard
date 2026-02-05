import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: 'QMS Guard <noreply@qms-guard.lovable.app>', to: [to], subject, html }),
  });
  return res.ok;
}

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    let sent = 0;

    // Get open NCs
    const ncs = await supabaseQuery(
      `non_conformances?status=not.eq.closed&status=not.eq.rejected&select=id,nc_number,due_date,responsible_person,tenant_id`
    );

    // Group by responsible person
    const byUser: Record<string, any[]> = {};
    for (const nc of ncs || []) {
      if (!nc.responsible_person) continue;
      if (!byUser[nc.responsible_person]) byUser[nc.responsible_person] = [];
      byUser[nc.responsible_person].push(nc);
    }

    // Send reminders
    for (const [userId, userNcs] of Object.entries(byUser)) {
      const profile = await supabaseQuery(`profiles?id=eq.${userId}&select=full_name`);
      const name = profile?.[0]?.full_name || 'User';
      
      // Get email from auth admin API
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const authUser = await authRes.json();
      const email = authUser?.email;
      if (!email) continue;

      const overdue = userNcs.filter(nc => nc.due_date < today);
      const subject = overdue.length > 0 
        ? `⚠️ You have ${overdue.length} overdue NC(s)`
        : `Reminder: ${userNcs.length} open NC(s)`;
      
      const html = `<p>Hello ${name},</p><p>You have ${userNcs.length} open NC(s)${overdue.length > 0 ? `, ${overdue.length} overdue` : ''}. Please log in to take action.</p>`;
      
      if (await sendEmail(email, subject, html)) sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
