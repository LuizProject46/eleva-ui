-- Migration 024: Schedule daily run of check-periodicity-deadlines Edge Function.
-- Requires pg_cron and pg_net. On Supabase hosted with Vault, store secrets then the schedule will run:
--   SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
-- (Vault extension is only available on Supabase hosted; local/dev may not have it.)

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Schedule daily at 08:00 only when vault schema and secrets exist (e.g. Supabase hosted)
DO $$
DECLARE
  has_vault boolean;
  has_url boolean;
  has_key boolean;
  job_sql text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault') INTO has_vault;
  IF NOT has_vault THEN
    RAISE NOTICE 'Vault schema not found; cron schedule skipped. On Supabase hosted, add vault secrets and re-run the schedule SQL from the migration comments.';
    RETURN;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_url USING 'project_url';
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_key USING 'service_role_key';
  IF NOT has_url OR NOT has_key THEN
    RAISE NOTICE 'Vault secrets project_url and/or service_role_key not found; cron schedule skipped.';
    RETURN;
  END IF;

  job_sql := $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/check-periodicity-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $job$;

  PERFORM cron.schedule(
    'check-periodicity-deadlines-daily',
    '0 8 * * *',
    job_sql
  );
  RAISE NOTICE 'Scheduled check-periodicity-deadlines daily at 08:00.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron schedule skipped: %', SQLERRM;
END $$;
