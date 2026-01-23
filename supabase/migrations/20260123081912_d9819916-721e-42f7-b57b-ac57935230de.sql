-- Update get_leads_by_stages to support offset for pagination
CREATE OR REPLACE FUNCTION public.get_leads_by_stages(
  p_tenant_id UUID,
  p_agency_ids UUID[] DEFAULT NULL,
  p_stages TEXT[] DEFAULT NULL,
  p_limit_per_stage INT DEFAULT 50,
  p_offset_per_stage INT DEFAULT 0,
  p_search_query TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_response_statuses TEXT[] DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  stage_record RECORD;
  stage_leads JSONB;
  stage_count BIGINT;
  search_pattern TEXT;
BEGIN
  -- Prepare search pattern if provided
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    search_pattern := '%' || lower(p_search_query) || '%';
  END IF;

  -- Get all pipeline stages for this tenant, ordered by position
  FOR stage_record IN
    SELECT id, name, color, position
    FROM lead_pipeline_stages
    WHERE tenant_id = p_tenant_id
    ORDER BY position ASC
  LOOP
    -- Only process if no stage filter or this stage is in the filter
    IF p_stages IS NULL OR stage_record.id::TEXT = ANY(p_stages) THEN
      
      -- Get total count for this stage (always needed for UI)
      SELECT COUNT(*)
      INTO stage_count
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.pipeline_stage_id = stage_record.id
        AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (p_sales_person_id IS NULL OR l.sales_person_id = p_sales_person_id)
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (p_from_date IS NULL OR l.created_at >= p_from_date)
        AND (p_to_date IS NULL OR l.created_at <= p_to_date)
        AND (search_pattern IS NULL OR (
          lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.email, '')) LIKE search_pattern OR
          COALESCE(l.phone, '') LIKE search_pattern
        ))
        AND (p_tag_ids IS NULL OR EXISTS (
          SELECT 1 FROM chat_contact_tags cct
          WHERE cct.contact_type = 'lead'
            AND cct.contact_id = l.id
            AND cct.tag_id = ANY(p_tag_ids)
        ));

      -- Get leads for this stage with limit and offset
      SELECT COALESCE(jsonb_agg(lead_data ORDER BY lead_data->>'updated_at' DESC), '[]'::JSONB)
      INTO stage_leads
      FROM (
        SELECT jsonb_build_object(
          'id', l.id,
          'contact_name', l.contact_name,
          'company_name', l.company_name,
          'email', l.email,
          'phone', l.phone,
          'source', l.source,
          'status', l.status,
          'response_status', l.response_status,
          'notes', l.notes,
          'agency_id', l.agency_id,
          'sales_person_id', l.sales_person_id,
          'product_id', l.product_id,
          'pipeline_stage_id', l.pipeline_stage_id,
          'created_at', l.created_at,
          'updated_at', l.updated_at,
          'follow_up_date', l.follow_up_date,
          'estimated_value', l.estimated_value,
          'manychat_subscriber_id', l.manychat_subscriber_id,
          'custom_fields', l.custom_fields,
          'tenant_id', l.tenant_id
        ) as lead_data
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.pipeline_stage_id = stage_record.id
          AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
          AND (p_sales_person_id IS NULL OR l.sales_person_id = p_sales_person_id)
          AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
          AND (p_from_date IS NULL OR l.created_at >= p_from_date)
          AND (p_to_date IS NULL OR l.created_at <= p_to_date)
          AND (search_pattern IS NULL OR (
            lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.email, '')) LIKE search_pattern OR
            COALESCE(l.phone, '') LIKE search_pattern
          ))
          AND (p_tag_ids IS NULL OR EXISTS (
            SELECT 1 FROM chat_contact_tags cct
            WHERE cct.contact_type = 'lead'
              AND cct.contact_id = l.id
              AND cct.tag_id = ANY(p_tag_ids)
          ))
        ORDER BY l.updated_at DESC
        LIMIT p_limit_per_stage
        OFFSET p_offset_per_stage
      ) sub;

      -- Add stage data to result
      result := result || jsonb_build_object(
        stage_record.id::TEXT,
        jsonb_build_object(
          'stage_id', stage_record.id,
          'stage_name', stage_record.name,
          'stage_color', stage_record.color,
          'stage_position', stage_record.position,
          'leads', stage_leads,
          'total_count', stage_count
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;