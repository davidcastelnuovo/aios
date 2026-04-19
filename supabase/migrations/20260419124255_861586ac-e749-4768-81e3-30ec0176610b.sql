ALTER TABLE public.social_media_wordpress_sites
ADD COLUMN IF NOT EXISTS campaign_form_mapping jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.social_media_wordpress_sites.campaign_form_mapping IS 'Maps Elementor form_id to Google Ads campaign_id for lead verification. Format: { "form_id": "campaign_id" }';