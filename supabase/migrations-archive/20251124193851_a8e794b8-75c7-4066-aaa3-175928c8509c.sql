-- Drop old conflicting SELECT policies that are causing issues
-- We need to remove these to allow the new comprehensive policies to work

-- Drop old campaigners SELECT policies
DROP POLICY IF EXISTS "Users can view all campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Campaigners visible to super admin and tenant members" ON public.campaigners;

-- Drop old tasks SELECT policies  
DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks from shared agencies" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their tenants" ON public.tasks;

-- Drop old leads SELECT policies
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads from shared agencies" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their tenants" ON public.leads;

-- Drop old agencies SELECT policies
DROP POLICY IF EXISTS "Users can view agencies" ON public.agencies;

-- Drop old clients SELECT policies
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;