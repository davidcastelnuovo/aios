-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Team managers view leads from managed agencies" ON public.leads;

-- Create new policy with corrected tenant check using get_user_tenant_id instead of get_effective_tenant_id
CREATE POLICY "Team managers view leads from managed agencies"
ON public.leads
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    -- Leads in user's active tenant
    tenant_id = get_user_tenant_id(auth.uid())
    OR
    -- Leads in agencies the user manages
    (agency_id IS NOT NULL AND user_manages_agency(auth.uid(), agency_id))
    OR
    -- Cross-tenant agency access
    (agency_id IS NOT NULL AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  )
);