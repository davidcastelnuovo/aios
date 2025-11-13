-- Add parent_menu_key column to support menu hierarchy
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS parent_menu_key text;

-- Add category column for better grouping
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category text;

-- Delete existing menu items for marketingcaptain to reinitialize
DELETE FROM menu_items WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';

-- Initialize all menu items with hierarchy for marketingcaptain
INSERT INTO menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
VALUES
  -- Main menu items
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'agencies', 'סוכנויות', '/agencies', 'Building2', 1, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'clients', 'לקוחות', '/clients', 'Users', 2, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'tasks', 'משימות', '/tasks', 'CheckSquare', 3, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'client-onboarding', 'לקוחות בקליטה', '/client-onboarding', 'UserPlus', 4, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'time-tracking', 'שעון נוכחות', '/time-tracking', 'Clock', 5, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'campaigners', 'צוות', '/campaigners', 'Megaphone', 6, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'users', 'ניהול משתמשים', '/users', 'ShieldCheck', 7, true, 'main', NULL),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'my-profile', 'אזור אישי', '/my-profile', 'User', 8, true, 'main', NULL),
  
  -- Management group parent
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'management', 'ניהול', '#', 'Settings', 100, true, 'group', NULL),
  
  -- Management submenu items
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'dashboard', 'דשבורד', '/dashboard', 'LayoutDashboard', 101, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'finance', 'כספים', '/finance', 'DollarSign', 102, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'reports', 'דוחות', '/reports', 'BarChart3', 103, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'suppliers', 'ספקים', '/suppliers', 'Truck', 104, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'automations', 'אוטומציות', '/automations', 'Zap', 105, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'tenants', 'ניהול ארגונים', '/tenants', 'Building', 106, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'branding', 'התאמת מערכת', '/branding', 'Palette', 107, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'accounting-integrations', 'הנהלת חשבונות', '/accounting-integrations', 'Building', 108, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'ai-support', 'תמיכה טכנית AI', '/ai-support', 'Bot', 109, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'menu-management', 'ניהול תפריטים', '/menu-management', 'Menu', 110, true, 'management', 'management'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'fields-management', 'ניהול שדות', '/fields-management', 'ListTree', 111, true, 'management', 'management'),
  
  -- Sales group parent
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'sales', 'ניהול מכירות', '#', 'TrendingUp', 200, true, 'group', NULL),
  
  -- Sales submenu items
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'sales-dashboard', 'דשבורד מכירות', '/sales-dashboard', 'TrendingUp', 201, true, 'sales', 'sales'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'leads', 'לידים', '/leads', 'Target', 202, true, 'sales', 'sales'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'products', 'מוצרים ושירותים', '/products', 'Package', 203, true, 'sales', 'sales'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'sales-people', 'אנשי מכירות', '/sales-people', 'UserCheck', 204, true, 'sales', 'sales'),
  ('2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'lead-integrations', 'אינטגרציות לידים', '/lead-integrations', 'Settings', 205, true, 'sales', 'sales');

-- Update the initialize function to include hierarchy
CREATE OR REPLACE FUNCTION public.initialize_tenant_menu_items(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
  VALUES
    -- Main menu items
    (_tenant_id, 'agencies', 'סוכנויות', '/agencies', 'Building2', 1, true, 'main', NULL),
    (_tenant_id, 'clients', 'לקוחות', '/clients', 'Users', 2, true, 'main', NULL),
    (_tenant_id, 'tasks', 'משימות', '/tasks', 'CheckSquare', 3, true, 'main', NULL),
    (_tenant_id, 'client-onboarding', 'לקוחות בקליטה', '/client-onboarding', 'UserPlus', 4, true, 'main', NULL),
    (_tenant_id, 'time-tracking', 'שעון נוכחות', '/time-tracking', 'Clock', 5, true, 'main', NULL),
    (_tenant_id, 'campaigners', 'צוות', '/campaigners', 'Megaphone', 6, true, 'main', NULL),
    (_tenant_id, 'users', 'ניהול משתמשים', '/users', 'ShieldCheck', 7, true, 'main', NULL),
    (_tenant_id, 'my-profile', 'אזור אישי', '/my-profile', 'User', 8, true, 'main', NULL),
    
    -- Management group
    (_tenant_id, 'management', 'ניהול', '#', 'Settings', 100, true, 'group', NULL),
    (_tenant_id, 'dashboard', 'דשבורד', '/dashboard', 'LayoutDashboard', 101, true, 'management', 'management'),
    (_tenant_id, 'finance', 'כספים', '/finance', 'DollarSign', 102, true, 'management', 'management'),
    (_tenant_id, 'reports', 'דוחות', '/reports', 'BarChart3', 103, true, 'management', 'management'),
    (_tenant_id, 'suppliers', 'ספקים', '/suppliers', 'Truck', 104, true, 'management', 'management'),
    (_tenant_id, 'automations', 'אוטומציות', '/automations', 'Zap', 105, true, 'management', 'management'),
    (_tenant_id, 'tenants', 'ניהול ארגונים', '/tenants', 'Building', 106, true, 'management', 'management'),
    (_tenant_id, 'branding', 'התאמת מערכת', '/branding', 'Palette', 107, true, 'management', 'management'),
    (_tenant_id, 'accounting-integrations', 'הנהלת חשבונות', '/accounting-integrations', 'Building', 108, true, 'management', 'management'),
    (_tenant_id, 'ai-support', 'תמיכה טכנית AI', '/ai-support', 'Bot', 109, true, 'management', 'management'),
    (_tenant_id, 'menu-management', 'ניהול תפריטים', '/menu-management', 'Menu', 110, true, 'management', 'management'),
    (_tenant_id, 'fields-management', 'ניהול שדות', '/fields-management', 'ListTree', 111, true, 'management', 'management'),
    
    -- Sales group
    (_tenant_id, 'sales', 'ניהול מכירות', '#', 'TrendingUp', 200, true, 'group', NULL),
    (_tenant_id, 'sales-dashboard', 'דשבורד מכירות', '/sales-dashboard', 'TrendingUp', 201, true, 'sales', 'sales'),
    (_tenant_id, 'leads', 'לידים', '/leads', 'Target', 202, true, 'sales', 'sales'),
    (_tenant_id, 'products', 'מוצרים ושירותים', '/products', 'Package', 203, true, 'sales', 'sales'),
    (_tenant_id, 'sales-people', 'אנשי מכירות', '/sales-people', 'UserCheck', 204, true, 'sales', 'sales'),
    (_tenant_id, 'lead-integrations', 'אינטגרציות לידים', '/lead-integrations', 'Settings', 205, true, 'sales', 'sales')
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;
END;
$$;