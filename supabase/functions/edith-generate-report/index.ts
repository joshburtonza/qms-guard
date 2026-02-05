import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  type: 'nc_summary' | 'iso_compliance' | 'overdue_report' | 'audit_prep' | 'performance';
  dateFrom?: string;
  dateTo?: string;
  format?: 'json' | 'csv' | 'html';
  filters?: {
    severity?: string;
    status?: string;
    department?: string;
    responsiblePerson?: string;
  };
  isoClause?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Get auth
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

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("*, tenants(name)")
      .eq("id", user.id)
      .single();

    const request: ReportRequest = await req.json();
    const format = request.format || 'json';
    const dateFrom = request.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = request.dateTo || new Date().toISOString();

    console.log(`Generating ${request.type} report`, { dateFrom, dateTo, format });

    let reportData: any = {};

    switch (request.type) {
      case 'nc_summary': {
        // Get all NCs in date range
        let query = supabaseUser
          .from("non_conformances")
          .select(`
            id, nc_number, description, status, severity, category, due_date, created_at, closed_at,
            responsible:profiles!non_conformances_responsible_person_fkey(full_name),
            department:departments(name)
          `)
          .gte("created_at", dateFrom)
          .lte("created_at", dateTo)
          .order("created_at", { ascending: false });

        if (request.filters?.severity) query = query.eq("severity", request.filters.severity);
        if (request.filters?.status) query = query.eq("status", request.filters.status);

        const { data: ncs, error } = await query;
        if (error) throw error;

        // Calculate statistics
        const stats = {
          total: ncs?.length || 0,
          byStatus: {} as Record<string, number>,
          bySeverity: {} as Record<string, number>,
          byCategory: {} as Record<string, number>,
          byDepartment: {} as Record<string, number>,
          overdue: 0,
          avgClosureTimeDays: 0,
          closedCount: 0,
        };

        let totalClosureTime = 0;
        const today = new Date();

        for (const nc of ncs || []) {
          // By status
          stats.byStatus[nc.status] = (stats.byStatus[nc.status] || 0) + 1;
          
          // By severity
          stats.bySeverity[nc.severity] = (stats.bySeverity[nc.severity] || 0) + 1;
          
          // By category
          stats.byCategory[nc.category] = (stats.byCategory[nc.category] || 0) + 1;
          
          // By department
          const deptName = (nc.department as any)?.name || 'Unassigned';
          stats.byDepartment[deptName] = (stats.byDepartment[deptName] || 0) + 1;
          
          // Overdue
          if (new Date(nc.due_date) < today && nc.status !== 'closed') {
            stats.overdue++;
          }
          
          // Closure time
          if (nc.status === 'closed' && nc.closed_at) {
            stats.closedCount++;
            totalClosureTime += new Date(nc.closed_at).getTime() - new Date(nc.created_at).getTime();
          }
        }

        if (stats.closedCount > 0) {
          stats.avgClosureTimeDays = Math.round(totalClosureTime / stats.closedCount / (1000 * 60 * 60 * 24) * 10) / 10;
        }

        reportData = {
          title: "NC Summary Report",
          tenant: profile?.tenants?.name,
          generatedAt: new Date().toISOString(),
          period: { from: dateFrom, to: dateTo },
          statistics: stats,
          ncs: ncs?.map(nc => ({
            ncNumber: nc.nc_number,
            description: nc.description?.substring(0, 100),
            status: nc.status,
            severity: nc.severity,
            category: nc.category,
            responsible: (nc.responsible as any)?.full_name,
            department: (nc.department as any)?.name,
            dueDate: nc.due_date,
            createdAt: nc.created_at,
            closedAt: nc.closed_at,
            daysOpen: nc.closed_at 
              ? Math.round((new Date(nc.closed_at).getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24))
              : Math.round((today.getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          })),
        };
        break;
      }

      case 'iso_compliance': {
        // Get ISO clauses
        const { data: clauses } = await supabaseUser
          .from("edith_iso_knowledge")
          .select("clause_number, clause_title, is_mandatory, evidence_required, common_nonconformities")
          .order("clause_number");

        // Get NCs for compliance check
        const { data: ncs } = await supabaseUser
          .from("non_conformances")
          .select("id, nc_number, status, severity, created_at, closed_at, corrective_actions(id)")
          .gte("created_at", dateFrom)
          .lte("created_at", dateTo);

        const compliance = {
          totalNCs: ncs?.length || 0,
          withCorrectiveActions: ncs?.filter(nc => (nc.corrective_actions as any[])?.length > 0).length || 0,
          closedWithinTarget: 0,
          clauses: [] as any[],
        };

        // Calculate on-time closure
        for (const nc of ncs || []) {
          if (nc.status === 'closed' && nc.closed_at) {
            // Check if closed within typical target (30 days)
            const daysToClose = (new Date(nc.closed_at).getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysToClose <= 30) compliance.closedWithinTarget++;
          }
        }

        compliance.clauses = (clauses || []).map(clause => ({
          number: clause.clause_number,
          title: clause.clause_title,
          mandatory: clause.is_mandatory,
          evidenceRequired: clause.evidence_required,
          status: 'review_needed', // Would need real assessment data
        }));

        reportData = {
          title: "ISO 9001:2015 Compliance Report",
          tenant: profile?.tenants?.name,
          generatedAt: new Date().toISOString(),
          period: { from: dateFrom, to: dateTo },
          compliance,
          summary: {
            correctiveActionRate: compliance.totalNCs > 0 
              ? Math.round(compliance.withCorrectiveActions / compliance.totalNCs * 100) 
              : 100,
            onTimeClosureRate: compliance.totalNCs > 0
              ? Math.round(compliance.closedWithinTarget / compliance.totalNCs * 100)
              : 100,
          },
        };
        break;
      }

      case 'overdue_report': {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: overdueNCs } = await supabaseUser
          .from("non_conformances")
          .select(`
            id, nc_number, description, status, severity, category, due_date, created_at,
            responsible:profiles!non_conformances_responsible_person_fkey(id, full_name),
            department:departments(name)
          `)
          .lt("due_date", today)
          .not("status", "eq", "closed")
          .order("due_date", { ascending: true });

        // Group by responsible person
        const byPerson = new Map<string, typeof overdueNCs>();
        for (const nc of overdueNCs || []) {
          const personName = (nc.responsible as any)?.full_name || 'Unassigned';
          const existing = byPerson.get(personName) || [];
          existing.push(nc);
          byPerson.set(personName, existing);
        }

        reportData = {
          title: "Overdue NCs Report",
          tenant: profile?.tenants?.name,
          generatedAt: new Date().toISOString(),
          totalOverdue: overdueNCs?.length || 0,
          byPerson: Array.from(byPerson.entries()).map(([name, personNcs]) => ({
            responsiblePerson: name,
            count: personNcs?.length || 0,
            ncs: (personNcs || []).map(nc => ({
              ncNumber: nc.nc_number,
              description: nc.description?.substring(0, 80),
              severity: nc.severity,
              dueDate: nc.due_date,
              daysOverdue: Math.floor((Date.now() - new Date(nc.due_date).getTime()) / (1000 * 60 * 60 * 24)),
            })),
          })).sort((a, b) => b.count - a.count),
        };
        break;
      }

      case 'performance': {
        // Get all NCs
        const { data: ncs } = await supabaseUser
          .from("non_conformances")
          .select(`
            id, nc_number, status, severity, due_date, created_at, closed_at,
            responsible:profiles!non_conformances_responsible_person_fkey(id, full_name),
            department:departments(name)
          `)
          .gte("created_at", dateFrom)
          .lte("created_at", dateTo);

        // Calculate performance by person
        const performanceByPerson = new Map<string, {
          name: string;
          total: number;
          closed: number;
          overdue: number;
          avgClosureDays: number;
          totalClosureDays: number;
        }>();

        const today = new Date();

        for (const nc of ncs || []) {
          const personName = (nc.responsible as any)?.full_name || 'Unassigned';
          const personId = (nc.responsible as any)?.id || 'unknown';
          
          if (!performanceByPerson.has(personId)) {
            performanceByPerson.set(personId, {
              name: personName,
              total: 0,
              closed: 0,
              overdue: 0,
              avgClosureDays: 0,
              totalClosureDays: 0,
            });
          }

          const perf = performanceByPerson.get(personId)!;
          perf.total++;

          if (nc.status === 'closed') {
            perf.closed++;
            if (nc.closed_at) {
              perf.totalClosureDays += (new Date(nc.closed_at).getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24);
            }
          }

          if (new Date(nc.due_date) < today && nc.status !== 'closed') {
            perf.overdue++;
          }
        }

        // Calculate averages
        for (const perf of performanceByPerson.values()) {
          if (perf.closed > 0) {
            perf.avgClosureDays = Math.round(perf.totalClosureDays / perf.closed * 10) / 10;
          }
        }

        reportData = {
          title: "NC Performance Report",
          tenant: profile?.tenants?.name,
          generatedAt: new Date().toISOString(),
          period: { from: dateFrom, to: dateTo },
          totalNCs: ncs?.length || 0,
          performance: Array.from(performanceByPerson.values())
            .sort((a, b) => b.total - a.total)
            .map(p => ({
              ...p,
              closureRate: p.total > 0 ? Math.round(p.closed / p.total * 100) : 0,
              overdueRate: p.total > 0 ? Math.round(p.overdue / p.total * 100) : 0,
            })),
        };
        break;
      }

      case 'audit_prep': {
        // Get ISO clause with audit questions
        const { data: clauses } = await supabaseUser
          .from("edith_iso_knowledge")
          .select("*")
          .order("clause_number");

        // Get recent NCs for evidence
        const { data: recentNCs } = await supabaseUser
          .from("non_conformances")
          .select(`
            nc_number, status, severity, category, created_at,
            corrective_actions(id, root_cause, corrective_action)
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        reportData = {
          title: "Audit Preparation Package",
          tenant: profile?.tenants?.name,
          generatedAt: new Date().toISOString(),
          clauses: (clauses || []).map(c => ({
            number: c.clause_number,
            title: c.clause_title,
            requirements: c.requirement_text,
            auditQuestions: c.audit_questions,
            evidenceRequired: c.evidence_required,
            commonNonconformities: c.common_nonconformities,
          })),
          recentNCsAsEvidence: recentNCs?.map(nc => ({
            ncNumber: nc.nc_number,
            status: nc.status,
            hasCorrectiveAction: (nc.corrective_actions as any[])?.length > 0,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown report type: ${request.type}`);
    }

    // Format response
    if (format === 'csv' && reportData.ncs) {
      // Convert to CSV
      const headers = Object.keys(reportData.ncs[0] || {}).join(',');
      const rows = reportData.ncs.map((row: any) => 
        Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      return new Response(`${headers}\n${rows}`, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${request.type}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (format === 'html') {
      // Return HTML formatted report
      const html = generateHTMLReport(reportData);
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html",
        },
      });
    }

    // Log action
    await supabaseUser.from("edith_actions").insert({
      tenant_id: profile?.tenant_id,
      user_id: user.id,
      action_type: "report",
      action_details: { type: request.type, format, dateFrom, dateTo },
      success: true,
    });

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to generate report",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateHTMLReport(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${data.title}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #1e40af; }
        .stat-label { color: #6b7280; font-size: 12px; margin-top: 5px; }
        .severity-critical { color: #dc2626; font-weight: bold; }
        .severity-major { color: #ea580c; }
        .severity-minor { color: #65a30d; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${data.title}</h1>
      <div class="meta">
        <p><strong>Organization:</strong> ${data.tenant || 'N/A'}</p>
        <p><strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()}</p>
        ${data.period ? `<p><strong>Period:</strong> ${data.period.from?.split('T')[0]} to ${data.period.to?.split('T')[0]}</p>` : ''}
      </div>
      
      ${data.statistics ? `
        <h2>Summary Statistics</h2>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">${data.statistics.total}</div>
            <div class="stat-label">Total NCs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.statistics.overdue}</div>
            <div class="stat-label">Overdue</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.statistics.avgClosureTimeDays}</div>
            <div class="stat-label">Avg Days to Close</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.statistics.closedCount}</div>
            <div class="stat-label">Closed</div>
          </div>
        </div>
      ` : ''}
      
      ${data.summary ? `
        <h2>Compliance Summary</h2>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">${data.summary.correctiveActionRate}%</div>
            <div class="stat-label">Corrective Action Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.summary.onTimeClosureRate}%</div>
            <div class="stat-label">On-Time Closure Rate</div>
          </div>
        </div>
      ` : ''}
      
      ${data.ncs ? `
        <h2>Non-Conformances (${data.ncs.length})</h2>
        <table>
          <thead>
            <tr>
              <th>NC #</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Category</th>
              <th>Responsible</th>
              <th>Due Date</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            ${data.ncs.slice(0, 50).map((nc: any) => `
              <tr>
                <td>${nc.ncNumber}</td>
                <td class="severity-${nc.severity}">${nc.severity}</td>
                <td>${nc.status}</td>
                <td>${nc.category?.replace(/_/g, ' ')}</td>
                <td>${nc.responsible || 'Unassigned'}</td>
                <td>${nc.dueDate}</td>
                <td>${nc.daysOpen}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${data.ncs.length > 50 ? `<p><em>Showing first 50 of ${data.ncs.length} records</em></p>` : ''}
      ` : ''}
      
      ${data.byPerson ? `
        <h2>Overdue by Person</h2>
        ${data.byPerson.map((p: any) => `
          <h3>${p.responsiblePerson} (${p.count} overdue)</h3>
          <table>
            <thead>
              <tr><th>NC #</th><th>Severity</th><th>Due Date</th><th>Days Overdue</th></tr>
            </thead>
            <tbody>
              ${p.ncs.map((nc: any) => `
                <tr>
                  <td>${nc.ncNumber}</td>
                  <td class="severity-${nc.severity}">${nc.severity}</td>
                  <td>${nc.dueDate}</td>
                  <td style="color: #dc2626; font-weight: bold;">${nc.daysOverdue}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}
      ` : ''}
      
      ${data.performance ? `
        <h2>Performance by Person</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Total</th>
              <th>Closed</th>
              <th>Overdue</th>
              <th>Closure Rate</th>
              <th>Avg Days</th>
            </tr>
          </thead>
          <tbody>
            ${data.performance.map((p: any) => `
              <tr>
                <td>${p.name}</td>
                <td>${p.total}</td>
                <td>${p.closed}</td>
                <td>${p.overdue}</td>
                <td>${p.closureRate}%</td>
                <td>${p.avgClosureDays}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>Generated by QMS Guard - Powered by Edith AI</p>
      </footer>
    </body>
    </html>
  `;
}
