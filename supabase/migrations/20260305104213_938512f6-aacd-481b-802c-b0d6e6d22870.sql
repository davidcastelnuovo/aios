INSERT INTO menu_items (tenant_id, menu_key, original_label, custom_label, is_visible, sort_order, icon, route, badge, parent_menu_key)
SELECT t.id, 'recordings', 'הקלטות', NULL, true, 25, 'BarChart3', '/recordings', NULL, NULL
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.tenant_id = t.id AND mi.menu_key = 'recordings'
);