ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS meta_ads_account_id text,
  ADD COLUMN IF NOT EXISTS google_ads_account_id text;