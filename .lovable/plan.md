
# EDITH Enhancement Plan: Full Feature Implementation + Multi-Provider Architecture

## Executive Summary

This plan addresses all requirements from the EDITH Ship Plan v2 document, implementing the 4 Sprint deliverables while also architecting Edith to support multiple AI providers (Claude, Gemini, OpenAI) instead of being locked to Lovable AI Gateway.

---

## Current State Analysis

### What Already Works
- Chat UI with markdown rendering and conversation persistence
- 20+ tool functions (NC CRUD, ISO 9001 knowledge, SA mining regulations, reports, batch operations)
- Supabase Edge Function (`edith-chat`) using Lovable AI Gateway (Gemini 3 Flash)
- Keyboard toggle (Cmd/Ctrl+K), side panel Sheet (400px)
- Offline detection, error handling, tenant isolation via RLS
- Database tables: `edith_conversations`, `edith_messages`, `edith_knowledge`, `edith_actions`, `edith_iso_knowledge`, `edith_regulatory_knowledge`

### Critical Gaps to Address
| Gap | Current State | Target State |
|-----|--------------|--------------|
| No streaming | 10-30 sec dead screen | Text appears within 1 second via SSE |
| Single-line input | `<Input>` component | Auto-resizing `<Textarea>` with Shift+Enter |
| No file upload/parse | Not implemented | Drag-and-drop PDF/Excel/CSV/DOCX/Images |
| No document generation | Basic HTML report | Downloadable PDFs, Excel, Word files |
| Side-panel only | 400px Sheet overlay | Dual-mode: side panel + full-page `/edith` |
| Single tool-call round | One tool loop only | Multi-turn chaining (max 5 iterations) |
| No page context | Hook exists but unwired | Full NC/page context sent to AI |
| Lovable dependency | Hardcoded gateway | Swappable provider with fallback |
| No usage tracking | None | Per-tenant metering for billing |
| No tenant config | Fixed assistant name | Customizable name, avatar, personality |

---

## Implementation Plan

### Phase 1: Provider Abstraction Layer (Pre-requisite for all sprints)

Create a modular AI provider system that allows swapping between Lovable AI, Anthropic Claude, Google Gemini, and OpenAI.

#### 1.1 Database Changes
```sql
-- Provider configuration per tenant
CREATE TABLE edith_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL UNIQUE,
  assistant_name TEXT DEFAULT 'Edith',
  assistant_avatar_url TEXT,
  personality_prompt TEXT,
  welcome_message TEXT DEFAULT 'Hi! I''m Edith, your QMS AI assistant.',
  suggested_prompts JSONB DEFAULT '[]',
  enabled_tools JSONB DEFAULT '[]',
  monthly_message_limit INTEGER DEFAULT 500,
  monthly_doc_gen_limit INTEGER DEFAULT 20,
  -- Provider configuration
  ai_provider TEXT DEFAULT 'lovable' CHECK (ai_provider IN ('lovable', 'anthropic', 'openai', 'google')),
  ai_model TEXT DEFAULT 'google/gemini-3-flash-preview',
  fallback_provider TEXT CHECK (fallback_provider IN ('lovable', 'anthropic', 'openai', 'google')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking for billing
CREATE TABLE edith_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID,
  timestamp TIMESTAMPTZ DEFAULT now(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  tool_calls_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  estimated_cost_usd DECIMAL(10,6),
  interaction_type TEXT CHECK (interaction_type IN ('chat', 'tool', 'document', 'import', 'export'))
);

-- Materialized view for usage summary
CREATE MATERIALIZED VIEW edith_usage_summary AS
SELECT 
  tenant_id,
  date_trunc('month', timestamp) AS month,
  COUNT(*) AS total_messages,
  SUM(input_tokens + output_tokens) AS total_tokens,
  SUM(estimated_cost_usd) AS total_cost,
  COUNT(DISTINCT user_id) AS active_users
FROM edith_usage_log
GROUP BY tenant_id, date_trunc('month', timestamp);
```

#### 1.2 Edge Function Architecture

Create a provider abstraction layer in `edith-chat/index.ts`:

```text
┌─────────────────────────────────────────────────────────────────┐
│                      edith-chat Edge Function                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Request   │───▶│ Provider Router │───▶│  AI Provider    │ │
│  │   Handler   │    │                 │    │  Abstraction    │ │
│  └─────────────┘    └─────────────────┘    └────────┬────────┘ │
│                                                       │          │
│                     ┌────────────────────────────────┴────────┐ │
│                     ▼                ▼                ▼        │ │
│              ┌──────────┐    ┌──────────┐    ┌──────────────┐  │ │
│              │ Lovable  │    │ Anthropic│    │ OpenAI/      │  │ │
│              │ Gateway  │    │ Claude   │    │ Google       │  │ │
│              └──────────┘    └──────────┘    └──────────────┘  │ │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Tool Executor│◀──▶│ Streaming    │◀──▶│ Usage Tracker    │  │
│  │ (multi-turn) │    │ Handler      │    │ (per-tenant)     │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Provider Interface:**
```typescript
interface AIProvider {
  name: string;
  chat(params: ChatParams): Promise<Response>; // Streaming response
  estimateCost(inputTokens: number, outputTokens: number): number;
}

interface ChatParams {
  model: string;
  messages: Message[];
  tools?: Tool[];
  stream: boolean;
  maxTokens?: number;
}
```

**Provider Implementations:**
- `LovableProvider`: Current implementation using `ai.gateway.lovable.dev`
- `AnthropicProvider`: Direct Claude API with `ANTHROPIC_API_KEY`
- `OpenAIProvider`: Direct OpenAI API with `OPENAI_API_KEY`
- `GoogleProvider`: Direct Gemini API with `GOOGLE_API_KEY`

---

### Phase 2: Sprint 1 - Real Chat Feel (8 days)

#### 2.1 Streaming Responses (3 days)

**Backend Changes:**
- Modify `edith-chat` to return SSE streaming response
- Stream tool execution status chips inline
- Handle fallback to blob response if streaming fails

```typescript
// SSE streaming implementation
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    
    // Stream AI response chunks
    for await (const chunk of aiStream) {
      const data = `data: ${JSON.stringify(chunk)}\n\n`;
      controller.enqueue(encoder.encode(data));
    }
    
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  }
});

return new Response(stream, {
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

**Frontend Changes:**
- Refactor `useEdith` hook to consume `ReadableStream`
- Update `EdithChat` for incremental markdown rendering
- Add tool execution status chips ("Querying NCs...", "Generating report...")

#### 2.2 Rich Input System (2 days)

**Replace Input with Textarea:**
```tsx
// New EdithInput component
- Auto-resizing (min 1 line, grows to ~8 lines, then scrolls)
- Shift+Enter for new line, Enter to send
- Attachment button (wired for Sprint 2)
- Paste support for text and files
- Context indicator showing current page/NC
```

#### 2.3 Page Context Injection (1 day)

**Wire `useEdithNCContext` to API:**
```typescript
// Extend request body with pageContext
{
  messages: [...],
  conversationId: "...",
  pageContext: {
    currentPage: "/nc/abc-123",
    ncData: { // Full NC when on detail page
      ncNumber: "NC-2026-02-00001",
      status: "open",
      severity: "major",
      description: "...",
      responsiblePerson: "...",
      dueDate: "2026-02-10",
      // ... all NC fields
    },
    filters: { // When on NC list
      status: ["open"],
      severity: ["critical", "major"],
    },
    dashboardMetrics: { // When on dashboard
      dateRange: "last30days",
      visibleStats: ["open", "overdue", "closed"],
    }
  }
}
```

**Update system prompt:**
```
The user is currently viewing [page type] with the following context:
[Serialized pageContext]
```

#### 2.4 Multi-Turn Tool Chaining (2 days)

**Implement iteration loop:**
```typescript
const MAX_TOOL_ITERATIONS = 5;
let iteration = 0;
let messages = [...initialMessages];

while (iteration < MAX_TOOL_ITERATIONS) {
  const response = await callAI(messages);
  
  if (!response.tool_calls || response.tool_calls.length === 0) {
    // Final text response - stream to client
    return streamResponse(response.content);
  }
  
  // Execute ALL tool calls
  const toolResults = await Promise.all(
    response.tool_calls.map(tc => executeToolCall(tc))
  );
  
  // Add tool calls and results to conversation
  messages.push({ role: 'assistant', tool_calls: response.tool_calls });
  messages.push(...toolResults.map(r => ({ role: 'tool', ...r })));
  
  iteration++;
}
```

---

### Phase 3: Sprint 2 - Document Pipeline (10 days)

#### 3.1 File Upload & Parsing (4 days)

**Storage Setup:**
```sql
-- Storage bucket for Edith uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('edith-uploads', 'edith-uploads', false);

-- RLS: Only owner tenant can access
CREATE POLICY "Tenant isolation" ON storage.objects
FOR ALL USING (
  bucket_id = 'edith-uploads' AND
  (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text
);
```

**New Edge Function: `edith-process-file`**
```typescript
// File type handlers
const parsers = {
  'application/pdf': pdfParse,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': parseExcel,
  'text/csv': parseCSV,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDocx,
  'image/*': processImage, // Send to Vision API
};
```

**Frontend Upload Flow:**
1. User drags file or clicks attachment button
2. Validate type/size (max 25MB)
3. Upload to Supabase Storage: `edith-uploads/{tenant_id}/{conversation_id}/{filename}`
4. Call `edith-process-file` to parse
5. Inject parsed content into AI context
6. Render file card in chat

#### 3.2 Document Generation (4 days)

**New Edge Function: `edith-generate-document`**
```typescript
// Template types
type DocumentTemplate = 
  | 'nc_summary_pdf'
  | 'overdue_excel'
  | 'audit_checklist_pdf'
  | 'corrective_action_pdf'
  | 'compliance_assessment_pdf'
  | 'procedure_docx'
  | 'management_review_pdf'
  | 'conversation_export_pdf';

// Generation pipeline
async function generateDocument(template: DocumentTemplate, data: any, tenantConfig: TenantConfig) {
  // Apply tenant branding (logo, colors, company name)
  const branded = applyBranding(data, tenantConfig);
  
  switch (template) {
    case 'nc_summary_pdf':
      return renderPDF(ncSummaryTemplate, branded);
    case 'overdue_excel':
      return renderExcel(overdueTemplate, branded);
    // ...
  }
}
```

**Dependencies:**
- PDF: `@react-pdf/renderer` or HTML-to-PDF via Puppeteer
- Excel: `exceljs` or `sheetjs`
- DOCX: `docx` package

#### 3.3 Rich File Cards in Chat (2 days)

```tsx
interface FileCardProps {
  filename: string;
  size: number;
  type: 'pdf' | 'xlsx' | 'docx' | 'csv' | 'image';
  downloadUrl: string; // Signed URL with 24hr expiry
  uploadedAt: Date;
}

// Inline rendering in chat
<FileCard 
  filename="NC-Summary-Feb-2026.pdf"
  size={245000}
  type="pdf"
  downloadUrl="https://..."
/>
```

---

### Phase 4: Sprint 3 - Full-Page Experience (8 days)

#### 4.1 Dual-Mode Interface (3 days)

**New Route: `/edith`**
- Full-page Edith experience
- Conversation list sidebar with search
- Full-width message rendering
- Drag-and-drop zone for files
- Suggested prompts based on context

**Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│  App Header                                           [Menu]  │
├──────────────┬────────────────────────────────────────────────┤
│              │                                                │
│  Conversation│            Main Chat Area                      │
│  List        │                                                │
│              │  ┌──────────────────────────────────────────┐  │
│  [+ New]     │  │  User: Show all overdue NCs              │  │
│              │  │                                          │  │
│  Today       │  │  Edith: Found 5 overdue NCs...           │  │
│  ├─ Conv 1   │  │  ┌────────────────────────────────────┐  │  │
│  ├─ Conv 2   │  │  │ NC-2026-02-00001 | Major | 3 days │  │  │
│              │  │  │ NC-2026-02-00002 | Minor | 1 day  │  │  │
│  Yesterday   │  │  └────────────────────────────────────┘  │  │
│  ├─ Conv 3   │  │                                          │  │
│              │  │  [View] [Export] [Send Reminders]        │  │
│  Pinned ⭐    │  └──────────────────────────────────────────┘  │
│  ├─ Audit Q  │                                                │
│              │  ┌──────────────────────────────────────────┐  │
│              │  │ [📎] Type your message...      [Send ▶]  │  │
│              │  └──────────────────────────────────────────┘  │
├──────────────┴────────────────────────────────────────────────┤
│  Suggested: "What's overdue?" | "NC trends" | "Generate report│
└───────────────────────────────────────────────────────────────┘
```

#### 4.2 Suggested Prompts System (2 days)

**Context-aware suggestions:**
```typescript
const suggestions = {
  dashboard: [
    "What's overdue?",
    "Show NC trends this month",
    "Generate performance report"
  ],
  ncList: [
    "Find NCs missing root cause",
    "Who has the most open actions?",
    "Export this list as Excel"
  ],
  ncDetail: [
    "What ISO clause applies to this NC?",
    "Draft corrective action for this",
    "Send reminder to responsible person"
  ],
  fullPageEdith: [
    "Import data from spreadsheet",
    "Help me write a procedure",
    "Prepare audit checklist for Clause 10"
  ],
};
```

#### 4.3 Rich Message Types (2 days)

| Type | Component | Use Case |
|------|-----------|----------|
| Data Table | Sortable, filterable inline table | NC listings, user tasks |
| File Card | Icon + name + download button | Generated PDFs, exports |
| Action Card | Confirm/cancel buttons | "Close these 5 NCs?" |
| NC Reference | Clickable card with status badge | NC-2026-02-00001 |
| Status Chip | Compact notification | "3 reminders sent" |
| Chart | Inline Recharts visualization | NC trends, severity distribution |

#### 4.4 Conversation Management (1 day)

- Conversation list with search and date filtering
- Auto-generated titles from first message (renameable)
- Pin important conversations
- Delete with soft delete and audit trail
- Export conversation as PDF

---

### Phase 5: Sprint 4 - White-Label & Usage Tracking (8 days)

#### 5.1 Per-Tenant Configuration (3 days)

**Settings UI: `/settings/edith`**
```tsx
// Tenant admin can configure:
- Assistant name (e.g., "Minnie" for Mining Corp)
- Custom avatar image upload
- Personality prompt additions
- Welcome message
- Suggested prompts (JSONB editor)
- Enabled tools per role
- Monthly message/doc limits
- AI provider selection (if allowed)
```

#### 5.2 Usage Tracking & Dashboard (3 days)

**Usage logging on every AI call:**
```typescript
await supabase.from('edith_usage_log').insert({
  tenant_id,
  user_id,
  conversation_id,
  provider: 'anthropic',
  model: 'claude-3-opus',
  input_tokens: usage.prompt_tokens,
  output_tokens: usage.completion_tokens,
  tool_calls_count: toolCalls.length,
  latency_ms: endTime - startTime,
  estimated_cost_usd: calculateCost(provider, model, tokens),
  interaction_type: 'chat',
});
```

**Admin Dashboard Component:**
```tsx
// Show in /settings or dedicated /edith/admin
- Messages used this month vs limit (progress bar)
- Documents generated vs limit
- Active users count
- Top users by message count
- Cost estimate breakdown (if admin)
```

#### 5.3 Limit Enforcement (2 days)

```typescript
// Before processing each request
const { count } = await supabase
  .from('edith_usage_log')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .gte('timestamp', startOfMonth());

const config = await getTenantConfig(tenantId);

if (count >= config.monthly_message_limit) {
  throw new Error('Monthly message limit reached. Contact administrator.');
}
```

---

## Technical Implementation Details

### API Keys & Secrets Required

| Secret | Purpose | When Needed |
|--------|---------|-------------|
| `LOVABLE_API_KEY` | Lovable AI Gateway (existing) | Default provider |
| `ANTHROPIC_API_KEY` | Anthropic Claude API | When Claude selected |
| `OPENAI_API_KEY` | OpenAI API | When OpenAI selected |
| `GOOGLE_API_KEY` | Google Gemini API | When Gemini direct selected |

### Files to Create

```text
src/
├── components/edith/
│   ├── EdithFullPage.tsx          # Full-page layout
│   ├── EdithConversationList.tsx  # Sidebar conversation list
│   ├── EdithInput.tsx             # Rich textarea input
│   ├── EdithFileCard.tsx          # File attachment card
│   ├── EdithDataTable.tsx         # Inline data tables
│   ├── EdithActionCard.tsx        # Confirm/cancel actions
│   ├── EdithNCReference.tsx       # Clickable NC cards
│   ├── EdithChart.tsx             # Inline charts
│   ├── EdithSuggestedPrompts.tsx  # Quick-start buttons
│   └── EdithStreamingMessage.tsx  # Streaming message renderer
├── hooks/
│   ├── useEdithStreaming.tsx      # SSE stream consumer
│   └── useEdithFileUpload.tsx     # File upload handling
├── pages/
│   └── Edith.tsx                  # Full-page /edith route
└── pages/settings/
    └── EdithSettings.tsx          # Tenant configuration UI

supabase/functions/
├── edith-chat/
│   ├── index.ts                   # Main handler (refactored)
│   ├── providers/
│   │   ├── lovable.ts             # Lovable AI Gateway
│   │   ├── anthropic.ts           # Claude provider
│   │   ├── openai.ts              # OpenAI provider
│   │   └── google.ts              # Gemini provider
│   ├── streaming.ts               # SSE streaming utilities
│   └── usage.ts                   # Usage tracking
├── edith-process-file/
│   └── index.ts                   # File parsing
└── edith-generate-document/
    └── index.ts                   # Document generation (enhanced)
```

### Database Migrations Required

1. **Create `edith_tenant_config` table**
2. **Create `edith_usage_log` table**
3. **Create `edith_usage_summary` materialized view**
4. **Create Supabase Storage bucket `edith-uploads`**
5. **Add RLS policies for new tables**

---

## Testing Strategy

### Unit Tests
- Provider abstraction layer (mock API responses)
- File parser functions (sample files)
- Document generation templates

### Integration Tests
- Full chat flow with streaming
- Multi-turn tool chaining (5 iterations)
- File upload → parse → context injection
- Document generation → storage → download

### E2E Tests
- User uploads Excel, Edith parses and offers import
- User requests PDF report, downloads successfully
- Multi-provider fallback when primary fails
- Usage limit enforcement blocks excess requests

---

## Estimated Timeline

| Sprint | Duration | Key Deliverables |
|--------|----------|------------------|
| 0: Provider Abstraction | 3 days | Multi-provider architecture, DB migrations |
| 1: Real Chat Feel | 8 days | Streaming, rich input, context, multi-turn |
| 2: Document Pipeline | 10 days | File upload/parse, document generation |
| 3: Full-Page Experience | 8 days | /edith route, rich message types, suggestions |
| 4: White-Label & Usage | 8 days | Tenant config, usage tracking, limits |

**Total: ~37 working days (~7-8 weeks)**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Provider API changes | Abstraction layer isolates changes to provider module |
| Rate limiting | Implement tenant-level rate limits + provider fallback |
| Large file uploads | Chunked uploads, size limits, async processing |
| Streaming failures | Graceful fallback to blob response |
| Cost overruns | Usage tracking + hard limits per tenant |
