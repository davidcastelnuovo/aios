-- Production apply. Fold a second team-member card into the one the user is
-- already assigned to (profiles.campaigner_id). Identical names are not a
-- reason to merge. The extra card is the one that carries that user's email
-- and is not itself assigned to a different user.

CREATE OR REPLACE FUNCTION public.merge_assigned_campaigner_duplicate(
  p_canonical uuid,
  p_duplicate uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kept public.campaigners%ROWTYPE;
  dup public.campaigners%ROWTYPE;
  dup_email text;
  dup_phone text;
  dup_role text[];
  dup_notes text;
  dup_active boolean;
BEGIN
  IF p_canonical IS NULL OR p_duplicate IS NULL OR p_canonical = p_duplicate THEN
    RETURN NULL;
  END IF;

  SELECT * INTO kept FROM public.campaigners WHERE id = p_canonical;
  SELECT * INTO dup FROM public.campaigners WHERE id = p_duplicate;
  IF kept.id IS NULL OR dup.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF kept.tenant_id IS DISTINCT FROM dup.tenant_id THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE campaigner_id = p_canonical
      AND NULLIF(lower(btrim(email)), '') IS NOT NULL
      AND lower(btrim(email)) = NULLIF(lower(btrim(dup.email)), '')
  ) THEN
    RETURN NULL;
  END IF;

  IF (
    SELECT count(DISTINCT campaigner_id)
    FROM public.profiles
    WHERE campaigner_id IS NOT NULL
      AND NULLIF(lower(btrim(email)), '') = NULLIF(lower(btrim(dup.email)), '')
  ) > 1 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE campaigner_id = p_duplicate
  ) THEN
    RETURN NULL;
  END IF;

  dup_email := NULLIF(btrim(dup.email), '');
  dup_phone := NULLIF(btrim(dup.phone), '');
  dup_role := dup.role;
  dup_notes := dup.notes;
  dup_active := dup.active;

  UPDATE public.campaigners
  SET
    email = COALESCE(NULLIF(btrim(email), ''), dup_email),
    phone = COALESCE(NULLIF(btrim(phone), ''), dup_phone),
    role = CASE
      WHEN role IS NULL OR coalesce(cardinality(role), 0) = 0 THEN dup_role
      ELSE role
    END,
    notes = COALESCE(notes, dup_notes),
    active = active OR dup_active,
    updated_at = now()
  WHERE id = p_canonical;

  INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
  SELECT p_canonical, agency_id
  FROM public.campaigner_agencies
  WHERE campaigner_id = p_duplicate
  ON CONFLICT (campaigner_id, agency_id) DO NOTHING;

  UPDATE public.tasks
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  DELETE FROM public.task_collaborators AS extra
  USING public.task_collaborators AS kept_row
  WHERE extra.campaigner_id = p_duplicate
    AND kept_row.campaigner_id = p_canonical
    AND kept_row.task_id = extra.task_id;

  UPDATE public.task_collaborators
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.client_team AS extra
  SET campaigner_id = p_canonical
  WHERE extra.campaigner_id = p_duplicate
    AND NOT EXISTS (
      SELECT 1
      FROM public.client_team AS kept_row
      WHERE kept_row.client_id = extra.client_id
        AND kept_row.campaigner_id = p_canonical
        AND kept_row.start_date IS NOT DISTINCT FROM extra.start_date
    );

  DELETE FROM public.client_team WHERE campaigner_id = p_duplicate;

  UPDATE public.client_onboarding
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.time_entries
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.suppliers
  SET related_campaigner_id = p_canonical
  WHERE related_campaigner_id = p_duplicate;

  UPDATE public.profiles
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

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
      FROM unnest(array_replace(recording.campaigner_ids, p_duplicate, p_canonical)) AS item
    )
    WHERE recording.campaigner_ids @> ARRAY[p_duplicate]::uuid[];
  END IF;

  DELETE FROM public.campaigners WHERE id = p_duplicate;
  RETURN p_canonical;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_assigned_campaigner_duplicate(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_assigned_campaigner_duplicate(uuid, uuid) TO service_role;

-- Stop the previous helper from merging on a shared name or a shared email alone.
CREATE OR REPLACE FUNCTION public.merge_duplicate_campaigner_pair(p_left uuid, p_right uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_campaigner_pair(uuid, uuid) FROM PUBLIC;

DO $$
DECLARE
  pair record;
  merged uuid;
BEGIN
  FOR pair IN
    SELECT DISTINCT assigned.id AS canonical_id, extra.id AS duplicate_id
    FROM public.profiles AS profile
    JOIN public.campaigners AS assigned
      ON assigned.id = profile.campaigner_id
    JOIN public.campaigners AS extra
      ON extra.tenant_id = assigned.tenant_id
     AND extra.id <> assigned.id
     AND NULLIF(lower(btrim(extra.email)), '') IS NOT NULL
     AND lower(btrim(extra.email)) = lower(btrim(profile.email))
    WHERE profile.campaigner_id IS NOT NULL
      AND NULLIF(btrim(profile.email), '') IS NOT NULL
  LOOP
    merged := public.merge_assigned_campaigner_duplicate(pair.canonical_id, pair.duplicate_id);
    IF merged IS NOT NULL THEN
      RAISE NOTICE 'merged extra campaigner % into assigned %', pair.duplicate_id, merged;
    END IF;
  END LOOP;
END $$;
