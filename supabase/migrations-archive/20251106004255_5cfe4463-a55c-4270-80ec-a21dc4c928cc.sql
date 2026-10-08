-- Add RLS policy to allow viewing clients from shared agencies via agency_tenant_access
CREATE POLICY "Users can view clients from shared agencies"
ON public.clients
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (
    user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);