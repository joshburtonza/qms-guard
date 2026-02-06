import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== PROVIDER ABSTRACTION ====================

interface AIProvider {
  name: string;
  chat(params: ChatParams): Promise<AIResponse>;
  chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

interface ChatParams {
  model: string;
  messages: Message[];
  tools?: Tool[];
  systemPrompt: string;
  maxTokens?: number;
}

interface Message {
  role: string;
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface AIResponse {
  content: string;
  toolCalls?: any[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface StreamChunk {
  type: 'content' | 'tool_start' | 'tool_complete' | 'done' | 'error';
  content?: string;
  toolName?: string;
  error?: string;
}

// Lovable AI Gateway Provider (default)
class LovableProvider implements AIProvider {
  name = 'lovable';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: params.systemPrompt },
          ...params.messages,
        ],
        tools: params.tools,
        tool_choice: params.tools ? "auto" : undefined,
        max_tokens: params.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lovable AI error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const message = result.choices[0].message;

    return {
      content: message.content || '',
      toolCalls: message.tool_calls,
      usage: result.usage ? {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
      } : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: params.systemPrompt },
          ...params.messages,
        ],
        tools: params.tools,
        tool_choice: params.tools ? "auto" : undefined,
        max_tokens: params.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `Lovable AI error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) {
                  yield { type: 'tool_start', toolName: tc.function.name };
                }
              }
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Lovable gateway pricing (approximate)
    return (inputTokens * 0.000001) + (outputTokens * 0.000002);
  }
}

// Anthropic Claude Provider
class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-20250514",
        max_tokens: params.maxTokens || 4096,
        system: params.systemPrompt,
        messages: params.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        tools: params.tools?.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const textContent = result.content.find((c: any) => c.type === 'text');
    const toolUseContent = result.content.filter((c: any) => c.type === 'tool_use');

    return {
      content: textContent?.text || '',
      toolCalls: toolUseContent.length > 0 ? toolUseContent.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      })) : undefined,
      usage: result.usage ? {
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
      } : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-20250514",
        max_tokens: params.maxTokens || 4096,
        system: params.systemPrompt,
        messages: params.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `Anthropic error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { type: 'content', content: parsed.delta.text };
            }
            if (parsed.type === 'message_stop') {
              yield { type: 'done' };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude Sonnet pricing
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }
}

// OpenAI Provider
class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "gpt-4o",
        messages: [
          { role: "system", content: params.systemPrompt },
          ...params.messages,
        ],
        tools: params.tools,
        tool_choice: params.tools ? "auto" : undefined,
        max_tokens: params.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const message = result.choices[0].message;

    return {
      content: message.content || '',
      toolCalls: message.tool_calls,
      usage: result.usage ? {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
      } : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "gpt-4o",
        messages: [
          { role: "system", content: params.systemPrompt },
          ...params.messages,
        ],
        max_tokens: params.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `OpenAI error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // GPT-4o pricing
    return (inputTokens * 0.000005) + (outputTokens * 0.000015);
  }
}

// Google Gemini Provider
class GoogleProvider implements AIProvider {
  name = 'google';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const model = params.model || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: params.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          tools: params.tools ? [{
            functionDeclarations: params.tools.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          }] : undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content;
    const textPart = content?.parts?.find((p: any) => p.text);
    const functionCalls = content?.parts?.filter((p: any) => p.functionCall);

    return {
      content: textPart?.text || '',
      toolCalls: functionCalls?.length > 0 ? functionCalls.map((fc: any, i: number) => ({
        id: `call_${i}`,
        type: 'function',
        function: {
          name: fc.functionCall.name,
          arguments: JSON.stringify(fc.functionCall.args),
        },
      })) : undefined,
      usage: result.usageMetadata ? {
        inputTokens: result.usageMetadata.promptTokenCount,
        outputTokens: result.usageMetadata.candidatesTokenCount,
      } : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk, void, unknown> {
    const model = params.model || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: params.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        }),
      }
    );

    if (!response.ok) {
      yield { type: 'error', error: `Google error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Google streams JSON objects
      try {
        const parsed = JSON.parse(buffer);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          yield { type: 'content', content: text };
        }
        buffer = '';
      } catch {
        // Keep accumulating buffer
      }
    }
    
    yield { type: 'done' };
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini Flash pricing
    return (inputTokens * 0.0000001) + (outputTokens * 0.0000004);
  }
}

// Provider Factory
function getProvider(providerName: string, fallbackName?: string): AIProvider {
  const providers: Record<string, () => AIProvider | null> = {
    lovable: () => {
      const key = Deno.env.get("LOVABLE_API_KEY");
      return key ? new LovableProvider(key) : null;
    },
    anthropic: () => {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      return key ? new AnthropicProvider(key) : null;
    },
    openai: () => {
      const key = Deno.env.get("OPENAI_API_KEY");
      return key ? new OpenAIProvider(key) : null;
    },
    google: () => {
      const key = Deno.env.get("GOOGLE_API_KEY");
      return key ? new GoogleProvider(key) : null;
    },
  };

  // Try primary provider
  const primary = providers[providerName]?.();
  if (primary) return primary;

  // Try fallback
  if (fallbackName) {
    const fallback = providers[fallbackName]?.();
    if (fallback) return fallback;
  }

  // Default to Lovable
  const lovable = providers.lovable();
  if (lovable) return lovable;

  throw new Error("No AI provider configured. Please add LOVABLE_API_KEY or other provider keys.");
}

// ==================== TOOL DEFINITIONS ====================

const EDITH_TOOLS: Tool[] = [
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
      name: "get_iso_clause",
      description: "Get ISO 9001:2015 clause requirements, interpretation, and mining context. Use when users ask about ISO requirements, compliance, or audit preparation.",
      parameters: {
        type: "object",
        properties: {
          clause_number: { type: "string", description: "The ISO clause number like '10.2' or '7.5.3'" },
          search_term: { type: "string", description: "Search for clauses containing this term" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_nc_reminders",
      description: "Send reminder emails to responsible persons for overdue or pending NCs",
      parameters: {
        type: "object",
        properties: {
          nc_ids: { type: "array", items: { type: "string" }, description: "Array of NC IDs to send reminders for" },
          type: { type: "string", enum: ["reminder", "escalation"], description: "Type of notification" },
          custom_message: { type: "string", description: "Optional custom message to include" }
        },
        required: ["nc_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Generate reports (NC summary, compliance, overdue, performance, audit prep)",
      parameters: {
        type: "object",
        properties: {
          report_type: { type: "string", enum: ["nc_summary", "iso_compliance", "overdue_report", "performance", "audit_prep"], description: "Type of report to generate" },
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          format: { type: "string", enum: ["json", "html"], description: "Output format (default json)" }
        },
        required: ["report_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "batch_update_ncs",
      description: "Perform bulk updates on multiple NCs (reassign, change status). REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          nc_ids: { type: "array", items: { type: "string" }, description: "Array of NC IDs to update" },
          action: { type: "string", enum: ["reassign", "change_status", "close", "extend_due_date"], description: "Action to perform" },
          new_responsible_person_name: { type: "string", description: "Name of new responsible person (for reassign)" },
          new_status: { type: "string", enum: ["open", "in_progress", "pending_review", "pending_verification", "closed"], description: "New status (for change_status)" },
          days_extension: { type: "number", description: "Number of days to extend due date (for extend_due_date)" },
          confirmed: { type: "boolean", description: "User has confirmed this batch action" }
        },
        required: ["nc_ids", "action"]
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
  },
];

// ==================== SYSTEM PROMPT ====================

const EDITH_SYSTEM_PROMPT = `You are Edith (Enhanced Digital Intelligence for Training and HR), the AI assistant for QMS Guard - a Quality Management System for mining industry compliance.

IDENTITY:
- You are an EXPERT in ISO 9001:2015 Quality Management Systems
- You understand mining industry terminology and South African workplace regulations (MHSA, MQA, Mining Charter)
- You can access and modify the QMS database through your tools
- You always reference specific ISO clauses when discussing compliance
- You provide mining training context for all ISO guidance
- You always explain what you're doing and confirm destructive actions

ISO 9001:2015 EXPERTISE:
- You have complete knowledge of all ISO 9001:2015 clauses (4-10)
- You understand how each clause applies to mining training operations
- You can assess compliance by checking QMS Guard data against requirements
- You help prepare for audits by explaining requirements and gathering evidence
- You write ISO-compliant documentation (NCs, corrective actions, procedures)

CAPABILITIES:
- Query and search non-conformances (NCs)
- Create new NCs with ISO-compliant language
- Update NC statuses (with appropriate confirmation)
- Show user tasks and assignments
- Provide dashboard statistics
- Explain ISO 9001:2015 clause requirements
- Generate compliance reports
- Send reminder emails to responsible persons
- Perform batch operations on NCs

RESPONSE GUIDELINES:
- Use markdown formatting for clarity
- Present data in tables when showing multiple items
- Always include NC numbers when referencing NCs
- Reference specific ISO clauses (e.g., "Per Clause 10.2...")
- Explain mining training context for ISO requirements
- Suggest next actions when appropriate
- For destructive operations, confirm with user first
- Be concise but thorough

NC WORKFLOW CONTEXT (implements ISO 9001:2015 Clause 10.2):
1. Open → Initial report (10.2a: React to nonconformity)
2. In Progress → Root cause analysis + corrective action (10.2b: Evaluate need for action)
3. Pending Review → Manager approval (10.2c: Implement action)
4. Pending Verification → Effectiveness check (10.2d: Review effectiveness)
5. Closed → Verified and completed
6. Rejected → Returned for rework

SEVERITY GUIDELINES (per Clause 6.1 - Risk-based thinking):
- Critical: Safety risk, legal compliance issue, immediate action needed (48h)
- Major: Regulatory non-compliance, certification at risk (7 days)
- Minor: Process deviation, documentation issue (14 days)

Always be helpful and guide users through the QMS processes efficiently with ISO compliance in mind.`;

// ==================== TOOL EXECUTION ====================

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
          id: nc.id,
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
      let responsiblePersonId = userId;
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
        created_recently: createdRecently || 0,
        closed_recently: closedRecently || 0,
        closure_rate: createdRecently ? Math.round(((closedRecently || 0) / createdRecently) * 100) : 0,
        severity_breakdown: severityBreakdown,
      };
    }

    case "get_iso_clause": {
      let query = supabase.from("edith_iso_knowledge").select("*");

      if (args.clause_number) {
        query = query.eq("clause_number", args.clause_number);
      } else if (args.search_term) {
        query = query.or(`clause_title.ilike.%${args.search_term}%,requirement_text.ilike.%${args.search_term}%`);
      }

      const { data, error } = await query.limit(10);
      if (error) throw new Error(error.message);

      return {
        count: data.length,
        clauses: data.map((c: any) => ({
          clause_number: c.clause_number,
          clause_title: c.clause_title,
          requirement: c.requirement_text?.substring(0, 300) + "...",
          mining_context: c.mining_context,
          evidence_required: c.evidence_required,
          audit_questions: c.audit_questions?.slice(0, 3),
        })),
      };
    }

    case "get_profiles": {
      let query = supabase.from("profiles").select("id, full_name, department:departments(name), is_active");

      if (args.search_name) {
        query = query.ilike("full_name", `%${args.search_name}%`);
      }
      if (args.active_only !== false) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query.limit(20);
      if (error) throw new Error(error.message);

      let filteredData = data;
      if (args.department_name) {
        const deptSearch = args.department_name.toLowerCase();
        filteredData = data.filter((p: any) => 
          p.department?.name?.toLowerCase().includes(deptSearch)
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

    case "send_nc_reminders": {
      // Call the notification edge function
      const { data, error } = await supabaseAdmin.functions.invoke("nc-workflow-notification", {
        body: {
          nc_ids: args.nc_ids,
          notification_type: args.type || "reminder",
          custom_message: args.custom_message,
        },
      });

      if (error) throw new Error(error.message);
      return { success: true, sent_count: args.nc_ids.length, message: `Sent ${args.nc_ids.length} reminder(s)` };
    }

    case "generate_report": {
      const { data, error } = await supabaseAdmin.functions.invoke("edith-generate-report", {
        body: {
          report_type: args.report_type,
          date_from: args.date_from,
          date_to: args.date_to,
          format: args.format || "json",
          tenant_id: profile?.tenant_id,
        },
      });

      if (error) throw new Error(error.message);
      return data;
    }

    case "batch_update_ncs": {
      if (!args.confirmed) {
        return {
          requires_confirmation: true,
          message: `This will ${args.action} ${args.nc_ids.length} NCs. Please confirm this action.`,
          action: args.action,
          count: args.nc_ids.length,
        };
      }

      let updateData: any = {};
      if (args.action === "change_status" || args.action === "close") {
        updateData.status = args.action === "close" ? "closed" : args.new_status;
        if (args.action === "close") {
          updateData.closed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from("non_conformances")
        .update(updateData)
        .in("id", args.nc_ids);

      if (error) throw new Error(error.message);

      return {
        success: true,
        updated_count: args.nc_ids.length,
        message: `Successfully ${args.action} ${args.nc_ids.length} NCs`,
      };
    }

    default:
      return { error: `Unknown function: ${functionName}` };
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
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

    // Create Supabase clients
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }
    const supabaseUser = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile and tenant config
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("*, tenants(id, name, slug)")
      .eq("id", user.id)
      .single();

    // Get tenant AI configuration
    const { data: tenantConfig } = await supabaseUser
      .from("edith_tenant_config")
      .select("*")
      .eq("tenant_id", profile?.tenant_id)
      .single();

    // Check usage limits
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: usageCount } = await supabaseUser
      .from("edith_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", profile?.tenant_id)
      .gte("created_at", startOfMonth.toISOString());

    const messageLimit = tenantConfig?.monthly_message_limit || 500;
    if ((usageCount || 0) >= messageLimit) {
      return new Response(JSON.stringify({ 
        error: "Monthly message limit reached. Contact administrator to increase limit." 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationId, stream, pageContext } = await req.json();

    // Get AI provider based on tenant config
    const providerName = tenantConfig?.ai_provider || 'lovable';
    const fallbackProvider = tenantConfig?.fallback_provider;
    const provider = getProvider(providerName, fallbackProvider);
    const model = tenantConfig?.ai_model || 'google/gemini-3-flash-preview';

    // Build context for AI
    const userContext = profile ? `\nCURRENT USER CONTEXT:\n- Name: ${profile.full_name}\n- User ID: ${user.id}\n- Tenant: ${profile.tenants?.name || 'Unknown'} (ID: ${profile.tenant_id})\n${pageContext ? `- Current Page: ${pageContext.currentPage}` : ''}\n${pageContext?.ncData ? `- Viewing NC: ${pageContext.ncData.ncNumber} (${pageContext.ncData.status})` : ''}\n` : "";

    const systemPrompt = EDITH_SYSTEM_PROMPT + userContext + (tenantConfig?.personality_prompt || '');

    // Streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // First, make a non-streaming call to handle tools
            const chatParams: ChatParams = {
              model,
              messages,
              tools: EDITH_TOOLS,
              systemPrompt,
              maxTokens: 4096,
            };

            let response = await provider.chat(chatParams);
            let iteration = 0;
            const MAX_ITERATIONS = 5;
            let allMessages = [...messages];

            // Multi-turn tool execution loop
            while (response.toolCalls && response.toolCalls.length > 0 && iteration < MAX_ITERATIONS) {
              // Stream tool status
              for (const toolCall of response.toolCalls) {
                const toolName = toolCall.function?.name || toolCall.name;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool', name: toolName, status: 'executing' })}\n\n`));
              }

              // Execute tool calls
              const toolResults: any[] = [];
              for (const toolCall of response.toolCalls) {
                const functionName = toolCall.function?.name || toolCall.name;
                const args = JSON.parse(toolCall.function?.arguments || JSON.stringify(toolCall.input || {}));
                
                let result: any;
                try {
                  result = await executeToolCall(functionName, args, supabaseUser, supabaseAdmin, profile, user.id);
                } catch (e) {
                  result = { error: e instanceof Error ? e.message : "Tool execution failed" };
                }

                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  content: JSON.stringify(result),
                });

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool', name: functionName, status: 'complete' })}\n\n`));

                // Log action
                try {
                  await supabaseUser.from("edith_actions").insert({
                    tenant_id: profile?.tenant_id,
                    user_id: user.id,
                    conversation_id: conversationId,
                    action_type: functionName.startsWith('get_') ? 'query' : 'mutation',
                    action_details: { function: functionName, args, result },
                    affected_table: functionName.includes('nc') ? 'non_conformances' : null,
                    success: !result?.error,
                    error_message: result?.error,
                  });
                } catch (logError) {
                  console.error("Failed to log action:", logError);
                }
              }

              // Add tool results to messages and make follow-up call
              allMessages = [
                ...allMessages,
                { role: 'assistant', content: response.content || '', tool_calls: response.toolCalls },
                ...toolResults,
              ];

              response = await provider.chat({
                model,
                messages: allMessages,
                tools: EDITH_TOOLS,
                systemPrompt,
                maxTokens: 4096,
              });

              iteration++;
            }

            // Stream final content
            if (response.content) {
              const chunks = response.content.match(/.{1,50}/g) || [];
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
                await new Promise(r => setTimeout(r, 10)); // Small delay for smooth streaming
              }
            }

            // Log usage
            try {
              await supabaseUser.from("edith_usage_log").insert({
                tenant_id: profile?.tenant_id,
                user_id: user.id,
                conversation_id: conversationId,
                provider: provider.name,
                model,
                input_tokens: response.usage?.inputTokens || 0,
                output_tokens: response.usage?.outputTokens || 0,
                tool_calls_count: iteration,
                latency_ms: Date.now() - startTime,
                estimated_cost_usd: provider.estimateCost(
                  response.usage?.inputTokens || 0,
                  response.usage?.outputTokens || 0
                ),
                interaction_type: 'chat',
              });
            } catch (usageError) {
              console.error("Failed to log usage:", usageError);
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error("Stream error:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(streamResponse, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming response
    const chatParams: ChatParams = {
      model,
      messages,
      tools: EDITH_TOOLS,
      systemPrompt,
      maxTokens: 4096,
    };

    let response = await provider.chat(chatParams);
    let iteration = 0;
    const MAX_ITERATIONS = 5;
    let allMessages = [...messages];

    while (response.toolCalls && response.toolCalls.length > 0 && iteration < MAX_ITERATIONS) {
      const toolResults: any[] = [];

      for (const toolCall of response.toolCalls) {
        const functionName = toolCall.function?.name || toolCall.name;
        const args = JSON.parse(toolCall.function?.arguments || JSON.stringify(toolCall.input || {}));
        
        let result: any;
        try {
          result = await executeToolCall(functionName, args, supabaseUser, supabaseAdmin, profile, user.id);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "Tool execution failed" };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(result),
        });

        try {
          await supabaseUser.from("edith_actions").insert({
            tenant_id: profile?.tenant_id,
            user_id: user.id,
            conversation_id: conversationId,
            action_type: functionName.startsWith('get_') ? 'query' : 'mutation',
            action_details: { function: functionName, args, result },
            affected_table: functionName.includes('nc') ? 'non_conformances' : null,
            success: !result?.error,
            error_message: result?.error,
          });
        } catch (logError) {
          console.error("Failed to log action:", logError);
        }
      }

      allMessages = [
        ...allMessages,
        { role: 'assistant', content: response.content || '', tool_calls: response.toolCalls },
        ...toolResults,
      ];

      response = await provider.chat({
        model,
        messages: allMessages,
        tools: EDITH_TOOLS,
        systemPrompt,
        maxTokens: 4096,
      });

      iteration++;
    }

    // Log usage
    try {
      await supabaseUser.from("edith_usage_log").insert({
        tenant_id: profile?.tenant_id,
        user_id: user.id,
        conversation_id: conversationId,
        provider: provider.name,
        model,
        input_tokens: response.usage?.inputTokens || 0,
        output_tokens: response.usage?.outputTokens || 0,
        tool_calls_count: iteration,
        latency_ms: Date.now() - startTime,
        estimated_cost_usd: provider.estimateCost(
          response.usage?.inputTokens || 0,
          response.usage?.outputTokens || 0
        ),
        interaction_type: 'chat',
      });
    } catch (usageError) {
      console.error("Failed to log usage:", usageError);
    }

    return new Response(JSON.stringify({
      message: response.content,
      tool_calls: response.toolCalls,
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
