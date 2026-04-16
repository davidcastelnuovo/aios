ALTER TABLE public.social_media_wordpress_sites
ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_media_wordpress_sites_agency_id 
ON public.social_media_wordpress_sites(agency_id);