-- Enrich deterministic campaign pulse snapshots with Meta Ads activity history.
-- The snapshot job reads /act_<id>/activities and stores the latest campaign,
-- ad-set or ad change from the last 30 days. No access token is stored here.

alter table public.campaign_pulse_snapshots
  add column if not exists last_meta_change_at timestamptz,
  add column if not exists last_meta_change_type text,
  add column if not exists last_meta_change_actor text,
  add column if not exists last_meta_change_object text,
  add column if not exists meta_change_availability text;

comment on column public.campaign_pulse_snapshots.meta_change_availability is
  'available, no_campaign_change_in_30d, ad_account_not_connected, meta_token_unavailable, or meta_api_unavailable';
