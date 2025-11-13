-- Create function to copy custom fields from source tenant to target tenant
CREATE OR REPLACE FUNCTION public.copy_custom_fields_to_tenant(_source_tenant_id uuid, _target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Copy all custom fields from source tenant to target tenant
  -- Only insert if they don't already exist
  INSERT INTO public.custom_fields (
    tenant_id,
    entity_type,
    field_key,
    field_label,
    field_type,
    is_required,
    is_visible,
    options,
    sort_order
  )
  SELECT
    _target_tenant_id,
    entity_type,
    field_key,
    field_label,
    field_type,
    is_required,
    is_visible,
    options,
    sort_order
  FROM public.custom_fields
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, entity_type, field_key) DO NOTHING;
END;
$$;

-- Create function to initialize default custom fields for new tenants
CREATE OR REPLACE FUNCTION public.initialize_default_custom_fields(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  source_tenant_id uuid;
BEGIN
  -- Get the marketingcaptain tenant ID as the source
  SELECT id INTO source_tenant_id
  FROM public.tenants
  WHERE slug = 'marketingcaptain'
  LIMIT 1;
  
  -- If source tenant exists, copy fields
  IF source_tenant_id IS NOT NULL THEN
    PERFORM copy_custom_fields_to_tenant(source_tenant_id, _tenant_id);
  END IF;
END;
$$;

-- Copy fields to all existing tenants (except marketingcaptain)
DO $$
DECLARE
  source_tenant_id uuid;
  target_tenant record;
BEGIN
  -- Get the marketingcaptain tenant ID
  SELECT id INTO source_tenant_id
  FROM public.tenants
  WHERE slug = 'marketingcaptain'
  LIMIT 1;
  
  -- Copy to all other tenants
  IF source_tenant_id IS NOT NULL THEN
    FOR target_tenant IN 
      SELECT id FROM public.tenants WHERE id != source_tenant_id
    LOOP
      PERFORM copy_custom_fields_to_tenant(source_tenant_id, target_tenant.id);
    END LOOP;
  END IF;
END;
$$;