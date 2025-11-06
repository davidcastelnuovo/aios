-- Add SELECT policy so campaigners can view clients of their agencies
CREATE POLICY "Campaigners can view clients from their agencies"
ON public.clients
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND agency_id = ANY (get_user_agency_ids(auth.uid()))
  )
);