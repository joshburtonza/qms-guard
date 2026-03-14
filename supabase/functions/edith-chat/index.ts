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

  // Default cascade: OpenAI → Anthropic → Lovable
  const openai = providers.openai();
  if (openai) return openai;

  const anthropic = providers.anthropic();
  if (anthropic) return anthropic;

  const lovable = providers.lovable();
  if (lovable) return lovable;

  throw new Error("No AI provider configured. Please add OPENAI_API_KEY, ANTHROPIC_API_KEY, or LOVABLE_API_KEY.");
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
      description: "Get all tasks for the current user or a named user. Returns NCs where they are responsible, NCs they reported, and role-specific queue items (QA classifications pending, manager approvals pending, verifications pending).",
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
      name: "classify_nc",
      description: "QA step: Classify a newly submitted NC — set risk level, due date, and classification comments. Moves the NC from Step 1 (open, awaiting QA) to Step 2 (in_progress). Only users with QA/verifier/admin role can do this.",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "NC number like NC-2026-02-00001" },
          nc_id: { type: "string", description: "UUID of the NC (alternative to nc_number)" },
          risk_classification: { type: "string", enum: ["observation", "ofi", "minor", "major"], description: "Risk level: observation=30 days, ofi=14 days, minor=7 days, major=3 days" },
          classification_comments: { type: "string", description: "QA classification comments explaining the risk decision (minimum 10 characters)" },
          due_date_override: { type: "string", description: "Optional custom due date YYYY-MM-DD (overrides auto-calculated from risk_classification)" }
        },
        required: ["risk_classification", "classification_comments"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_corrective_action",
      description: "Responsible person step: Submit root cause analysis and corrective action for an NC in Step 2 (in_progress). Moves NC to Step 3 (pending_review).",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "NC number" },
          nc_id: { type: "string", description: "UUID of the NC" },
          root_cause: { type: "string", description: "Detailed root cause analysis" },
          corrective_action: { type: "string", description: "Corrective action taken or planned" },
          preventive_action: { type: "string", description: "Preventive action to stop recurrence" }
        },
        required: ["root_cause", "corrective_action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "approve_nc",
      description: "Manager/admin step: Review and approve or reject a corrective action for an NC in Step 3 (pending_review). Approve moves to Step 4 (pending_verification). Reject sends back to Step 2.",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "NC number" },
          nc_id: { type: "string", description: "UUID of the NC" },
          decision: { type: "string", enum: ["approve", "reject"], description: "approve = accept corrective action, reject = send back for rework" },
          comments: { type: "string", description: "Comments explaining the decision" }
        },
        required: ["decision", "comments"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verify_nc",
      description: "QA/verifier step: Verify effectiveness of corrective action for an NC in Step 4 (pending_verification). Approve closes the NC. Reject sends back to Step 2 for rework.",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "NC number" },
          nc_id: { type: "string", description: "UUID of the NC" },
          decision: { type: "string", enum: ["approve", "reject"], description: "approve = effective, close NC. reject = not effective, send back" },
          effectiveness_notes: { type: "string", description: "Notes on the effectiveness verification" }
        },
        required: ["decision", "effectiveness_notes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workflow_guidance",
      description: "Get detailed guidance on what needs to happen for a specific NC — who needs to act, what step it's on, what buttons/actions are available based on the viewer's role.",
      parameters: {
        type: "object",
        properties: {
          nc_number: { type: "string", description: "NC number" },
          nc_id: { type: "string", description: "UUID of the NC" }
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
  {
    type: "function",
    function: {
      name: "process_file",
      description: "Process an uploaded file (PDF, Excel, CSV, Word, or image) and extract its text content and structured data for analysis. Use this when a user uploads a file and you need to read its contents.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to the file in the edith-uploads storage bucket. Format: {tenant_id}/{filename}" },
          mime_type: { type: "string", description: "MIME type of the file (e.g., 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')" },
          file_name: { type: "string", description: "Original filename as uploaded by the user" }
        },
        required: ["file_path", "mime_type", "file_name"]
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

NC WORKFLOW (ISO 9001:2015 Clause 10.2) — 5 steps, each requires a specific role:
- Step 1 (Open, current_step=1): NC submitted. QA/verifier must CLASSIFY it (risk level + due date). Reporters are BLOCKED here — they cannot advance until QA acts. Use classify_nc tool.
- Step 2 (In Progress, current_step=2): QA classified. Responsible person must submit root cause + corrective action. Use submit_corrective_action tool.
- Step 3 (Pending Review, current_step=3): Corrective action submitted. Manager/admin must approve or reject. Use approve_nc tool.
- Step 4 (Pending Verification, current_step=4): Manager approved. QA/verifier checks effectiveness. Use verify_nc tool to close or send back.
- Step 5 (Closed): Complete.

ROLE DEFINITIONS:
- super_admin / site_admin: All capabilities including classify, approve, verify
- verifier (QA role): Can classify (Step 1→2) and verify (Step 4→closed)
- manager: Can approve corrective actions (Step 3→4 or back to Step 2)
- employee: Can report NCs and submit corrective actions for NCs they're responsible for

WHEN USER IS BLOCKED: Always diagnose why. The most common block is Step 1 — the REPORTER cannot advance their own NC. They must wait for someone with verifier/admin role to classify it. Tell them this clearly and offer to notify the relevant QA person.

SEVERITY GUIDELINES (per Clause 6.1 - Risk-based thinking):
- Critical: Safety risk, legal compliance issue, immediate action needed (48h)
- Major: Regulatory non-compliance, certification at risk (7 days)
- Minor: Process deviation, documentation issue (14 days)
- OFI (Opportunity for Improvement): 14 days
- Observation: 30 days

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
          corrective_actions(id, root_cause, corrective_action, submitted_at),
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
      let targetName = profile?.full_name || "You";

      if (args.user_name) {
        const { data: users } = await supabase
          .from("profiles")
          .select("id, full_name")
          .ilike("full_name", `%${args.user_name}%`)
          .limit(1);
        if (users && users.length > 0) {
          targetUserId = users[0].id;
          targetName = users[0].full_name;
        }
      }

      const baseSelect = `
        id, nc_number, description, status, severity, due_date, current_step,
        department:departments(name),
        responsible:profiles!non_conformances_responsible_person_fkey(full_name),
        reporter:profiles!non_conformances_reported_by_fkey(full_name)
      `;
      const closedFilter = !args.include_closed;

      // 1. NCs where user is responsible
      let q1 = supabase.from("non_conformances").select(baseSelect)
        .eq("responsible_person", targetUserId).order("due_date", { ascending: true });
      if (closedFilter) q1 = q1.not("status", "eq", "closed");

      // 2. NCs reported by user (so they can track progress)
      let q2 = supabase.from("non_conformances").select(baseSelect)
        .eq("reported_by", targetUserId).not("responsible_person", "eq", targetUserId)
        .order("created_at", { ascending: false }).limit(10);
      if (closedFilter) q2 = q2.not("status", "eq", "closed");

      // 3. Role-based queue: QA classifications needed (step 1, open)
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", targetUserId);
      const roles = (targetRoles || []).map((r: any) => r.role);
      const isQA = roles.some((r: string) => ["super_admin","site_admin","verifier"].includes(r));
      const isManager = roles.some((r: string) => ["super_admin","site_admin","manager"].includes(r));

      const [res1, res2] = await Promise.all([q1, q2]);
      const responsible = (res1.data || []);
      const reported = (res2.data || []);

      const qaQueue: any[] = [];
      const managerQueue: any[] = [];

      if (isQA) {
        const { data: qaPending } = await supabase.from("non_conformances").select(baseSelect)
          .eq("status", "open").eq("current_step", 1).order("created_at", { ascending: true });
        qaQueue.push(...(qaPending || []).filter((nc: any) => nc.responsible?.full_name));
      }
      if (isQA) {
        const { data: verifyPending } = await supabase.from("non_conformances").select(baseSelect)
          .eq("status", "pending_verification").order("due_date", { ascending: true });
        qaQueue.push(...(verifyPending || []));
      }
      if (isManager) {
        const { data: reviewPending } = await supabase.from("non_conformances").select(baseSelect)
          .eq("status", "pending_review").order("due_date", { ascending: true });
        managerQueue.push(...(reviewPending || []));
      }

      const format = (nc: any, taskType: string) => ({
        nc_number: nc.nc_number,
        description: nc.description?.substring(0, 80) + (nc.description?.length > 80 ? "..." : ""),
        status: nc.status,
        current_step: nc.current_step,
        severity: nc.severity,
        due_date: nc.due_date,
        overdue: nc.due_date && new Date(nc.due_date) < new Date() && nc.status !== "closed",
        department: nc.department?.name,
        task_type: taskType,
        responsible: nc.responsible?.full_name,
        reporter: nc.reporter?.full_name,
      });

      return {
        user: targetName,
        roles,
        summary: {
          responsible_count: responsible.length,
          reported_count: reported.length,
          qa_queue_count: qaQueue.length,
          manager_queue_count: managerQueue.length,
        },
        responsible_tasks: responsible.map((nc: any) => format(nc, "responsible")),
        reported_ncs: reported.map((nc: any) => format(nc, "reporter")),
        qa_queue: qaQueue.map((nc: any) => format(nc, nc.current_step === 1 ? "awaiting_qa_classification" : "awaiting_verification")),
        manager_queue: managerQueue.map((nc: any) => format(nc, "awaiting_manager_approval")),
      };
    }

    case "classify_nc": {
      const { data: cRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const cRoleList = (cRoles || []).map((r: any) => r.role);
      if (!cRoleList.some((r: string) => ["super_admin","site_admin","verifier"].includes(r))) {
        return { error: "Permission denied. Classifying NCs requires QA, verifier, or admin role." };
      }
      let nc: any;
      if (args.nc_number) {
        const { data, error } = await supabase.from("non_conformances")
          .select("id, nc_number, status, current_step, tenant_id")
          .eq("nc_number", args.nc_number).single();
        if (error) throw new Error(error.message);
        nc = data;
      } else if (args.nc_id) {
        const { data, error } = await supabase.from("non_conformances")
          .select("id, nc_number, status, current_step, tenant_id")
          .eq("id", args.nc_id).single();
        if (error) throw new Error(error.message);
        nc = data;
      } else {
        return { error: "Either nc_number or nc_id is required" };
      }

      if (nc.current_step !== 1 || nc.status !== "open") {
        return { error: `Cannot classify: NC is at step ${nc.current_step} with status ${nc.status}. Classification only applies to step 1 (open) NCs.` };
      }

      const riskDays: Record<string, number> = { major: 3, minor: 7, ofi: 14, observation: 30 };
      const dueDays = riskDays[args.risk_classification] || 14;
      const dueDate = args.due_date_override || (() => {
        const d = new Date(); d.setDate(d.getDate() + dueDays); return d.toISOString().split("T")[0];
      })();

      const { error: updateError } = await supabase.from("non_conformances")
        .update({
          current_step: 2,
          status: "in_progress",
          risk_classification: args.risk_classification,
          due_date: dueDate,
          qa_classification_comments: args.classification_comments,
          qa_classified_by: userId,
          qa_classified_at: new Date().toISOString(),
        })
        .eq("id", nc.id);
      if (updateError) throw new Error(updateError.message);

      await supabase.from("workflow_approvals").insert({
        nc_id: nc.id, step: 1, action: "classified",
        approved_by: userId,
        comments: `Risk: ${args.risk_classification}. ${args.classification_comments}`,
        approved_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});

      return { success: true, nc_number: nc.nc_number, message: `NC ${nc.nc_number} classified as ${args.risk_classification}. Due date: ${dueDate}. Now in Step 2 — waiting for responsible person to submit corrective action.` };
    }

    case "submit_corrective_action": {
      if (!args.nc_number && !args.nc_id) return { error: "Either nc_number or nc_id is required." };
      let nc: any;
      const ncQuery = args.nc_number
        ? supabase.from("non_conformances").select("id, nc_number, status, current_step, responsible_person").eq("nc_number", args.nc_number).single()
        : supabase.from("non_conformances").select("id, nc_number, status, current_step, responsible_person").eq("id", args.nc_id).single();
      const { data: ncData, error: ncErr } = await ncQuery;
      if (ncErr) throw new Error(ncErr.message);
      nc = ncData;

      if (nc.current_step !== 2 || nc.status !== "in_progress") {
        return { error: `Cannot submit corrective action: NC is at step ${nc.current_step} (${nc.status}). Must be step 2 (in_progress).` };
      }

      const { error: caErr } = await supabase.from("corrective_actions").upsert({
        nc_id: nc.id,
        root_cause: args.root_cause,
        corrective_action: args.corrective_action,
        preventive_action: args.preventive_action || null,
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "nc_id" });
      if (caErr) throw new Error(caErr.message);

      const { error: updateErr } = await supabase.from("non_conformances")
        .update({ current_step: 3, status: "pending_review" }).eq("id", nc.id);
      if (updateErr) throw new Error(updateErr.message);

      return { success: true, nc_number: nc.nc_number, message: `Corrective action submitted for ${nc.nc_number}. NC moved to Step 3 — awaiting manager review.` };
    }

    case "approve_nc": {
      if (!args.nc_number && !args.nc_id) return { error: "Either nc_number or nc_id is required." };
      const { data: aRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const aRoleList = (aRoles || []).map((r: any) => r.role);
      if (!aRoleList.some((r: string) => ["super_admin","site_admin","manager"].includes(r))) {
        return { error: "Permission denied. Approving corrective actions requires manager or admin role." };
      }
      let nc: any;
      const ncQ = args.nc_number
        ? supabase.from("non_conformances").select("id, nc_number, status, current_step").eq("nc_number", args.nc_number).single()
        : supabase.from("non_conformances").select("id, nc_number, status, current_step").eq("id", args.nc_id).single();
      const { data: ncD, error: ncE } = await ncQ;
      if (ncE) throw new Error(ncE.message);
      nc = ncD;

      if (nc.current_step !== 3 || nc.status !== "pending_review") {
        return { error: `Cannot approve: NC is at step ${nc.current_step} (${nc.status}). Must be step 3 (pending_review).` };
      }

      const approved = args.decision === "approve";
      const { error: approveErr } = await supabase.from("non_conformances").update({
        current_step: approved ? 4 : 2,
        status: approved ? "pending_verification" : "in_progress",
        manager_review_comments: args.comments,
        manager_reviewed_by: userId,
        manager_reviewed_at: new Date().toISOString(),
      }).eq("id", nc.id);
      if (approveErr) throw new Error(approveErr.message);

      await supabase.from("workflow_approvals").insert({
        nc_id: nc.id, step: 3,
        action: approved ? "approved" : "rejected",
        approved_by: userId, comments: args.comments,
        approved_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});

      return { success: true, nc_number: nc.nc_number, message: approved
        ? `NC ${nc.nc_number} approved. Moved to Step 4 — awaiting QA verification.`
        : `NC ${nc.nc_number} rejected. Sent back to Step 2 — responsible person must revise corrective action.` };
    }

    case "verify_nc": {
      if (!args.nc_number && !args.nc_id) return { error: "Either nc_number or nc_id is required." };
      const { data: vRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const vRoleList = (vRoles || []).map((r: any) => r.role);
      if (!vRoleList.some((r: string) => ["super_admin","site_admin","verifier"].includes(r))) {
        return { error: "Permission denied. Verifying NCs requires QA, verifier, or admin role." };
      }
      let nc: any;
      const vQ = args.nc_number
        ? supabase.from("non_conformances").select("id, nc_number, status, current_step").eq("nc_number", args.nc_number).single()
        : supabase.from("non_conformances").select("id, nc_number, status, current_step").eq("id", args.nc_id).single();
      const { data: vD, error: vE } = await vQ;
      if (vE) throw new Error(vE.message);
      nc = vD;

      if (nc.current_step !== 4 || nc.status !== "pending_verification") {
        return { error: `Cannot verify: NC is at step ${nc.current_step} (${nc.status}). Must be step 4 (pending_verification).` };
      }

      const verified = args.decision === "approve";
      const now = new Date().toISOString();
      const { error: verifyErr } = await supabase.from("non_conformances").update({
        current_step: verified ? 5 : 2,
        status: verified ? "closed" : "in_progress",
        closed_at: verified ? now : null,
        verification_notes: args.effectiveness_notes,
        verified_by: userId,
        verified_at: now,
      }).eq("id", nc.id);
      if (verifyErr) throw new Error(verifyErr.message);

      await supabase.from("workflow_approvals").insert({
        nc_id: nc.id, step: 4,
        action: verified ? "verified_closed" : "rejected",
        approved_by: userId, comments: args.effectiveness_notes,
        approved_at: now,
      }).then(() => {}).catch(() => {});

      return { success: true, nc_number: nc.nc_number, message: verified
        ? `NC ${nc.nc_number} verified effective and CLOSED. Well done!`
        : `NC ${nc.nc_number} verification failed — corrective action not effective. Sent back to Step 2 for rework.` };
    }

    case "get_workflow_guidance": {
      let nc: any;
      if (!args.nc_number && !args.nc_id) {
        // Return overview of all blocked NCs
        const { data: blocked } = await supabase.from("non_conformances")
          .select("nc_number, status, current_step, responsible:profiles!non_conformances_responsible_person_fkey(full_name)")
          .not("status", "in", "(closed,rejected)").order("created_at", { ascending: false }).limit(20);
        return { blocked_ncs: (blocked || []).map((nc: any) => ({
          nc_number: nc.nc_number, status: nc.status, current_step: nc.current_step,
          responsible: nc.responsible?.full_name,
          next_action: nc.current_step === 1 ? "QA must classify" : nc.current_step === 2 ? "Responsible person must submit corrective action" : nc.current_step === 3 ? "Manager must review" : "QA must verify",
        })) };
      }

      const gQ = args.nc_number
        ? supabase.from("non_conformances").select(`*, responsible:profiles!non_conformances_responsible_person_fkey(full_name, id), reporter:profiles!non_conformances_reported_by_fkey(full_name), department:departments(name), corrective_actions(*)`).eq("nc_number", args.nc_number).single()
        : supabase.from("non_conformances").select(`*, responsible:profiles!non_conformances_responsible_person_fkey(full_name, id), reporter:profiles!non_conformances_reported_by_fkey(full_name), department:departments(name), corrective_actions(*)`).eq("id", args.nc_id).single();
      const { data: gD, error: gE } = await gQ;
      if (gE) return { error: gE.message };
      nc = gD;

      const stepLabels: Record<number, string> = { 1: "QA Classification", 2: "Corrective Action", 3: "Manager Review", 4: "QA Verification", 5: "Closed" };
      const nextActions: Record<number, string> = {
        1: "A QA/verifier must classify this NC (set risk level + due date) using classify_nc",
        2: `${nc.responsible?.full_name || "The responsible person"} must submit root cause + corrective action using submit_corrective_action`,
        3: "A manager/admin must review and approve the corrective action using approve_nc",
        4: "A QA/verifier must verify the corrective action was effective using verify_nc",
        5: "NC is closed — no further action needed",
      };

      return {
        nc_number: nc.nc_number, status: nc.status, current_step: nc.current_step,
        step_label: stepLabels[nc.current_step] || "Unknown",
        next_action: nextActions[nc.current_step] || "Unknown",
        reporter: nc.reporter?.full_name,
        responsible: nc.responsible?.full_name,
        due_date: nc.due_date,
        overdue: nc.due_date && new Date(nc.due_date) < new Date() && nc.status !== "closed",
        has_corrective_action: (nc.corrective_actions || []).length > 0,
        corrective_action_summary: nc.corrective_actions?.[0] ? {
          root_cause: nc.corrective_actions[0].root_cause?.substring(0, 100),
          corrective_action: nc.corrective_actions[0].corrective_action?.substring(0, 100),
        } : null,
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

    case "process_file": {
      const { data, error } = await supabaseAdmin.functions.invoke("edith-process-file", {
        body: {
          filePath: args.file_path,
          mimeType: args.mime_type,
          fileName: args.file_name,
        },
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      });
      if (error) throw new Error(`File processing failed: ${error.message}`);
      return data;
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

    // Get user roles
    const { data: userRolesData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (userRolesData || []).map((r: any) => r.role);
    const isQA = userRoles.some((r: string) => ["super_admin","site_admin","verifier"].includes(r));
    const isManager = userRoles.some((r: string) => ["super_admin","site_admin","manager"].includes(r));

    // Get AI provider based on tenant config
    const providerName = tenantConfig?.ai_provider || 'openai';
    const fallbackProvider = tenantConfig?.fallback_provider;
    const provider = getProvider(providerName, fallbackProvider);
    const model = tenantConfig?.ai_model || 'gpt-4o';

    // Build context for AI — include roles so EDITH gives role-appropriate guidance
    const userContext = profile ? `\nCURRENT USER CONTEXT:\n- Name: ${profile.full_name}\n- User ID: ${user.id}\n- Tenant: ${profile.tenants?.name || 'Unknown'} (ID: ${profile.tenant_id})\n- Roles: ${userRoles.length > 0 ? userRoles.join(", ") : "employee (no special roles)"}\n- Can classify NCs (QA): ${isQA}\n- Can approve corrective actions (Manager): ${isManager}\n${pageContext ? `- Current Page: ${pageContext.currentPage}` : ''}\n${pageContext?.ncData ? `- Viewing NC: ${pageContext.ncData.ncNumber} (Step ${pageContext.ncData.currentStep}, ${pageContext.ncData.status})` : ''}\n` : "";

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
