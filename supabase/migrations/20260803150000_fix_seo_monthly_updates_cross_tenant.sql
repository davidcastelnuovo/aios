-- Fix: SEO monthly work ("עבודה שבוצעה") invisible on shared agencies.
--
-- Production replaced the intended FOR ALL policy
-- (seo_monthly_updates_tenant_access, with user_has_cross_tenant_client_access)
-- with per-command policies that require:
--   tenant_id = get_effective_tenant_id()
-- MarketingCaptain team managers (e.g. Anna) therefore get 0 rows for DMM-MC
-- clients whose seo_monthly_updates.tenant_id is the DMM tenant — July/May
-- look empty even though work JSON is fully populated.
--
-- Restore the cross-tenant-aware policy from 20260411115429 / schema.sql.

DROP POLICY IF EXISTS "seo_monthly_updates_select" ON public.seo_monthly_updates;
DROP POLICY IF EXISTS "seo_monthly_updates_write" ON public.seo_monthly_updates;
DROP POLICY IF EXISTS "seo_monthly_updates_update" ON public.seo_monthly_updates;
DROP POLICY IF EXISTS "seo_monthly_updates_delete" ON public.seo_monthly_updates;
DROP POLICY IF EXISTS "seo_monthly_updates_tenant_access" ON public.seo_monthly_updates;

CREATE POLICY "seo_monthly_updates_tenant_access"
ON public.seo_monthly_updates
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
)
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);
