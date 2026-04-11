-- Allow users to SELECT agencies shared with their active tenant via agency_tenant_access
CREATE POLICY "Users can view cross-tenant shared agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.agency_id = agencies.id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);