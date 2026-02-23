-- Add api_key column to smartsheet_config for per-tenant Smartsheet token storage
ALTER TABLE public.smartsheet_config ADD COLUMN IF NOT EXISTS api_key TEXT;
