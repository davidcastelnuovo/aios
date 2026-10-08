CREATE POLICY "Owners can view campaigners assigned to cross-tenant clients"
ON public.campaigners FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.client_team ct
    JOIN public.clients c ON c.id = ct.client_id
    JOIN public.agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE ct.campaigner_id = campaigners.id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);