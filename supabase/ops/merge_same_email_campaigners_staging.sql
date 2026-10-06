-- Same person, two team-member cards: identical email, different display names
-- (for example אוהד and אוהד טל). The earlier name-only merge skipped these
-- because the names were not equal and neither card had a login link.
-- Keep the row with more client assignments, otherwise the older row, and
-- keep the longer name when it extends the shorter one.

CREATE OR REPLACE FUNCTION public.merge_duplicate_campaigner_pair(p_left uuid, p_right uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  left_row public.campaigners%ROWTYPE;
  right_row public.campaigners%ROWTYPE;
  canonical uuid;
  duplicate uuid;
  left_team integer;
  right_team integer;
  left_name text;
  right_name text;
  left_email text;
  right_email text;
  same_email boolean;
  same_name boolean;
BEGIN
  SELECT * INTO left_row FROM public.campaigners WHERE id = p_left;
  SELECT * INTO right_row FROM public.campaigners WHERE id = p_right;
  IF left_row.id IS NULL OR right_row.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF left_row.tenant_id IS DISTINCT FROM right_row.tenant_id THEN
    RETURN NULL;
  END IF;

  left_name := lower(regexp_replace(btrim(coalesce(left_row.full_name, '')), '\s+', ' ', 'g'));
  right_name := lower(regexp_replace(btrim(coalesce(right_row.full_name, '')), '\s+', ' ', 'g'));
  left_email := NULLIF(lower(btrim(coalesce(left_row.email, ''))), '');
  right_email := NULLIF(lower(btrim(coalesce(right_row.email, ''))), '');
  same_email := left_email IS NOT NULL AND left_email = right_email;
  same_name := left_name <> '' AND left_name = right_name
    AND left_name NOT IN ('קמפיינר', 'איש מכירות', 'איש צוות');

  IF NOT same_name AND NOT same_email THEN
    RETURN NULL;
  END IF;
  IF same_name AND NOT same_email AND left_email IS NOT NULL AND right_email IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF (
    SELECT count(DISTINCT id)
    FROM public.profiles
    WHERE campaigner_id IN (left_row.id, right_row.id)
  ) > 1
  AND EXISTS (SELECT 1 FROM public.profiles WHERE campaigner_id = left_row.id)
  AND EXISTS (SELECT 1 FROM public.profiles WHERE campaigner_id = right_row.id) THEN
    RETURN NULL;
  END IF;

  IF NOT same_email AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE campaigner_id IN (left_row.id, right_row.id)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO left_team FROM public.client_team WHERE campaigner_id = left_row.id;
  SELECT count(*) INTO right_team FROM public.client_team WHERE campaigner_id = right_row.id;

  IF left_team > right_team OR (left_team = right_team AND left_row.created_at <= right_row.created_at) THEN
    canonical := left_row.id;
    duplicate := right_row.id;
  ELSE
    canonical := right_row.id;
    duplicate := left_row.id;
  END IF;

  UPDATE public.campaigners AS kept
  SET
    full_name = CASE
      WHEN length(regexp_replace(btrim(dup.full_name), '\s+', ' ', 'g'))
           > length(regexp_replace(btrim(kept.full_name), '\s+', ' ', 'g'))
       AND lower(regexp_replace(btrim(dup.full_name), '\s+', ' ', 'g'))
           LIKE lower(regexp_replace(btrim(kept.full_name), '\s+', ' ', 'g')) || '%'
      THEN regexp_replace(btrim(dup.full_name), '\s+', ' ', 'g')
      ELSE kept.full_name
    END,
    email = COALESCE(NULLIF(btrim(kept.email), ''), NULLIF(btrim(dup.email), '')),
    phone = COALESCE(NULLIF(btrim(kept.phone), ''), NULLIF(btrim(dup.phone), '')),
    role = CASE
      WHEN kept.role IS NULL OR cardinality(kept.role) = 0 THEN dup.role
      ELSE kept.role
    END,
    notes = COALESCE(kept.notes, dup.notes),
    active = kept.active OR dup.active,
    updated_at = now()
  FROM public.campaigners AS dup
  WHERE kept.id = canonical
    AND dup.id = duplicate;

  INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
  SELECT canonical, agency_id
  FROM public.campaigner_agencies
  WHERE campaigner_id = duplicate
  ON CONFLICT (campaigner_id, agency_id) DO NOTHING;

  UPDATE public.tasks
  SET campaigner_id = canonical
  WHERE campaigner_id = duplicate;

  DELETE FROM public.task_collaborators AS extra
  USING public.task_collaborators AS kept
  WHERE extra.campaigner_id = duplicate
    AND kept.campaigner_id = canonical
    AND kept.task_id = extra.task_id;

  UPDATE public.task_collaborators
  SET campaigner_id = canonical
  WHERE campaigner_id = duplicate;

  UPDATE public.client_team AS extra
  SET campaigner_id = canonical
  WHERE extra.campaigner_id = duplicate
    AND NOT EXISTS (
      SELECT 1
      FROM public.client_team AS kept
      WHERE kept.client_id = extra.client_id
        AND kept.campaigner_id = canonical
        AND kept.start_date IS NOT DISTINCT FROM extra.start_date
    );

  DELETE FROM public.client_team WHERE campaigner_id = duplicate;

  UPDATE public.client_onboarding
  SET campaigner_id = canonical
  WHERE campaigner_id = duplicate;

  UPDATE public.time_entries
  SET campaigner_id = canonical
  WHERE campaigner_id = duplicate;

  UPDATE public.suppliers
  SET related_campaigner_id = canonical
  WHERE related_campaigner_id = duplicate;

  UPDATE public.profiles
  SET campaigner_id = canonical
  WHERE campaigner_id = duplicate;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'zoom_recordings'
      AND column_name = 'campaigner_ids'
  ) THEN
    UPDATE public.zoom_recordings AS recording
    SET campaigner_ids = (
      SELECT COALESCE(array_agg(DISTINCT item), ARRAY[]::uuid[])
      FROM unnest(array_replace(recording.campaigner_ids, duplicate, canonical)) AS item
    )
    WHERE recording.campaigner_ids @> ARRAY[duplicate]::uuid[];
  END IF;

  DELETE FROM public.campaigners WHERE id = duplicate;
  RETURN canonical;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_campaigner_pair(uuid, uuid) FROM PUBLIC;

DO $$
DECLARE
  pair record;
  merged uuid;
BEGIN
  FOR pair IN
    SELECT a.id AS left_id, b.id AS right_id
    FROM public.campaigners a
    JOIN public.campaigners b
      ON a.tenant_id = b.tenant_id
     AND a.id < b.id
     AND NULLIF(lower(btrim(coalesce(a.email, ''))), '') IS NOT NULL
     AND lower(btrim(a.email)) = lower(btrim(b.email))
  LOOP
    merged := public.merge_duplicate_campaigner_pair(pair.left_id, pair.right_id);
    IF merged IS NOT NULL THEN
      RAISE NOTICE 'merged same-email campaigner into %', merged;
    END IF;
  END LOOP;
END $$;
