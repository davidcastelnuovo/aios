-- Allow campaigners to view clients explicitly assigned to them via client_team
-- This complements existing agency-based policy and matches the user expectation
CREATE POLICY "Campaigners can view clients assigned to them"
ON public.clients
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.client_team ct
      WHERE ct.client_id = clients.id
        AND ct.campaigner_id = get_user_campaigner_id(auth.uid())
    )
  )
);
