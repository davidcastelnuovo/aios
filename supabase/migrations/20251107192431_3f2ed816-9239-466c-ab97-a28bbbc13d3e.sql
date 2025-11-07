-- Create menu_items table for customizable menu labels
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  menu_key TEXT NOT NULL,
  custom_label TEXT,
  original_label TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  route TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, menu_key)
);

-- Create custom_fields table for customizable entity fields
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'client', 'lead')),
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'textarea', 'checkbox', 'email', 'phone')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  options JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity_type, field_key)
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_items
CREATE POLICY "Users can view menu_items in their tenant"
  ON public.menu_items FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage menu_items"
  ON public.menu_items FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  );

-- RLS Policies for custom_fields
CREATE POLICY "Users can view custom_fields in their tenant"
  ON public.custom_fields FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage custom_fields"
  ON public.custom_fields FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  );

-- Create triggers for updated_at
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default menu items for new tenants
CREATE OR REPLACE FUNCTION public.initialize_tenant_menu_items(_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.menu_items (tenant_id, menu_key, original_label, custom_label, route, icon, sort_order, is_visible)
  VALUES
    (_tenant_id, 'dashboard', 'דשבורד', NULL, '/dashboard', 'LayoutDashboard', 1, true),
    (_tenant_id, 'tasks', 'משימות', NULL, '/tasks', 'CheckSquare', 2, true),
    (_tenant_id, 'leads', 'לידים', NULL, '/leads', 'UserPlus', 3, true),
    (_tenant_id, 'clients', 'לקוחות', NULL, '/clients', 'Users', 4, true),
    (_tenant_id, 'client-onboarding', 'קליטת לקוחות', NULL, '/client-onboarding', 'UserCheck', 5, true),
    (_tenant_id, 'agencies', 'סוכנויות', NULL, '/agencies', 'Building2', 6, true),
    (_tenant_id, 'campaigners', 'קמפיינרים', NULL, '/campaigners', 'Megaphone', 7, true),
    (_tenant_id, 'sales-people', 'אנשי מכירות', NULL, '/sales-people', 'TrendingUp', 8, true),
    (_tenant_id, 'suppliers', 'ספקים', NULL, '/suppliers', 'Package', 9, true),
    (_tenant_id, 'products', 'מוצרים', NULL, '/products', 'ShoppingBag', 10, true),
    (_tenant_id, 'finance', 'כספים', NULL, '/finance', 'DollarSign', 11, true),
    (_tenant_id, 'reports', 'דוחות', NULL, '/reports', 'BarChart3', 12, true),
    (_tenant_id, 'time-tracking', 'מעקב זמנים', NULL, '/time-tracking', 'Clock', 13, true),
    (_tenant_id, 'automations', 'אוטומציות', NULL, '/automations', 'Zap', 14, true)
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;
END;
$$;