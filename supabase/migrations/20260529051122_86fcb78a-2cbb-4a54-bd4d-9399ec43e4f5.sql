
-- ============================================================
-- SECURITY HARDENING MIGRATION (Phase 1)
-- ============================================================

-- 1) deleted_facebook_leads: lock to service_role
DROP POLICY IF EXISTS "Service role full access" ON public.deleted_facebook_leads;
CREATE POLICY "Service role full access"
  ON public.deleted_facebook_leads
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Users can view deleted facebook leads in their tenant"
  ON public.deleted_facebook_leads
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 2) invitation_tokens UPDATE: restrict to service_role
DROP POLICY IF EXISTS "Service role can update invitation tokens" ON public.invitation_tokens;
CREATE POLICY "Service role can update invitation tokens"
  ON public.invitation_tokens
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- 3) automation_logs INSERT: restrict to service_role
DROP POLICY IF EXISTS "System can insert automation logs" ON public.automation_logs;
CREATE POLICY "Service role can insert automation logs"
  ON public.automation_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 4) ahrefs_reports: drop public webhook insert
DROP POLICY IF EXISTS "Allow webhook inserts" ON public.ahrefs_reports;

-- 5) global_settings: restrict SELECT to super_admin
DROP POLICY IF EXISTS "Authenticated users can view global_settings" ON public.global_settings;
CREATE POLICY "Super admins can view global_settings"
  ON public.global_settings
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

-- 6) signature_documents: drop anon SELECT (replaced by RPC)
DROP POLICY IF EXISTS "Anyone can view document for signing" ON public.signature_documents;

-- 7) signature_recipients: drop anon SELECT + UPDATE
DROP POLICY IF EXISTS "Anyone can view recipient by sign token" ON public.signature_recipients;
DROP POLICY IF EXISTS "Anyone can update recipient signature by token" ON public.signature_recipients;

-- 8) site_* tables: restrict INSERT/UPDATE to service_role
DROP POLICY IF EXISTS "Service role can insert events" ON public.site_events;
CREATE POLICY "Service role can insert events" ON public.site_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert pageviews" ON public.site_pageviews;
CREATE POLICY "Service role can insert pageviews" ON public.site_pageviews
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can update pageviews" ON public.site_pageviews;
CREATE POLICY "Service role can update pageviews" ON public.site_pageviews
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert sessions" ON public.site_sessions;
CREATE POLICY "Service role can insert sessions" ON public.site_sessions
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can update sessions" ON public.site_sessions;
CREATE POLICY "Service role can update sessions" ON public.site_sessions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert visitors" ON public.site_visitors;
CREATE POLICY "Service role can insert visitors" ON public.site_visitors
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can update visitors" ON public.site_visitors;
CREATE POLICY "Service role can update visitors" ON public.site_visitors
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- 9) team_channel_invites: drop both anon-readable policies
DROP POLICY IF EXISTS "Anyone can read active invites by token" ON public.team_channel_invites;
DROP POLICY IF EXISTS "Anyone can view active invites by token" ON public.team_channel_invites;

-- ============================================================
-- SECURITY DEFINER RPCs for anonymous flows
-- ============================================================

-- Signature: fetch recipient + document by token
CREATE OR REPLACE FUNCTION public.get_signature_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL THEN
    RETURN NULL;
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
$$;
REVOKE ALL ON FUNCTION public.get_signature_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_by_token(uuid) TO anon, authenticated, service_role;

-- Signature: submit signature by token
CREATE OR REPLACE FUNCTION public.submit_signature_by_token(
  _token uuid,
  _signature_data text,
  _ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      ip_address = COALESCE(_ip, 'client-side')
  WHERE sign_token = _token AND status = 'pending'
  RETURNING * INTO v_rec;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'not_found_or_already_signed';
  END IF;

  SELECT count(*) INTO v_unsigned
  FROM public.signature_recipients
  WHERE document_id = v_rec.document_id AND status = 'pending';

  v_new_status := CASE WHEN v_unsigned = 0 THEN 'completed' ELSE 'partially_signed' END;

  UPDATE public.signature_documents
  SET status = v_new_status,
      completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = v_rec.document_id;

  RETURN jsonb_build_object('ok', true, 'document_status', v_new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_signature_by_token(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_signature_by_token(uuid, text, text) TO anon, authenticated, service_role;

-- Signature: decline by token
CREATE OR REPLACE FUNCTION public.decline_signature_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _token IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  UPDATE public.signature_recipients
  SET status = 'declined'
  WHERE sign_token = _token AND status = 'pending'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.decline_signature_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_signature_by_token(uuid) TO anon, authenticated, service_role;

-- Team chat invite: fetch invite by token (replaces anon SELECT)
CREATE OR REPLACE FUNCTION public.get_channel_invite_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', i.id,
    'channel_id', i.channel_id,
    'token', i.token,
    'is_active', i.is_active,
    'tenant_id', i.tenant_id,
    'team_channels', jsonb_build_object(
      'name', c.name,
      'color', c.color
    )
  ) INTO result
  FROM public.team_channel_invites i
  LEFT JOIN public.team_channels c ON c.id = i.channel_id
  WHERE i.token = _token AND i.is_active = true
  LIMIT 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_channel_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_invite_by_token(text) TO anon, authenticated, service_role;
