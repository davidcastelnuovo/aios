-- Fix RLS policy to ensure users can view custom_fields
DROP POLICY IF EXISTS "Users can view custom_fields in their tenant" ON public.custom_fields;

CREATE POLICY "Users can view custom_fields in their tenant"
ON public.custom_fields
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);