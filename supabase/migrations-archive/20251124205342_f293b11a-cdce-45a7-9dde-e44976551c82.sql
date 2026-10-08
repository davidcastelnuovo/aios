-- ========================================
-- FIX INFINITE RECURSION - FINAL VERSION
-- ========================================
-- Create SECURITY DEFINER function to check campaigner visibility
-- and update all policies to use it

-- ========================================
-- STEP 1: Create SECURITY DEFINER function for campaigner visibility
-- ========================================

CREATE OR REPLACE FUNCTION public.user_can_view_campaigner(_user_id uuid, _campaigner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admin
  SELECT is_super_admin(_user_id)
  OR
  -- Owner in same tenant
  EXISTS (
    SELECT 1 FROM campaigners c
    WHERE c.id = _campaigner_id
    AND c.tenant_id = get_user_tenant_id(_user_id)
    AND has_role(_user_id, 'owner'::app_role)
  )
  OR
  -- Team manager managing campaigner's agencies
  EXISTS (
    SELECT 1 FROM campaigners c
    JOIN campaigner_agencies ca ON ca.campaigner_id = c.id
    WHERE c.id = _campaigner_id
    AND has_role(_user_id, 'team_manager'::app_role)
    AND user_manages_agency(_user_id, ca.agency_id)
  )
  OR
  -- Campaigner viewing themselves
  (get_user_campaigner_id(_user_id) = _campaigner_id)
$$;

-- ========================================
-- STEP 2: DROP OLD CAMPAIGNERS POLICIES
-- ========================================

DROP POLICY IF EXISTS "Super admins view campaigners with permission" ON public.campaigners;
DROP POLICY IF EXISTS "Owners view all campaigners in tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Team managers view their campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Campaigners view own profile" ON public.campaigners;

-- ========================================
-- STEP 3: CREATE NEW SIMPLE CAMPAIGNERS POLICY
-- ========================================

CREATE POLICY "Users can view campaigners they have access to"
ON public.campaigners FOR SELECT
USING (
  user_can_view_campaigner(auth.uid(), id)
);

-- ========================================
-- STEP 4: VERIFY OTHER POLICIES ARE SIMPLE
-- ========================================
-- The other policies (agencies, clients, tasks, leads) already use
-- SECURITY DEFINER functions and should not cause recursion