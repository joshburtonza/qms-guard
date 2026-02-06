-- EDITH Enhancement: Provider Configuration and Usage Tracking
-- Phase 0: Database schema for multi-provider support

-- 1. Tenant-level EDITH configuration
CREATE TABLE public.edith_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL UNIQUE,
  
  -- Branding
  assistant_name TEXT DEFAULT 'Edith',
  assistant_avatar_url TEXT,
  personality_prompt TEXT,
  welcome_message TEXT DEFAULT 'Hi! I''m Edith, your QMS AI assistant. How can I help you today?',
  
  -- Features
  suggested_prompts JSONB DEFAULT '["Show my tasks", "What''s overdue?", "NC trends this month"]'::jsonb,
  enabled_tools JSONB DEFAULT '[]'::jsonb,
  
  -- Limits
  monthly_message_limit INTEGER DEFAULT 500,
  monthly_doc_gen_limit INTEGER DEFAULT 20,
  
  -- AI Provider Configuration
  ai_provider TEXT DEFAULT 'lovable' CHECK (ai_provider IN ('lovable', 'anthropic', 'openai', 'google')),
  ai_model TEXT DEFAULT 'google/gemini-3-flash-preview',
  fallback_provider TEXT CHECK (fallback_provider IS NULL OR fallback_provider IN ('lovable', 'anthropic', 'openai', 'google')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edith_tenant_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for edith_tenant_config
CREATE POLICY "Users can view their tenant config"
  ON public.edith_tenant_config FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Admins can manage tenant config"
  ON public.edith_tenant_config FOR ALL
  USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

-- 2. Usage tracking for billing and analytics
CREATE TABLE public.edith_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  conversation_id UUID REFERENCES public.edith_conversations(id),
  
  -- Provider info
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Token tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  tool_calls_count INTEGER DEFAULT 0,
  
  -- Performance
  latency_ms INTEGER,
  
  -- Cost tracking
  estimated_cost_usd DECIMAL(10,6),
  
  -- Interaction type
  interaction_type TEXT CHECK (interaction_type IN ('chat', 'tool', 'document', 'import', 'export')),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_edith_usage_tenant_month ON public.edith_usage_log (tenant_id, created_at);
CREATE INDEX idx_edith_usage_user ON public.edith_usage_log (user_id, created_at);

-- Enable RLS
ALTER TABLE public.edith_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for edith_usage_log
CREATE POLICY "Users can view own usage"
  ON public.edith_usage_log FOR SELECT
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Admins can view all tenant usage"
  ON public.edith_usage_log FOR SELECT
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "System can insert usage logs"
  ON public.edith_usage_log FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- 3. Add pinned flag to conversations
ALTER TABLE public.edith_conversations 
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. Add file attachments support to messages
ALTER TABLE public.edith_messages 
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 5. Create storage bucket for Edith uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'edith-uploads', 
  'edith-uploads', 
  false,
  26214400, -- 25MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        'application/vnd.ms-excel', 'text/csv', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for edith-uploads bucket
CREATE POLICY "Tenant users can upload to edith-uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'edith-uploads' AND
  (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text
);

CREATE POLICY "Tenant users can view edith-uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'edith-uploads' AND
  (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text
);

CREATE POLICY "Tenant users can delete own edith-uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'edith-uploads' AND
  (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text
);

-- 6. Trigger to update updated_at on config changes
CREATE OR REPLACE TRIGGER update_edith_tenant_config_updated_at
  BEFORE UPDATE ON public.edith_tenant_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create default config for existing tenants
INSERT INTO public.edith_tenant_config (tenant_id)
SELECT id FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.edith_tenant_config)
ON CONFLICT DO NOTHING;