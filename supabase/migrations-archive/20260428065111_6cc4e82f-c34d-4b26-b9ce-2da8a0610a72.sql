CREATE POLICY "Campaigners can manage tables for assigned clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND client_id = ANY(get_user_client_ids(auth.uid()))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND client_id = ANY(get_user_client_ids(auth.uid()))
);