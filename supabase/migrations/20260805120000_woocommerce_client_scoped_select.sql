-- WooCommerce / WordPress sites: allow SELECT when the user already has access
-- to the linked client (same scope as crm_dashboards / clients). Does NOT raise
-- roles — only opens rows the viewer can already reach via user_can_access_client.
-- Fixes empty Woo revenue on in-app dashboards when the session tenant differs
-- from the site/orders tenant (shared-agency / cross-tenant agency access).

-- WordPress sites: client-scoped read
DROP POLICY IF EXISTS "wordpress_sites_client_select" ON public.social_media_wordpress_sites;
CREATE POLICY "wordpress_sites_client_select"
ON public.social_media_wordpress_sites
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    client_id IS NOT NULL
    AND public.user_can_access_client(auth.uid(), client_id)
  )
);

-- WooCommerce orders / products / customers / sync_log: client-scoped read via site
DROP POLICY IF EXISTS "woo_orders_client_select" ON public.woocommerce_orders;
CREATE POLICY "woo_orders_client_select"
ON public.woocommerce_orders
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.social_media_wordpress_sites s
    WHERE s.id = woocommerce_orders.site_id
      AND s.client_id IS NOT NULL
      AND public.user_can_access_client(auth.uid(), s.client_id)
  )
);

DROP POLICY IF EXISTS "woo_products_client_select" ON public.woocommerce_products;
CREATE POLICY "woo_products_client_select"
ON public.woocommerce_products
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.social_media_wordpress_sites s
    WHERE s.id = woocommerce_products.site_id
      AND s.client_id IS NOT NULL
      AND public.user_can_access_client(auth.uid(), s.client_id)
  )
);

DROP POLICY IF EXISTS "woo_customers_client_select" ON public.woocommerce_customers;
CREATE POLICY "woo_customers_client_select"
ON public.woocommerce_customers
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.social_media_wordpress_sites s
    WHERE s.id = woocommerce_customers.site_id
      AND s.client_id IS NOT NULL
      AND public.user_can_access_client(auth.uid(), s.client_id)
  )
);

DROP POLICY IF EXISTS "woo_sync_log_client_select" ON public.woocommerce_sync_log;
CREATE POLICY "woo_sync_log_client_select"
ON public.woocommerce_sync_log
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.social_media_wordpress_sites s
    WHERE s.id = woocommerce_sync_log.site_id
      AND s.client_id IS NOT NULL
      AND public.user_can_access_client(auth.uid(), s.client_id)
  )
);

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'rls_woo_client_scoped_select',
  'woocommerce_*+social_media_wordpress_sites',
  jsonb_build_object(
    'rule', 'SELECT Woo/WP rows when user_can_access_client on site.client_id',
    'client', 'בילבי',
    'reason', 'dashboard Woo revenue empty when session tenant != site tenant'
  )
);
