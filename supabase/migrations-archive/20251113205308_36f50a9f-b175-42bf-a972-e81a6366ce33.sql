-- Drop the policies we tried to create
DROP POLICY IF EXISTS "Tenant owners and super admins can insert tenant_settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Tenant owners and super admins can update tenant_settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Tenant owners and super admins can update menu_items" ON public.menu_items;

-- Create correct policies for tenant_settings with proper function call
CREATE POLICY "Tenant owners and super admins can insert tenant_settings"
ON public.tenant_settings
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = tenant_settings.tenant_id
        AND tu.role = 'owner'
    )
  )
);

CREATE POLICY "Tenant owners and super admins can update tenant_settings"
ON public.tenant_settings
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid()
        AND tenant_id = tenant_settings.tenant_id
        AND role = 'owner'
    )
  )
);

-- Create correct policy for menu_items
CREATE POLICY "Tenant owners and super admins can update menu_items"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = menu_items.tenant_id
        AND tu.role = 'owner'
    )
  )
);