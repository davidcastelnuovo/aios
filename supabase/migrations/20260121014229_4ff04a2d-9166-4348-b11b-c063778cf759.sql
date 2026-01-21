-- Create terminology presets table
CREATE TABLE public.terminology_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  terms JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.terminology_presets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view public presets
CREATE POLICY "Anyone can view public presets" ON public.terminology_presets
  FOR SELECT TO authenticated USING (is_public = true);

-- Allow super admins full access
CREATE POLICY "Super admins full access" ON public.terminology_presets
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Allow owners to manage their tenant's presets
CREATE POLICY "Owners manage own presets" ON public.terminology_presets
  FOR ALL TO authenticated USING (
    created_by_user_id = auth.uid()
  );

-- Add indexes
CREATE INDEX idx_terminology_presets_public ON public.terminology_presets(is_public) WHERE is_public = true;
CREATE INDEX idx_terminology_presets_tenant ON public.terminology_presets(created_by_tenant_id);