-- Staging gap fix: phase1 function/migrations landed without base columns/table.
-- Idempotent — safe on environments that already ran 20260907130000.

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

DROP POLICY IF EXISTS "Users can view signature events in their tenant" ON public.signature_events;
CREATE POLICY "Users can view signature events in their tenant"
  ON public.signature_events FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

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

-- Keep get_signature_by_token VOLATILE + field-aware (matches 20260907180000).
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
