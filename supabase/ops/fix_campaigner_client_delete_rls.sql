-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260827100000_fix_campaigner_client_delete_rls.sql

DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can delete clients in their tenants" ON public.clients;
DROP POLICY IF EXISTS "Users can delete clients in their or shared tenants" ON public.clients;

CREATE POLICY "Users can delete clients in their or shared tenants"
ON public.clients
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_user_tenant_id(auth.uid())
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR (
        has_role(auth.uid(), 'team_manager'::app_role)
        AND user_manages_agency(auth.uid(), agency_id)
      )
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND id = ANY (get_user_client_ids(auth.uid()))
      )
    )
  )
);
