-- ========================================
-- FIX CAMPAIGNERS RLS POLICIES
-- ========================================
-- Problem: INSERT and UPDATE policies had ur.tenant_id = ur.tenant_id 
-- (always TRUE) instead of ur.tenant_id = campaigners.tenant_id

-- ========================================
-- STEP 1: FIX INSERT POLICY
-- ========================================

DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON public.campaigners;

CREATE POLICY "Team managers and owners can insert campaigners"
ON public.campaigners FOR INSERT
WITH CHECK (
  -- Super admin can insert anywhere
  is_super_admin(auth.uid())
  OR
  -- Owner or Team Manager can insert in their tenant
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = campaigners.tenant_id  -- ✅ Correct check!
    AND ur.role IN ('owner', 'team_manager')
  )
);

-- ========================================
-- STEP 2: FIX UPDATE POLICY
-- ========================================

DROP POLICY IF EXISTS "Users can update campaigners in their tenant" ON public.campaigners;

CREATE POLICY "Users can update campaigners in their tenant"
ON public.campaigners FOR UPDATE
USING (
  -- Can view the record (same logic as SELECT)
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = campaigners.tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
)
WITH CHECK (
  -- Can update to new values (must stay in same tenant)
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = campaigners.tenant_id  -- ✅ Correct check!
    AND ur.role IN ('owner', 'team_manager')
  )
);