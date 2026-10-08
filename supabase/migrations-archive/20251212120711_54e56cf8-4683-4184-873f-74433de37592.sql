-- Create lead_pipeline_stages table for dynamic pipeline stages
CREATE TABLE public.lead_pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, stage_key)
);

-- Enable RLS
ALTER TABLE public.lead_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pipeline stages in their tenant"
ON public.lead_pipeline_stages FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage pipeline stages"
ON public.lead_pipeline_stages FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
);

-- Function to initialize default pipeline stages for a tenant
CREATE OR REPLACE FUNCTION public.initialize_default_pipeline_stages(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order)
  VALUES
    (p_tenant_id, 'new', 'חדש', '#3B82F6', 1),
    (p_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2),
    (p_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3),
    (p_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4),
    (p_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5),
    (p_tenant_id, 'won', 'נסגר בהצלחה', '#22C55E', 6),
    (p_tenant_id, 'lost', 'אבוד', '#EF4444', 7)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$$;

-- Initialize pipeline stages for existing tenants
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    PERFORM initialize_default_pipeline_stages(t_id);
  END LOOP;
END $$;