-- Twice-daily pulse snapshot refresh (dashboard data only) + instant WA alert rules.

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS pulse_alert_rules jsonb NOT NULL DEFAULT '{
    "instant_wa_enabled": true,
    "no_contact_enabled": true,
    "no_contact_days": 14,
    "cpl_spike_enabled": true,
    "cpl_spike_pct": 50,
    "disconnected_enabled": true
  }'::jsonb;

COMMENT ON COLUMN public.tenant_heartbeat_settings.pulse_alert_rules IS
  'Tenant-level instant pulse WhatsApp alert toggles and thresholds.';

CREATE TABLE IF NOT EXISTS public.pulse_instant_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('no_contact', 'cpl_spike', 'connection_lost')),
  message text NOT NULL,
  recipient_phone text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_instant_alert_log_dedupe
  ON public.pulse_instant_alert_log (tenant_id, client_id, rule_type, sent_at DESC);

ALTER TABLE public.pulse_instant_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_instant_alert_log_read" ON public.pulse_instant_alert_log;
CREATE POLICY "pulse_instant_alert_log_read"
  ON public.pulse_instant_alert_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

GRANT SELECT ON public.pulse_instant_alert_log TO authenticated;
GRANT ALL ON public.pulse_instant_alert_log TO service_role;

-- Include meetings alongside calls for contact freshness.
CREATE OR REPLACE FUNCTION public.get_latest_client_call_updates(p_client_ids uuid[])
RETURNS TABLE (
  client_id uuid,
  last_client_call_at timestamptz,
  last_client_call_by text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (updates.client_id)
    updates.client_id,
    updates.created_at AS last_client_call_at,
    COALESCE(NULLIF(profiles.full_name, ''), profiles.email) AS last_client_call_by
  FROM public.client_updates AS updates
  LEFT JOIN public.profiles AS profiles ON profiles.id = updates.user_id
  WHERE updates.client_id = ANY (p_client_ids)
    AND (
      updates.update_type IN ('call', 'meeting')
      OR (
        updates.update_type = 'weekly_update'
        AND public.client_update_documents_phone_call(updates.content)
      )
    )
  ORDER BY updates.client_id, updates.created_at DESC;
$$;

-- Dashboard snapshot refresh: 07:00 + 16:00 Israel (deliver:false).
DO $pulse_refresh_crons$
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
    RAISE NOTICE 'No pulse cron secret in Vault; refresh crons not scheduled';
    RETURN;
  END IF;

  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('campaign-pulse-refresh-0700', 'campaign-pulse-refresh-1600')
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'campaign-pulse-refresh-0700',
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
          'deliver', false,
          'source', 'refresh_morning_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );

  PERFORM cron.schedule(
    'campaign-pulse-refresh-1600',
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
          'deliver', false,
          'source', 'refresh_afternoon_cron'
        ),
        timeout_milliseconds := 120000
      );
      $cron$,
      worker_secret
    )
  );
END;
$pulse_refresh_crons$;
