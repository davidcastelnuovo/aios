-- 1. Fix agencies table - allow team managers to see cross-tenant shared agencies
DROP POLICY IF EXISTS "Team managers view managed agencies" ON public.agencies;

CREATE POLICY "Team managers view managed agencies"
ON public.agencies
FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  AND user_manages_agency(auth.uid(), id)
  AND (
    -- Same tenant
    tenant_id = get_effective_tenant_id()
    OR
    -- Cross-tenant shared agency
    user_has_cross_tenant_agency_access(auth.uid(), id)
  )
);

-- 2. Fix client_onboarding table - update team manager policy to include cross-tenant access
DROP POLICY IF EXISTS "Team managers can view client_onboarding from managed agencies" ON public.client_onboarding;

CREATE POLICY "Team managers can view client_onboarding from managed agencies"
ON public.client_onboarding
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND has_role(auth.uid(), 'team_manager'::app_role) 
    AND (
      user_manages_agency(auth.uid(), agency_id) 
      OR (
        (client_id IS NOT NULL) 
        AND (EXISTS ( 
          SELECT 1 FROM clients c
          WHERE c.id = client_onboarding.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        ))
      )
    )
  )
  OR (
    -- Cross-tenant shared agency access
    has_role(auth.uid(), 'team_manager'::app_role)
    AND (
      user_has_cross_tenant_agency_access(auth.uid(), agency_id)
      OR (
        (client_id IS NOT NULL)
        AND (EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_onboarding.client_id
          AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)
        ))
      )
    )
  )
);