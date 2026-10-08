
CREATE POLICY "View campaigners linked to cross-tenant agencies"
ON public.campaigners
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.campaigner_agencies ca
    JOIN public.agency_tenant_access ata ON ata.agency_id = ca.agency_id
    WHERE ca.campaigner_id = campaigners.id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);
