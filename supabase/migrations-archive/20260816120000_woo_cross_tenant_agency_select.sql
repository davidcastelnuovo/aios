-- Restore cross-tenant agency SELECT on WP sites (defined in 20260531101252 but missing in prod)
-- and mirror it for WooCommerce orders so shared-agency dashboards (e.g. DMM-MC / אביאלי)
-- show store revenue when the viewer's session tenant differs from the site's home tenant.

DROP POLICY IF EXISTS "Cross-tenant agency access to wp sites" ON public.social_media_wordpress_sites;
CREATE POLICY "Cross-tenant agency access to wp sites"
ON public.social_media_wordpress_sites
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL
  AND public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
);

DROP POLICY IF EXISTS "woo_orders_agency_cross_tenant_select" ON public.woocommerce_orders;
CREATE POLICY "woo_orders_agency_cross_tenant_select"
ON public.woocommerce_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_media_wordpress_sites s
    WHERE s.id = woocommerce_orders.site_id
      AND s.agency_id IS NOT NULL
      AND public.user_has_cross_tenant_agency_access(auth.uid(), s.agency_id)
  )
);
