-- Business stamp under client signature: name + ח.פ / ע.מ from linked entity / document.

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS business_stamp_name text,
  ADD COLUMN IF NOT EXISTS business_stamp_company_id text;

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
      NULLIF(l.company_name, ''),
      NULLIF(l.contact_name, ''),
      NULLIF(r.name, '')
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
