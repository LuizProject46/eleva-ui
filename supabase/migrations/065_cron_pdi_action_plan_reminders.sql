-- Migration 065: Schedule daily run of check-pdi-action-plan-reminders Edge Function via pg_cron.
-- Uses pg_cron + pg_net; reuses Vault secrets project_url and service_role_key (same as 024).
-- Reminder logic lives in the Edge Function; cron only triggers it on a schedule.

DO $$
DECLARE
  has_vault boolean;
  has_url boolean;
  has_key boolean;
  job_sql text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault') INTO has_vault;
  IF NOT has_vault THEN
    RAISE NOTICE 'Vault schema not found; PDI reminder cron schedule skipped. On Supabase hosted, add vault secrets and re-run.';
    RETURN;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_url USING 'project_url';
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_key USING 'service_role_key';
  IF NOT has_url OR NOT has_key THEN
    RAISE NOTICE 'Vault secrets project_url and/or service_role_key not found; PDI reminder cron schedule skipped.';
    RETURN;
  END IF;

  job_sql := $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/check-pdi-action-plan-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $job$;

  PERFORM cron.schedule(
    'check-pdi-action-plan-reminders-daily',
    '0 8 * * *',
    job_sql
  );
  RAISE NOTICE 'Scheduled check-pdi-action-plan-reminders daily at 08:00.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PDI reminder cron schedule skipped: %', SQLERRM;
END $$;
