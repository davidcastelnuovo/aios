-- Fix client DELETE for campaigners (and team managers) on shared-agency clients.
--
-- Background: 20260803140000 fixed cross-tenant UPDATE for clients/tasks but DELETE
-- was never aligned. Campaigners could see and edit assigned clients on shared agencies
-- (e.g. DMM-MC ↔ MarketingCaptain) but delete returned 0 rows while the UI showed
-- success. Mirror the UPDATE scope for DELETE; drop the overly broad tenant-only
-- delete policy that did not cover cross-tenant rows anyway.

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
