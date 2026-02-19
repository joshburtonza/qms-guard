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

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const data = await res.json();
    return data?.email || null;
  } catch {
    return null;
  }
}

async function getAdminEmails(tenantId: string): Promise<string[]> {
  const roles = await supabaseQuery(
    `user_roles?role=in.(super_admin,site_admin)&select=user_id`
  );
  const emails: string[] = [];
  for (const role of roles || []) {
    const email = await getUserEmail(role.user_id);
    if (email) emails.push(email);
  }
  return emails;
}

function getEscalationTier(daysOverdue: number): 'reminder' | 'manager' | 'senior' {
  if (daysOverdue >= 14) return 'senior';
  if (daysOverdue >= 7) return 'manager';
  return 'reminder';
}

function getEscalationColor(tier: string): string {
  switch (tier) {
    case 'senior': return '#7C3AED'; // purple
    case 'manager': return '#DC2626'; // red
    default: return '#D97706'; // amber
  }
}

function buildReminderEmail(nc: any, name: string, daysOverdue: number, tier: string): { subject: string; html: string } {
  const color = getEscalationColor(tier);
  const tierLabel = tier === 'senior' ? '🔴 CRITICAL ESCALATION' 
    : tier === 'manager' ? '⚠️ ESCALATED - Manager Review' 
    : '⏰ Reminder';

  return {
    subject: tier === 'senior'
      ? `[CRITICAL] NC ${nc.nc_number} — ${daysOverdue} Days Overdue, Senior Management Review`
      : tier === 'manager'
      ? `[ESCALATED] NC ${nc.nc_number} — ${daysOverdue} Days Overdue`
      : `[Reminder] NC ${nc.nc_number} — ${daysOverdue > 0 ? `${daysOverdue} Days Overdue` : 'Action Required'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: ${color};">${tierLabel}</h2>
          <p>Hello ${name},</p>
          <p>${tier === 'senior' 
            ? 'This NC has been overdue for an extended period and requires immediate senior management intervention.'
            : tier === 'manager'
            ? 'This NC is significantly overdue and requires your attention as Training Manager / QA.'
            : 'This is a reminder regarding the non-conformance that requires your attention.'
          }</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
            <table style="width: 100%;">
              <tr><td style="color: #666; padding: 5px 0;">NC Number:</td><td style="font-weight: bold;">${nc.nc_number}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Due Date:</td><td style="font-weight: bold; color: #DC2626;">${nc.due_date}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Days Overdue:</td><td style="font-weight: bold; color: #DC2626;">${daysOverdue}</td></tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Take Action Now
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from QMS Guard. Do not reply directly.
          </p>
        </div>
      </div>
    `,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Authenticate: only allow calls with the service role key
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let sent = 0;

    // Get open NCs with due dates
    const ncs = await supabaseQuery(
      `non_conformances?status=not.eq.closed&status=not.eq.rejected&select=id,nc_number,due_date,responsible_person,tenant_id,description`
    );

    for (const nc of ncs || []) {
      if (!nc.responsible_person || !nc.due_date) continue;

      const dueDate = new Date(nc.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const tier = getEscalationTier(daysOverdue);

      // Get responsible person info
      const profile = await supabaseQuery(`profiles?id=eq.${nc.responsible_person}&select=full_name`);
      const name = profile?.[0]?.full_name || 'User';
      const rpEmail = await getUserEmail(nc.responsible_person);

      // Always send to responsible person
      if (rpEmail) {
        const email = buildReminderEmail(nc, name, daysOverdue, daysOverdue > 0 ? 'reminder' : 'reminder');
        if (await sendEmail(rpEmail, email.subject, email.html)) sent++;
      }

      // Tier-based escalation
      if (tier === 'manager' || tier === 'senior') {
        // Get department manager
        const ncFull = await supabaseQuery(`non_conformances?id=eq.${nc.id}&select=department_id`);
        const deptId = ncFull?.[0]?.department_id;
        
        if (deptId) {
          const dept = await supabaseQuery(`departments?id=eq.${deptId}&select=manager_id`);
          const managerId = dept?.[0]?.manager_id;
          if (managerId) {
            const managerEmail = await getUserEmail(managerId);
            if (managerEmail) {
              const email = buildReminderEmail(nc, 'Training Manager', daysOverdue, 'manager');
              if (await sendEmail(managerEmail, email.subject, email.html)) sent++;
            }
          }
        }

        // Also notify QA/admin for manager tier
        const adminEmails = await getAdminEmails(nc.tenant_id);
        for (const adminEmail of adminEmails) {
          const email = buildReminderEmail(nc, 'Administrator', daysOverdue, tier);
          if (await sendEmail(adminEmail, email.subject, email.html)) sent++;
        }
      }

      // Senior tier (14+ days): additional escalation logging
      if (tier === 'senior') {
        // Log escalation in activity log via REST
        await fetch(`${SUPABASE_URL}/rest/v1/nc_activity_log`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            nc_id: nc.id,
            action: 'overdue_escalation_senior',
            details: { days_overdue: daysOverdue, tier: 'senior', escalated_at: new Date().toISOString() },
            tenant_id: nc.tenant_id,
          }),
        });
      }
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
