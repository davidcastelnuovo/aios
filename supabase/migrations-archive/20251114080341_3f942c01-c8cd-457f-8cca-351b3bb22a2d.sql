-- Create tenant_terminology table for custom module names
CREATE TABLE public.tenant_terminology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  term_key TEXT NOT NULL,
  singular TEXT NOT NULL,
  plural TEXT NOT NULL,
  original_singular TEXT NOT NULL,
  original_plural TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, term_key)
);

-- Enable RLS
ALTER TABLE public.tenant_terminology ENABLE ROW LEVEL SECURITY;

-- Owners can manage terminology
CREATE POLICY "Owners can manage terminology"
ON public.tenant_terminology
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- All tenant users can view terminology
CREATE POLICY "Users can view tenant terminology"
ON public.tenant_terminology
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);

-- Super admins can manage all terminology
CREATE POLICY "Super admins can manage all terminology"
ON public.tenant_terminology
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_tenant_terminology_updated_at
BEFORE UPDATE ON public.tenant_terminology
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize default terms for all existing tenants
INSERT INTO public.tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
SELECT 
  t.id,
  term.key,
  term.singular,
  term.plural,
  term.singular,
  term.plural
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('agency', 'סוכנות', 'סוכנויות'),
    ('client', 'לקוח', 'לקוחות'),
    ('lead', 'ליד', 'לידים'),
    ('task', 'משימה', 'משימות'),
    ('campaigner', 'קמפיינר', 'קמפיינרים'),
    ('sales_person', 'איש מכירות', 'אנשי מכירות'),
    ('supplier', 'ספק', 'ספקים'),
    ('product', 'מוצר', 'מוצרים'),
    ('onboarding', 'קליטה', 'קליטות')
) AS term(key, singular, plural)
ON CONFLICT (tenant_id, term_key) DO NOTHING;