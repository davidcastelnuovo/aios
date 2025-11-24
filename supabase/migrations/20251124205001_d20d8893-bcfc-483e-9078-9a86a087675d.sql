-- ========================================
-- RESTORE SIMPLE AND WORKING RLS POLICIES
-- ========================================
-- This migration removes all problematic policies from 24/11
-- and creates simple, clear policies using SECURITY DEFINER functions

-- ========================================
-- STEP 1: DROP ALL PROBLEMATIC POLICIES
-- ========================================

-- CAMPAIGNERS: Remove all policies
DROP POLICY IF EXISTS "Super admins can view all campaigners with permission" ON public.campaigners;
DROP POLICY IF EXISTS "Owners can view all campaigners in their tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Team managers can view their team's campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Campaigners can view their agencies' campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can view campaigners in accessible tenants" ON public.campaigners;
DROP POLICY IF EXISTS "Users can view accessible campaigners" ON public.campaigners;

-- AGENCIES: Remove all policies
DROP POLICY IF EXISTS "Super admins can view all agencies with permission" ON public.agencies;
DROP POLICY IF EXISTS "Owners can view all agencies in their tenant" ON public.agencies;
DROP POLICY IF EXISTS "Team managers can view managed agencies" ON public.agencies;
DROP POLICY IF EXISTS "Campaigners can view their assigned agencies" ON public.agencies;
DROP POLICY IF EXISTS "Sales people can view their assigned agencies" ON public.agencies;
DROP POLICY IF EXISTS "Users can view agencies in accessible tenants" ON public.agencies;
DROP POLICY IF EXISTS "Owners can view all agencies" ON public.agencies;

-- CLIENTS: Remove all policies
DROP POLICY IF EXISTS "Super admins can view all clients with permission" ON public.clients;
DROP POLICY IF EXISTS "Owners can view all clients in their tenant" ON public.clients;
DROP POLICY IF EXISTS "Team managers can view clients from managed agencies" ON public.clients;
DROP POLICY IF EXISTS "Campaigners can view clients from their agencies" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients in accessible tenants" ON public.clients;
DROP POLICY IF EXISTS "Owners can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients from shared agencies" ON public.clients;

-- TASKS: Remove all policies
DROP POLICY IF EXISTS "Super admins can view all tasks with permission" ON public.tasks;
DROP POLICY IF EXISTS "Owners can view all tasks in their tenant" ON public.tasks;
DROP POLICY IF EXISTS "Team managers can view tasks from managed agencies" ON public.tasks;
DROP POLICY IF EXISTS "Campaigners can view tasks from their agencies" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in accessible tenants" ON public.tasks;

-- LEADS: Remove all policies
DROP POLICY IF EXISTS "Super admins can view all leads with permission" ON public.leads;
DROP POLICY IF EXISTS "Owners can view all leads in their tenant" ON public.leads;
DROP POLICY IF EXISTS "Sales people can view their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Team managers can view leads from managed agencies" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in accessible tenants" ON public.leads;

-- ========================================
-- STEP 2: CREATE SIMPLE, CLEAR POLICIES
-- ========================================

-- ================
-- CAMPAIGNERS
-- ================

-- Super admins with permission
CREATE POLICY "Super admins view campaigners with permission"
ON public.campaigners FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  AND (SELECT allow_super_admin_access FROM public.tenants WHERE id = campaigners.tenant_id) = true
);

-- Owners see all in their tenant
CREATE POLICY "Owners view all campaigners in tenant"
ON public.campaigners FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Team managers see campaigners from their managed agencies
CREATE POLICY "Team managers view their campaigners"
ON public.campaigners FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND id IN (
    SELECT ca.campaigner_id 
    FROM public.campaigner_agencies ca
    WHERE user_manages_agency(auth.uid(), ca.agency_id)
  )
);

-- Campaigners see themselves
CREATE POLICY "Campaigners view own profile"
ON public.campaigners FOR SELECT
USING (
  id = get_user_campaigner_id(auth.uid())
);

-- ================
-- AGENCIES
-- ================

-- Super admins with permission
CREATE POLICY "Super admins view agencies with permission"
ON public.agencies FOR SELECT
USING (
  is_super_admin(auth.uid())
  AND (SELECT allow_super_admin_access FROM public.tenants WHERE id = agencies.tenant_id) = true
);

-- Owners see all in their tenant
CREATE POLICY "Owners view all agencies in tenant"
ON public.agencies FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Team managers see their managed agencies
CREATE POLICY "Team managers view managed agencies"
ON public.agencies FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND user_manages_agency(auth.uid(), id)
);

-- Campaigners see their assigned agencies
CREATE POLICY "Campaigners view assigned agencies"
ON public.agencies FOR SELECT
USING (
  has_role(auth.uid(), 'campaigner'::app_role)
  AND id = ANY(get_user_agency_ids(auth.uid()))
);

-- Sales people see their assigned agencies
CREATE POLICY "Sales people view assigned agencies"
ON public.agencies FOR SELECT
USING (
  has_role(auth.uid(), 'sales_person'::app_role)
  AND id = ANY(get_user_sales_person_agency_ids(auth.uid()))
);

-- ================
-- CLIENTS
-- ================

-- Super admins with permission
CREATE POLICY "Super admins view clients with permission"
ON public.clients FOR SELECT
USING (
  is_super_admin(auth.uid())
  AND (SELECT allow_super_admin_access FROM public.tenants WHERE id = clients.tenant_id) = true
);

-- Owners see all in their tenant
CREATE POLICY "Owners view all clients in tenant"
ON public.clients FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Team managers see clients from managed agencies
CREATE POLICY "Team managers view clients from managed agencies"
ON public.clients FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND user_manages_agency(auth.uid(), agency_id)
);

-- Campaigners see clients from their agencies
CREATE POLICY "Campaigners view clients from agencies"
ON public.clients FOR SELECT
USING (
  has_role(auth.uid(), 'campaigner'::app_role)
  AND agency_id = ANY(get_user_agency_ids(auth.uid()))
);

-- ================
-- TASKS
-- ================

-- Super admins with permission
CREATE POLICY "Super admins view tasks with permission"
ON public.tasks FOR SELECT
USING (
  is_super_admin(auth.uid())
  AND (SELECT allow_super_admin_access FROM public.tenants WHERE id = tasks.tenant_id) = true
);

-- Owners see all in their tenant
CREATE POLICY "Owners view all tasks in tenant"
ON public.tasks FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Team managers see tasks from managed agencies
CREATE POLICY "Team managers view tasks from managed agencies"
ON public.tasks FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND user_manages_agency(auth.uid(), agency_id)
);

-- Campaigners see tasks from their agencies OR assigned to them
CREATE POLICY "Campaigners view tasks from agencies or assigned"
ON public.tasks FOR SELECT
USING (
  has_role(auth.uid(), 'campaigner'::app_role)
  AND (
    agency_id = ANY(get_user_agency_ids(auth.uid()))
    OR campaigner_id = get_user_campaigner_id(auth.uid())
  )
);

-- ================
-- LEADS
-- ================

-- Super admins with permission
CREATE POLICY "Super admins view leads with permission"
ON public.leads FOR SELECT
USING (
  is_super_admin(auth.uid())
  AND (SELECT allow_super_admin_access FROM public.tenants WHERE id = leads.tenant_id) = true
);

-- Owners see all in their tenant
CREATE POLICY "Owners view all leads in tenant"
ON public.leads FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Sales people see their assigned leads
CREATE POLICY "Sales people view assigned leads"
ON public.leads FOR SELECT
USING (
  has_role(auth.uid(), 'sales_person'::app_role)
  AND sales_person_id = get_user_sales_person_id(auth.uid())
);

-- Team managers see leads from managed agencies
CREATE POLICY "Team managers view leads from managed agencies"
ON public.leads FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND agency_id IS NOT NULL
  AND user_manages_agency(auth.uid(), agency_id)
);