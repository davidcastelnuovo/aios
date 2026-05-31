CREATE POLICY "SEO users view SEO-tagged clients"
ON public.clients FOR SELECT
USING (
  has_role(auth.uid(), 'seo'::app_role)
  AND (
    is_seo_client = true
    OR services @> ARRAY['seo']::text[]
  )
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);