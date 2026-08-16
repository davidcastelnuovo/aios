-- אביאלי: share avieli.co.il Woo site with MarketingCaptain tenant + restore cross-tenant agency SELECT.
-- Site lives on DMM tenant; MC viewers need wordpress_sites_shared_tenants and/or agency cross-tenant RLS.

INSERT INTO public.wordpress_sites_shared_tenants (site_id, tenant_id)
VALUES (
  '7d15854d-88c8-4361-ac23-6f7caafed00e',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'  -- MarketingCaptain
)
ON CONFLICT (site_id, tenant_id) DO NOTHING;

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

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'cursor',
  'woo_avieli_dashboard_visibility',
  'social_media_wordpress_sites:7d15854d-88c8-4361-ac23-6f7caafed00e',
  jsonb_build_object(
    'client_id', '0117effa-063f-4579-989c-cdf8ec923fb9',
    'site_url', 'https://www.avieli.co.il',
    'shared_with_tenant', '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
    'orders_synced', 56
  )
);
