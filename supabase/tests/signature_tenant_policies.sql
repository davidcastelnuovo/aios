-- Staging only: synthetic documents, authenticated roles, and a full rollback.
BEGIN;
DO $test$
DECLARE
  actor uuid; own_tenant uuid; other_tenant uuid;
  own_doc uuid; other_doc uuid; own_recipient uuid; other_recipient uuid;
  affected integer;
BEGIN
  SELECT tu.user_id, tu.tenant_id INTO actor, own_tenant
  FROM public.tenant_users tu
  WHERE public.get_user_tenant_id(tu.user_id) = tu.tenant_id
    AND NOT public.is_super_admin(tu.user_id)
  LIMIT 1;
  SELECT id INTO other_tenant FROM public.tenants WHERE id <> own_tenant LIMIT 1;
  IF actor IS NULL OR other_tenant IS NULL THEN
    RAISE EXCEPTION 'Requires a non-admin tenant member and a second tenant';
  END IF;

  INSERT INTO public.signature_documents (tenant_id, created_by, title)
  VALUES (other_tenant, actor, 'QA ROLLBACK other tenant') RETURNING id INTO other_doc;
  INSERT INTO public.signature_recipients (tenant_id, document_id, name, email)
  VALUES (other_tenant, other_doc, 'QA', 'qa@example.invalid') RETURNING id INTO other_recipient;

  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.signature_documents (tenant_id, created_by, title)
  VALUES (own_tenant, actor, 'QA ROLLBACK own tenant') RETURNING id INTO own_doc;
  IF NOT EXISTS (SELECT 1 FROM public.signature_documents WHERE id = own_doc) THEN
    RAISE EXCEPTION 'Own document is not readable';
  END IF;
  UPDATE public.signature_documents SET title = 'QA ROLLBACK updated' WHERE id = own_doc;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own document is not editable'; END IF;
  INSERT INTO public.signature_recipients (tenant_id, document_id, name, email)
  VALUES (own_tenant, own_doc, 'QA', 'qa@example.invalid') RETURNING id INTO own_recipient;
  IF NOT EXISTS (SELECT 1 FROM public.signature_recipients WHERE id = own_recipient) THEN
    RAISE EXCEPTION 'Own recipient is not readable';
  END IF;
  UPDATE public.signature_recipients SET name = 'QA updated' WHERE id = own_recipient;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own recipient is not editable'; END IF;

  IF EXISTS (SELECT 1 FROM public.signature_documents WHERE id = other_doc)
    OR EXISTS (SELECT 1 FROM public.signature_recipients WHERE id = other_recipient) THEN
    RAISE EXCEPTION 'Another tenant is readable';
  END IF;
  UPDATE public.signature_documents SET title = 'Must be denied' WHERE id = other_doc;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another tenant document is editable'; END IF;
  UPDATE public.signature_recipients SET name = 'Must be denied' WHERE id = other_recipient;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another tenant recipient is editable'; END IF;

  BEGIN
    INSERT INTO public.signature_documents (tenant_id, created_by, title)
    VALUES (other_tenant, actor, 'Must be denied');
    RAISE EXCEPTION 'Another tenant document can be created';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.signature_recipients (tenant_id, document_id, name, email)
    VALUES (other_tenant, other_doc, 'Must be denied', 'qa@example.invalid');
    RAISE EXCEPTION 'Another tenant recipient can be created';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.signature_documents SET tenant_id = other_tenant WHERE id = own_doc;
    RAISE EXCEPTION 'Document can be moved to another tenant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.signature_recipients SET tenant_id = other_tenant WHERE id = own_recipient;
    RAISE EXCEPTION 'Recipient can be moved to another tenant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM public.signature_recipients WHERE id = other_recipient;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another tenant recipient is deletable'; END IF;
  DELETE FROM public.signature_documents WHERE id = other_doc;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another tenant document is deletable'; END IF;
  DELETE FROM public.signature_recipients WHERE id = own_recipient;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own recipient is not deletable'; END IF;
  DELETE FROM public.signature_documents WHERE id = own_doc;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own document is not deletable'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  IF EXISTS (SELECT 1 FROM public.signature_documents)
    OR EXISTS (SELECT 1 FROM public.signature_recipients) THEN
    RAISE EXCEPTION 'Anonymous access bypasses signing tokens';
  END IF;
  RESET ROLE;
END;
$test$;
SELECT 'Tenant CRUD, cross-tenant isolation, and anonymous isolation passed' AS result;
ROLLBACK;
