-- Staging: daily client-retention alert. Once each morning, the stored pulse
-- and CRM mood are ranked and a short recommendation is queued to the tenant
-- pulse phone. Clients are never messaged. 05:00 UTC is 08:00 during IDT.

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS client_retention_last_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_client_retention_delivery(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  affected_rows integer := 0;
BEGIN
  UPDATE public.tenant_heartbeat_settings
  SET client_retention_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      client_retention_last_sent_at IS NULL
      OR timezone('Asia/Jerusalem', client_retention_last_sent_at)::date
         < timezone('Asia/Jerusalem', now())::date
    );
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_retention_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_retention_delivery(uuid) TO service_role;

DO $retention_daily$
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

  IF project_url IS NULL THEN
    SELECT (regexp_match(command, 'https://[a-z0-9-]+\.supabase\.co'))[1] INTO project_url
    FROM cron.job
    WHERE command ~ 'https://[a-z0-9-]+\.supabase\.co/functions/v1/'
    ORDER BY jobid
    LIMIT 1;
  END IF;

  SELECT decrypted_secret INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR worker_secret IS NULL THEN
    RAISE EXCEPTION 'Daily retention alert not scheduled: project URL or service role secret missing';
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'client-retention-daily-0800'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'client-retention-daily-0800',
    '0 5 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/campaign-pulse-snapshot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{"retention_daily":true}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cron$,
      rtrim(project_url, '/'),
      worker_secret
    )
  );
END;
$retention_daily$;
