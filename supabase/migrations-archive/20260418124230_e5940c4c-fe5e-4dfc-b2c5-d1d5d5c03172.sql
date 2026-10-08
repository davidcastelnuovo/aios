-- Allow integration owners to view all permissions on integrations they own
DROP POLICY IF EXISTS "Users can view permissions granted to them" ON public.integration_user_permissions;

CREATE POLICY "Users can view relevant integration permissions"
ON public.integration_user_permissions
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.user_owns_integration(integration_id)
);