-- Production apply for supabase/migrations/20260918150000_pulse_campaign_goal_breakdown.sql
-- and supabase/migrations/20260918193000_campaign_operational_checks_every_two_hours.sql.
-- Idempotent: safe to re-run.

ALTER TABLE public.campaign_pulse_snapshots
  ADD COLUMN IF NOT EXISTS campaign_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.campaign_pulse_snapshots.campaign_breakdown IS
  'Deterministic campaign rows classified by platform objective/explicit mapping into leads, engagement, ecommerce, or unknown. Includes complete-day 3d/7d trends, weekday-normalized 28d baseline, approved target, status reason, and alert eligibility.';

DO $alert_log$
BEGIN
  IF to_regclass('public.pulse_instant_alert_log') IS NULL THEN
    RAISE EXCEPTION 'pulse_instant_alert_log missing — run apply_pulse_refresh_and_instant_alerts.sql first';
  END IF;

  ALTER TABLE public.pulse_instant_alert_log
    DROP CONSTRAINT IF EXISTS pulse_instant_alert_log_rule_type_check;

  ALTER TABLE public.pulse_instant_alert_log
    ADD CONSTRAINT pulse_instant_alert_log_rule_type_check
    CHECK (rule_type IN ('no_contact', 'cpl_spike', 'connection_lost', 'campaign_exception'));

  ALTER TABLE public.pulse_instant_alert_log
    ADD COLUMN IF NOT EXISTS campaign_key text,
    ADD COLUMN IF NOT EXISTS fingerprint text,
    ADD COLUMN IF NOT EXISTS severity_score numeric,
    ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

  CREATE INDEX IF NOT EXISTS idx_pulse_instant_alert_log_campaign_dedupe
    ON public.pulse_instant_alert_log (
      tenant_id,
      client_id,
      campaign_key,
      rule_type,
      sent_at DESC
    );
END;
$alert_log$;

-- Cheap operational checks every two hours. They read campaign/account status only;
-- the heavier Insights sync that feeds the pulse KPI windows stays on its own cadence.
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

  -- Fall back to the project URL already baked into an existing pulse cron so the
  -- same file applies to Staging and Production without hardcoding a project ref.
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
    RAISE NOTICE 'Operational campaign checks not scheduled: project URL or service role secret missing';
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

-- Verification. The Management API returns only the last statement, so the
-- column check runs last and lands in the apply logs.
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('meta-operational-check-2h', 'google-ads-operational-check-2h')
ORDER BY jobname;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('campaign_pulse_snapshots', 'pulse_instant_alert_log')
  AND column_name IN ('campaign_breakdown', 'campaign_key', 'fingerprint', 'severity_score', 'evidence')
ORDER BY table_name, column_name;
