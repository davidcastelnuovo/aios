-- Re-enable hourly Woo sync for Aviali (avieli.co.il) — manual refresh was failing since Aug 2026
-- because sync-woocommerce-data sent YYYY-MM-DD to WooCommerce `after` (needs ISO8601 date-time).
UPDATE public.social_media_wordpress_sites
SET woo_sync_enabled = true
WHERE id = '7d15854d-88c8-4361-ac23-6f7caafed00e'
  AND woocommerce_enabled = true
  AND is_active = true;
