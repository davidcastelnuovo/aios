-- Allow tenant owners to INSERT their tenant_settings (needed for saving menu group order)
CREATE POLICY "Tenant owners can insert their tenant_settings"
ON public.tenant_settings
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = tenant_settings.tenant_id
      AND tu.role = 'owner'
  )
);