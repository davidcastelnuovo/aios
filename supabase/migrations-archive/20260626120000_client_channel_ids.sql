-- Per-channel connection identifiers on clients, filled once in client details and
-- reused to provision per-channel dynamic tables/dashboards.
-- meta_ads_account_id / google_ads_account_id / website already exist.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ga_property_id text,   -- Google Analytics (GA4) property id — always shown
  ADD COLUMN IF NOT EXISTS gsc_site_url   text,   -- Search Console site url — SEO clients only
  ADD COLUMN IF NOT EXISTS ahrefs_domain  text;   -- Ahrefs project domain — SEO clients only

COMMENT ON COLUMN public.clients.ga_property_id IS 'Google Analytics GA4 property id (e.g. properties/123456789)';
COMMENT ON COLUMN public.clients.gsc_site_url   IS 'Google Search Console site URL (e.g. sc-domain:example.com)';
COMMENT ON COLUMN public.clients.ahrefs_domain  IS 'Ahrefs project domain (e.g. example.com)';
