ALTER TABLE public.social_media_wordpress_sites
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS woocommerce_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS woocommerce_consumer_key text,
  ADD COLUMN IF NOT EXISTS woocommerce_consumer_secret text,
  ADD COLUMN IF NOT EXISTS last_woocommerce_sync_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_smws_client_id ON public.social_media_wordpress_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_smws_tenant_id ON public.social_media_wordpress_sites(tenant_id);