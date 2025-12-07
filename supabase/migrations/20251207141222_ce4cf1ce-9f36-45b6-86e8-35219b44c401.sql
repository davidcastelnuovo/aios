
-- =====================================================
-- FIX: RLS Infinite Recursion on user_roles, tenant_users, tenants
-- The key is to ONLY use:
-- 1. Simple column comparisons (user_id = auth.uid())
-- 2. SECURITY DEFINER functions (is_super_admin, has_role)
-- NEVER query the same table from within its own policy!
-- =====================================================

-- =====================================================
-- Step 1: Fix user_roles policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Managers can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

-- Policy 1: Users can see their own roles (simple comparison - no recursion)
CREATE POLICY "Users see own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Super admins can see all roles (SECURITY DEFINER function bypasses RLS)
CREATE POLICY "Super admins see all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- =====================================================
-- Step 2: Fix tenant_users policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tenant records" ON tenant_users;
DROP POLICY IF EXISTS "Super admins can view all tenant_users" ON tenant_users;
DROP POLICY IF EXISTS "Owners can view users in their tenant" ON tenant_users;
DROP POLICY IF EXISTS "Owners can view all users in their tenant" ON tenant_users;
DROP POLICY IF EXISTS "Users can view own tenant_users" ON tenant_users;
DROP POLICY IF EXISTS "Super admins view all tenant_users" ON tenant_users;

-- Policy 1: Users can see their own tenant memberships (simple comparison)
CREATE POLICY "Users see own tenant_users"
  ON tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Super admins can see all (SECURITY DEFINER function)
CREATE POLICY "Super admins see all tenant_users"
  ON tenant_users
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- =====================================================
-- Step 3: Fix tenants policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users view own tenants" ON tenants;
DROP POLICY IF EXISTS "Super admins view tenants" ON tenants;

-- Policy 1: Users can see tenants they're members of
-- This subquery on tenant_users is safe because tenant_users now has simple policies
CREATE POLICY "Users see member tenants"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

-- Policy 2: Super admins can see all tenants
CREATE POLICY "Super admins see all tenants"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- =====================================================
-- Step 4: Fix user_active_tenant policies (if needed)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their active tenant" ON user_active_tenant;

-- Users can only see/manage their own active tenant record
CREATE POLICY "Users manage own active_tenant"
  ON user_active_tenant
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admins can see all
CREATE POLICY "Super admins see all active_tenant"
  ON user_active_tenant
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));
