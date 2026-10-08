-- Clean up duplicate and overlapping SELECT policies
-- Keep only the comprehensive "accessible tenants" policies

-- AGENCIES: Remove redundant SELECT policies
DROP POLICY IF EXISTS "Campaigners can view their agencies" ON public.agencies;
DROP POLICY IF EXISTS "Campaigners can view their assigned agencies" ON public.agencies;
DROP POLICY IF EXISTS "Owners can view all agencies" ON public.agencies;
DROP POLICY IF EXISTS "Owners can view all agencies in their tenant" ON public.agencies;
DROP POLICY IF EXISTS "Sales people can view their agencies" ON public.agencies;
DROP POLICY IF EXISTS "Team managers can view managed agencies" ON public.agencies;
DROP POLICY IF EXISTS "Team managers can view their managed agencies" ON public.agencies;
DROP POLICY IF EXISTS "Users can view agencies shared with their tenant" ON public.agencies;
DROP POLICY IF EXISTS "Users can view agencies in their tenants" ON public.agencies;

-- CAMPAIGNERS: Remove redundant SELECT policies
DROP POLICY IF EXISTS "Campaigners visible to users in tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Campaigners visible to agency team managers" ON public.campaigners;
DROP POLICY IF EXISTS "Owners can view all campaigners in their tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Super admins can view all campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Team managers can view their campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can view campaigners in their tenants" ON public.campaigners;

-- CLIENTS: Remove redundant SELECT policies  
DROP POLICY IF EXISTS "Owners and team managers can view all clients in tenant" ON public.clients;
DROP POLICY IF EXISTS "Owners can view all clients in their tenant" ON public.clients;
DROP POLICY IF EXISTS "Super admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Team managers can view clients in managed agencies" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients in their tenants" ON public.clients;

-- TASKS: Remove redundant SELECT policies
DROP POLICY IF EXISTS "Campaigners can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners and managers can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners can view all tasks in their tenant" ON public.tasks;
DROP POLICY IF EXISTS "Super admins can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team managers can view tasks in their agencies" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their tenants" ON public.tasks;

-- LEADS: Remove redundant SELECT policies
DROP POLICY IF EXISTS "Owners can view all leads in their tenant" ON public.leads;
DROP POLICY IF EXISTS "Sales people can view their leads" ON public.leads;
DROP POLICY IF EXISTS "Super admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Team managers can view leads in managed agencies" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their tenants" ON public.leads;

-- The remaining "accessible tenants" policies provide comprehensive access:
-- 1. Users can view records in accessible tenants (covers own tenant + shared agencies)
-- 2. Super admins can view with permission