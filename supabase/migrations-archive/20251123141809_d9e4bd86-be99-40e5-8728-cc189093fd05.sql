
-- Drop the existing restrictive DELETE policy for owners
DROP POLICY IF EXISTS "Owners can delete roles with restrictions" ON user_roles;

-- Create a new policy that allows owners to delete super_admin role too
CREATE POLICY "Owners can delete roles with restrictions"
ON user_roles
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'owner'::app_role) 
  AND (
    -- Can delete owner role only if it's their own
    (role = 'owner'::app_role AND user_id = auth.uid())
    OR
    -- Can delete super_admin role only if it's their own
    (role = 'super_admin'::app_role AND user_id = auth.uid())
    OR
    -- Can delete any other role for any user in their tenant
    (role NOT IN ('owner'::app_role, 'super_admin'::app_role))
  )
);

-- Also update the super admin delete policy to allow them to delete super_admin from themselves
DROP POLICY IF EXISTS "Super admins can delete non-owner roles" ON user_roles;

CREATE POLICY "Super admins can delete roles"
ON user_roles
FOR DELETE
TO public
USING (
  is_super_admin(auth.uid()) 
  AND (
    -- Super admins can delete owner role from others (not themselves)
    (role = 'owner'::app_role AND user_id != auth.uid())
    OR
    -- Super admins can delete their own super_admin role
    (role = 'super_admin'::app_role AND user_id = auth.uid())
    OR
    -- Can delete any other role
    (role NOT IN ('owner'::app_role, 'super_admin'::app_role))
  )
);
