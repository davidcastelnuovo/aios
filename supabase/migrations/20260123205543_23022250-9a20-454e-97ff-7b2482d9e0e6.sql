-- Add rank_tracking menu item to all existing tenants
INSERT INTO menu_items (tenant_id, menu_key, original_label, custom_label, is_visible, sort_order, icon, route, parent_menu_key, category)
SELECT 
  t.id,
  'rank_tracking',
  'מעקב מיקומים',
  NULL,
  true,
  107,
  'Target',
  '/rank-tracking',
  'management',
  'management'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi 
  WHERE mi.tenant_id = t.id AND mi.menu_key = 'rank_tracking'
);