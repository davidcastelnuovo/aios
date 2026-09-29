-- Staging: the daily client-retention WhatsApp is paused.
-- Re-apply: the first push skipped unscheduling client-retention-daily-0800.
-- David rejected the alert. Do not schedule client-retention-daily-0800.
-- claim_client_retention_delivery stays false so an old function deploy
-- cannot queue the message even if a leftover cron still fires.

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS client_retention_last_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_client_retention_delivery(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_retention_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_retention_delivery(uuid) TO service_role;

DO $retention_daily_off$
DECLARE
  existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'client-retention-daily-0800'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;
END;
$retention_daily_off$;
