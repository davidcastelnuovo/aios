-- Apply pulse goal metrics columns (leads vs ecommerce split).

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
