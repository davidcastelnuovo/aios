-- client_contacts INSERT was never updated for cross-tenant client access (unlike
-- SELECT/UPDATE/DELETE). Users working on shared-agency clients could add contacts
-- only when tenant_id matched get_effective_tenant_id(), which fails when the row
-- must belong to the client's owning tenant.
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

-- Same gap on client_credentials INSERT.
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
