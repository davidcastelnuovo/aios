-- Track failed Marketing Captain lead-alert deliveries and notify David via Carmen.
-- Rows are queued by trigger-automation; cron-lead-alert-failure-watch delivers WA alerts.

CREATE TABLE IF NOT EXISTS public.lead_alert_failure_notifications (
  automation_log_id uuid PRIMARY KEY REFERENCES public.automation_logs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_phone text,
  lead_name text,
  client_name text,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lead_alert_failure_notifications_pending
  ON public.lead_alert_failure_notifications (tenant_id, created_at)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lead_alert_failure_notifications_notified
  ON public.lead_alert_failure_notifications (tenant_id, notified_at DESC);

ALTER TABLE public.lead_alert_failure_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_alert_failure_notifications_read"
  ON public.lead_alert_failure_notifications FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

COMMENT ON TABLE public.lead_alert_failure_notifications IS
  'Failed ManyChat lead-alert sends; Carmen notifies David when delivery fails.';

-- Cron: every 15 minutes, deliver pending failure alerts (MC tenant).
DO $lead_alert_fail_cron$
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
    RAISE NOTICE 'No cron secret in Vault; lead-alert failure watch cron not scheduled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'lead-alert-failure-watch-15m'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'lead-alert-failure-watch-15m',
    '*/15 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/cron-lead-alert-failure-watch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
      $cron$,
      worker_secret
    )
  );
END;
$lead_alert_fail_cron$;
