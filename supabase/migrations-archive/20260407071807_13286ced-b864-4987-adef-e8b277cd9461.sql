CREATE POLICY "Users can update ahrefs_reports in their tenant"
ON public.ahrefs_reports
FOR UPDATE
TO authenticated
USING ((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()));