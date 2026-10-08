-- Step 1: Clean up invalid user_roles data (NULL tenant_id for non-super_admin roles)
DELETE FROM public.user_roles
WHERE tenant_id IS NULL 
  AND role != 'super_admin';

-- Step 2: Drop the existing problematic policy on profiles
DROP POLICY IF EXISTS "Owners can update profiles in their tenant" ON public.profiles;

-- Step 3: Create new correct policy for profiles UPDATE
CREATE POLICY "Owners and super admins can update profiles in their tenants"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Super admins can update anyone
  is_super_admin(auth.uid())
  OR
  -- Owners can update users that belong to their tenant(s)
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.tenant_users tu ON tu.tenant_id = ur.tenant_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
      AND tu.user_id = profiles.id
  )
);