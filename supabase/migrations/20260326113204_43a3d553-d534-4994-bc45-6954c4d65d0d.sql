
INSERT INTO menu_items (tenant_id, menu_key, original_label, custom_label, is_visible, sort_order, icon, route)
SELECT 
  t.id,
  'agents',
  'סוכני AI',
  NULL,
  true,
  31,
  'Cpu',
  '/agents'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.tenant_id = t.id AND mi.menu_key = 'agents'
);

INSERT INTO menu_items (tenant_id, menu_key, original_label, custom_label, is_visible, sort_order, icon, route)
SELECT 
  t.id,
  'ai-detection',
  'ניטור נראות AI',
  NULL,
  true,
  32,
  'Radar',
  '/ai-detection'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.tenant_id = t.id AND mi.menu_key = 'ai-detection'
);
