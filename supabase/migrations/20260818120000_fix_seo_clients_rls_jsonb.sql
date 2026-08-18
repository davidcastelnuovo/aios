-- SEO client visibility: services is jsonb, not text[].
-- Also let SEO staff see owned agencies in their tenant (not only shared ones).

DROP POLICY IF EXISTS "SEO users view SEO-tagged clients" ON public.clients;

CREATE POLICY "SEO users view SEO-tagged clients"
ON public.clients
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'seo'::app_role)
  AND (
    is_seo_client = true
    OR services @> '["seo"]'::jsonb
  )
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);

DROP POLICY IF EXISTS "SEO users view tenant and shared agencies" ON public.agencies;

CREATE POLICY "SEO users view tenant and shared agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'seo'::app_role)
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), id)
  )
);
