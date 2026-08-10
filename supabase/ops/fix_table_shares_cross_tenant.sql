-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260810190000_fix_table_shares_cross_tenant.sql

DROP POLICY IF EXISTS "Users can manage their tenant table shares" ON public.table_shares;

CREATE POLICY "Users can manage their tenant table shares"
ON public.table_shares
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1
    FROM public.crm_tables t
    WHERE t.id = table_shares.table_id
      AND public.user_can_access_crm_table(auth.uid(), t.id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1
    FROM public.crm_tables t
    WHERE t.id = table_shares.table_id
      AND t.tenant_id = table_shares.tenant_id
      AND public.user_can_access_crm_table(auth.uid(), t.id)
  )
);
