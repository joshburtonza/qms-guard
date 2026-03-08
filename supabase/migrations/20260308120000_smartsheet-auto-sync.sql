-- Enable extensions (idempotent)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Add sync status columns to non_conformances
alter table non_conformances
  add column if not exists smartsheet_sync_status text default null
    check (smartsheet_sync_status in ('synced', 'failed', 'pending')),
  add column if not exists smartsheet_synced_at timestamptz default null;

-- Trigger function: fires after INSERT or UPDATE on non_conformances
-- Sets sync status to 'pending' and calls the smartsheet-sync edge function async
create or replace function trigger_nc_smartsheet_sync()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sync_enabled boolean;
  v_supabase_url text;
  v_service_role_key text;
begin
  -- Check if sync is enabled for this tenant
  select sync_enabled into v_sync_enabled
  from smartsheet_config
  where tenant_id = NEW.tenant_id
  limit 1;

  if v_sync_enabled is not true then
    return NEW;
  end if;

  -- Mark as pending (will be updated by edge function on completion)
  update non_conformances
    set smartsheet_sync_status = 'pending'
  where id = NEW.id;

  -- Read settings
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);

  if v_supabase_url is null or v_service_role_key is null then
    return NEW;
  end if;

  -- Async HTTP call to edge function
  perform net.http_post(
    url := v_supabase_url || '/functions/v1/smartsheet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'action', 'sync_to_smartsheet',
      'tenantId', NEW.tenant_id,
      'ncId', NEW.id
    )
  );

  return NEW;
end;
$$;

-- Drop trigger if it already exists, then recreate
drop trigger if exists nc_after_change_smartsheet_sync on non_conformances;

create trigger nc_after_change_smartsheet_sync
  after insert or update of status, current_step, description, severity, category, due_date,
    responsible_person, root_cause, corrective_action, completion_date, closed_at
  on non_conformances
  for each row
  execute function trigger_nc_smartsheet_sync();

-- Cron job: retry failed syncs every 30 minutes
select cron.schedule(
  'smartsheet-retry-failed',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/smartsheet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'action', 'retry_failed'
    )
  )
  $$
);
