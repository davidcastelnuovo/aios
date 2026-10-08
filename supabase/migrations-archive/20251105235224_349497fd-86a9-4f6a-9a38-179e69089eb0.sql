-- Add SELECT permissions for super admins on user_roles and user_permissions
-- Ensure we don't duplicate policies by using unique names and IF NOT EXISTS semantics via checks

-- user_roles: allow super admins to view all roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Super admins can view all roles'
  ) THEN
    CREATE POLICY "Super admins can view all roles"
    ON public.user_roles
    FOR SELECT
    USING (is_super_admin(auth.uid()));
  END IF;
END $$;

-- user_permissions: allow super admins to view all permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_permissions' AND policyname = 'Super admins can view all permissions'
  ) THEN
    CREATE POLICY "Super admins can view all permissions"
    ON public.user_permissions
    FOR SELECT
    USING (is_super_admin(auth.uid()));
  END IF;
END $$;
