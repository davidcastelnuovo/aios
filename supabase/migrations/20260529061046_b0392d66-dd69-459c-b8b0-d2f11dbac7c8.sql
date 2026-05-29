
CREATE POLICY "Users can view shared mirror automations"
ON public.automations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automation_shared_tenants ast
    WHERE ast.automation_id = automations.id
      AND ast.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can view shared mirror flow steps"
ON public.automation_flow_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automation_shared_tenants ast
    WHERE ast.automation_id = automation_flow_steps.automation_id
      AND ast.tenant_id = public.get_effective_tenant_id()
  )
);
