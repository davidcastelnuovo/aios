-- table_shares were locked to get_effective_tenant_id(), so SEO tables hosted on a
-- sibling tenant (shared agency, e.g. DMM-MC viewed from MarketingCaptain) could be
-- read via user_can_access_crm_table but share links could not be created.

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
