-- Ops: Sunday 09:00 pulse cadence + scoped delivery to campaigners and PMM (team managers) on DMM.
-- David request 2026-09-18 — apply via apply-sql-migration workflow.

CREATE OR REPLACE FUNCTION public.claim_campaign_pulse_delivery(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  local_now timestamp := timezone('Asia/Jerusalem', now());
  current_slot timestamp;
  affected_rows integer := 0;
BEGIN
  IF EXTRACT(ISODOW FROM local_now) <> 7 THEN
    RETURN false;
  END IF;

  IF local_now::time < time '08:50' OR local_now::time >= time '09:40' THEN
    RETURN false;
  END IF;

  current_slot := date_trunc('day', local_now) + interval '9 hours';

  UPDATE public.tenant_heartbeat_settings
  SET campaign_pulse_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      campaign_pulse_last_sent_at IS NULL
      OR timezone('Asia/Jerusalem', campaign_pulse_last_sent_at) < current_slot
    );
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_pulse_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_pulse_delivery(uuid) TO service_role;

DO $pulse_crons$
DECLARE
  worker_secret text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('CAMPAIGN_PULSE_CRON_SECRET', 'service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name
    WHEN 'CAMPAIGN_PULSE_CRON_SECRET' THEN 0
    WHEN 'service_role_key' THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' THEN
    RAISE NOTICE 'No pulse cron secret in Vault; pulse crons not scheduled';
    RETURN;
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'campaign-pulse-morning-0730',
      'campaign-pulse-morning-0700',
      'campaign-pulse-afternoon-1600',
      'campaign-pulse-sunday-0700',
      'campaign-pulse-sunday-0900'
    )
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'campaign-pulse-sunday-0900',
    '0 6 * * 0',
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
          'source', 'sunday_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );
END;
$pulse_crons$;

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_enabled = true,
  campaign_pulse_deliver_to_campaigners = true,
  campaign_pulse_deliver_to_team_managers = true,
  updated_at = now()
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug = 'dmm';

SELECT
  t.slug,
  ths.campaign_pulse_enabled,
  ths.campaign_pulse_deliver_to_campaigners,
  ths.campaign_pulse_deliver_to_team_managers,
  ths.campaign_pulse_phone
FROM public.tenant_heartbeat_settings ths
JOIN public.tenants t ON t.id = ths.tenant_id
WHERE t.slug = 'dmm';

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'campaign-pulse-sunday-0900';
