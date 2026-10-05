-- Report syncs feed בדיקת הדופק, which refreshes at 04:00 and 13:00 UTC.
-- Google Ads was once a day and Facebook's second run was after the afternoon
-- pulse, so the dashboard was calculated on stale rows.
-- Runs are twice daily and finish before each pulse refresh. The next batch is
-- queued through pg_net, and the cron bearer is read from Vault at run time.

CREATE OR REPLACE FUNCTION public.kick_internal_function(p_function text, p_body jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  project_url text;
  worker_secret text;
  request_id bigint;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_function NOT IN (
    'cron-sync-google-ads',
    'cron-sync-facebook-insights',
    'cron-sync-facebook-ecommerce',
    'cron-sync-google-analytics'
  ) THEN
    RAISE EXCEPTION 'invalid function';
  END IF;

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

  IF project_url IS NULL OR worker_secret IS NULL OR worker_secret = '' THEN
    RAISE EXCEPTION 'kick secrets missing';
  END IF;

  SELECT net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 150000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kick_internal_function(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_internal_function(text, jsonb) TO service_role;

DO $morning_sync$
DECLARE
  project_url text;
  job_name text;
  job_schedule text;
  fn text;
  cmd text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL', 'supabase_url', 'project_url')
  ORDER BY CASE name WHEN 'SUPABASE_URL' THEN 0 WHEN 'supabase_url' THEN 1 ELSE 2 END
  LIMIT 1;

  IF project_url IS NULL OR project_url = '' THEN
    RAISE NOTICE 'Morning report crons not updated: project URL missing from Vault';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
      AND coalesce(decrypted_secret, '') <> ''
  ) THEN
    RAISE NOTICE 'Morning report crons not updated: service role missing from Vault';
    RETURN;
  END IF;

  -- Twice a day, before the pulse refreshes at 04:00 and 13:00 UTC
  -- (07:00 and 16:00 Israel during IDT). Staggered so the ads APIs are not
  -- hit by every provider in the same minute. Existing jobs are retimed;
  -- a once-daily Google Ads job would leave the afternoon pulse stale.
  FOR job_name, job_schedule, fn IN
    SELECT * FROM (VALUES
      ('daily-google-ads-sync'::text, '40 2,11 * * *'::text, 'cron-sync-google-ads'::text),
      ('sync-facebook-insights-twice-daily'::text, '45 2,11 * * *'::text, 'cron-sync-facebook-insights'::text),
      ('cron-sync-facebook-ecommerce-daily'::text, '50 2,11 * * *'::text, 'cron-sync-facebook-ecommerce'::text),
      ('daily-ga-sync'::text, '55 2,11 * * *'::text, 'cron-sync-google-analytics'::text)
    ) AS jobs(jobname, schedule, fn)
  LOOP
    cmd := format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
            ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
            LIMIT 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cron$,
      rtrim(project_url, '/') || '/functions/v1/' || fn
    );

    SELECT jobid INTO existing_job FROM cron.job WHERE jobname = job_name LIMIT 1;
    IF existing_job IS NULL THEN
      PERFORM cron.schedule(job_name, job_schedule, cmd);
    ELSE
      PERFORM cron.alter_job(job_id := existing_job, schedule := job_schedule, command := cmd);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE NOTICE 'pg_cron, pg_net, or Vault is unavailable; morning report crons not updated';
END;
$morning_sync$;
