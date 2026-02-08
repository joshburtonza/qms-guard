-- Create Smartsheet integration configuration table
CREATE TABLE public.smartsheet_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  sheet_name TEXT,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  webhook_id TEXT,
  webhook_secret TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Create sync log table for tracking changes
CREATE TABLE public.smartsheet_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nc_id UUID REFERENCES public.non_conformances(id) ON DELETE SET NULL,
  smartsheet_row_id TEXT,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('to_smartsheet', 'from_smartsheet')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('create', 'update', 'delete')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add smartsheet_row_id to non_conformances for tracking
ALTER TABLE public.non_conformances 
ADD COLUMN smartsheet_row_id TEXT;

-- Enable RLS
ALTER TABLE public.smartsheet_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartsheet_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for smartsheet_config
CREATE POLICY "Admins can manage Smartsheet config"
ON public.smartsheet_config
FOR ALL
USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "Users can view Smartsheet config"
ON public.smartsheet_config
FOR SELECT
USING (tenant_id = get_user_tenant(auth.uid()));

-- RLS policies for smartsheet_sync_log
CREATE POLICY "Admins can view sync logs"
ON public.smartsheet_sync_log
FOR SELECT
USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "System can insert sync logs"
ON public.smartsheet_sync_log
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- Create trigger to update updated_at
CREATE TRIGGER update_smartsheet_config_updated_at
BEFORE UPDATE ON public.smartsheet_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_nc_smartsheet_row_id ON public.non_conformances(smartsheet_row_id);
CREATE INDEX idx_sync_log_nc_id ON public.smartsheet_sync_log(nc_id);
CREATE INDEX idx_sync_log_tenant_created ON public.smartsheet_sync_log(tenant_id, created_at DESC);