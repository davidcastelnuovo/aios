-- Recover Eyal Horn (Promo) lead_updates from data that DID reach the database
-- (call_logs.notes, task notes). CRM textarea updates blocked by RLS were never
-- stored and cannot be reconstructed from Postgres alone.
--
-- Eyal: profile a58f0410-64b9-4b35-a503-0df471fc068a
-- Promo tenant: 571dbdde-62b9-4c14-b536-30ae7a4fef81

DO $$
DECLARE
  v_user_id uuid := 'a58f0410-64b9-4b35-a503-0df471fc068a';
  v_tenant_id uuid := '571dbdde-62b9-4c14-b536-30ae7a4fef81';
  n_calls integer := 0;
  n_tasks integer := 0;
  n_existing integer := 0;
BEGIN
  SELECT count(*)::integer
  INTO n_existing
  FROM public.lead_updates
  WHERE user_id = v_user_id;

  WITH ins AS (
    INSERT INTO public.lead_updates (lead_id, user_id, content, created_at)
    SELECT
      cl.lead_id,
      cl.caller_user_id,
      trim(cl.notes),
      cl.created_at
    FROM public.call_logs cl
    WHERE cl.tenant_id = v_tenant_id
      AND cl.caller_user_id = v_user_id
      AND cl.lead_id IS NOT NULL
      AND trim(coalesce(cl.notes, '')) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.lead_updates lu
        WHERE lu.lead_id = cl.lead_id
          AND lu.user_id = cl.caller_user_id
          AND lu.content = trim(cl.notes)
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO n_calls FROM ins;

  WITH ins AS (
    INSERT INTO public.lead_updates (lead_id, user_id, content, created_at)
    SELECT
      t.lead_id,
      t.created_by,
      trim(
        CASE
          WHEN trim(coalesce(t.notes, '')) <> '' THEN t.notes
          ELSE '[משימה] ' || t.title
        END
      ),
      t.created_at
    FROM public.tasks t
    WHERE t.tenant_id = v_tenant_id
      AND t.created_by = v_user_id
      AND t.lead_id IS NOT NULL
      AND (
        trim(coalesce(t.notes, '')) <> ''
        OR trim(coalesce(t.title, '')) <> ''
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.lead_updates lu
        WHERE lu.lead_id = t.lead_id
          AND lu.user_id = t.created_by
          AND lu.content = trim(
            CASE
              WHEN trim(coalesce(t.notes, '')) <> '' THEN t.notes
              ELSE '[משימה] ' || t.title
            END
          )
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO n_tasks FROM ins;

  RAISE NOTICE
    'recover_promo_eyal_lead_updates: existing_by_eyal=%, inserted_from_call_logs=%, inserted_from_tasks=%',
    n_existing,
    n_calls,
    n_tasks;
END $$;
