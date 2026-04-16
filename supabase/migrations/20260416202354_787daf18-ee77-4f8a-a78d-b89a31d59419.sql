ALTER TABLE public.social_media_wordpress_sites
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS woo_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS woo_last_sync_at timestamptz;

-- Backfill woo_last_sync_at from the new last_woocommerce_sync_at column if any rows already have it
UPDATE public.social_media_wordpress_sites
SET woo_last_sync_at = last_woocommerce_sync_at
WHERE last_woocommerce_sync_at IS NOT NULL AND woo_last_sync_at IS NULL;