-- Add RLS policy to allow users to view shared agencies
CREATE POLICY "Users can view agencies shared with their tenant"
ON public.agencies
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR user_has_cross_tenant_agency_access(auth.uid(), id)
);