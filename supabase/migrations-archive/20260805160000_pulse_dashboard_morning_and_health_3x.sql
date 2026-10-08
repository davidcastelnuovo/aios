-- Pulse dashboard delivery cadence:
-- 1) Morning campaign pulse at 07:30 Asia/Jerusalem → WA gets dashboard link only.
-- 2) Connection/health digests three times/day (no "missing table" spam — UI only).

CREATE OR REPLACE FUNCTION public.claim_health_digest_delivery(p_tenant_id uuid)
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
  -- Three Israel-time windows: morning / midday / afternoon.
  current_slot := CASE
    WHEN local_now::time >= time '08:20' AND local_now::time < time '09:00'
      THEN date_trunc('day', local_now) + interval '8 hours'
    WHEN local_now::time >= time '12:20' AND local_now::time < time '13:00'
      THEN date_trunc('day', local_now) + interval '12 hours'
    WHEN local_now::time >= time '15:20' AND local_now::time < time '16:00'
      THEN date_trunc('day', local_now) + interval '15 hours'
    ELSE NULL
  END;
  IF current_slot IS NULL THEN RETURN false; END IF;

  UPDATE public.tenant_heartbeat_settings
  SET health_digest_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      health_digest_last_sent_at IS NULL
      OR timezone('Asia/Jerusalem', health_digest_last_sent_at) < current_slot
    );
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_health_digest_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_health_digest_delivery(uuid) TO service_role;

-- Morning pulse cron: 04:30 UTC ≈ 07:30 Asia/Jerusalem (IDT / UTC+3).
-- Uses CAMPAIGN_PULSE_CRON_SECRET when provisioned; otherwise skips safely.
DO $pulse_morning$
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
    RAISE NOTICE 'No pulse cron secret in Vault; morning pulse cron not scheduled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'campaign-pulse-morning-0730'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'campaign-pulse-morning-0730',
    '30 4 * * *',
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
          'force_delivery', true,
          'source', 'morning_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );
END;
$pulse_morning$;
