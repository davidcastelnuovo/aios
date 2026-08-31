-- Install morning (07:00) + afternoon (16:00) Israel campaign pulse delivery crons.
-- Applied via install-pulse-delivery-crons workflow: __SUPABASE_SERVICE_ROLE_KEY__
-- is substituted from the Management API service_role key (never committed).

DO $pulse_crons$
DECLARE
  worker_secret text := '__SUPABASE_SERVICE_ROLE_KEY__';
  existing_job bigint;
BEGIN
  IF worker_secret IS NULL OR worker_secret = '' OR worker_secret = '__SUPABASE_SERVICE_ROLE_KEY__' THEN
    RAISE EXCEPTION 'Pulse cron secret placeholder not substituted';
  END IF;

  -- Persist for future ops that read vault (apply_pulse_twice_daily_cadence.sql).
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret(worker_secret, 'service_role_key', 'Service role for pg_cron HTTP calls');
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'campaign-pulse-morning-0730',
      'campaign-pulse-morning-0700',
      'campaign-pulse-afternoon-1600'
    )
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'campaign-pulse-morning-0700',
    '0 4 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/campaign-pulse-snapshot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := jsonb_build_object(
          'deliver', true,
          'source', 'morning_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );

  PERFORM cron.schedule(
    'campaign-pulse-afternoon-1600',
    '0 13 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/campaign-pulse-snapshot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := jsonb_build_object(
          'deliver', true,
          'source', 'afternoon_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );
END;
$pulse_crons$;

-- Verification (visible in migration apply logs)
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('campaign-pulse-morning-0700', 'campaign-pulse-afternoon-1600')
ORDER BY jobname;
