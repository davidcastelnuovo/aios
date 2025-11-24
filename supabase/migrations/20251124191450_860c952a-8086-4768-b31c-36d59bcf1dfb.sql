-- Fix SELECT policies for campaigners, tasks, agencies, clients, leads to support shared agencies
-- Allow access to data from agencies that are shared with the user's tenant via agency_tenant_access

-- ==========================================
-- 1. CAMPAIGNERS TABLE - SELECT
-- ==========================================

DROP POLICY IF EXISTS "Users can view all campaigners" ON public.campaigners;

CREATE POLICY "Users can view campaigners in accessible tenants" 
ON public.campaigners
FOR SELECT
USING (
  -- Super admin can see all
  is_super_admin(auth.uid())
  OR
  -- User has role in the campaigner's tenant
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = campaigners.tenant_id
  ))
  OR
  -- User's tenant has shared access to agencies associated with this campaigner
  (EXISTS (
    SELECT 1
    FROM campaigner_agencies ca
    JOIN agency_tenant_access ata ON ata.agency_id = ca.agency_id
    JOIN user_roles ur ON ur.tenant_id = ata.accessing_tenant_id
    WHERE ca.campaigner_id = campaigners.id
    AND ur.user_id = auth.uid()
  ))
);

-- ==========================================
-- 2. TASKS TABLE - SELECT
-- ==========================================

DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in accessible tenants" 
ON public.tasks
FOR SELECT
USING (
  -- Super admin can see all
  is_super_admin(auth.uid())
  OR
  -- User has role in the task's tenant
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tasks.tenant_id
  ))
  OR
  -- User's tenant has shared access to the task's agency
  (EXISTS (
    SELECT 1
    FROM agency_tenant_access ata
    JOIN user_roles ur ON ur.tenant_id = ata.accessing_tenant_id
    WHERE ata.agency_id = tasks.agency_id
    AND ur.user_id = auth.uid()
  ))
);

-- ==========================================
-- 3. AGENCIES TABLE - SELECT
-- ==========================================

DROP POLICY IF EXISTS "Users can view agencies" ON public.agencies;

CREATE POLICY "Users can view agencies in accessible tenants" 
ON public.agencies
FOR SELECT
USING (
  -- Super admin can see all
  is_super_admin(auth.uid())
  OR
  -- User has role in the agency's tenant (owns the agency)
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = agencies.tenant_id
  ))
  OR
  -- User's tenant has shared access to this agency
  (EXISTS (
    SELECT 1
    FROM agency_tenant_access ata
    JOIN user_roles ur ON ur.tenant_id = ata.accessing_tenant_id
    WHERE ata.agency_id = agencies.id
    AND ur.user_id = auth.uid()
  ))
);

-- ==========================================
-- 4. CLIENTS TABLE - SELECT
-- ==========================================

DROP POLICY IF EXISTS "Users can view clients" ON public.clients;

CREATE POLICY "Users can view clients in accessible tenants" 
ON public.clients
FOR SELECT
USING (
  -- Super admin can see all
  is_super_admin(auth.uid())
  OR
  -- User has role in the client's tenant
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = clients.tenant_id
  ))
  OR
  -- User's tenant has shared access to the client's agency
  (EXISTS (
    SELECT 1
    FROM agency_tenant_access ata
    JOIN user_roles ur ON ur.tenant_id = ata.accessing_tenant_id
    WHERE ata.agency_id = clients.agency_id
    AND ur.user_id = auth.uid()
  ))
);

-- ==========================================
-- 5. LEADS TABLE - SELECT
-- ==========================================

DROP POLICY IF EXISTS "Users can view leads" ON public.leads;

CREATE POLICY "Users can view leads in accessible tenants" 
ON public.leads
FOR SELECT
USING (
  -- Super admin can see all
  is_super_admin(auth.uid())
  OR
  -- User has role in the lead's tenant
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = leads.tenant_id
  ))
  OR
  -- User's tenant has shared access to the lead's agency
  (EXISTS (
    SELECT 1
    FROM agency_tenant_access ata
    JOIN user_roles ur ON ur.tenant_id = ata.accessing_tenant_id
    WHERE ata.agency_id = leads.agency_id
    AND ur.user_id = auth.uid()
  ))
);