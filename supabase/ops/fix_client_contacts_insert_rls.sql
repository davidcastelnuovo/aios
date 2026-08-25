-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260825120000_fix_client_contacts_insert_rls.sql

-- INSERT on client_contacts was stricter than SELECT/UPDATE/DELETE and never
-- allowed anyone who can open the client card (owners, managers, campaigners,
-- shared-agency viewers) to add additional contacts.
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
