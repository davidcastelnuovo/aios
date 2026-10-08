ALTER TABLE public.social_media_wordpress_sites
ADD COLUMN IF NOT EXISTS campaign_url_mapping JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.social_media_wordpress_sites.campaign_url_mapping IS 'Maps URL slugs to Google Ads campaign IDs, e.g. {"north-india-ladakh": "23756715038"}';