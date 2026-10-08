CREATE OR REPLACE FUNCTION public.can_view_cross_tenant_campaigner(_campaigner_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigner_agencies ca
    JOIN public.agency_tenant_access ata ON ata.agency_id = ca.agency_id
    WHERE ca.campaigner_id = _campaigner_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$$;

DROP POLICY IF EXISTS "View campaigners linked to cross-tenant agencies" ON public.campaigners;
DROP POLICY IF EXISTS "Owners can view campaigners assigned to cross-tenant clients" ON public.campaigners;

CREATE POLICY "View campaigners linked to cross-tenant agencies"
ON public.campaigners
FOR SELECT
TO authenticated
USING (public.can_view_cross_tenant_campaigner(id, auth.uid()));