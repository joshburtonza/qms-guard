-- activity-reporter.sql
-- Sends key NC events to the AOS Supabase client_activity table via pg_net.
-- Allows Sophia to monitor client usage and send proactive WhatsApp nudges.

create or replace function report_nc_activity()
returns trigger language plpgsql security definer as $$
declare
  _user_email text;
  _user_name  text;
  _event_type text;
  _aos_url    text := 'https://afmpbtynucpbglwtbfuz.supabase.co/rest/v1/client_activity';
  _aos_key    text := current_setting('app.aos_service_role_key', true);
  _payload    jsonb;
begin
  -- Determine event type
  if TG_OP = 'INSERT' then
    _event_type := 'nc_created';
  elsif NEW.status = 'closed' and (OLD.status is null or OLD.status <> 'closed') then
    _event_type := 'nc_closed';
  elsif NEW.status <> OLD.status then
    _event_type := 'nc_status_changed';
  else
    _event_type := 'nc_updated';
  end if;

  -- Get user info from profiles
  select email, full_name into _user_email, _user_name
  from profiles where id = coalesce(NEW.created_by, NEW.responsible_person_id);

  _payload := jsonb_build_object(
    'client_slug', 'ascend-lc',
    'event_type',  _event_type,
    'user_email',  _user_email,
    'user_name',   _user_name,
    'metadata',    jsonb_build_object(
      'nc_id',       NEW.id,
      'title',       NEW.title,
      'status',      NEW.status,
      'severity',    NEW.severity,
      'tenant_id',   NEW.tenant_id
    )
  );

  -- Fire async to AOS Supabase
  if _aos_key is not null and _aos_key <> '' then
    perform net.http_post(
      url     := _aos_url,
      headers := jsonb_build_object(
        'apikey',        _aos_key,
        'Authorization', 'Bearer ' || _aos_key,
        'Content-Type',  'application/json',
        'Prefer',        'return=minimal'
      ),
      body := _payload::text
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_nc_activity_report on non_conformances;
create trigger trigger_nc_activity_report
  after insert or update of status, current_step
  on non_conformances
  for each row execute function report_nc_activity();
