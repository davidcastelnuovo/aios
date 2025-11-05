-- Allow owners to create tenants (for sub-organizations)
DROP POLICY IF EXISTS "Super admins can insert tenants" ON public.tenants;
CREATE POLICY "Super admins and owners can insert tenants"
ON public.tenants
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR has_role(auth.uid(), 'owner'::app_role)
);

-- Update delete policy for user_roles to prevent super_admins from deleting owners
DROP POLICY IF EXISTS "Owners can delete roles" ON public.user_roles;
CREATE POLICY "Owners can delete roles with restrictions"
ON public.user_roles
FOR DELETE
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND (
    -- Owners can delete any role except other owners' owner role
    role != 'owner'::app_role 
    OR user_id = auth.uid()  -- Can delete their own owner role
  )
);

-- Super admins can delete roles except owner roles
CREATE POLICY "Super admins can delete non-owner roles"
ON public.user_roles
FOR DELETE
USING (
  is_super_admin(auth.uid())
  AND role != 'owner'::app_role
);

-- Comment for clarity
COMMENT ON POLICY "Super admins and owners can insert tenants" ON public.tenants IS 
'Allows both super admins and tenant owners to create new tenants (sub-organizations)';

COMMENT ON POLICY "Owners can delete roles with restrictions" ON public.user_roles IS 
'Owners can delete any role except owner roles (to prevent removing other owners)';

COMMENT ON POLICY "Super admins can delete non-owner roles" ON public.user_roles IS 
'Super admins can delete any role except owner roles (owners remain protected)';