-- Create manychat_templates table
CREATE TABLE IF NOT EXISTS public.manychat_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  template_namespace TEXT NOT NULL,
  template_language TEXT DEFAULT 'he' NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  template_variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, template_name)
);

-- Enable RLS
ALTER TABLE public.manychat_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their tenant"
  ON public.manychat_templates
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage templates in their tenant"
  ON public.manychat_templates
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_manychat_templates_updated_at
  BEFORE UPDATE ON public.manychat_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();