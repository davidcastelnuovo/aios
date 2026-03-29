INSERT INTO menu_items (tenant_id, menu_key, original_label, custom_label, is_visible, sort_order, icon, route, parent_menu_key)
SELECT t.id, 'social-media', 'ניהול סושיאל', NULL, true, 30, 'Share2', '/social-media', NULL
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.tenant_id = t.id AND mi.menu_key = 'social-media'
);