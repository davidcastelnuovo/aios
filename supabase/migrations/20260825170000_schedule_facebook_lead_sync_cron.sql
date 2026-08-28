-- Instant Form CRM intake had a poller (cron-sync-facebook-leads) and UI copy
-- saying leads are pulled every minute, but no pg_cron job was scheduled.
-- Realtime depends on the Page being subscribed to leadgen; this job is the
-- fallback so mapped forms still create CRM leads when the webhook misses.

DO $facebook_lead_cron$
DECLARE
  worker_secret text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('task_worker_anon_key', 'SUPABASE_ANON_KEY', 'service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name
    WHEN 'task_worker_anon_key' THEN 0
    WHEN 'SUPABASE_ANON_KEY' THEN 1
    WHEN 'service_role_key' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' THEN
    RAISE NOTICE 'No cron auth secret in Vault; facebook lead sync cron not scheduled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'cron-sync-facebook-leads'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'cron-sync-facebook-leads',
    '* * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/cron-sync-facebook-leads',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cron$,
      worker_secret
    )
  );
END;
$facebook_lead_cron$;
