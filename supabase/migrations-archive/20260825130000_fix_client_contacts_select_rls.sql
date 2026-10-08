-- client_contacts SELECT/UPDATE/DELETE still filtered on viewer tenant_id while INSERT
-- stores the client's owning tenant_id — saved rows were invisible to the same user.
UPDATE public.client_contacts AS cc
SET tenant_id = c.tenant_id
FROM public.clients AS c
WHERE cc.client_id = c.id
  AND cc.tenant_id IS DISTINCT FROM c.tenant_id;

DROP POLICY IF EXISTS "Users can view client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can view client contacts in their tenant"
ON public.client_contacts FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR user_can_access_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can update client contacts in their tenant"
ON public.client_contacts FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Users can delete client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can delete client contacts in their tenant"
ON public.client_contacts FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR user_can_access_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can insert client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can insert client contacts in their tenant"
ON public.client_contacts FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_client_tenant_id(client_id)
  AND (
    is_super_admin(auth.uid())
    OR user_can_access_client(auth.uid(), client_id)
  )
);
