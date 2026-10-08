-- Fix correlated subquery bug in shared-access SELECT policies.
-- Previous policies compared junction-table columns to themselves (sp.social_page_id = sp.id)
-- instead of to the outer row (sp.social_page_id = social_pages.id).

-- ── social_pages ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "social_pages_tenant_select" ON public.social_pages;

CREATE POLICY "social_pages_tenant_select" ON public.social_pages
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_pages_shared_tenants sp
      WHERE sp.social_page_id = social_pages.id
        AND sp.tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

-- ── social_media_wordpress_sites ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wordpress_sites_shared_select" ON public.social_media_wordpress_sites;

CREATE POLICY "wordpress_sites_shared_select" ON public.social_media_wordpress_sites
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.wordpress_sites_shared_tenants ws
      WHERE ws.site_id = social_media_wordpress_sites.id
        AND ws.tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );
