-- Enable RLS on menu_items if not already enabled
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view menu_items in their tenant" ON menu_items;
DROP POLICY IF EXISTS "Owners can update menu_items" ON menu_items;
DROP POLICY IF EXISTS "Super admins can manage all menu_items" ON menu_items;

-- Users can view menu items in their tenant
CREATE POLICY "Users can view menu_items in their tenant"
ON menu_items
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

-- Owners can update menu items in their tenant
CREATE POLICY "Owners can update menu_items"
ON menu_items
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Super admins can manage all menu_items
CREATE POLICY "Super admins can manage all menu_items"
ON menu_items
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));