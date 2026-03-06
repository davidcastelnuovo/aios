
-- Insert team-chat menu item for all existing tenants
INSERT INTO public.menu_items (tenant_id, menu_key, original_label, custom_label, route, icon, sort_order, is_visible, category, parent_menu_key)
SELECT 
  t.id,
  'team-chat',
  'צ''אט צוות',
  'צ''אט צוות',
  'team-chat',
  'MessagesSquare',
  115,
  true,
  'main',
  NULL
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items mi WHERE mi.tenant_id = t.id AND mi.menu_key = 'team-chat'
);
