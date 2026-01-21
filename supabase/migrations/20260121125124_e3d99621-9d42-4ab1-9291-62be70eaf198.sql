-- Drop and recreate the function with correct column names
DROP FUNCTION IF EXISTS get_leads_by_stages(uuid, uuid[], text[], integer, text, uuid, text[], boolean, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_leads_by_stages(
  p_tenant_id UUID,
  p_agency_ids UUID[] DEFAULT NULL,
  p_stages TEXT[] DEFAULT ARRAY['new', 'contacted', 'meeting_set', 'proposal', 'negotiation', 'won', 'lost'],
  p_limit_per_stage INT DEFAULT 50,
  p_search_query TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_response_statuses TEXT[] DEFAULT NULL,
  p_follow_up_today BOOLEAN DEFAULT FALSE,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  stage TEXT,
  leads JSONB,
  total_count BIGINT
)
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
    WITH stage_data AS (
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
    )
    SELECT 
      stage_record.stage_id,
      COALESCE(jsonb_agg(to_jsonb(stage_data.*)), '[]'::JSONB),
      COALESCE((SELECT cnt FROM stage_total), 0)
    FROM stage_data;
  END LOOP;
END;
$$;