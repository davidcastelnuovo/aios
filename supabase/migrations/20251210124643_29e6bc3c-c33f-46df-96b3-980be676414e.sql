-- Update get_cross_tenant_campaigner_ids to include campaigners from managed agencies
CREATE OR REPLACE FUNCTION public.get_cross_tenant_campaigner_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ARRAY_AGG(DISTINCT campaigner_id) FROM (
    -- Campaigners associated with clients in agencies the user manages
    SELECT ct.campaigner_id
    FROM client_team ct
    JOIN clients c ON c.id = ct.client_id
    WHERE user_manages_agency(p_user_id, c.agency_id)
      OR (c.agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata 
        WHERE ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
      ))
    
    UNION
    
    -- Campaigners directly associated with agencies the user manages
    SELECT ca.campaigner_id
    FROM campaigner_agencies ca
    WHERE user_manages_agency(p_user_id, ca.agency_id)
  ) AS all_campaigners
$$;