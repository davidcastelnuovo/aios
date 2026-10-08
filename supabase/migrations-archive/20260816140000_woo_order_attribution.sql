-- WooCommerce Order Attribution (native WC _wc_order_attribution_* meta fields).
ALTER TABLE public.woocommerce_orders
  ADD COLUMN IF NOT EXISTS attribution jsonb DEFAULT NULL;

COMMENT ON COLUMN public.woocommerce_orders.attribution IS
  'Order traffic source from WooCommerce Order Attribution meta (_wc_order_attribution_*): source_type, utm_*, referrer, session_entry, label';

CREATE INDEX IF NOT EXISTS idx_woo_orders_attribution_label
  ON public.woocommerce_orders ((attribution->>'label'))
  WHERE attribution IS NOT NULL;
