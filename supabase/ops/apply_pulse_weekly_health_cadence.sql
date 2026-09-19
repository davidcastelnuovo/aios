-- Pulse + health WhatsApp: once per week (Sunday, Asia/Jerusalem).
-- Pulse WA: 07:00 via campaign-pulse-sunday-0700 cron (deliver:true).
-- Health WA: 07:30 window via carmen-health-probe (was twice daily).
-- Dashboard snapshot refresh stays twice-daily with deliver:false only.

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
  -- ISO day-of-week: 7 = Sunday.
  IF EXTRACT(ISODOW FROM local_now) <> 7 THEN
    RETURN false;
  END IF;

  -- Delivery window: Sunday 07:30 ±10 minutes (after weekly pulse cron).
  IF local_now::time < time '07:20' OR local_now::time >= time '07:50' THEN
    RETURN false;
  END IF;

  current_slot := date_trunc('day', local_now) + interval '7 hours 30 minutes';

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
  IF local_now::time < time '06:50' OR local_now::time >= time '07:40' THEN
    RETURN false;
  END IF;
  current_slot := date_trunc('day', local_now) + interval '7 hours';
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

-- Sunday 07:00 Israel deliver cron + vault bootstrap for pg_cron HTTP auth.
DO $pulse_crons$
DECLARE
  worker_secret text := '__SUPABASE_SERVICE_ROLE_KEY__';
  existing_job bigint;
BEGIN
  IF worker_secret IS NULL OR worker_secret = '' OR worker_secret = '__SUPABASE_SERVICE_ROLE_KEY__' THEN
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
  END IF;

  IF worker_secret IS NULL OR worker_secret = '' OR worker_secret = '__SUPABASE_SERVICE_ROLE_KEY__' THEN
    RAISE NOTICE 'No pulse cron secret available; pulse deliver cron not scheduled';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret(worker_secret, 'service_role_key', 'Service role for pg_cron HTTP calls');
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'campaign-pulse-morning-0730',
      'campaign-pulse-morning-0700',
      'campaign-pulse-afternoon-1600',
      'campaign-pulse-sunday-0700'
    )
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'campaign-pulse-sunday-0700',
    '0 4 * * 0',
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

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'campaign-pulse-sunday-0700';
