-- Create index for better performance on stage-based queries
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);

-- Create RPC to fetch leads grouped by pipeline stages
CREATE OR REPLACE FUNCTION get_leads_by_stages(
  p_tenant_id UUID,
  p_agency_ids UUID[] DEFAULT NULL,
  p_stages TEXT[] DEFAULT NULL,
  p_limit_per_stage INT DEFAULT 50,
  p_search_query TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_response_statuses TEXT[] DEFAULT NULL,
  p_follow_up_today BOOLEAN DEFAULT FALSE,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  result JSONB := '[]'::JSONB;
  stage_leads JSONB;
  stage_count BIGINT;
  today_start TIMESTAMPTZ;
  today_end TIMESTAMPTZ;
BEGIN
  -- Calculate today's boundaries if follow_up_today is true
  IF p_follow_up_today THEN
    today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem');
    today_end := today_start + interval '1 day';
  END IF;

  -- Loop through each requested stage
  FOR stage_record IN 
    SELECT unnest(COALESCE(p_stages, ARRAY['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])) AS stage_id
  LOOP
    -- Get leads for this stage with limit
    WITH stage_data AS (
      SELECT l.*
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_id
        AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (p_search_query IS NULL OR p_search_query = '' OR 
             l.name ILIKE '%' || p_search_query || '%' OR 
             l.email ILIKE '%' || p_search_query || '%' OR 
             l.phone ILIKE '%' || p_search_query || '%' OR
             l.business_name ILIKE '%' || p_search_query || '%')
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
             l.name ILIKE '%' || p_search_query || '%' OR 
             l.email ILIKE '%' || p_search_query || '%' OR 
             l.phone ILIKE '%' || p_search_query || '%' OR
             l.business_name ILIKE '%' || p_search_query || '%')
        AND (p_sales_person_id IS NULL OR l.sales_person_id = p_sales_person_id)
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (NOT p_follow_up_today OR (l.follow_up_date >= today_start AND l.follow_up_date < today_end))
        AND (p_start_date IS NULL OR l.created_at >= p_start_date)
        AND (p_end_date IS NULL OR l.created_at <= p_end_date)
    )
    SELECT 
      COALESCE(jsonb_agg(to_jsonb(stage_data.*)), '[]'::JSONB),
      COALESCE((SELECT cnt FROM stage_total), 0)
    INTO stage_leads, stage_count
    FROM stage_data;

    -- Add to result array
    result := result || jsonb_build_array(jsonb_build_object(
      'stage', stage_record.stage_id,
      'leads', stage_leads,
      'total_count', stage_count
    ));
  END LOOP;

  RETURN result;
END;
$$;