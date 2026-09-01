-- Scoped prod fix: נופר זומר — start_date only (work_start_date does not exist on clients).
-- tenant_id=2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019
-- client_id=6db997aa-6dac-450d-b091-613628b4d749

DO $$
DECLARE
  v_tenant uuid := '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';
  v_client uuid := '6db997aa-6dac-450d-b091-613628b4d749';
  v_before jsonb;
  v_after jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', name,
    'start_date', start_date,
    'end_date', end_date,
    'services', services,
    'is_seo_client', is_seo_client
  )
  INTO v_before
  FROM public.clients
  WHERE id = v_client AND tenant_id = v_tenant;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Client not found for tenant % / client %', v_tenant, v_client;
  END IF;

  UPDATE public.clients
  SET start_date = DATE '2026-07-21',
      updated_at = now()
  WHERE id = v_client
    AND tenant_id = v_tenant;

  SELECT jsonb_build_object(
    'name', name,
    'start_date', start_date,
    'end_date', end_date,
    'services', services,
    'is_seo_client', is_seo_client
  )
  INTO v_after
  FROM public.clients
  WHERE id = v_client AND tenant_id = v_tenant;

  INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
  VALUES (
    v_tenant,
    'cursor',
    'update_client_start_date',
    v_client::text,
    jsonb_build_object(
      'client_name', v_after->>'name',
      'before', v_before,
      'after', v_after,
      'work_start_date', 'field_not_in_schema_skipped',
      'requested_work_start_date', '2026-08-03'
    )
  );
END $$;

SELECT public.claude_notify_david(
  'Cursor: עודכן start_date לנופר זומר → 2026-07-21. work_start_date לא קיים בסכמה — לא עודכן.',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
