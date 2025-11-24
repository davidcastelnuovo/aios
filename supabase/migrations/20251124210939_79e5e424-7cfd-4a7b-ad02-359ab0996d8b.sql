
-- ========================================
-- FIX TASKS AND CAMPAIGNER_AGENCIES RLS
-- ========================================
-- Goal: Allow DMM users full access to shared agency data

-- ========================================
-- STEP 1: FIX TASKS RLS POLICIES
-- ========================================

-- Drop all existing tasks policies
DROP POLICY IF EXISTS "Super admins can manage tasks with permission" ON public.tasks;
DROP POLICY IF EXISTS "Team managers can manage tasks from managed agencies" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their tenants" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their tenants" ON public.tasks;
DROP POLICY IF EXISTS "Campaigners view tasks from agencies or assigned" ON public.tasks;
DROP POLICY IF EXISTS "Owners view all tasks in tenant" ON public.tasks;
DROP POLICY IF EXISTS "Super admins view tasks with permission" ON public.tasks;
DROP POLICY IF EXISTS "Team managers view tasks from managed agencies" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their tenants" ON public.tasks;

-- SELECT: View tasks from owned or shared agencies
CREATE POLICY "Users can view tasks from accessible agencies"
ON public.tasks FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  -- Tasks in user's tenant
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR
  -- Tasks from shared agencies
  (agency_id IN (
    SELECT ata.agency_id 
    FROM agency_tenant_access ata
    WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  ))
);

-- INSERT: Create tasks in owned or shared agencies
CREATE POLICY "Users can create tasks in accessible agencies"
ON public.tasks FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  -- User has permission in their tenant
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tasks.tenant_id
      AND ur.role IN ('owner', 'team_manager', 'campaigner')
    )
    AND (
      -- Agency is in user's tenant
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      -- Agency is shared with user's tenant
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);

-- UPDATE: Update tasks in owned or shared agencies
CREATE POLICY "Users can update tasks in accessible agencies"
ON public.tasks FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR
  (agency_id IN (
    SELECT ata.agency_id 
    FROM agency_tenant_access ata
    WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  ))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tasks.tenant_id
      AND ur.role IN ('owner', 'team_manager', 'campaigner')
    )
    AND (
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);

-- DELETE: Delete tasks in owned or shared agencies
CREATE POLICY "Users can delete tasks in accessible agencies"
ON public.tasks FOR DELETE
USING (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tasks.tenant_id
      AND ur.role IN ('owner', 'team_manager')
    )
    AND (
      (tenant_id = get_user_tenant_id(auth.uid()))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);

-- ========================================
-- STEP 2: SIMPLIFY CAMPAIGNER_AGENCIES RLS
-- ========================================

DROP POLICY IF EXISTS "Team managers and owners can manage campaigner_agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Users can view campaigner_agencies in their tenant" ON public.campaigner_agencies;

-- SELECT: View campaigner_agencies for owned or shared agencies
CREATE POLICY "Users can view campaigner_agencies"
ON public.campaigner_agencies FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  -- Campaigner is in user's tenant
  (EXISTS (
    SELECT 1 FROM campaigners c
    WHERE c.id = campaigner_agencies.campaigner_id
    AND c.tenant_id = get_user_tenant_id(auth.uid())
  ))
  OR
  -- Agency is shared with user's tenant
  (agency_id IN (
    SELECT ata.agency_id 
    FROM agency_tenant_access ata
    WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  ))
);

-- INSERT: Assign campaigners to owned or shared agencies
CREATE POLICY "Users can assign campaigners to accessible agencies"
ON public.campaigner_agencies FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (
    -- User is owner or team_manager
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'team_manager')
    )
    AND
    -- Campaigner is in user's tenant
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND
    (
      -- Agency is owned by user's tenant
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      -- Agency is shared with user's tenant (with write access)
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
        AND ata.access_level = 'read_write'
      ))
    )
  )
);

-- UPDATE: Update campaigner assignments for owned or shared agencies
CREATE POLICY "Users can update campaigner_agencies"
ON public.campaigner_agencies FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'team_manager')
    )
    AND
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND
    (
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
        AND ata.access_level = 'read_write'
      ))
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'team_manager')
    )
    AND
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND
    (
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
        AND ata.access_level = 'read_write'
      ))
    )
  )
);

-- DELETE: Remove campaigner assignments from owned or shared agencies
CREATE POLICY "Users can delete campaigner_agencies"
ON public.campaigner_agencies FOR DELETE
USING (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'team_manager')
    )
    AND
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND
    (
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
        AND ata.access_level = 'read_write'
      ))
    )
  )
);
