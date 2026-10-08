-- Fix leads table - allow team managers to see cross-tenant shared agency leads
DROP POLICY IF EXISTS "Team managers view leads from managed agencies" ON public.leads;

CREATE POLICY "Team managers view leads from managed agencies"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  AND agency_id IS NOT NULL
  AND user_manages_agency(auth.uid(), agency_id)
  AND (
    -- Same tenant
    tenant_id = get_effective_tenant_id()
    OR
    -- Cross-tenant shared agency
    user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);