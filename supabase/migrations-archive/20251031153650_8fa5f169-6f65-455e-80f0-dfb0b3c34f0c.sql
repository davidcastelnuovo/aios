-- Fix critical security issues in profiles table
-- Users should only be able to view/update/delete their own profile

-- Fix profiles UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Fix profiles DELETE policy
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.profiles;

CREATE POLICY "Owners can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'owner') OR is_super_admin(auth.uid())
);

-- Fix profiles SELECT policy to only show profiles in same tenant
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (get_user_tenant_id(id) = get_user_tenant_id(auth.uid())) OR 
  is_super_admin(auth.uid()) OR
  (auth.uid() = id)  -- Users can always view their own profile
);