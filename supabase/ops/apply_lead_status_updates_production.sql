-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source: supabase/migrations/20261006193000_lead_status_and_updates_visible.sql

-- Status changes and lead updates must stick on the lead card for every
-- tenant member who can work the lead.
--
-- Salespeople could update a lead in their tenant, but SELECT required a
-- lead_sales_people row. New leads only set leads.sales_person_id, so the
-- card's read-back after save came back empty and the screen dropped the
-- status. lead_updates stayed on the old agency check, so a lead stamped
-- with the tenant's own home agency rejected the note.
--
-- Keep the assignment link in sync, let the assignee read the lead back,
-- and let any member of the lead's tenant write and see updates.

CREATE OR REPLACE FUNCTION public.leads_sync_sales_person_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sales_person_id IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.lead_sales_people (lead_id, sales_person_id, tenant_id)
    VALUES (NEW.id, NEW.sales_person_id, NEW.tenant_id)
    ON CONFLICT (lead_id, sales_person_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_sales_person_link ON public.leads;
CREATE TRIGGER leads_sync_sales_person_link
AFTER INSERT OR UPDATE OF sales_person_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_sync_sales_person_link();

INSERT INTO public.lead_sales_people (lead_id, sales_person_id, tenant_id)
SELECT id, sales_person_id, tenant_id
FROM public.leads
WHERE sales_person_id IS NOT NULL
  AND tenant_id IS NOT NULL
ON CONFLICT (lead_id, sales_person_id) DO NOTHING;

DROP POLICY IF EXISTS "Sales people view assigned leads" ON public.leads;
CREATE POLICY "Sales people view assigned leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sales_person'::app_role)
  AND (
    (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (
        sales_person_id = get_user_sales_person_id(auth.uid())
        OR EXISTS (
          SELECT 1
          FROM lead_sales_people lsp
          WHERE lsp.lead_id = leads.id
            AND lsp.tenant_id = leads.tenant_id
            AND lsp.sales_person_id = get_user_sales_person_id(auth.uid())
        )
      )
    )
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);

DROP POLICY IF EXISTS "Users can update leads in their tenants" ON public.leads;
CREATE POLICY "Users can update leads in their tenants"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'campaigner'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'campaigner'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
    )
  )
);

CREATE OR REPLACE FUNCTION public.user_can_annotate_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'owner')
        OR public.user_is_tenant_member(l.tenant_id)
        OR l.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
        OR l.agency_id = ANY (public.get_user_sales_person_agency_ids(auth.uid()))
        OR public.user_has_cross_tenant_agency_access(auth.uid(), l.agency_id)
        OR l.sales_person_id = public.get_user_sales_person_id(auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.lead_sales_people lsp
          WHERE lsp.lead_id = l.id
            AND lsp.sales_person_id = public.get_user_sales_person_id(auth.uid())
        )
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_annotate_lead(uuid) IS
  'Whether the current user may view and create lead_updates for this lead';

DROP POLICY IF EXISTS "Users can create lead updates" ON public.lead_updates;
CREATE POLICY "Users can create lead updates"
ON public.lead_updates
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND public.user_can_annotate_lead(lead_id)
);

DROP POLICY IF EXISTS "Users can view lead updates" ON public.lead_updates;
CREATE POLICY "Users can view lead updates"
ON public.lead_updates
FOR SELECT
TO public
USING (public.user_can_annotate_lead(lead_id));

GRANT EXECUTE ON FUNCTION public.user_can_annotate_lead(uuid) TO authenticated, service_role;

-- Board queries must keep an assigned lead visible when its agency is outside
-- the caller's agency list, and must match leads.sales_person_id as well as
-- the junction table.

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
        AND (
          p_agency_ids IS NULL
          OR l.agency_id IS NULL
          OR l.agency_id = ANY(p_agency_ids)
          OR l.sales_person_id = public.get_user_sales_person_id(auth.uid())
          OR EXISTS (
            SELECT 1
            FROM lead_sales_people lsp
            WHERE lsp.lead_id = l.id
              AND lsp.sales_person_id = public.get_user_sales_person_id(auth.uid())
          )
          OR (
            p_sales_person_ids IS NOT NULL
            AND (
              l.sales_person_id = ANY(p_sales_person_ids)
              OR EXISTS (
                SELECT 1
                FROM lead_sales_people lsp
                WHERE lsp.lead_id = l.id
                  AND lsp.sales_person_id = ANY(p_sales_person_ids)
              )
            )
          )
        )
        AND (
          p_sales_person_ids IS NULL
          OR l.sales_person_id = ANY(p_sales_person_ids)
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
          AND (
            p_agency_ids IS NULL
            OR l.agency_id IS NULL
            OR l.agency_id = ANY(p_agency_ids)
            OR l.sales_person_id = public.get_user_sales_person_id(auth.uid())
            OR EXISTS (
              SELECT 1
              FROM lead_sales_people lsp
              WHERE lsp.lead_id = l.id
                AND lsp.sales_person_id = public.get_user_sales_person_id(auth.uid())
            )
            OR (
              p_sales_person_ids IS NOT NULL
              AND (
                l.sales_person_id = ANY(p_sales_person_ids)
                OR EXISTS (
                  SELECT 1
                  FROM lead_sales_people lsp
                  WHERE lsp.lead_id = l.id
                    AND lsp.sales_person_id = ANY(p_sales_person_ids)
                )
              )
            )
          )
          AND (
            p_sales_person_ids IS NULL
            OR l.sales_person_id = ANY(p_sales_person_ids)
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
