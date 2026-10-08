-- Fix get_signature_by_token: cannot be STABLE when it UPDATEs viewed_at / logs events.
-- Without this, /sign/:token fails and shows "קישור לא תקין".

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

REVOKE ALL ON FUNCTION public.get_signature_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_by_token(uuid) TO anon, authenticated, service_role;
