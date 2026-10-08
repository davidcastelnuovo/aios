-- Campaign-level pulse evidence for three goal categories.
-- Existing client-level columns remain for backward compatibility.

ALTER TABLE public.campaign_pulse_snapshots
  ADD COLUMN IF NOT EXISTS campaign_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.campaign_pulse_snapshots.campaign_breakdown IS
  'Deterministic campaign rows classified by platform objective/explicit mapping into leads, engagement, ecommerce, or unknown. Includes complete-day 3d/7d trends, weekday-normalized 28d baseline, approved target, status reason, and alert eligibility.';

ALTER TABLE public.pulse_instant_alert_log
  DROP CONSTRAINT IF EXISTS pulse_instant_alert_log_rule_type_check;

ALTER TABLE public.pulse_instant_alert_log
  ADD CONSTRAINT pulse_instant_alert_log_rule_type_check
  CHECK (rule_type IN ('no_contact', 'cpl_spike', 'connection_lost', 'campaign_exception'));

ALTER TABLE public.pulse_instant_alert_log
  ADD COLUMN IF NOT EXISTS campaign_key text,
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS severity_score numeric,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pulse_instant_alert_log_campaign_dedupe
  ON public.pulse_instant_alert_log (
    tenant_id,
    client_id,
    campaign_key,
    rule_type,
    sent_at DESC
  );
