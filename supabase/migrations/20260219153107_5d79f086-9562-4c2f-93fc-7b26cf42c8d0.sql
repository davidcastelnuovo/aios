
-- Allow owners and team managers to see all tenant_users in their tenant
CREATE POLICY "Owners can view tenant_users in their tenant"
ON public.tenant_users
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'team_manager'::app_role)
  )
);
