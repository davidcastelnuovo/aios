
-- Fix agencies RLS policy for team_managers to also check tenant
DROP POLICY IF EXISTS "Team managers view managed agencies" ON agencies;

CREATE POLICY "Team managers view managed agencies"
ON agencies
FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  AND user_manages_agency(auth.uid(), id)
  AND tenant_id = get_effective_tenant_id()
);
