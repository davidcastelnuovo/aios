-- ========================================
-- FIX INFINITE RECURSION IN tenant_users
-- ========================================
-- The RLS policy on tenant_users was calling get_user_tenant_id(),
-- which in turn queries tenant_users, creating infinite recursion

-- ========================================
-- STEP 1: DROP PROBLEMATIC tenant_users POLICY
-- ========================================

DROP POLICY IF EXISTS "Users can view their own tenant users" ON public.tenant_users;

-- ========================================
-- STEP 2: CREATE SIMPLE tenant_users POLICY
-- ========================================
-- Users can see their own tenant_users records (direct comparison, no function call)

CREATE POLICY "Users can view their own tenant records"
ON public.tenant_users FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);