-- Align seo_call_snapshots RLS with seo_monthly_updates: tenant_users membership +
-- cross-agency client access, with explicit WITH CHECK on UPDATE for upserts.

DROP POLICY IF EXISTS "Read snapshots in tenant or shared agency" ON public.seo_call_snapshots;
DROP POLICY IF EXISTS "Insert snapshots in tenant or shared agency" ON public.seo_call_snapshots;
DROP POLICY IF EXISTS "Update snapshots in tenant or shared agency" ON public.seo_call_snapshots;
DROP POLICY IF EXISTS "Delete snapshots in tenant or shared agency" ON public.seo_call_snapshots;

CREATE POLICY "seo_call_snapshots_tenant_access"
ON public.seo_call_snapshots
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
