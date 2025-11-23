-- Allow team_manager to insert campaigners in their tenant
CREATE POLICY "Team managers can insert campaigners in their tenant"
ON public.campaigners
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'team_manager'::app_role))
  OR (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert campaigners in their tenant" ON public.campaigners;