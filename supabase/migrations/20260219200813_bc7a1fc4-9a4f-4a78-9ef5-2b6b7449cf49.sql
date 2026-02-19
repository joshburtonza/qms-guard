
-- Workflow configurations table for admin-managed automation settings
CREATE TABLE public.workflow_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_key TEXT NOT NULL, -- e.g. 'wf1_qa_classify', 'wf7_reminder'
  workflow_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL DEFAULT 'database_change', -- 'database_change', 'scheduled', 'manual'
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"table":"non_conformances","field":"status","event":"UPDATE"}
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of condition objects
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of action objects (send_email, update_record, etc.)
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- configurable recipient list
  email_subject_template TEXT,
  email_body_template TEXT,
  schedule_interval TEXT, -- for scheduled: '3 days', '7 days', etc.
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, workflow_key)
);

-- Workflow execution log
CREATE TABLE public.workflow_execution_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.workflow_configurations(id),
  nc_id UUID REFERENCES public.non_conformances(id),
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed', 'skipped'
  recipients_notified TEXT[],
  error_message TEXT,
  execution_details JSONB DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_execution_log ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage workflow configs in their tenant
CREATE POLICY "Admins can manage workflow configs"
  ON public.workflow_configurations
  FOR ALL
  USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "Users can view workflow configs in tenant"
  ON public.workflow_configurations
  FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()));

-- RLS: Admins can view execution logs
CREATE POLICY "Admins can view execution logs"
  ON public.workflow_execution_log
  FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "System can insert execution logs"
  ON public.workflow_execution_log
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_workflow_configurations_updated_at
  BEFORE UPDATE ON public.workflow_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
