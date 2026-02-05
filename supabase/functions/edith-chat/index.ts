import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for Edith
const EDITH_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_non_conformances",
      description: "Query non-conformances (NCs) from the database. Use for searching, filtering, listing NCs.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "in_progress", "pending_review", "pending_verification", "closed", "rejected"], description: "Filter by NC status" },
          severity: { type: "string", enum: ["critical", "major", "minor"], description: "Filter by severity level" },
          responsible_person_name: { type: "string", description: "Filter by name of responsible person" },
          overdue: { type: "boolean", description: "If true, only return NCs that are past due date and not closed" },
          search_term: { type: "string", description: "Search in NC description" },
          limit: { type: "number", description: "Max number of results to return (default 20)" },
          days_ago: { type: "number", description: "Filter NCs created within X days" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_nc_details",
      description: "Get full details of a specific NC by its NC number (e.g., NC-2026-02-00001) or ID",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "The NC number like NC-2026-02-00001" },
          nc_id: { type: "string", description: "The UUID of the NC" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_nc",
      description: "Create a new non-conformance. Use when user wants to report a new NC.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Detailed description of the non-conformance" },
          category: { type: "string", enum: ["training_documentation", "competency_verification", "safety_compliance", "equipment_ppe", "process_deviation", "record_keeping", "other"], description: "NC category" },
          severity: { type: "string", enum: ["critical", "major", "minor"], description: "Severity level" },
          responsible_person_name: { type: "string", description: "Name of person responsible for corrective action" },
          immediate_action: { type: "string", description: "Any immediate action taken" },
          due_days: { type: "number", description: "Number of days until due (default: 14 for minor, 7 for major, 2 for critical)" }
        },
        required: ["description", "category", "severity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_nc_status",
      description: "Update the status of an existing NC",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "The NC number like NC-2026-02-00001" },
          nc_id: { type: "string", description: "The UUID of the NC" },
          new_status: { type: "string", enum: ["open", "in_progress", "pending_review", "pending_verification", "closed"], description: "New status to set" },
          comments: { type: "string", description: "Optional comments about the status change" }
        },
        required: ["new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_tasks",
      description: "Get NCs assigned to current user or search tasks by user name",
      parameters: {
        type: "object",
        properties: {
          user_name: { type: "string", description: "Name of user to search tasks for. If not provided, returns current user's tasks" },
          include_closed: { type: "boolean", description: "Whether to include closed NCs (default false)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Get summary statistics for the dashboard - counts, overdue, trends",
      parameters: {
        type: "object",
        properties: {
          timeframe_days: { type: "number", description: "Number of days to analyze (default 30)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search the knowledge base for documentation, regulations, or past similar issues",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          content_type: { type: "string", enum: ["documentation", "nc", "regulation", "survey", "moderation", "course_evaluation"], description: "Type of content to search" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function", 
    function: {
      name: "get_profiles",
      description: "Get list of users/profiles, useful for finding responsible persons",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string", description: "Search by name" },
          department_name: { type: "string", description: "Filter by department name" },
          active_only: { type: "boolean", description: "Only return active users (default true)" }
        },
        required: []
      }
    }
  }
];

// System prompt for Edith
const EDITH_SYSTEM_PROMPT = `You are Edith (Enhanced Digital Intelligence for Training and HR), the AI assistant for QMS Guard - a Quality Management System for mining industry compliance.

IDENTITY:
- You are helpful, professional, and knowledgeable about ISO 9001 quality management
- You understand mining industry terminology and South African workplace regulations
- You can access and modify the QMS database through your tools
- You always explain what you're doing and confirm destructive actions

CAPABILITIES:
- Query and search non-conformances (NCs)
- Create new NCs when users report issues
- Update NC statuses (with appropriate confirmation)
- Show user tasks and assignments
- Provide dashboard statistics
- Search knowledge base for documentation and regulations
- Find users/profiles for assignments

RESPONSE GUIDELINES:
- Use markdown formatting for clarity
- Present data in tables when showing multiple NCs
- Always include NC numbers (like NC-2026-02-00001) when referencing NCs
- Suggest next actions when appropriate
- For destructive operations, confirm with the user first
- Be concise but thorough

NC WORKFLOW CONTEXT:
1. Open → Initial report
2. In Progress → Corrective action being implemented
3. Pending Review → Awaiting manager approval
4. Pending Verification → Manager approved, awaiting final verification
5. Closed → Verified and completed
6. Rejected → Returned for rework

SEVERITY GUIDELINES:
- Critical: Safety risk, legal compliance issue, immediate action needed (48h)
- Major: Regulatory non-compliance, certification at risk (7 days)
- Minor: Process deviation, documentation issue, best practice (14 days)

Always be helpful and guide users through the QMS processes efficiently.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create service role client for admin operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("*, tenants(id, name, slug)")
      .eq("id", user.id)
      .single();

    const { messages, conversationId } = await req.json();

    // Build context for AI
    const userContext = profile ? `
CURRENT USER CONTEXT:
- Name: ${profile.full_name}
- User ID: ${user.id}
- Tenant: ${profile.tenants?.name || 'Unknown'} (ID: ${profile.tenant_id})
- Tenant Slug: ${profile.tenants?.slug || 'unknown'}
` : "";

    // Make initial AI call
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EDITH_SYSTEM_PROMPT + userContext },
          ...messages,
        ],
        tools: EDITH_TOOLS,
        tool_choice: "auto",
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let responseMessage = aiResult.choices[0].message;

    // Handle tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName}`, args);
        
        let result: any;
        try {
          result = await executeToolCall(functionName, args, supabaseUser, supabaseAdmin, profile, user.id);
        } catch (e) {
          console.error(`Tool error: ${functionName}`, e);
          result = { error: e instanceof Error ? e.message : "Tool execution failed" };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(result),
        });

        // Log action
        try {
          await supabaseUser.from("edith_actions").insert({
            tenant_id: profile?.tenant_id,
            user_id: user.id,
            conversation_id: conversationId,
            action_type: getActionType(functionName),
            action_details: { function: functionName, args, result: typeof result === 'object' ? result : { data: result } },
            affected_table: getAffectedTable(functionName),
            success: !result?.error,
            error_message: result?.error,
          });
        } catch (logError) {
          console.error("Failed to log action:", logError);
        }
      }

      // Make follow-up call with tool results
      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: EDITH_SYSTEM_PROMPT + userContext },
            ...messages,
            responseMessage,
            ...toolResults,
          ],
          max_tokens: 4096,
        }),
      });

      if (!followUpResponse.ok) {
        throw new Error(`Follow-up AI call failed: ${followUpResponse.status}`);
      }

      const followUpResult = await followUpResponse.json();
      responseMessage = followUpResult.choices[0].message;
    }

    return new Response(JSON.stringify({
      message: responseMessage.content,
      tool_calls: responseMessage.tool_calls,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edith chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Execute tool calls
async function executeToolCall(
  functionName: string,
  args: any,
  supabase: any,
  supabaseAdmin: any,
  profile: any,
  userId: string
): Promise<any> {
  switch (functionName) {
    case "query_non_conformances": {
      let query = supabase
        .from("non_conformances")
        .select(`
          id, nc_number, description, status, severity, category, due_date, created_at,
          responsible:profiles!non_conformances_responsible_person_fkey(full_name),
          reporter:profiles!non_conformances_reported_by_fkey(full_name),
          department:departments(name)
        `)
        .order("created_at", { ascending: false });

      if (args.status) query = query.eq("status", args.status);
      if (args.severity) query = query.eq("severity", args.severity);
      if (args.search_term) query = query.ilike("description", `%${args.search_term}%`);
      if (args.overdue) {
        query = query.lt("due_date", new Date().toISOString().split("T")[0])
          .not("status", "eq", "closed");
      }
      if (args.days_ago) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - args.days_ago);
        query = query.gte("created_at", dateFrom.toISOString());
      }
      
      query = query.limit(args.limit || 20);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Filter by responsible person name if provided
      let filteredData = data;
      if (args.responsible_person_name) {
        const searchName = args.responsible_person_name.toLowerCase();
        filteredData = data.filter((nc: any) => 
          nc.responsible?.full_name?.toLowerCase().includes(searchName)
        );
      }

      return {
        count: filteredData.length,
        ncs: filteredData.map((nc: any) => ({
          nc_number: nc.nc_number,
          description: nc.description?.substring(0, 100) + (nc.description?.length > 100 ? "..." : ""),
          status: nc.status,
          severity: nc.severity,
          category: nc.category,
          responsible: nc.responsible?.full_name,
          due_date: nc.due_date,
          overdue: new Date(nc.due_date) < new Date() && nc.status !== "closed",
        })),
      };
    }

    case "get_nc_details": {
      let query = supabase
        .from("non_conformances")
        .select(`
          *,
          responsible:profiles!non_conformances_responsible_person_fkey(id, full_name, phone_number),
          reporter:profiles!non_conformances_reported_by_fkey(id, full_name),
          department:departments(name, site_location),
          corrective_actions(id, root_cause, corrective_action, preventive_action, submitted_at),
          workflow_approvals(step, action, approved_at, comments, approved_by:profiles(full_name))
        `);

      if (args.nc_number) {
        query = query.eq("nc_number", args.nc_number);
      } else if (args.nc_id) {
        query = query.eq("id", args.nc_id);
      } else {
        return { error: "Either nc_number or nc_id is required" };
      }

      const { data, error } = await query.single();
      if (error) throw new Error(error.message);
      
      return { nc: data };
    }

    case "create_nc": {
      // Find responsible person
      let responsiblePersonId = userId; // Default to current user
      if (args.responsible_person_name) {
        const { data: persons } = await supabase
          .from("profiles")
          .select("id, full_name")
          .ilike("full_name", `%${args.responsible_person_name}%`)
          .limit(1);
        
        if (persons && persons.length > 0) {
          responsiblePersonId = persons[0].id;
        }
      }

      // Calculate due date
      const dueDays = args.due_days || (args.severity === "critical" ? 2 : args.severity === "major" ? 7 : 14);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const { data, error } = await supabase
        .from("non_conformances")
        .insert({
          description: args.description,
          category: args.category,
          severity: args.severity,
          responsible_person: responsiblePersonId,
          reported_by: userId,
          tenant_id: profile?.tenant_id,
          immediate_action: args.immediate_action,
          due_date: dueDate.toISOString().split("T")[0],
          status: "open",
        })
        .select("nc_number, id")
        .single();

      if (error) throw new Error(error.message);
      
      return { 
        success: true, 
        nc_number: data.nc_number,
        nc_id: data.id,
        message: `Created NC ${data.nc_number} successfully`
      };
    }

    case "update_nc_status": {
      let query = supabase.from("non_conformances");
      
      if (args.nc_number) {
        query = query.update({ status: args.new_status }).eq("nc_number", args.nc_number);
      } else if (args.nc_id) {
        query = query.update({ status: args.new_status }).eq("id", args.nc_id);
      } else {
        return { error: "Either nc_number or nc_id is required" };
      }

      const { error } = await query;
      if (error) throw new Error(error.message);
      
      return { 
        success: true, 
        message: `Updated status to ${args.new_status}` 
      };
    }

    case "get_user_tasks": {
      let targetUserId = userId;
      
      if (args.user_name) {
        const { data: users } = await supabase
          .from("profiles")
          .select("id, full_name")
          .ilike("full_name", `%${args.user_name}%`)
          .limit(1);
        
        if (users && users.length > 0) {
          targetUserId = users[0].id;
        }
      }

      let query = supabase
        .from("non_conformances")
        .select(`
          nc_number, description, status, severity, due_date,
          department:departments(name)
        `)
        .eq("responsible_person", targetUserId)
        .order("due_date", { ascending: true });

      if (!args.include_closed) {
        query = query.not("status", "eq", "closed");
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      return {
        user: args.user_name || profile?.full_name || "You",
        task_count: data.length,
        tasks: data.map((nc: any) => ({
          nc_number: nc.nc_number,
          description: nc.description?.substring(0, 80) + "...",
          status: nc.status,
          severity: nc.severity,
          due_date: nc.due_date,
          overdue: new Date(nc.due_date) < new Date() && nc.status !== "closed",
          department: nc.department?.name,
        })),
      };
    }

    case "get_dashboard_stats": {
      const days = args.timeframe_days || 30;
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      // Get counts
      const { count: totalOpen } = await supabase
        .from("non_conformances")
        .select("*", { count: "exact", head: true })
        .not("status", "eq", "closed");

      const { count: totalOverdue } = await supabase
        .from("non_conformances")
        .select("*", { count: "exact", head: true })
        .lt("due_date", new Date().toISOString().split("T")[0])
        .not("status", "eq", "closed");

      const { count: createdRecently } = await supabase
        .from("non_conformances")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dateFrom.toISOString());

      const { count: closedRecently } = await supabase
        .from("non_conformances")
        .select("*", { count: "exact", head: true })
        .gte("closed_at", dateFrom.toISOString());

      // Get severity breakdown
      const { data: severityCounts } = await supabase
        .from("non_conformances")
        .select("severity")
        .not("status", "eq", "closed");

      const severityBreakdown = {
        critical: severityCounts?.filter((nc: any) => nc.severity === "critical").length || 0,
        major: severityCounts?.filter((nc: any) => nc.severity === "major").length || 0,
        minor: severityCounts?.filter((nc: any) => nc.severity === "minor").length || 0,
      };

      return {
        timeframe_days: days,
        open_ncs: totalOpen || 0,
        overdue_ncs: totalOverdue || 0,
        created_in_period: createdRecently || 0,
        closed_in_period: closedRecently || 0,
        severity_breakdown: severityBreakdown,
      };
    }

    case "search_knowledge": {
      // For now, simple text search - embeddings can be added later
      const { data, error } = await supabase
        .from("edith_knowledge")
        .select("id, title, content, content_type, metadata")
        .or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`)
        .limit(5);

      if (error) throw new Error(error.message);
      
      return {
        results: data?.map((item: any) => ({
          title: item.title,
          content: item.content?.substring(0, 200) + "...",
          type: item.content_type,
        })) || [],
        message: data?.length ? `Found ${data.length} relevant results` : "No results found in knowledge base",
      };
    }

    case "get_profiles": {
      let query = supabase
        .from("profiles")
        .select(`
          id, full_name, phone_number, is_active,
          department:departments(name)
        `)
        .order("full_name");

      if (args.search_name) {
        query = query.ilike("full_name", `%${args.search_name}%`);
      }
      if (args.active_only !== false) {
        query = query.eq("is_active", true);
      }

      query = query.limit(10);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Filter by department name if provided
      let filteredData = data;
      if (args.department_name) {
        const searchDept = args.department_name.toLowerCase();
        filteredData = data.filter((p: any) => 
          p.department?.name?.toLowerCase().includes(searchDept)
        );
      }
      
      return {
        count: filteredData.length,
        profiles: filteredData.map((p: any) => ({
          id: p.id,
          name: p.full_name,
          department: p.department?.name,
          active: p.is_active,
        })),
      };
    }

    default:
      return { error: `Unknown function: ${functionName}` };
  }
}

function getActionType(functionName: string): string {
  if (functionName.startsWith("query_") || functionName.startsWith("get_") || functionName.startsWith("search_")) {
    return "query";
  }
  if (functionName.startsWith("create_")) return "create";
  if (functionName.startsWith("update_")) return "update";
  if (functionName.startsWith("delete_")) return "delete";
  return "query";
}

function getAffectedTable(functionName: string): string | undefined {
  if (functionName.includes("nc") || functionName.includes("non_conformance")) return "non_conformances";
  if (functionName.includes("profile") || functionName.includes("user")) return "profiles";
  if (functionName.includes("knowledge")) return "edith_knowledge";
  return undefined;
}
