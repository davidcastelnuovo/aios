
-- Create a security definer function to get campaigner IDs that are assigned to clients in user's managed agencies
CREATE OR REPLACE FUNCTION public.get_cross_tenant_campaigner_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT ct.campaigner_id)
  FROM client_team ct
  JOIN clients c ON c.id = ct.client_id
  WHERE user_manages_agency(p_user_id, c.agency_id)
    OR (c.agency_id IN (
      SELECT ata.agency_id 
      FROM agency_tenant_access ata 
      WHERE ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
    ))
$$;

-- Add a new SELECT policy for team managers to see campaigners assigned to their clients
CREATE POLICY "Team managers can view cross-tenant campaigners on their clients"
ON public.campaigners
FOR SELECT
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  AND id = ANY(COALESCE(get_cross_tenant_campaigner_ids(auth.uid()), ARRAY[]::uuid[]))
);
