
DROP POLICY IF EXISTS "Owners view all clients in tenant" ON public.clients;

CREATE POLICY "Owners view all clients in tenant"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);
