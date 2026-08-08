-- facebook_ecommerce CRM tables had a sync edge function but no pg_cron job.
-- Only facebook_insights was scheduled twice-daily, so ecommerce clients
-- (e.g. 4/4 ארבע על ארבע) could sit with a July last_sync while Meta/Google
-- connections were otherwise fine — false "sync old" in health/pulse.
--
-- Align with other ads syncs: 05:05 and 12:05 UTC (just after insights).

DO $ecommerce_cron$
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
    RAISE NOTICE 'No cron auth secret in Vault; facebook ecommerce cron not scheduled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'cron-sync-facebook-ecommerce-daily'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'cron-sync-facebook-ecommerce-daily',
    '5 5,12 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/cron-sync-facebook-ecommerce',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );
END;
$ecommerce_cron$;
