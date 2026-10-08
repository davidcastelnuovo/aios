-- Phase 1: signature audit trail, signed PDF path, event logging

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS signed_file_url text;

ALTER TABLE public.signature_recipients
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.signature_recipients(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_type text NOT NULL CHECK (event_type IN ('sent', 'viewed', 'signed', 'declined', 'pdf_generated')),
  ip_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_events_document_id ON public.signature_events(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_created_at ON public.signature_events(created_at DESC);

ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signature events in their tenant"
  ON public.signature_events FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Internal logging helper (service role / SECURITY DEFINER only)
CREATE OR REPLACE FUNCTION public.log_signature_event(
  _document_id uuid,
  _recipient_id uuid,
  _event_type text,
  _ip text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.signature_documents
  WHERE id = _document_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.signature_events (document_id, recipient_id, tenant_id, event_type, ip_address, metadata)
  VALUES (_document_id, _recipient_id, v_tenant_id, _event_type, _ip, COALESCE(_metadata, '{}'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.log_signature_event(uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_signature_event(uuid, uuid, text, text, jsonb) TO service_role;

-- Log first view when recipient opens signing page
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
    'signed_at', r.signed_at,
    'viewed_at', r.viewed_at,
    'signature_documents', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'file_url', d.file_url,
      'document_type', d.document_type,
      'status', d.status
    )
  ) INTO result
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  WHERE r.sign_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;

-- Submit with audit + real IP
CREATE OR REPLACE FUNCTION public.submit_signature_by_token(
  _token uuid,
  _signature_data text,
  _ip text DEFAULT NULL
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
    jsonb_build_object('email', v_rec.email, 'name', v_rec.name)
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

CREATE OR REPLACE FUNCTION public.decline_signature_by_token(_token uuid, _ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
BEGIN
  IF _token IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  UPDATE public.signature_recipients
  SET status = 'declined'
  WHERE sign_token = _token AND status = 'pending'
  RETURNING * INTO v_rec;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'not_found_or_already_processed';
  END IF;

  PERFORM public.log_signature_event(
    v_rec.document_id,
    v_rec.id,
    'declined',
    _ip,
    jsonb_build_object('email', v_rec.email, 'name', v_rec.name)
  );

  RETURN jsonb_build_object('ok', true, 'document_id', v_rec.document_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.decline_signature_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_signature_by_token(uuid, text) TO anon, authenticated, service_role;
