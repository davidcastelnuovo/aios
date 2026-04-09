-- Drop the existing overly-restrictive UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their tenants" ON public.clients;

-- Create a single comprehensive UPDATE policy that supports cross-tenant access
CREATE POLICY "Users can update clients in their or shared tenants"
ON public.clients
FOR UPDATE
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
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (has_role(auth.uid(), 'campaigner'::app_role) AND id = ANY(get_user_client_ids(auth.uid())))
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_user_tenant_id(auth.uid())
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (has_role(auth.uid(), 'campaigner'::app_role) AND id = ANY(get_user_client_ids(auth.uid())))
    )
  )
);