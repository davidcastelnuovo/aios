
-- Digital Signature Documents table
CREATE TABLE public.signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  title text NOT NULL,
  content text, -- HTML content for created documents
  file_url text, -- URL for uploaded documents
  document_type text NOT NULL DEFAULT 'created' CHECK (document_type IN ('created', 'uploaded')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'partially_signed', 'completed', 'cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Signature Recipients table
CREATE TABLE public.signature_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.signature_documents(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'signer',
  sign_order integer DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined')),
  signature_data text, -- base64 PNG of drawn signature
  signed_at timestamptz,
  sign_token uuid DEFAULT gen_random_uuid(), -- unique token for signing link
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_recipients ENABLE ROW LEVEL SECURITY;

-- RLS for signature_documents
CREATE POLICY "Users can view documents in their tenant"
  ON public.signature_documents FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create documents in their tenant"
  ON public.signature_documents FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update documents in their tenant"
  ON public.signature_documents FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete documents in their tenant"
  ON public.signature_documents FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- RLS for signature_recipients
CREATE POLICY "Users can view recipients in their tenant"
  ON public.signature_recipients FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can manage recipients in their tenant"
  ON public.signature_recipients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update recipients in their tenant"
  ON public.signature_recipients FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete recipients in their tenant"
  ON public.signature_recipients FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Allow anonymous access for signing via token
CREATE POLICY "Anyone can view recipient by sign token"
  ON public.signature_recipients FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can update recipient signature by token"
  ON public.signature_recipients FOR UPDATE TO anon
  USING (true);

-- Allow anon to read document for signing
CREATE POLICY "Anyone can view document for signing"
  ON public.signature_documents FOR SELECT TO anon
  USING (true);

-- Add signatures menu item to all existing tenants
INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
SELECT id, 'signatures', 'חתימות דיגיטליות', '/signatures', 'FileSignature', 10, true, 'main', NULL
FROM public.tenants
ON CONFLICT (tenant_id, menu_key) DO NOTHING;

-- Update initialize function to include signatures for new tenants
CREATE OR REPLACE FUNCTION public.initialize_tenant_menu_items(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
  VALUES
    (_tenant_id, 'agencies', 'סוכנויות', '/agencies', 'Building2', 1, true, 'main', NULL),
    (_tenant_id, 'clients', 'לקוחות', '/clients', 'Users', 2, true, 'main', NULL),
    (_tenant_id, 'tasks', 'משימות', '/tasks', 'CheckSquare', 3, true, 'main', NULL),
    (_tenant_id, 'client-onboarding', 'לקוחות בקליטה', '/client-onboarding', 'UserPlus', 4, true, 'main', NULL),
    (_tenant_id, 'time-tracking', 'שעון נוכחות', '/time-tracking', 'Clock', 5, true, 'main', NULL),
    (_tenant_id, 'campaigners', 'צוות', '/campaigners', 'Megaphone', 6, true, 'main', NULL),
    (_tenant_id, 'users', 'ניהול משתמשים', '/users', 'ShieldCheck', 7, true, 'main', NULL),
    (_tenant_id, 'my-profile', 'אזור אישי', '/my-profile', 'User', 8, true, 'main', NULL),
    (_tenant_id, 'chat', 'צ''אט', '/chat', 'MessageCircle', 9, true, 'main', NULL),
    (_tenant_id, 'signatures', 'חתימות דיגיטליות', '/signatures', 'FileSignature', 10, true, 'main', NULL),
    
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
    
    (_tenant_id, 'sales', 'ניהול מכירות', '#', 'TrendingUp', 200, true, 'group', NULL),
    (_tenant_id, 'sales-dashboard', 'דשבורד מכירות', '/sales-dashboard', 'TrendingUp', 201, true, 'sales', 'sales'),
    (_tenant_id, 'leads', 'לידים', '/leads', 'Target', 202, true, 'sales', 'sales'),
    (_tenant_id, 'products', 'מוצרים ושירותים', '/products', 'Package', 203, true, 'sales', 'sales'),
    (_tenant_id, 'sales-people', 'אנשי מכירות', '/sales-people', 'UserCheck', 204, true, 'sales', 'sales'),
    (_tenant_id, 'integrations', 'אינטגרציות', '/integrations', 'Plug', 206, true, 'sales', 'sales')
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;
END;
$function$;

-- Create storage bucket for uploaded documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-documents', 'signature-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Authenticated users can upload signature docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signature-documents');

CREATE POLICY "Authenticated users can view signature docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signature-documents');

CREATE POLICY "Anon can view signature docs for signing"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'signature-documents');
