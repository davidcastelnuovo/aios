-- Separate Carmen's two reporting cadences:
-- 1. Campaign performance digest: at most once every 24 hours.
-- 2. Connection/infrastructure health digest: twice daily after ad syncs.

CREATE OR REPLACE FUNCTION public.claim_campaign_pulse_delivery(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.tenant_heartbeat_settings
  SET campaign_pulse_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      campaign_pulse_last_sent_at IS NULL
      OR campaign_pulse_last_sent_at < now() - interval '24 hours'
    )
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_pulse_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_pulse_delivery(uuid) TO service_role;

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS health_digest_last_sent_at timestamptz;

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
  current_slot := CASE
    WHEN local_now::time >= time '08:20' AND local_now::time < time '09:00'
      THEN date_trunc('day', local_now) + interval '8 hours'
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
