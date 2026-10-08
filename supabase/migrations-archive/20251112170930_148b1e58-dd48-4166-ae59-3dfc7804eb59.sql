-- Add RLS policy for team managers to view client_onboarding from their managed agencies
CREATE POLICY "Team managers can view client_onboarding from managed agencies"
ON public.client_onboarding
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND (
      user_manages_agency(auth.uid(), agency_id)
      OR (
        client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_onboarding.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
);

-- Add RLS policy for team managers to manage client_onboarding from their managed agencies
CREATE POLICY "Team managers can manage client_onboarding from managed agencies"
ON public.client_onboarding
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND (
      user_manages_agency(auth.uid(), agency_id)
      OR (
        client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_onboarding.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND (
      user_manages_agency(auth.uid(), agency_id)
      OR (
        client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_onboarding.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
);