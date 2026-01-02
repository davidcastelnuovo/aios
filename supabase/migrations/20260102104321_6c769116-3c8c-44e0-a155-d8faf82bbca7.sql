-- Create tenant_templates table
CREATE TABLE public.tenant_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates from their tenant or public templates"
ON public.tenant_templates FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR is_public = true
  OR source_tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Owners can create templates from their tenant"
ON public.tenant_templates FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    source_tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
);

CREATE POLICY "Owners can update their templates"
ON public.tenant_templates FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR (
    source_tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
);

CREATE POLICY "Owners can delete their templates"
ON public.tenant_templates FOR DELETE
USING (
  is_super_admin(auth.uid())
  OR (
    source_tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
);

-- Create RPC function to copy tenant configuration
CREATE OR REPLACE FUNCTION public.copy_tenant_template(_source_tenant_id UUID, _target_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Copy custom_fields
  INSERT INTO public.custom_fields (
    tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  )
  SELECT
    _target_tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  FROM public.custom_fields
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, entity_type, field_key) DO NOTHING;

  -- Copy menu_items
  INSERT INTO public.menu_items (
    tenant_id, menu_key, original_label, custom_label, route, icon,
    sort_order, is_visible, category, parent_menu_key, badge, hidden_from_child_tenants
  )
  SELECT
    _target_tenant_id, menu_key, original_label, custom_label, route, icon,
    sort_order, is_visible, category, parent_menu_key, badge, hidden_from_child_tenants
  FROM public.menu_items
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;

  -- Copy tenant_terminology
  INSERT INTO public.tenant_terminology (
    tenant_id, term_key, custom_value
  )
  SELECT
    _target_tenant_id, term_key, custom_value
  FROM public.tenant_terminology
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, term_key) DO NOTHING;

  -- Copy lead_pipeline_stages
  INSERT INTO public.lead_pipeline_stages (
    tenant_id, stage_key, label, color, sort_order, is_active
  )
  SELECT
    _target_tenant_id, stage_key, label, color, sort_order, is_active
  FROM public.lead_pipeline_stages
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;

  -- Copy lead_statuses
  INSERT INTO public.lead_statuses (
    tenant_id, status_key, label, color, sort_order, is_active
  )
  SELECT
    _target_tenant_id, status_key, label, color, sort_order, is_active
  FROM public.lead_statuses
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, status_key) DO NOTHING;

  -- Copy tenant_settings
  INSERT INTO public.tenant_settings (
    tenant_id, setting_key, setting_value
  )
  SELECT
    _target_tenant_id, setting_key, setting_value
  FROM public.tenant_settings
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- Copy automations (without tenant-specific references)
  INSERT INTO public.automations (
    tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  )
  SELECT
    _target_tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  FROM public.automations
  WHERE tenant_id = _source_tenant_id;

END;
$$;