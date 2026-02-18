import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Email templates for different notification types
const emailTemplates = {
  qa_classified: (nc: any, risk: string) => ({
    subject: `[Action Required] NC ${nc.nc_number} - Investigation Assigned`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E40AF; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: #1E40AF;">Non-Conformance Assigned for Investigation</h2>
          <p>A non-conformance has been classified and assigned to you for investigation.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr><td style="color: #666; padding: 5px 0;">NC Number:</td><td style="font-weight: bold;">${nc.nc_number}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Risk Level:</td><td style="font-weight: bold; color: ${risk === 'major' ? '#DC2626' : risk === 'minor' ? '#D97706' : '#059669'};">${risk.toUpperCase()}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Due Date:</td><td style="font-weight: bold;">${nc.due_date}</td></tr>
            </table>
          </div>
          
          <p><strong>Description:</strong></p>
          <p style="background: white; padding: 10px; border-radius: 4px;">${nc.description}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: #1E40AF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View & Respond to NC
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Please investigate the root cause and submit your corrective actions before the due date.
          </p>
        </div>
      </div>
    `,
  }),

  manager_notice: (nc: any, risk: string) => ({
    subject: `[Notice] NC ${nc.nc_number} Logged - ${risk.toUpperCase()} Risk`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E40AF; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: #1E40AF;">New Non-Conformance Notice</h2>
          <p>A non-conformance has been logged and classified. Please be aware.</p>
          
          <div style="background: ${risk === 'major' ? '#FEF2F2' : '#FFFBEB'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${risk === 'major' ? '#DC2626' : '#D97706'}; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">Risk Classification: ${risk.toUpperCase()}</p>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr><td style="color: #666; padding: 5px 0;">NC Number:</td><td style="font-weight: bold;">${nc.nc_number}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Category:</td><td>${nc.category}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Due Date:</td><td>${nc.due_date}</td></tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            You will be notified when the responsible person submits their corrective action for your review.
          </p>
        </div>
      </div>
    `,
  }),

  response_submitted: (nc: any) => ({
    subject: `[Action Required] NC ${nc.nc_number} - Review Corrective Action`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E40AF; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: #1E40AF;">Corrective Action Submitted for Review</h2>
          <p>A corrective action has been submitted and requires your review.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>NC Number:</strong> ${nc.nc_number}</p>
            <p><strong>Description:</strong> ${nc.description}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: #1E40AF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review & Approve/Decline
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  nc_approved: (nc: any) => ({
    subject: `[Closed] NC ${nc.nc_number} - Approved & Closed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #f0fdf4;">
          <h2 style="color: #059669;">✓ Non-Conformance Approved & Closed</h2>
          <p>The corrective action for this NC has been approved. The NC is now closed.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>NC Number:</strong> ${nc.nc_number}</p>
            <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">CLOSED</span></p>
          </div>
          
          <p style="color: #666;">Thank you for your prompt attention to this matter.</p>
        </div>
      </div>
    `,
  }),

  nc_declined: (nc: any, comments: string) => ({
    subject: `[Action Required] NC ${nc.nc_number} - Declined, Rework Needed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #DC2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: #fef2f2;">
          <h2 style="color: #DC2626;">Corrective Action Declined</h2>
          <p>Your corrective action submission has been declined and requires rework.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <p><strong>Manager Feedback:</strong></p>
            <p>${comments}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Submit Revised Response
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  nc_rejected_final: (nc: any) => ({
    subject: `[ESCALATION] NC ${nc.nc_number} - Rejected, Manual Intervention Required`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #7C3AED; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard - ESCALATION</h1>
        </div>
        <div style="padding: 20px; background: #f5f3ff;">
          <h2 style="color: #7C3AED;">⚠️ NC Rejected - Manual Intervention Required</h2>
          <p>This NC has been declined twice and requires manual intervention from QA or Admin.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>NC Number:</strong> ${nc.nc_number}</p>
            <p><strong>Status:</strong> <span style="color: #DC2626; font-weight: bold;">REJECTED</span></p>
          </div>
          
          <p style="color: #666;">Please review the NC history and determine the appropriate course of action.</p>
        </div>
      </div>
    `,
  }),

  nc_escalated: (nc: any, declineCount: number) => ({
    subject: `[ESCALATION] NC ${nc.nc_number} - ${declineCount} Declines, Admin Review Required`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #7C3AED; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard - ESCALATION</h1>
        </div>
        <div style="padding: 20px; background: #f5f3ff;">
          <h2 style="color: #7C3AED;">⚠️ NC Escalated — Multiple Declines</h2>
          <p>This NC has been declined <strong>${declineCount} times</strong> and has been escalated for administrator review. The NC remains active in the approve/decline cycle.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>NC Number:</strong> ${nc.nc_number}</p>
            <p><strong>Description:</strong> ${nc.description}</p>
            <p><strong>Decline Count:</strong> <span style="color: #DC2626; font-weight: bold;">${declineCount}</span></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review Escalated NC
            </a>
          </div>
          
          <p style="color: #666;">Please review the NC history and facilitate resolution.</p>
        </div>
      </div>
    `,
  }),

  reminder: (nc: any, daysOverdue: number) => ({
    subject: `[Reminder] NC ${nc.nc_number} - ${daysOverdue > 0 ? `${daysOverdue} Days OVERDUE` : 'Action Required'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${daysOverdue > 0 ? '#DC2626' : '#D97706'}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">QMS Guard</h1>
        </div>
        <div style="padding: 20px; background: ${daysOverdue > 0 ? '#fef2f2' : '#fffbeb'};">
          <h2 style="color: ${daysOverdue > 0 ? '#DC2626' : '#D97706'};">
            ${daysOverdue > 0 ? '⚠️ OVERDUE' : '⏰ Reminder'}: Action Required
          </h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr><td style="color: #666; padding: 5px 0;">NC Number:</td><td style="font-weight: bold;">${nc.nc_number}</td></tr>
              <tr><td style="color: #666; padding: 5px 0;">Due Date:</td><td style="font-weight: bold; color: ${daysOverdue > 0 ? '#DC2626' : 'inherit'};">${nc.due_date}</td></tr>
              ${daysOverdue > 0 ? `<tr><td style="color: #666; padding: 5px 0;">Days Overdue:</td><td style="font-weight: bold; color: #DC2626;">${daysOverdue}</td></tr>` : ''}
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('FRONTEND_URL') || 'https://qms-guard.lovable.app'}/nc/${nc.id}" 
               style="background: ${daysOverdue > 0 ? '#DC2626' : '#D97706'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Take Action Now
            </a>
          </div>
        </div>
      </div>
    `,
  }),
};

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'QMS Guard <noreply@qms-guard.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return { success: false, error };
    }

    const data = await response.json();
    console.log('Email sent successfully:', data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}

async function getEmailForUser(supabase: any, userId: string): Promise<string | null> {
  // Get email from auth.users via a lookup
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    console.error('Failed to get user email:', error);
    return null;
  }
  return data.user.email;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, nc_id, risk_classification, decline_comments, decline_count } = await req.json();

    console.log('Processing notification:', { type, nc_id });

    // Fetch NC details
    const { data: nc, error: ncError } = await supabase
      .from('non_conformances')
      .select(`
        *,
        reporter:reported_by(id, full_name),
        responsible:responsible_person(id, full_name),
        department:department_id(name, manager_id)
      `)
      .eq('id', nc_id)
      .single();

    if (ncError || !nc) {
      throw new Error(`NC not found: ${ncError?.message}`);
    }

    const notifications: { to: string; template: { subject: string; html: string } }[] = [];

    switch (type) {
      case 'qa_classified': {
        // Notify responsible person
        const rpEmail = await getEmailForUser(supabase, nc.responsible_person);
        if (rpEmail) {
          notifications.push({
            to: rpEmail,
            template: emailTemplates.qa_classified(nc, risk_classification),
          });
        }

        // Notify training manager if high risk
        if (risk_classification === 'major' || risk_classification === 'minor') {
          if (nc.department?.manager_id) {
            const managerEmail = await getEmailForUser(supabase, nc.department.manager_id);
            if (managerEmail) {
              notifications.push({
                to: managerEmail,
                template: emailTemplates.manager_notice(nc, risk_classification),
              });
            }
          }
        }
        break;
      }

      case 'response_submitted':
      case 'rework_submitted': {
        // Notify training manager
        if (nc.department?.manager_id) {
          const managerEmail = await getEmailForUser(supabase, nc.department.manager_id);
          if (managerEmail) {
            notifications.push({
              to: managerEmail,
              template: emailTemplates.response_submitted(nc),
            });
          }
        }
        break;
      }

      case 'nc_approved': {
        // Notify responsible person, initiator, and QA
        const recipients = [nc.responsible_person, nc.reported_by];
        for (const userId of recipients) {
          const email = await getEmailForUser(supabase, userId);
          if (email) {
            notifications.push({
              to: email,
              template: emailTemplates.nc_approved(nc),
            });
          }
        }
        break;
      }

      case 'nc_declined': {
        // Notify responsible person
        const rpEmail = await getEmailForUser(supabase, nc.responsible_person);
        if (rpEmail) {
          notifications.push({
            to: rpEmail,
            template: emailTemplates.nc_declined(nc, decline_comments || 'Please review and resubmit.'),
          });
        }
        break;
      }

      case 'nc_rejected_final':
      case 'nc_escalated': {
        // Notify all super_admin and site_admin users in the tenant
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['super_admin', 'site_admin']);

        const template = type === 'nc_escalated'
          ? emailTemplates.nc_escalated(nc, decline_count || 3)
          : emailTemplates.nc_rejected_final(nc);

        for (const admin of admins || []) {
          const email = await getEmailForUser(supabase, admin.user_id);
          if (email) {
            notifications.push({ to: email, template });
          }
        }
        break;
      }
    }

    // Send all notifications
    const results = await Promise.all(
      notifications.map(n => sendEmail(n.to, n.template.subject, n.template.html))
    );

    console.log('Notification results:', results);

    return new Response(
      JSON.stringify({ success: true, sent: results.filter(r => r.success).length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Notification error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
