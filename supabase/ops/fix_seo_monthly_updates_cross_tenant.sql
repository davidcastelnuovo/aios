-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260803150000_fix_seo_monthly_updates_cross_tenant.sql

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
