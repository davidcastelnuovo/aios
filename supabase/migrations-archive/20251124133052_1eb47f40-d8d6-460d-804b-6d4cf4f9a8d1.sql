-- ============================================================================
-- FIX RLS POLICIES FOR 5 CRITICAL TABLES
-- Replace active tenant checks with role-based checks against specific tenant
-- ============================================================================

-- ============================================================================
-- 1. TASKS TABLE - Fix all policies
-- ============================================================================

-- Drop broken policies
DROP POLICY IF EXISTS "Users can manage tasks in their tenant" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their tenant" ON tasks;

-- SELECT: Users can view tasks in tenants where they have roles
CREATE POLICY "Users can view tasks in their tenants"
ON tasks
FOR SELECT
TO authenticated
USING (
  -- Check if user has role in this task's tenant
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tasks.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- INSERT: Users can create tasks in tenants where they have appropriate roles
CREATE POLICY "Users can create tasks in their tenants"
ON tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner')
  )
  OR is_super_admin(auth.uid())
);

-- UPDATE: Users can update tasks in tenants where they have appropriate roles
CREATE POLICY "Users can update tasks in their tenants"
ON tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tasks.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner')
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Only owners and team managers can delete tasks
CREATE POLICY "Users can delete tasks in their tenants"
ON tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tasks.tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
  OR is_super_admin(auth.uid())
);

-- ============================================================================
-- 2. AGENCIES TABLE - Fix main tenant policies (keep cross-tenant access)
-- ============================================================================

-- Drop broken policies (keep cross-tenant ones)
DROP POLICY IF EXISTS "Users can view agencies in their tenant" ON agencies;
DROP POLICY IF EXISTS "Users can insert agencies in their tenant" ON agencies;
DROP POLICY IF EXISTS "Users can update agencies in their tenant" ON agencies;
DROP POLICY IF EXISTS "Users can delete agencies in their tenant" ON agencies;

-- SELECT: Users can view agencies in tenants where they have roles
CREATE POLICY "Users can view agencies in their tenants"
ON agencies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = agencies.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- INSERT: Only owners can create agencies
CREATE POLICY "Owners can create agencies in their tenants"
ON agencies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
);

-- UPDATE: Owners can update agencies
CREATE POLICY "Owners can update agencies in their tenants"
ON agencies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = agencies.tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Only owners can delete agencies
CREATE POLICY "Owners can delete agencies in their tenants"
ON agencies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = agencies.tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
);

-- ============================================================================
-- 3. CLIENTS TABLE - Fix all policies
-- ============================================================================

-- Drop broken policies
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON clients;
DROP POLICY IF EXISTS "Users can insert clients in their tenant" ON clients;
DROP POLICY IF EXISTS "Users can update clients in their tenant" ON clients;
DROP POLICY IF EXISTS "Users can delete clients in their tenant" ON clients;

-- SELECT: Users can view clients in tenants where they have roles
CREATE POLICY "Users can view clients in their tenants"
ON clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = clients.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- INSERT: Users with appropriate roles can create clients
CREATE POLICY "Users can create clients in their tenants"
ON clients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- UPDATE: Users with appropriate roles can update clients
CREATE POLICY "Users can update clients in their tenants"
ON clients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = clients.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner')
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Only owners can delete clients
CREATE POLICY "Owners can delete clients in their tenants"
ON clients
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = clients.tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
);

-- ============================================================================
-- 4. LEADS TABLE - Fix all policies (complex due to sales/campaigner access)
-- ============================================================================

-- Drop all broken tenant-based policies
DROP POLICY IF EXISTS "Owners can view all leads" ON leads;
DROP POLICY IF EXISTS "Owners can insert all leads" ON leads;
DROP POLICY IF EXISTS "Owners can update all leads" ON leads;
DROP POLICY IF EXISTS "Owners can delete leads" ON leads;
DROP POLICY IF EXISTS "Campaigners can view leads from their agencies" ON leads;
DROP POLICY IF EXISTS "Campaigners can insert leads for their agencies" ON leads;
DROP POLICY IF EXISTS "Campaigners can update leads from their agencies" ON leads;
DROP POLICY IF EXISTS "Sales people can view leads from their agencies" ON leads;
DROP POLICY IF EXISTS "Sales people can insert leads for their agencies" ON leads;
DROP POLICY IF EXISTS "Sales people can update leads from their agencies" ON leads;

-- SELECT: Comprehensive view policy
CREATE POLICY "Users can view leads in their tenants"
ON leads
FOR SELECT
TO authenticated
USING (
  -- Check if user has role in this lead's tenant
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = leads.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- INSERT: Users with sales/campaigner roles can create leads
CREATE POLICY "Users can create leads in their tenants"
ON leads
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- UPDATE: Users with appropriate roles can update leads
CREATE POLICY "Users can update leads in their tenants"
ON leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = leads.tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Only owners can delete leads
CREATE POLICY "Owners can delete leads in their tenants"
ON leads
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = leads.tenant_id
    AND ur.role = 'owner'
  )
  OR is_super_admin(auth.uid())
);