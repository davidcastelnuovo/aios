-- Split campaign pulse metrics by goal (leads vs ecommerce) for hybrid clients.

ALTER TABLE public.campaign_pulse_snapshots
  ADD COLUMN IF NOT EXISTS campaign_goal_mode text NOT NULL DEFAULT 'leads'
    CHECK (campaign_goal_mode IN ('leads', 'ecommerce', 'hybrid')),
  ADD COLUMN IF NOT EXISTS lead_spend_7d numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ecommerce_spend_7d numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roas_change_pct numeric,
  ADD COLUMN IF NOT EXISTS lead_goal_status text
    CHECK (lead_goal_status IS NULL OR lead_goal_status IN ('healthy', 'warning', 'critical', 'no_data')),
  ADD COLUMN IF NOT EXISTS ecommerce_goal_status text
    CHECK (ecommerce_goal_status IS NULL OR ecommerce_goal_status IN ('healthy', 'warning', 'critical', 'no_data'));

COMMENT ON COLUMN public.campaign_pulse_snapshots.campaign_goal_mode IS
  'Primary campaign goal mix: leads-only, ecommerce-only, or hybrid (both Meta insights + ecommerce tables).';
COMMENT ON COLUMN public.campaign_pulse_snapshots.lead_spend_7d IS
  '7-day spend from lead-generation tables (facebook_insights, google_ads).';
COMMENT ON COLUMN public.campaign_pulse_snapshots.ecommerce_spend_7d IS
  '7-day spend from facebook_ecommerce tables.';
COMMENT ON COLUMN public.campaign_pulse_snapshots.roas_change_pct IS
  'ROAS % change vs prior equal window (ecommerce goal only).';
COMMENT ON COLUMN public.campaign_pulse_snapshots.lead_goal_status IS
  'Status for the leads goal when hybrid; mirrors status when leads-only.';
COMMENT ON COLUMN public.campaign_pulse_snapshots.ecommerce_goal_status IS
  'Status for the ecommerce goal when hybrid; mirrors status when ecommerce-only.';
