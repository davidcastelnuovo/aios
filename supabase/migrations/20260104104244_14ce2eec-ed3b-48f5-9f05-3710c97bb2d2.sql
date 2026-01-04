-- Create lead_filter_presets table
CREATE TABLE public.lead_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_filter_presets ENABLE ROW LEVEL SECURITY;

-- Users can view their own presets
CREATE POLICY "Users can view their own presets"
ON public.lead_filter_presets
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own presets
CREATE POLICY "Users can insert their own presets"
ON public.lead_filter_presets
FOR INSERT
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));

-- Users can update their own presets
CREATE POLICY "Users can update their own presets"
ON public.lead_filter_presets
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own presets
CREATE POLICY "Users can delete their own presets"
ON public.lead_filter_presets
FOR DELETE
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_lead_filter_presets_user_tenant ON public.lead_filter_presets(user_id, tenant_id);

-- Add trigger for updated_at
CREATE TRIGGER update_lead_filter_presets_updated_at
BEFORE UPDATE ON public.lead_filter_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();