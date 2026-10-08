-- Soft-archive for CRM leads. Pipeline "delete" archives the row; permanent
-- delete is only allowed on already-archived leads (stricter).
-- Also match phone search on last-9 digits so 050… finds 972… numbers.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS first_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_source public.lead_source;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_archived
  ON public.leads (tenant_id, archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.leads.archived_at IS 'When set, the lead is hidden from the pipeline and lives in the archive';
COMMENT ON COLUMN public.leads.archived_by IS 'User who archived the lead';
COMMENT ON COLUMN public.leads.first_created_at IS 'Original created_at; kept when a repeat inbound bumps created_at to the top of the list';
COMMENT ON COLUMN public.leads.first_source IS 'Original arrival source; kept when a later inbound arrives from a different channel';

UPDATE public.leads
SET first_created_at = created_at
WHERE first_created_at IS NULL;

UPDATE public.leads
SET first_source = source
WHERE first_source IS NULL;

CREATE OR REPLACE FUNCTION public.leads_set_first_origin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_created_at IS NULL THEN
    NEW.first_created_at := COALESCE(NEW.created_at, now());
  END IF;
  IF NEW.first_source IS NULL THEN
    NEW.first_source := NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_first_origin ON public.leads;
CREATE TRIGGER leads_set_first_origin
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_set_first_origin();

CREATE OR REPLACE FUNCTION public.can_manage_lead_archive(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = _tenant_id
          AND ur.role = 'owner'::app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
          AND tu.tenant_id = _tenant_id
          AND lower(tu.role) IN ('owner', 'admin')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.archive_leads(p_lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.leads
  SET archived_at = now(),
      archived_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים להעביר לידים לארכיון';
  END IF;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_archived_leads(p_lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.leads
  SET archived_at = NULL,
      archived_by = NULL,
      updated_at = now()
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NOT NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים לשחזר לידים מהארכיון';
  END IF;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_leads(p_lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.leads
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NOT NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים למחוק לידים לצמיתות';
  END IF;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_lead_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_leads(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_leads(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_leads(uuid[]) TO authenticated;

DROP POLICY IF EXISTS "Owners can delete leads in their tenants" ON public.leads;
DROP POLICY IF EXISTS "Owners can delete archived leads in their tenants" ON public.leads;

CREATE POLICY "Owners can delete archived leads in their tenants"
ON public.leads
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  archived_at IS NOT NULL
  AND public.can_manage_lead_archive(leads.tenant_id)
);

CREATE OR REPLACE FUNCTION public.get_leads_by_stages(
  p_tenant_id uuid,
  p_agency_ids uuid[] DEFAULT NULL::uuid[],
  p_stages text[] DEFAULT NULL::text[],
  p_limit_per_stage integer DEFAULT 50,
  p_search_query text DEFAULT NULL::text,
  p_from_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_sales_person_ids uuid[] DEFAULT NULL::uuid[],
  p_response_statuses text[] DEFAULT NULL::text[],
  p_follow_up_today boolean DEFAULT false,
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tag_ids uuid[] DEFAULT NULL::uuid[],
  p_offset_per_stage integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB := '{}'::JSONB;
  stage_record RECORD;
  stage_leads JSONB;
  stage_count BIGINT;
  search_pattern TEXT;
  phone_digits TEXT;
  effective_start_date timestamp with time zone;
  effective_end_date timestamp with time zone;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    search_pattern := '%' || lower(p_search_query) || '%';
    IF length(regexp_replace(p_search_query, '\D', '', 'g')) >= 8 THEN
      phone_digits := right(regexp_replace(p_search_query, '\D', '', 'g'), 9);
    END IF;
  END IF;

  effective_start_date := COALESCE(p_start_date, p_from_date);
  effective_end_date := COALESCE(p_end_date, p_to_date);

  FOR stage_record IN
    SELECT id, stage_key, label, color, sort_order
    FROM lead_pipeline_stages
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY sort_order ASC
  LOOP
    IF p_stages IS NULL OR stage_record.stage_key = ANY(p_stages) THEN

      SELECT COUNT(*)
      INTO stage_count
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.archived_at IS NULL
        AND l.status = stage_record.stage_key
        AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (
          p_sales_person_ids IS NULL
          OR EXISTS (
            SELECT 1
            FROM lead_sales_people lsp
            WHERE lsp.lead_id = l.id
              AND lsp.tenant_id = l.tenant_id
              AND lsp.sales_person_id = ANY(p_sales_person_ids)
          )
        )
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
        AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
        AND (NOT p_follow_up_today OR l.follow_up_date <= CURRENT_DATE)
        AND (search_pattern IS NULL OR (
          lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.email, '')) LIKE search_pattern OR
          COALESCE(l.phone, '') LIKE search_pattern OR
          lower(COALESCE(l.campaign_name, '')) LIKE search_pattern OR
          (
            phone_digits IS NOT NULL
            AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE '%' || phone_digits || '%'
          )
        ))
        AND (p_tag_ids IS NULL OR EXISTS (
          SELECT 1
          FROM chat_contact_tags cct
          WHERE cct.lead_id = l.id
            AND cct.tag_id = ANY(p_tag_ids)
        ));

      SELECT COALESCE(jsonb_agg(lead_data ORDER BY
        CASE WHEN p_follow_up_today THEN (lead_data->>'follow_up_date') END ASC NULLS LAST,
        (lead_data->>'created_at') DESC
      ), '[]'::JSONB)
      INTO stage_leads
      FROM (
        SELECT jsonb_build_object(
          'id', l.id,
          'contact_name', l.contact_name,
          'company_name', l.company_name,
          'email', l.email,
          'phone', l.phone,
          'source', l.source,
          'first_source', l.first_source,
          'campaign_name', l.campaign_name,
          'status', l.status,
          'response_status', l.response_status,
          'notes', l.notes,
          'agency_id', l.agency_id,
          'sales_person_id', l.sales_person_id,
          'created_at', l.created_at,
          'first_created_at', l.first_created_at,
          'updated_at', l.updated_at,
          'follow_up_date', l.follow_up_date,
          'estimated_deal_value', l.estimated_deal_value,
          'won_date', l.won_date,
          'folder_link', l.folder_link,
          'industry', l.industry,
          'tenant_id', l.tenant_id,
          'manychat_subscriber_id', l.manychat_subscriber_id,
          'active_chat_provider', l.active_chat_provider,
          'whatsapp_avatar_url', l.whatsapp_avatar_url,
          'leadgen_id', NULL,
          'lead_sales_people', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('sales_person_id', lsp.sales_person_id))
             FROM lead_sales_people lsp
             WHERE lsp.lead_id = l.id AND lsp.tenant_id = l.tenant_id),
            '[]'::jsonb
          )
        ) as lead_data
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.archived_at IS NULL
          AND l.status = stage_record.stage_key
          AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
          AND (
            p_sales_person_ids IS NULL
            OR EXISTS (
              SELECT 1
              FROM lead_sales_people lsp
              WHERE lsp.lead_id = l.id
                AND lsp.tenant_id = l.tenant_id
                AND lsp.sales_person_id = ANY(p_sales_person_ids)
            )
          )
          AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
          AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
          AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
          AND (NOT p_follow_up_today OR l.follow_up_date <= CURRENT_DATE)
          AND (search_pattern IS NULL OR (
            lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.email, '')) LIKE search_pattern OR
            COALESCE(l.phone, '') LIKE search_pattern OR
            lower(COALESCE(l.campaign_name, '')) LIKE search_pattern OR
            (
              phone_digits IS NOT NULL
              AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE '%' || phone_digits || '%'
            )
          ))
          AND (p_tag_ids IS NULL OR EXISTS (
            SELECT 1
            FROM chat_contact_tags cct
            WHERE cct.lead_id = l.id
              AND cct.tag_id = ANY(p_tag_ids)
          ))
        ORDER BY
          CASE WHEN p_follow_up_today THEN l.follow_up_date END ASC NULLS LAST,
          l.created_at DESC
        LIMIT p_limit_per_stage
        OFFSET p_offset_per_stage
      ) sub;

      result := result || jsonb_build_object(
        stage_record.stage_key,
        jsonb_build_object(
          'id', stage_record.id,
          'label', stage_record.label,
          'color', stage_record.color,
          'sort_order', stage_record.sort_order,
          'leads', stage_leads,
          'total_count', stage_count
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_leads_by_tags(
  p_tenant_id uuid,
  p_tag_ids uuid[],
  p_agency_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF leads
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT l.*
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND l.archived_at IS NULL
    AND (
      l.tenant_id = p_tenant_id
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    )
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.count_leads_by_tags(
  p_tenant_id uuid,
  p_tag_ids uuid[],
  p_agency_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT l.id)::INTEGER
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND l.archived_at IS NULL
    AND (
      l.tenant_id = p_tenant_id
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    );
$$;
