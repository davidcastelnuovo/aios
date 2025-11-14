-- First, drop existing policies on user_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON user_permissions;

-- Create a security definer function to check if user can manage permissions
CREATE OR REPLACE FUNCTION public.can_manage_user_permissions(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins can manage anyone's permissions
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- Owners can manage permissions within their tenants
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN tenant_users tu_manager ON tu_manager.user_id = ur.user_id
    JOIN tenant_users tu_target ON tu_target.tenant_id = tu_manager.tenant_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
      AND tu_target.user_id = target_user_id
  )
  OR
  -- Users can manage their own permissions
  target_user_id = auth.uid();
$$;

-- Create new RLS policies using the security definer function
CREATE POLICY "Users can view permissions they can manage"
ON user_permissions FOR SELECT
USING (public.can_manage_user_permissions(user_id));

CREATE POLICY "Users can insert permissions they can manage"
ON user_permissions FOR INSERT
WITH CHECK (public.can_manage_user_permissions(user_id));

CREATE POLICY "Users can update permissions they can manage"
ON user_permissions FOR UPDATE
USING (public.can_manage_user_permissions(user_id))
WITH CHECK (public.can_manage_user_permissions(user_id));

CREATE POLICY "Users can delete permissions they can manage"
ON user_permissions FOR DELETE
USING (public.can_manage_user_permissions(user_id));