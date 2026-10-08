-- Fix security issues: Add tenant isolation to all sensitive tables

-- ============================================
-- 1. Fix profiles table - Add tenant filtering
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = get_user_tenant_id(profiles.id)
  ) OR is_super_admin(auth.uid())
);

-- ============================================
-- 2. Fix campaigners table - Add tenant filtering
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view campaigners" ON public.campaigners;

CREATE POLICY "Users can view campaigners in their tenant"
ON public.campaigners
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can insert campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Authenticated users can update campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Authenticated users can delete campaigners" ON public.campaigners;

CREATE POLICY "Users can insert campaigners in their tenant"
ON public.campaigners
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update campaigners in their tenant"
ON public.campaigners
FOR UPDATE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete campaigners in their tenant"
ON public.campaigners
FOR DELETE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- ============================================
-- 3. Fix suppliers table - Add tenant filtering
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

CREATE POLICY "Users can view suppliers in their tenant"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;

CREATE POLICY "Users can insert suppliers in their tenant"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update suppliers in their tenant"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete suppliers in their tenant"
ON public.suppliers
FOR DELETE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- ============================================
-- 4. Fix sales_people table - Add tenant filtering
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view sales_people" ON public.sales_people;

CREATE POLICY "Users can view sales_people in their tenant"
ON public.sales_people
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can insert sales_people" ON public.sales_people;
DROP POLICY IF EXISTS "Authenticated users can update sales_people" ON public.sales_people;
DROP POLICY IF EXISTS "Authenticated users can delete sales_people" ON public.sales_people;

CREATE POLICY "Users can insert sales_people in their tenant"
ON public.sales_people
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update sales_people in their tenant"
ON public.sales_people
FOR UPDATE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete sales_people in their tenant"
ON public.sales_people
FOR DELETE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- ============================================
-- 5. Fix invitation_tokens - Remove public access
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify unused invitation tokens" ON public.invitation_tokens;

-- Only service role (edge functions) can read invitation tokens
CREATE POLICY "Service role can read invitation tokens"
ON public.invitation_tokens
FOR SELECT
TO service_role
USING (true);

-- Authenticated users in the same tenant can view their tenant's invitations
CREATE POLICY "Users can view invitations in their tenant"
ON public.invitation_tokens
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- ============================================
-- 6. Fix other tables with overly permissive policies
-- ============================================

-- Fix campaigner_agencies
DROP POLICY IF EXISTS "Authenticated users can view campaigner_agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Authenticated users can insert campaigner_agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Authenticated users can update campaigner_agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Authenticated users can delete campaigner_agencies" ON public.campaigner_agencies;

CREATE POLICY "Users can view campaigner_agencies in their tenant"
ON public.campaigner_agencies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigners
    WHERE campaigners.id = campaigner_agencies.campaigner_id
    AND (campaigners.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Owners can manage campaigner_agencies"
ON public.campaigner_agencies
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'owner') OR is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'owner') OR is_super_admin(auth.uid())
);

-- Fix sales_person_agencies
DROP POLICY IF EXISTS "Authenticated users can view sales_person_agencies" ON public.sales_person_agencies;
DROP POLICY IF EXISTS "Authenticated users can insert sales_person_agencies" ON public.sales_person_agencies;
DROP POLICY IF EXISTS "Authenticated users can update sales_person_agencies" ON public.sales_person_agencies;
DROP POLICY IF EXISTS "Authenticated users can delete sales_person_agencies" ON public.sales_person_agencies;

CREATE POLICY "Users can view sales_person_agencies in their tenant"
ON public.sales_person_agencies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales_people
    WHERE sales_people.id = sales_person_agencies.sales_person_id
    AND (sales_people.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Owners can manage sales_person_agencies"
ON public.sales_person_agencies
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'owner') OR is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'owner') OR is_super_admin(auth.uid())
);

-- Fix client_onboarding, tasks, finance, time_entries, client_team, client_suppliers
DROP POLICY IF EXISTS "Authenticated users can view client_onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Authenticated users can insert client_onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Authenticated users can update client_onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Authenticated users can delete client_onboarding" ON public.client_onboarding;

CREATE POLICY "Users can view client_onboarding in their tenant"
ON public.client_onboarding
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage client_onboarding in their tenant"
ON public.client_onboarding
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- Fix tasks
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their tenant"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage tasks in their tenant"
ON public.tasks
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- Fix finance
DROP POLICY IF EXISTS "Authenticated users can view finance" ON public.finance;
DROP POLICY IF EXISTS "Authenticated users can insert finance" ON public.finance;
DROP POLICY IF EXISTS "Authenticated users can update finance" ON public.finance;
DROP POLICY IF EXISTS "Authenticated users can delete finance" ON public.finance;

CREATE POLICY "Users can view finance in their tenant"
ON public.finance
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage finance in their tenant"
ON public.finance
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- Fix time_entries
DROP POLICY IF EXISTS "Authenticated users can view time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated users can insert time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated users can update time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated users can delete time_entries" ON public.time_entries;

CREATE POLICY "Users can view time_entries in their tenant"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage time_entries in their tenant"
ON public.time_entries
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- Fix client_team
DROP POLICY IF EXISTS "Authenticated users can view client_team" ON public.client_team;
DROP POLICY IF EXISTS "Authenticated users can insert client_team" ON public.client_team;
DROP POLICY IF EXISTS "Authenticated users can update client_team" ON public.client_team;
DROP POLICY IF EXISTS "Authenticated users can delete client_team" ON public.client_team;

CREATE POLICY "Users can view client_team in their tenant"
ON public.client_team
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_team.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage client_team in their tenant"
ON public.client_team
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_team.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_team.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- Fix client_suppliers
DROP POLICY IF EXISTS "Authenticated users can view client_suppliers" ON public.client_suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert client_suppliers" ON public.client_suppliers;
DROP POLICY IF EXISTS "Authenticated users can update client_suppliers" ON public.client_suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete client_suppliers" ON public.client_suppliers;

CREATE POLICY "Users can view client_suppliers in their tenant"
ON public.client_suppliers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_suppliers.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage client_suppliers in their tenant"
ON public.client_suppliers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_suppliers.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_suppliers.client_id
    AND (clients.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);