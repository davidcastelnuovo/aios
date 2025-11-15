-- Add chat-integrations menu item to all existing tenants
INSERT INTO menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
SELECT 
  id as tenant_id,
  'chat-integrations' as menu_key,
  'אינטגרציות צ''אט' as original_label,
  '/chat-integrations' as route,
  'MessageSquare' as icon,
  50 as sort_order,
  true as is_visible,
  'main' as category,
  NULL as parent_menu_key
FROM tenants
ON CONFLICT (tenant_id, menu_key) DO UPDATE
SET 
  original_label = EXCLUDED.original_label,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;