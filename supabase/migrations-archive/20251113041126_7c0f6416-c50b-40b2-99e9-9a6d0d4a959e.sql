-- Add allow_super_admin_access column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS allow_super_admin_access boolean NOT NULL DEFAULT true;

-- Update RLS policies to respect the allow_super_admin_access setting
-- For agencies
DROP POLICY IF EXISTS "Super admins can view all agencies" ON public.agencies;
CREATE POLICY "Super admins can view agencies with permission"
ON public.agencies
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = agencies.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all agencies" ON public.agencies;
CREATE POLICY "Super admins can manage agencies with permission"
ON public.agencies
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = agencies.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = agencies.tenant_id
  ) = true
);

-- For clients
DROP POLICY IF EXISTS "Super admins can view all clients" ON public.clients;
CREATE POLICY "Super admins can view clients with permission"
ON public.clients
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = clients.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
CREATE POLICY "Super admins can manage clients with permission"
ON public.clients
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = clients.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = clients.tenant_id
  ) = true
);

-- For tasks
DROP POLICY IF EXISTS "Super admins can manage all tasks" ON public.tasks;
CREATE POLICY "Super admins can manage tasks with permission"
ON public.tasks
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = tasks.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = tasks.tenant_id
  ) = true
);

-- For leads
DROP POLICY IF EXISTS "Super admins can view all leads" ON public.leads;
CREATE POLICY "Super admins can view leads with permission"
ON public.leads
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = leads.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all leads" ON public.leads;
CREATE POLICY "Super admins can manage leads with permission"
ON public.leads
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = leads.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = leads.tenant_id
  ) = true
);

-- For campaigners
DROP POLICY IF EXISTS "Super admins can view all campaigners" ON public.campaigners;
CREATE POLICY "Super admins can view campaigners with permission"
ON public.campaigners
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = campaigners.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all campaigners" ON public.campaigners;
CREATE POLICY "Super admins can manage campaigners with permission"
ON public.campaigners
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = campaigners.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = campaigners.tenant_id
  ) = true
);

-- For client_onboarding
DROP POLICY IF EXISTS "Super admins can view all client_onboarding" ON public.client_onboarding;
CREATE POLICY "Super admins can view client_onboarding with permission"
ON public.client_onboarding
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = client_onboarding.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all client_onboarding" ON public.client_onboarding;
CREATE POLICY "Super admins can manage client_onboarding with permission"
ON public.client_onboarding
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = client_onboarding.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = client_onboarding.tenant_id
  ) = true
);

-- For time_entries
DROP POLICY IF EXISTS "Super admins can view all time_entries" ON public.time_entries;
CREATE POLICY "Super admins can view time_entries with permission"
ON public.time_entries
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = time_entries.tenant_id
  ) = true
);

DROP POLICY IF EXISTS "Super admins can manage all time_entries" ON public.time_entries;
CREATE POLICY "Super admins can manage time_entries with permission"
ON public.time_entries
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = time_entries.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = time_entries.tenant_id
  ) = true
);