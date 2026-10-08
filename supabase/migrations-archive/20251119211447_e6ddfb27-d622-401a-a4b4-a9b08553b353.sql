-- Add policy for owners and super admins to update profiles in their tenant
CREATE POLICY "Owners can update profiles in their tenant"
ON public.profiles
FOR UPDATE
TO public
USING (
  is_super_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'owner'::app_role)
    AND id IN (
      SELECT tu1.user_id
      FROM tenant_users tu1
      WHERE tu1.tenant_id IN (
        SELECT tu2.tenant_id
        FROM tenant_users tu2
        WHERE tu2.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'owner'::app_role)
    AND id IN (
      SELECT tu1.user_id
      FROM tenant_users tu1
      WHERE tu1.tenant_id IN (
        SELECT tu2.tenant_id
        FROM tenant_users tu2
        WHERE tu2.user_id = auth.uid()
      )
    )
  )
);