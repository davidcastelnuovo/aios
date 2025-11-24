-- Fix RLS policies for campaigners, tasks, agencies, clients, leads
-- The previous migration had bugs where INSERT/UPDATE policies checked ur.tenant_id = ur.tenant_id
-- instead of checking against the actual row's tenant_id (NEW.tenant_id)

-- ==========================================
-- 1. CAMPAIGNERS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can update campaigners in their tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON public.campaigners;

CREATE POLICY "Team managers and owners can insert campaigners" 
ON public.campaigners
FOR INSERT
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update campaigners in their tenant" 
ON public.campaigners
FOR UPDATE
USING (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = campaigners.tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role])
  )) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

-- ==========================================
-- 2. TASKS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can create tasks in their tenants" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their tenants" ON public.tasks;

CREATE POLICY "Users can create tasks in their tenants" 
ON public.tasks
FOR INSERT
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update tasks in their tenants" 
ON public.tasks
FOR UPDATE
USING (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tasks.tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

-- ==========================================
-- 3. AGENCIES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Owners can insert agencies" ON public.agencies;
DROP POLICY IF EXISTS "Owners can update agencies" ON public.agencies;

CREATE POLICY "Owners can insert agencies" 
ON public.agencies
FOR INSERT
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = 'owner'::app_role
  )) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Owners can update agencies" 
ON public.agencies
FOR UPDATE
USING (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = agencies.tenant_id
    AND ur.role = 'owner'::app_role
  )) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = 'owner'::app_role
  )) 
  OR is_super_admin(auth.uid())
);

-- ==========================================
-- 4. CLIENTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can insert clients in their tenants" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their tenants" ON public.clients;

CREATE POLICY "Users can insert clients in their tenants" 
ON public.clients
FOR INSERT
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'sales_person'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update clients in their tenants" 
ON public.clients
FOR UPDATE
USING (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = clients.tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'sales_person'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'sales_person'::app_role, 'campaigner'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

-- ==========================================
-- 5. LEADS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can create leads in their tenants" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their tenants" ON public.leads;

CREATE POLICY "Users can create leads in their tenants" 
ON public.leads
FOR INSERT
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update leads in their tenants" 
ON public.leads
FOR UPDATE
USING (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = leads.tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = tenant_id
    AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )) 
  OR is_super_admin(auth.uid())
);