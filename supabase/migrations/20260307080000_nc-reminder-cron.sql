-- Enable pg_cron and pg_net extensions for scheduled edge function calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the NC reminder edge function to run daily at 8:00 AM UTC (10:00 AM SAST)
-- This triggers the nc-scheduled-tasks function which sends overdue reminders and escalations
select cron.schedule(
  'nc-daily-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/nc-scheduled-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
