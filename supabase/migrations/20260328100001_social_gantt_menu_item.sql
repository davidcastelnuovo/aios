-- Add social-gantt menu item for all existing tenants
INSERT INTO public.menu_items (tenant_id, menu_key, custom_label, original_label, is_visible, sort_order, icon, route, parent_menu_key)
SELECT DISTINCT mi.tenant_id, 'social-gantt', NULL, 'גאנט סושיאל', true,
  COALESCE((SELECT MAX(sort_order) FROM public.menu_items mi2 WHERE mi2.tenant_id = mi.tenant_id), 0) + 1,
  'CalendarRange', '/social-gantt', NULL
FROM public.menu_items mi
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items existing
  WHERE existing.tenant_id = mi.tenant_id AND existing.menu_key = 'social-gantt'
)
GROUP BY mi.tenant_id;
