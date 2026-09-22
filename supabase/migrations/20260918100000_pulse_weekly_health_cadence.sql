-- Health digest WA: weekly on Sunday 07:30 Jerusalem (was twice daily).
-- Pulse WA claim remains weekly Sunday 07:00 (see 20260915153000).

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
  IF EXTRACT(ISODOW FROM local_now) <> 7 THEN
    RETURN false;
  END IF;
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
