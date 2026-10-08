-- Validate the complete submission while holding the document lock. The public
-- Edge Function validates the token; only service_role may invoke mutation RPCs.
CREATE OR REPLACE FUNCTION public.signature_png_is_valid(_value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  bytes bytea;
  width bigint;
  height bigint;
BEGIN
  IF _value IS NULL OR length(_value) > 5000000 OR length(_value) < 100
    OR _value NOT LIKE 'data:image/png;base64,%' THEN RETURN false; END IF;
  bytes := decode(substr(_value, 23), 'base64');
  IF octet_length(bytes) < 67
    OR substring(bytes FROM 1 FOR 8) <> decode('89504e470d0a1a0a', 'hex')
    OR substring(bytes FROM 9 FOR 8) <> decode('0000000d49484452', 'hex')
    OR substring(bytes FROM octet_length(bytes) - 11) <> decode('0000000049454e44ae426082', 'hex')
    THEN RETURN false; END IF;
  width := get_byte(bytes,16)::bigint*16777216 + get_byte(bytes,17)*65536 + get_byte(bytes,18)*256 + get_byte(bytes,19);
  height := get_byte(bytes,20)::bigint*16777216 + get_byte(bytes,21)*65536 + get_byte(bytes,22)*256 + get_byte(bytes,23);
  RETURN width BETWEEN 2 AND 4096 AND height BETWEEN 2 AND 4096;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.signature_png_is_valid(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signature_png_is_valid(text) TO service_role;

CREATE OR REPLACE FUNCTION public.log_signature_event(
  _document_id uuid, _recipient_id uuid, _event_type text,
  _ip text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.signature_documents WHERE id = _document_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'document_not_found'; END IF;
  IF _recipient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.signature_recipients
    WHERE id = _recipient_id AND document_id = _document_id AND tenant_id = v_tenant_id
  ) THEN RAISE EXCEPTION 'invalid_event_recipient'; END IF;
  INSERT INTO public.signature_events (document_id, recipient_id, tenant_id, event_type, ip_address, metadata)
  VALUES (_document_id, _recipient_id, v_tenant_id, _event_type, _ip, COALESCE(_metadata, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.log_signature_event(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_signature_event(uuid,uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_signature_by_token(
  _token uuid, _signature_data text, _ip text DEFAULT NULL, _field_values jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_doc public.signature_documents%ROWTYPE;
  v_document_id uuid;
  v_field jsonb;
  v_value text;
  v_values jsonb := '{}'::jsonb;
  v_new_status text;
  v_stamp boolean := false;
  v_stamp_name text;
  v_stamp_id text;
BEGIN
  IF _token IS NULL OR NOT public.signature_png_is_valid(_signature_data) THEN
    RAISE EXCEPTION 'invalid_signature';
  END IF;
  IF _field_values IS NULL OR jsonb_typeof(_field_values) <> 'object' OR octet_length(_field_values::text) > 10000000 THEN
    RAISE EXCEPTION 'invalid_field_values';
  END IF;
  SELECT document_id INTO v_document_id FROM public.signature_recipients WHERE sign_token = _token;
  IF v_document_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_signed'; END IF;
  -- Always lock the document first, serializing concurrent signers and cancellation.
  SELECT * INTO v_doc FROM public.signature_documents WHERE id = v_document_id FOR UPDATE;
  SELECT * INTO v_rec FROM public.signature_recipients WHERE sign_token = _token FOR UPDATE;
  IF v_rec.status <> 'pending' THEN RAISE EXCEPTION 'not_found_or_already_signed'; END IF;
  IF v_doc.id IS NULL OR v_rec.tenant_id <> v_doc.tenant_id OR v_doc.is_template
    OR v_doc.status NOT IN ('pending','partially_signed')
    OR EXISTS (SELECT 1 FROM public.signature_recipients WHERE document_id = v_doc.id AND status = 'declined')
    THEN RAISE EXCEPTION 'document_not_signable'; END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.document_fields, '[]'::jsonb)) LOOP
    IF COALESCE((v_field->>'recipient_index')::int, 0) <> GREATEST(0, v_rec.sign_order - 1) THEN CONTINUE; END IF;
    v_value := NULLIF(btrim(_field_values->>(v_field->>'id')), '');
    IF COALESCE((v_field->>'required')::boolean, false) AND v_value IS NULL THEN
      RAISE EXCEPTION 'missing_required_field';
    END IF;
    IF v_value IS NULL THEN CONTINUE; END IF;
    IF jsonb_typeof(_field_values->(v_field->>'id')) <> 'string' THEN RAISE EXCEPTION 'invalid_field_values'; END IF;
    IF v_field->>'type' IN ('signature','signature_stamp') THEN
      IF NOT public.signature_png_is_valid(v_value) THEN RAISE EXCEPTION 'invalid_signature'; END IF;
      IF v_field->>'type' = 'signature_stamp' THEN v_stamp := true; END IF;
    ELSIF length(v_value) > 10000 THEN RAISE EXCEPTION 'invalid_field_values';
    END IF;
    IF v_field->>'type' = 'company_name' THEN v_stamp_name := COALESCE(v_stamp_name, v_value); END IF;
    IF v_field->>'type' = 'id_number' THEN v_stamp_id := COALESCE(v_stamp_id, v_value); END IF;
    v_values := v_values || jsonb_build_object(v_field->>'id', v_value);
  END LOOP;
  IF v_stamp THEN
    v_stamp_name := COALESCE(v_stamp_name, NULLIF(btrim(_field_values->>'__stamp_name'), ''), NULLIF(btrim(v_doc.business_stamp_name), ''));
    v_stamp_id := COALESCE(v_stamp_id, NULLIF(btrim(_field_values->>'__stamp_company_id'), ''), NULLIF(btrim(v_doc.business_stamp_company_id), ''));
    IF v_stamp_name IS NULL OR v_stamp_id IS NULL THEN RAISE EXCEPTION 'missing_stamp_details'; END IF;
    IF length(v_stamp_name) > 200 OR length(v_stamp_id) > 64 THEN RAISE EXCEPTION 'invalid_field_values'; END IF;
    v_values := v_values || jsonb_build_object('__stamp_name', v_stamp_name, '__stamp_company_id', v_stamp_id);
  END IF;

  UPDATE public.signature_recipients SET status = 'signed', signature_data = _signature_data,
    field_values = v_values, signed_at = now(), ip_address = COALESCE(_ip, ip_address)
  WHERE id = v_rec.id;
  PERFORM public.log_signature_event(v_doc.id, v_rec.id, 'signed', _ip,
    jsonb_build_object('email', v_rec.email, 'name', v_rec.name, 'field_values', v_values));
  SELECT CASE WHEN bool_and(status = 'signed') THEN 'completed' ELSE 'partially_signed' END INTO v_new_status
  FROM public.signature_recipients WHERE document_id = v_doc.id;
  UPDATE public.signature_documents SET status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE NULL END, updated_at = now()
  WHERE id = v_doc.id;
  RETURN jsonb_build_object('ok', true, 'document_id', v_doc.id, 'document_status', v_new_status, 'tenant_id', v_doc.tenant_id);
END;
$$;

-- Preserve the old API for internal callers, with the same validation and no bypass.
CREATE OR REPLACE FUNCTION public.submit_signature_by_token(_token uuid, _signature_data text, _ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.submit_signature_by_token(_token, _signature_data, _ip, '{}'::jsonb); $$;
REVOKE ALL ON FUNCTION public.submit_signature_by_token(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_signature_by_token(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_signature_by_token(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_signature_by_token(uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.decline_signature_by_token(_token uuid, _ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_doc public.signature_documents%ROWTYPE;
  v_document_id uuid;
BEGIN
  SELECT document_id INTO v_document_id FROM public.signature_recipients WHERE sign_token = _token;
  IF v_document_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  SELECT * INTO v_doc FROM public.signature_documents WHERE id = v_document_id FOR UPDATE;
  SELECT * INTO v_rec FROM public.signature_recipients WHERE sign_token = _token FOR UPDATE;
  IF v_rec.status <> 'pending' THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  IF v_doc.id IS NULL OR v_rec.tenant_id <> v_doc.tenant_id OR v_doc.is_template
    OR v_doc.status NOT IN ('pending','partially_signed') THEN RAISE EXCEPTION 'document_not_signable'; END IF;
  UPDATE public.signature_recipients SET status = 'declined', ip_address = COALESCE(_ip, ip_address) WHERE id = v_rec.id;
  UPDATE public.signature_documents SET status = 'cancelled', completed_at = NULL, updated_at = now() WHERE id = v_doc.id;
  PERFORM public.log_signature_event(v_doc.id, v_rec.id, 'declined', _ip, jsonb_build_object('email', v_rec.email, 'name', v_rec.name));
  RETURN jsonb_build_object('ok', true, 'document_id', v_doc.id, 'document_status', 'cancelled', 'tenant_id', v_doc.tenant_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.decline_signature_by_token(_token uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.decline_signature_by_token(_token, NULL::text); $$;
REVOKE ALL ON FUNCTION public.decline_signature_by_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_signature_by_token(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_signature_by_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decline_signature_by_token(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_signature_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_rec_id uuid;
  v_doc_id uuid;
  v_business_name text;
  v_company_id text;
BEGIN
  IF _token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT r.id, r.document_id INTO v_rec_id, v_doc_id
  FROM public.signature_recipients r
  WHERE r.sign_token = _token
  LIMIT 1;

  IF v_rec_id IS NOT NULL THEN
    UPDATE public.signature_recipients
    SET viewed_at = COALESCE(viewed_at, now())
    WHERE id = v_rec_id AND viewed_at IS NULL;

    IF FOUND THEN
      PERFORM public.log_signature_event(v_doc_id, v_rec_id, 'viewed', NULL, '{}'::jsonb);
    END IF;
  END IF;

  SELECT
    COALESCE(
      NULLIF(d.business_stamp_name, ''),
      NULLIF(c.name, ''),
      NULLIF(l.company_name, '')
    ),
    NULLIF(d.business_stamp_company_id, '')
  INTO v_business_name, v_company_id
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  LEFT JOIN public.clients c ON c.id = d.client_id
  LEFT JOIN public.leads l ON l.id = d.lead_id
  WHERE r.sign_token = _token
  LIMIT 1;

  SELECT jsonb_build_object(
    'id', r.id,
    'document_id', r.document_id,
    'name', r.name,
    'email', r.email,
    'status', r.status,
    'sign_order', r.sign_order,
    'sign_token', r.sign_token,
    'signature_position', r.signature_position,
    'field_values', COALESCE(r.field_values, '{}'::jsonb),
    'signed_at', r.signed_at,
    'viewed_at', r.viewed_at,
    'business_stamp', jsonb_build_object(
      'name', v_business_name,
      'company_id', v_company_id
    ),
    'signature_documents', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'file_url', d.file_url,
      'document_type', d.document_type,
      'status', d.status,
      'document_fields', COALESCE(d.document_fields, '[]'::jsonb),
      'client_id', d.client_id,
      'lead_id', d.lead_id,
      'business_stamp_name', d.business_stamp_name,
      'business_stamp_company_id', d.business_stamp_company_id
    )
  ) INTO result
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  WHERE r.sign_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_signature_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_by_token(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
