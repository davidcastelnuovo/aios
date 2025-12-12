-- Add integrations menu item to all tenants that don't have it
INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
SELECT 
  t.id,
  'integrations',
  'אינטגרציות',
  '/integrations',
  'Plug',
  206,
  true,
  'sales',
  'sales'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi 
  WHERE mi.tenant_id = t.id AND mi.menu_key = 'integrations'
);