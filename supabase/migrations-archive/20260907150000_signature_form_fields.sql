-- Form fields on documents + filled values on recipients

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS document_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.signature_recipients
  ADD COLUMN IF NOT EXISTS field_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Include document_fields in signing token payload
CREATE OR REPLACE FUNCTION public.get_signature_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_rec_id uuid;
  v_doc_id uuid;
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
    'signature_documents', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'file_url', d.file_url,
      'document_type', d.document_type,
      'status', d.status,
      'document_fields', COALESCE(d.document_fields, '[]'::jsonb)
    )
  ) INTO result
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  WHERE r.sign_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_signature_by_token(
  _token uuid,
  _signature_data text,
  _ip text DEFAULT NULL,
  _field_values jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_unsigned int;
  v_new_status text;
BEGIN
  IF _token IS NULL OR _signature_data IS NULL OR length(_signature_data) > 5000000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  UPDATE public.signature_recipients
  SET status = 'signed',
      signature_data = _signature_data,
      field_values = COALESCE(_field_values, '{}'::jsonb),
      signed_at = now(),
      ip_address = COALESCE(_ip, ip_address)
  WHERE sign_token = _token AND status = 'pending'
  RETURNING * INTO v_rec;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'not_found_or_already_signed';
  END IF;

  PERFORM public.log_signature_event(
    v_rec.document_id,
    v_rec.id,
    'signed',
    _ip,
    jsonb_build_object('email', v_rec.email, 'name', v_rec.name, 'field_values', COALESCE(_field_values, '{}'::jsonb))
  );

  SELECT count(*) INTO v_unsigned
  FROM public.signature_recipients
  WHERE document_id = v_rec.document_id AND status = 'pending';

  v_new_status := CASE WHEN v_unsigned = 0 THEN 'completed' ELSE 'partially_signed' END;

  UPDATE public.signature_documents
  SET status = v_new_status,
      completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = v_rec.document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', v_rec.document_id,
    'document_status', v_new_status,
    'tenant_id', v_rec.tenant_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_signature_by_token(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_signature_by_token(uuid, text, text, jsonb) TO anon, authenticated, service_role;
