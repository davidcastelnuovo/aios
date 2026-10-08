-- Drop and recreate the function with tag filtering support
DROP FUNCTION IF EXISTS public.get_leads_by_stages(UUID, UUID[], TEXT[], INT, TEXT, UUID, TEXT[], BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_leads_by_stages(
  p_tenant_id UUID,
  p_agency_ids UUID[],
  p_stages TEXT[],
  p_limit_per_stage INT,
  p_search_query TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_response_statuses TEXT[] DEFAULT NULL,
  p_follow_up_today BOOLEAN DEFAULT FALSE,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(stage TEXT, leads JSONB, total_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  today_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem');
  today_end TIMESTAMPTZ := today_start + INTERVAL '1 day';
BEGIN
  FOR stage_record IN 
    SELECT unnest(p_stages) AS stage_id
  LOOP
    RETURN QUERY
    WITH filtered_lead_ids AS (
      -- If tag filtering is needed, find leads with matching tags
      SELECT DISTINCT lt.lead_id
      FROM lead_tags lt
      WHERE p_tag_ids IS NOT NULL AND lt.tag_id = ANY(p_tag_ids)
    ),
    stage_data AS (
      SELECT l.*
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_id
        AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (p_search_query IS NULL OR p_search_query = '' OR 
             l.company_name ILIKE '%' || p_search_query || '%' OR 
             l.contact_name ILIKE '%' || p_search_query || '%' OR
             l.email ILIKE '%' || p_search_query || '%' OR 
             l.phone ILIKE '%' || p_search_query || '%')
        AND (p_sales_person_id IS NULL OR l.sales_person_id = p_sales_person_id)
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (NOT p_follow_up_today OR (l.follow_up_date >= today_start AND l.follow_up_date < today_end))
        AND (p_start_date IS NULL OR l.created_at >= p_start_date)
        AND (p_end_date IS NULL OR l.created_at <= p_end_date)
        -- Tag filter: if p_tag_ids is provided, only include leads that have at least one of those tags
        AND (p_tag_ids IS NULL OR l.id IN (SELECT lead_id FROM filtered_lead_ids))
      ORDER BY l.updated_at DESC
      LIMIT p_limit_per_stage
    ),
    stage_total AS (
      SELECT COUNT(*) as cnt
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_id
        AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (p_search_query IS NULL OR p_search_query = '' OR 
             l.company_name ILIKE '%' || p_search_query || '%' OR 
             l.contact_name ILIKE '%' || p_search_query || '%' OR
             l.email ILIKE '%' || p_search_query || '%' OR 
             l.phone ILIKE '%' || p_search_query || '%')
        AND (p_sales_person_id IS NULL OR l.sales_person_id = p_sales_person_id)
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (NOT p_follow_up_today OR (l.follow_up_date >= today_start AND l.follow_up_date < today_end))
        AND (p_start_date IS NULL OR l.created_at >= p_start_date)
        AND (p_end_date IS NULL OR l.created_at <= p_end_date)
        AND (p_tag_ids IS NULL OR l.id IN (SELECT lead_id FROM filtered_lead_ids))
    )
    SELECT 
      stage_record.stage_id,
      COALESCE(jsonb_agg(to_jsonb(stage_data.*)), '[]'::JSONB),
      COALESCE((SELECT cnt FROM stage_total), 0)
    FROM stage_data;
  END LOOP;
END;
$$;