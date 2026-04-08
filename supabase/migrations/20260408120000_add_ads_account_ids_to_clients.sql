-- Add Meta Ads and Google Ads account ID fields to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS meta_ads_account_id text,
  ADD COLUMN IF NOT EXISTS google_ads_account_id text;

COMMENT ON COLUMN public.clients.meta_ads_account_id IS 'Meta (Facebook) Ads account ID';
COMMENT ON COLUMN public.clients.google_ads_account_id IS 'Google Ads account ID';
