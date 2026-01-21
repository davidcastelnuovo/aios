-- Function to initialize terminology from preset
CREATE OR REPLACE FUNCTION public.initialize_tenant_terminology_from_preset(
  _tenant_id UUID,
  _preset_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preset RECORD;
  _term JSONB;
BEGIN
  SELECT * INTO _preset FROM terminology_presets WHERE id = _preset_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preset not found';
  END IF;

  FOR _term IN SELECT * FROM jsonb_array_elements(_preset.terms)
  LOOP
    INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
    VALUES (
      _tenant_id,
      _term->>'key',
      _term->>'singular',
      _term->>'plural',
      _term->>'singular',
      _term->>'plural'
    )
    ON CONFLICT (tenant_id, term_key) DO NOTHING;
  END LOOP;
END;
$$;