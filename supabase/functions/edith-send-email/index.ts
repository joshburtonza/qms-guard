import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'nc_reminder' | 'nc_escalation' | 'bulk_reminder' | 'approval_needed' | 'nc_created';
  ncIds?: string[];
  recipientIds?: string[];
  customMessage?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }
    const supabaseUser = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile and tenant
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("*, tenants(name, support_email)")
      .eq("id", user.id)
      .single();

    const resend = new Resend(RESEND_API_KEY);
    const { type, ncIds, recipientIds, customMessage }: EmailRequest = await req.json();

    console.log(`Processing email request: ${type}`, { ncIds, recipientIds });

    let emailsSent = 0;
    let errors: string[] = [];

    switch (type) {
      case 'nc_reminder':
      case 'nc_escalation': {
        if (!ncIds || ncIds.length === 0) {
          throw new Error("NC IDs required for reminder emails");
        }

        // Get NCs with responsible person details
        const { data: ncs, error: ncError } = await supabaseAdmin
          .from("non_conformances")
          .select(`
            nc_number, description, due_date, severity, status,
            responsible:profiles!non_conformances_responsible_person_fkey(id, full_name)
          `)
          .in("id", ncIds);

        if (ncError) throw ncError;

        // Group NCs by responsible person
        const ncsByPerson = new Map<string, typeof ncs>();
        for (const nc of ncs || []) {
          const personId = (nc.responsible as any)?.id;
          if (personId) {
            const existing = ncsByPerson.get(personId) || [];
            existing.push(nc);
            ncsByPerson.set(personId, existing);
          }
        }

        // Get email addresses from auth.users
        for (const [personId, personNcs] of ncsByPerson) {
          try {
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(personId);
            const email = userData?.user?.email;
            const name = (personNcs[0].responsible as any)?.full_name || 'Team Member';

            if (!email) {
              errors.push(`No email found for user ${personId}`);
              continue;
            }

            const isEscalation = type === 'nc_escalation';
            const subject = isEscalation 
              ? `⚠️ ESCALATION: ${personNcs.length} Overdue NC(s) Require Immediate Attention`
              : `Reminder: ${personNcs.length} NC(s) Require Your Attention`;

            const ncList = personNcs.map(nc => {
              const daysOverdue = Math.floor((Date.now() - new Date(nc.due_date).getTime()) / (1000 * 60 * 60 * 24));
              return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${nc.nc_number}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${(nc.description as string)?.substring(0, 60)}...</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${nc.severity}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; ${daysOverdue > 0 ? 'color: #dc2626; font-weight: bold;' : ''}">
                    ${daysOverdue > 0 ? `${daysOverdue} days overdue` : `Due ${nc.due_date}`}
                  </td>
                </tr>
              `;
            }).join('');

            const html = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${isEscalation ? '#dc2626' : '#3b82f6'}; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px;">QMS Guard</h1>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">${profile?.tenants?.name || 'Quality Management System'}</p>
                </div>
                
                <div style="padding: 20px; background: #f9fafb;">
                  <p>Hi ${name},</p>
                  
                  ${isEscalation 
                    ? `<p style="color: #dc2626; font-weight: bold;">This is an escalation notice. The following NC(s) are overdue and require immediate action:</p>`
                    : `<p>This is a friendly reminder that you have ${personNcs.length} non-conformance(s) requiring your attention:</p>`
                  }
                  
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                      <tr style="background: #f3f4f6;">
                        <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">NC #</th>
                        <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
                        <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Severity</th>
                        <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ncList}
                    </tbody>
                  </table>
                  
                  ${customMessage ? `<p><strong>Message from ${profile?.full_name}:</strong> ${customMessage}</p>` : ''}
                  
                  <p>Please log into QMS Guard to review and address these items.</p>
                  
                  <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    This is an automated message from QMS Guard. Please do not reply to this email.
                  </p>
                </div>
              </div>
            `;

            const { error: sendError } = await resend.emails.send({
              from: `QMS Guard <noreply@resend.dev>`,
              to: [email],
              subject,
              html,
            });

            if (sendError) {
              errors.push(`Failed to send to ${email}: ${sendError.message}`);
            } else {
              emailsSent++;
              console.log(`Email sent to ${email}`);
            }
          } catch (e) {
            errors.push(`Error processing user ${personId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
        break;
      }

      case 'nc_created': {
        if (!ncIds || ncIds.length === 0) {
          throw new Error("NC ID required");
        }

        // Get NC details
        const { data: nc } = await supabaseAdmin
          .from("non_conformances")
          .select(`
            nc_number, description, due_date, severity, category,
            responsible:profiles!non_conformances_responsible_person_fkey(id, full_name),
            reporter:profiles!non_conformances_reported_by_fkey(full_name)
          `)
          .eq("id", ncIds[0])
          .single();

        if (!nc) throw new Error("NC not found");

        const personId = (nc.responsible as any)?.id;
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(personId);
        const email = userData?.user?.email;

        if (email) {
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #3b82f6; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">QMS Guard</h1>
              </div>
              
              <div style="padding: 20px; background: #f9fafb;">
                <p>Hi ${(nc.responsible as any)?.full_name},</p>
                
                <p>A new non-conformance has been assigned to you:</p>
                
                <div style="background: white; border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; border-radius: 8px;">
                  <p><strong>NC Number:</strong> ${nc.nc_number}</p>
                  <p><strong>Severity:</strong> <span style="color: ${nc.severity === 'critical' ? '#dc2626' : nc.severity === 'major' ? '#ea580c' : '#65a30d'}">${nc.severity?.toUpperCase()}</span></p>
                  <p><strong>Category:</strong> ${(nc.category as string)?.replace(/_/g, ' ')}</p>
                  <p><strong>Due Date:</strong> ${nc.due_date}</p>
                  <p><strong>Reported By:</strong> ${(nc.reporter as any)?.full_name}</p>
                  <p><strong>Description:</strong></p>
                  <p style="background: #f3f4f6; padding: 10px; border-radius: 4px;">${nc.description}</p>
                </div>
                
                <p>Please log into QMS Guard to review and take action on this NC.</p>
              </div>
            </div>
          `;

          const { error: sendError } = await resend.emails.send({
            from: `QMS Guard <noreply@resend.dev>`,
            to: [email],
            subject: `New NC Assigned: ${nc.nc_number} (${nc.severity?.toUpperCase()})`,
            html,
          });

          if (sendError) {
            errors.push(sendError.message);
          } else {
            emailsSent++;
          }
        }
        break;
      }

      case 'approval_needed': {
        // Get managers/approvers for pending NCs
        // This would need role-based lookup
        break;
      }

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    // Log the action
    await supabaseUser.from("edith_actions").insert({
      tenant_id: profile?.tenant_id,
      user_id: user.id,
      action_type: "email",
      action_details: { type, ncIds, emailsSent, errors },
      success: errors.length === 0,
      error_message: errors.length > 0 ? errors.join("; ") : null,
    });

    return new Response(JSON.stringify({
      success: true,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to send emails",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
