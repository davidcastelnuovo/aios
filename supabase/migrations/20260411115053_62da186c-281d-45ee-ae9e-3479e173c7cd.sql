
-- Helper function to check if a user has cross-tenant access to a client
CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_client_access(p_user_id uuid, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = p_client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
  )
$$;

-- ==========================================
-- client_contacts: Add cross-tenant SELECT
-- ==========================================
DROP POLICY IF EXISTS "Users can view client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can view client contacts in their tenant"
ON public.client_contacts FOR SELECT TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can update client contacts in their tenant"
ON public.client_contacts FOR UPDATE TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can delete client contacts in their tenant" ON public.client_contacts;
CREATE POLICY "Users can delete client contacts in their tenant"
ON public.client_contacts FOR DELETE TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- client_credentials: Add cross-tenant SELECT/UPDATE/DELETE
-- ==========================================
DROP POLICY IF EXISTS "Users can view credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can view credentials in their tenant"
ON public.client_credentials FOR SELECT TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can update credentials in their tenant"
ON public.client_credentials FOR UPDATE TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can delete credentials in their tenant" ON public.client_credentials;
CREATE POLICY "Users can delete credentials in their tenant"
ON public.client_credentials FOR DELETE TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- client_updates: Add cross-tenant SELECT
-- ==========================================
DROP POLICY IF EXISTS "Users can view client updates in their tenant" ON public.client_updates;
CREATE POLICY "Users can view client updates in their tenant"
ON public.client_updates FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- client_tenant_financial_data: Add cross-tenant SELECT/UPDATE
-- ==========================================
DROP POLICY IF EXISTS "Users can view financial data in their tenant" ON public.client_tenant_financial_data;
CREATE POLICY "Users can view financial data in their tenant"
ON public.client_tenant_financial_data FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = client_tenant_financial_data.client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update financial data in their tenant" ON public.client_tenant_financial_data;
CREATE POLICY "Users can update financial data in their tenant"
ON public.client_tenant_financial_data FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = client_tenant_financial_data.client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- ==========================================
-- communication_logs: Add cross-tenant SELECT
-- ==========================================
DROP POLICY IF EXISTS "Tenant users can view communication_logs" ON public.communication_logs;
CREATE POLICY "Tenant users can view communication_logs"
ON public.communication_logs FOR SELECT TO authenticated
USING (
  tenant_id = get_effective_tenant_id()
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = communication_logs.client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);
