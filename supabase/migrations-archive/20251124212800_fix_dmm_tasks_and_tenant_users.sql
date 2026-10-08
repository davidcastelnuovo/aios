-- ========================================
-- FIX DMM TASKS AND TENANT_USERS ACCESS
-- ========================================
-- Problem 1: DMM owners can't see tasks in their tenant (missing tenant_id check)
-- Problem 2: DMM owners can't add team members (missing INSERT/UPDATE/DELETE policies for tenant_users)

-- ========================================
-- STEP 1: FIX TASKS SELECT POLICY
-- ========================================
-- The previous migration removed the direct tenant_id check
-- This causes tasks without agency_id or with NULL agency_id to be invisible

DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON public.tasks FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  -- Direct tenant access (fixes the main issue!)
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR
  -- Agency access (for shared agencies)
  can_access_agency(auth.uid(), agency_id)
);

-- ========================================
-- STEP 2: ADD tenant_users POLICIES FOR OWNERS
-- ========================================
-- Currently only super_admins can insert/update/delete tenant_users
-- This prevents owners from managing their team members

-- Allow owners to view tenant_users in their tenant
CREATE POLICY "Owners can view tenant_users in their tenant"
ON public.tenant_users FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Allow owners to add users to their tenant
CREATE POLICY "Owners can insert tenant_users in their tenant"
ON public.tenant_users FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Allow owners to update tenant_users in their tenant
CREATE POLICY "Owners can update tenant_users in their tenant"
ON public.tenant_users FOR UPDATE
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Allow owners to delete tenant_users in their tenant (except themselves)
CREATE POLICY "Owners can delete tenant_users in their tenant"
ON public.tenant_users FOR DELETE
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND user_id != auth.uid()  -- Can't delete themselves
);
