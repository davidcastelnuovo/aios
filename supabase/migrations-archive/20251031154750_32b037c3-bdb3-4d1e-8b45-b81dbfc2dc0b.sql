-- Fix infinite recursion in RLS policies
-- The problem: client_team policy checks clients table, and clients policy checks client_team table

-- Create security definer function to check client tenant
CREATE OR REPLACE FUNCTION public.get_client_tenant_id(_client_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.clients
  WHERE id = _client_id
$$;

-- Fix client_team policies to use security definer function instead of direct table reference
DROP POLICY IF EXISTS "Users can view client_team in their tenant" ON public.client_team;
DROP POLICY IF EXISTS "Users can manage client_team in their tenant" ON public.client_team;

CREATE POLICY "Users can view client_team in their tenant"
ON public.client_team
FOR SELECT
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert client_team in their tenant"
ON public.client_team
FOR INSERT
TO authenticated
WITH CHECK (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update client_team in their tenant"
ON public.client_team
FOR UPDATE
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete client_team in their tenant"
ON public.client_team
FOR DELETE
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

-- Similarly fix client_suppliers
DROP POLICY IF EXISTS "Users can view client_suppliers in their tenant" ON public.client_suppliers;
DROP POLICY IF EXISTS "Users can manage client_suppliers in their tenant" ON public.client_suppliers;

CREATE POLICY "Users can view client_suppliers in their tenant"
ON public.client_suppliers
FOR SELECT
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert client_suppliers in their tenant"
ON public.client_suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update client_suppliers in their tenant"
ON public.client_suppliers
FOR UPDATE
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete client_suppliers in their tenant"
ON public.client_suppliers
FOR DELETE
TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);