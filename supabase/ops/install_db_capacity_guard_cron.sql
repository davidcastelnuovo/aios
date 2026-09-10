-- Install/refresh the 2-minute db-capacity-guard cron on THIS project.
-- Replace the URL if applying on Staging.

DO $db_capacity_cron$
DECLARE
  worker_secret text;
  existing_job bigint;
  functions_url text := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/db-capacity-guard';
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN (
    'CAMPAIGN_PULSE_CRON_SECRET',
    'service_role_key',
    'SUPABASE_SERVICE_ROLE_KEY',
    'task_worker_anon_key'
  )
  ORDER BY CASE name
    WHEN 'CAMPAIGN_PULSE_CRON_SECRET' THEN 0
    WHEN 'service_role_key' THEN 1
    WHEN 'SUPABASE_SERVICE_ROLE_KEY' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' THEN
    RAISE EXCEPTION 'No cron secret in Vault';
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'db-capacity-guard-every-2-min'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'db-capacity-guard-every-2-min',
    '*/2 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cron$,
      functions_url,
      worker_secret
    )
  );
END;
$db_capacity_cron$;
