-- Allow members of a tenant that has cross-tenant agency access
-- to view integrations hosted in the source tenant. Needed so shared
-- agency clients (DMM <-> MarketingCaptain) can render Ahrefs / GSC / GA
-- data even when the integration row lives in the other tenant.
CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_integration_access(_user_id uuid, _integration_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = _integration_tenant_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$$;

CREATE POLICY "Cross-tenant agency members can view integrations"
ON public.tenant_integrations
FOR SELECT
USING (public.user_has_cross_tenant_integration_access(auth.uid(), tenant_id));