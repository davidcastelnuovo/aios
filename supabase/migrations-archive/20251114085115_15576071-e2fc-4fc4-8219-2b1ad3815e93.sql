-- Add tenant_id column to user_roles to support per-tenant roles
-- super_admin role will have NULL tenant_id (global role)
ALTER TABLE user_roles ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop the old unique constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Create new unique constraint that includes tenant_id
-- This allows same user to have different roles in different tenants
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_tenant_unique 
  UNIQUE (user_id, role, tenant_id);

-- Migrate existing roles to be tenant-specific (except super_admin)
-- For each user role, assign it to all tenants the user belongs to
WITH user_tenant_mapping AS (
  SELECT DISTINCT ur.id as role_id, tu.tenant_id
  FROM user_roles ur
  JOIN tenant_users tu ON tu.user_id = ur.user_id
  WHERE ur.role != 'super_admin' AND ur.tenant_id IS NULL
)
UPDATE user_roles ur
SET tenant_id = utm.tenant_id
FROM user_tenant_mapping utm
WHERE ur.id = utm.role_id;

-- Update has_role function to check tenant-specific roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        -- Super admin is global (tenant_id IS NULL)
        (_role = 'super_admin' AND tenant_id IS NULL)
        OR
        -- Other roles are tenant-specific
        (_role != 'super_admin' AND tenant_id = get_user_tenant_id(_user_id))
      )
  )
$$;

-- Update is_super_admin to only check global super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND tenant_id IS NULL  -- Super admin must be global
  )
$$;