-- Cheap operational checks every two hours. These read campaign/account status
-- only; they do not run the heavier Insights sync used by the pulse KPI windows.
DO $operational_crons$
DECLARE
  project_url text;
  worker_secret text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL', 'supabase_url', 'project_url')
  ORDER BY CASE name WHEN 'SUPABASE_URL' THEN 0 WHEN 'supabase_url' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT decrypted_secret INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR worker_secret IS NULL THEN
    RAISE NOTICE 'Operational campaign checks not scheduled: SUPABASE_URL or service role secret missing';
    RETURN;
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('meta-operational-check-2h', 'google-ads-operational-check-2h')
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'meta-operational-check-2h',
    '15 */2 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/fb-campaign-monitor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cron$,
      rtrim(project_url, '/'),
      worker_secret
    )
  );

  PERFORM cron.schedule(
    'google-ads-operational-check-2h',
    '25 */2 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/cron-sync-google-ads',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{"operational_only":true}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cron$,
      rtrim(project_url, '/'),
      worker_secret
    )
  );
END;
$operational_crons$;
