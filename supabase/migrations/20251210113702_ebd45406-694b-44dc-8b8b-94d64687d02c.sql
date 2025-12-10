-- Add agency_id and client_id columns to crm_tables
ALTER TABLE public.crm_tables
ADD COLUMN agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_crm_tables_agency_id ON public.crm_tables(agency_id);
CREATE INDEX idx_crm_tables_client_id ON public.crm_tables(client_id);

-- Drop existing policies to recreate with new logic
DROP POLICY IF EXISTS "Owners can manage tables" ON public.crm_tables;
DROP POLICY IF EXISTS "Users can view tables in their tenant" ON public.crm_tables;

-- Policy for owners and super_admin - full access to all tables in tenant
CREATE POLICY "Owners can manage all tables in tenant"
ON public.crm_tables FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
);

-- Policy for team managers - view general tables + tables from managed agencies/clients
CREATE POLICY "Team managers can view managed tables"
ON public.crm_tables FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    (agency_id IS NULL AND client_id IS NULL)  -- general tables
    OR user_manages_agency(auth.uid(), agency_id)  -- tables assigned to managed agencies
    OR (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = crm_tables.client_id 
      AND user_manages_agency(auth.uid(), c.agency_id)
    ))  -- tables assigned to clients in managed agencies
  )
);

-- Policy for team managers to manage (insert/update/delete) tables
CREATE POLICY "Team managers can manage their tables"
ON public.crm_tables FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    (agency_id IS NULL AND client_id IS NULL)
    OR user_manages_agency(auth.uid(), agency_id)
    OR (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = crm_tables.client_id 
      AND user_manages_agency(auth.uid(), c.agency_id)
    ))
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    (agency_id IS NULL AND client_id IS NULL)
    OR user_manages_agency(auth.uid(), agency_id)
    OR (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = crm_tables.client_id 
      AND user_manages_agency(auth.uid(), c.agency_id)
    ))
  )
);

-- Policy for campaigners - view general tables + tables from their clients
CREATE POLICY "Campaigners can view their tables"
ON public.crm_tables FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'campaigner'::app_role)
  AND (
    (agency_id IS NULL AND client_id IS NULL)  -- general tables
    OR (client_id IS NOT NULL AND client_id = ANY(get_user_client_ids(auth.uid())))  -- tables assigned to their clients
  )
);