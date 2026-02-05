-- Enable vector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Sequence for conversation numbering
CREATE SEQUENCE IF NOT EXISTS edith_conversation_seq START WITH 1 INCREMENT BY 1;

-- Edith conversation history
CREATE TABLE edith_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_number TEXT UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edith messages (separate table for better querying)
CREATE TABLE edith_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES edith_conversations(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edith knowledge base (for RAG)
CREATE TABLE edith_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- null = global knowledge
  content_type TEXT NOT NULL CHECK (content_type IN ('documentation', 'nc', 'code', 'regulation', 'survey', 'moderation', 'course_evaluation')),
  title TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI ada-002 compatible
  metadata JSONB DEFAULT '{}',
  source_id UUID, -- Reference to original record (nc_id, survey_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON edith_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Edith actions log (audit trail)
CREATE TABLE edith_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  conversation_id UUID REFERENCES edith_conversations(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('query', 'create', 'update', 'delete', 'report', 'email', 'search')),
  action_details JSONB NOT NULL,
  affected_table TEXT,
  affected_ids UUID[],
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate conversation number
CREATE OR REPLACE FUNCTION generate_edith_conversation_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_slug TEXT;
BEGIN
  SELECT slug INTO tenant_slug FROM public.tenants WHERE id = NEW.tenant_id;
  NEW.conversation_number := 'EDITH-' || COALESCE(UPPER(tenant_slug), 'DEFAULT') || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('public.edith_conversation_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-generating conversation number
CREATE TRIGGER generate_edith_conversation_number_trigger
BEFORE INSERT ON edith_conversations
FOR EACH ROW
EXECUTE FUNCTION generate_edith_conversation_number();

-- Enable RLS on all Edith tables
ALTER TABLE edith_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE edith_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE edith_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE edith_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for edith_conversations
CREATE POLICY "Users can view own conversations"
ON edith_conversations FOR SELECT
USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Users can create own conversations"
ON edith_conversations FOR INSERT
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Users can update own conversations"
ON edith_conversations FOR UPDATE
USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Users can delete own conversations"
ON edith_conversations FOR DELETE
USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

-- RLS Policies for edith_messages
CREATE POLICY "Users can view messages in own conversations"
ON edith_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM edith_conversations ec 
    WHERE ec.id = edith_messages.conversation_id 
    AND ec.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in own conversations"
ON edith_messages FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM edith_conversations ec 
    WHERE ec.id = edith_messages.conversation_id 
    AND ec.user_id = auth.uid()
  )
);

-- RLS Policies for edith_knowledge
CREATE POLICY "Users can view knowledge in own tenant or global"
ON edith_knowledge FOR SELECT
USING (tenant_id IS NULL OR tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Admins can manage knowledge"
ON edith_knowledge FOR ALL
USING (is_admin(auth.uid()) AND (tenant_id IS NULL OR tenant_id = get_user_tenant(auth.uid())));

-- RLS Policies for edith_actions
CREATE POLICY "Users can view own actions"
ON edith_actions FOR SELECT
USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Users can log own actions"
ON edith_actions FOR INSERT
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

-- Admins can view all actions in tenant
CREATE POLICY "Admins can view all tenant actions"
ON edith_actions FOR SELECT
USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant(auth.uid()));

-- Index for faster conversation lookups
CREATE INDEX idx_edith_conversations_user ON edith_conversations(user_id, tenant_id);
CREATE INDEX idx_edith_messages_conversation ON edith_messages(conversation_id);
CREATE INDEX idx_edith_actions_user ON edith_actions(user_id, tenant_id);
CREATE INDEX idx_edith_knowledge_tenant ON edith_knowledge(tenant_id);
CREATE INDEX idx_edith_knowledge_type ON edith_knowledge(content_type);

-- Updated_at trigger for conversations
CREATE TRIGGER update_edith_conversations_updated_at
BEFORE UPDATE ON edith_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for knowledge
CREATE TRIGGER update_edith_knowledge_updated_at
BEFORE UPDATE ON edith_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();