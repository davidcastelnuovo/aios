-- Production pulse cadence: weekly WA (Sunday 07:30) + twice-daily dashboard refresh + instant alert rules.

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
  IF local_now::time < time '07:20' OR local_now::time >= time '07:40' THEN
    RETURN false;
  END IF;
  current_slot := date_trunc('day', local_now) + interval '7 hours 30 minutes';
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

DO $pulse_wa_crons$
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
    RAISE NOTICE 'No pulse cron secret in Vault; WA crons not scheduled';
    RETURN;
  END IF;
  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'campaign-pulse-morning-0730',
      'campaign-pulse-morning-0700',
      'campaign-pulse-afternoon-1600',
      'campaign-pulse-sunday-0700',
      'campaign-pulse-sunday-0900',
      'campaign-pulse-sunday-0730'
    )
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;
  PERFORM cron.schedule(
    'campaign-pulse-sunday-0730',
    '30 4 * * 0',
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
$pulse_wa_crons$;

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
    WHERE jobname IN (
      'campaign-pulse-refresh-0700',
      'campaign-pulse-refresh-1600',
      'campaign-pulse-morning-0730',
      'campaign-pulse-morning-0700',
      'campaign-pulse-afternoon-1600'
    )
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
