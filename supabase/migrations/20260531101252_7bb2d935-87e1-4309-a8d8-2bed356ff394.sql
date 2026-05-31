CREATE POLICY "Cross-tenant agency access to wp sites"
ON public.social_media_wordpress_sites
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL
  AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
);