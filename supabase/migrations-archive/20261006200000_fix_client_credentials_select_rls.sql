-- client_credentials INSERT stores tenant_id = client's owning tenant, but SELECT
-- still filtered on viewer tenant_id — saved passwords were invisible (same as
-- client_contacts fix in 20260825130000).

UPDATE public.client_credentials AS cc
SET tenant_id = c.tenant_id,
    updated_at = now()
FROM public.clients AS c
WHERE cc.client_id = c.id
  AND cc.tenant_id IS DISTINCT FROM c.tenant_id;

DROP POLICY IF EXISTS "Users can view credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can view credentials in their tenant"
ON public.client_credentials FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR user_can_access_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can update credentials in their tenant"
ON public.client_credentials FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR user_can_access_client(auth.uid(), client_id)
)
WITH CHECK (
  tenant_id = get_client_tenant_id(client_id)
  AND (
    is_super_admin(auth.uid())
    OR user_can_access_client(auth.uid(), client_id)
  )
);

DROP POLICY IF EXISTS "Users can delete credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can delete credentials in their tenant"
ON public.client_credentials FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR user_can_access_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can insert credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can insert credentials in their tenant"
ON public.client_credentials FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_client_tenant_id(client_id)
  AND (
    is_super_admin(auth.uid())
    OR user_can_access_client(auth.uid(), client_id)
  )
);
