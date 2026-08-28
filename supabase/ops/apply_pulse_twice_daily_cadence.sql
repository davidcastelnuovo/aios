-- Campaign pulse WhatsApp delivery: exactly twice per day (07:00 + 16:00 Asia/Jerusalem).
-- Snapshot refresh from sync crons stays deliver:false; only scheduled crons send WA.

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
  current_slot := CASE
    WHEN local_now::time >= time '06:50' AND local_now::time < time '07:40'
      THEN date_trunc('day', local_now) + interval '7 hours'
    WHEN local_now::time >= time '15:50' AND local_now::time < time '16:40'
      THEN date_trunc('day', local_now) + interval '16 hours'
    ELSE NULL
  END;
  IF current_slot IS NULL THEN RETURN false; END IF;

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

-- Morning 07:00 + afternoon 16:00 Israel (04:00 / 13:00 UTC during IDT).
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
    WHERE jobname IN ('campaign-pulse-morning-0730', 'campaign-pulse-morning-0700', 'campaign-pulse-afternoon-1600')
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
-- Re-applied via apply-sql-migration.yml to install morning/afternoon deliver crons.
