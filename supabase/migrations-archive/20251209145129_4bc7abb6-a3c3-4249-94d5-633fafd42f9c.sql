
-- Drop and recreate the SELECT policy for team managers to include cross-tenant shared agency access
DROP POLICY IF EXISTS "Team managers view clients from managed agencies" ON public.clients;

CREATE POLICY "Team managers view clients from managed agencies"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  AND user_manages_agency(auth.uid(), agency_id)
  AND (
    -- Same tenant
    tenant_id = get_effective_tenant_id()
    OR
    -- Cross-tenant shared agency
    user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);
