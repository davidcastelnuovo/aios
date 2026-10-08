-- Fix SELECT policy for campaigners - make it simple and clear
DROP POLICY IF EXISTS "Users can view campaigners they have access to" ON campaigners;

CREATE POLICY "Owners can view all campaigners in their tenant"
ON campaigners FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR 
  -- Owner can see all campaigners in their tenant
  (
    has_role(auth.uid(), 'owner'::app_role)
    AND tenant_id = get_user_tenant_id(auth.uid())
  )
  OR
  -- Team managers can see campaigners in agencies they manage
  EXISTS (
    SELECT 1 FROM campaigner_agencies ca
    WHERE ca.campaigner_id = campaigners.id
    AND user_manages_agency(auth.uid(), ca.agency_id)
  )
  OR
  -- Campaigners can see themselves
  (get_user_campaigner_id(auth.uid()) = campaigners.id)
);