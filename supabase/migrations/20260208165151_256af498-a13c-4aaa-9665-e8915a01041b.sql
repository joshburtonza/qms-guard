-- ============================================================
-- MIGRATION: Fix tenant_id auto-population on child tables
-- Addresses CRITICAL multi-tenancy security hole
-- ============================================================

-- 1. Create the trigger function to auto-populate tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-set if tenant_id wasn't explicitly provided
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- If still NULL (edge case: no profile yet), use default tenant
    IF NEW.tenant_id IS NULL THEN
      -- Get the first tenant as fallback (for edge cases)
      SELECT id INTO NEW.tenant_id FROM public.tenants LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Attach trigger to all child tables (DROP IF EXISTS to be idempotent)
DROP TRIGGER IF EXISTS set_corrective_actions_tenant ON public.corrective_actions;
CREATE TRIGGER set_corrective_actions_tenant
  BEFORE INSERT ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

DROP TRIGGER IF EXISTS set_nc_attachments_tenant ON public.nc_attachments;
CREATE TRIGGER set_nc_attachments_tenant
  BEFORE INSERT ON public.nc_attachments
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

DROP TRIGGER IF EXISTS set_nc_activity_log_tenant ON public.nc_activity_log;
CREATE TRIGGER set_nc_activity_log_tenant
  BEFORE INSERT ON public.nc_activity_log
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

DROP TRIGGER IF EXISTS set_workflow_approvals_tenant ON public.workflow_approvals;
CREATE TRIGGER set_workflow_approvals_tenant
  BEFORE INSERT ON public.workflow_approvals
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- 3. Backfill any existing NULL tenant_id records with the first tenant
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants LIMIT 1;
  
  IF default_tenant_id IS NOT NULL THEN
    UPDATE public.corrective_actions SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.nc_attachments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.nc_activity_log SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.workflow_approvals SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;