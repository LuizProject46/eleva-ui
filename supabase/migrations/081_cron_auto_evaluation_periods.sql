-- Migration 081: Schedule daily run of auto-generate-evaluation-periods Edge Function.
-- Same prerequisites as 024_cron_periodicity.sql (pg_cron, pg_net, vault secrets).

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

DO $$
DECLARE
  has_vault boolean;
  has_url boolean;
  has_key boolean;
  job_sql text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault') INTO has_vault;
  IF NOT has_vault THEN
    RAISE NOTICE 'Vault schema not found; auto-generate-evaluation-periods cron skipped.';
    RETURN;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_url USING 'project_url';
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = $1)' INTO has_key USING 'service_role_key';
  IF NOT has_url OR NOT has_key THEN
    RAISE NOTICE 'Vault secrets missing; auto-generate-evaluation-periods cron skipped.';
    RETURN;
  END IF;

  job_sql := $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/auto-generate-evaluation-periods',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$;

  PERFORM cron.schedule(
    'auto-generate-evaluation-periods-daily',
    '15 8 * * *',
    job_sql
  );
  RAISE NOTICE 'Scheduled auto-generate-evaluation-periods daily at 08:15 UTC.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'auto-generate-evaluation-periods cron skipped: %', SQLERRM;
END $$;
