
-- Update get_leads_by_stages function to use lead_sales_people junction table for multi-salesperson filtering
CREATE OR REPLACE FUNCTION public.get_leads_by_stages(
  p_tenant_id UUID,
  p_agency_ids UUID[] DEFAULT NULL,
  p_stages TEXT[] DEFAULT NULL,
  p_limit_per_stage INTEGER DEFAULT 50,
  p_offset_per_stage INTEGER DEFAULT 0,
  p_search_query TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_sales_person_ids UUID[] DEFAULT NULL,
  p_response_statuses TEXT[] DEFAULT NULL,
  p_follow_up_today BOOLEAN DEFAULT FALSE,
  p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_to_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL
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
  effective_start_date timestamp with time zone;
  effective_end_date timestamp with time zone;
  effective_sales_person_ids UUID[];
BEGIN
  -- Prepare search pattern if provided
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    search_pattern := '%' || lower(p_search_query) || '%';
  END IF;
  
  -- Use p_start_date/p_end_date if provided, otherwise fall back to p_from_date/p_to_date
  effective_start_date := COALESCE(p_start_date, p_from_date);
  effective_end_date := COALESCE(p_end_date, p_to_date);
  
  -- Merge sales_person_ids: prefer p_sales_person_ids array, fall back to single p_sales_person_id
  IF p_sales_person_ids IS NOT NULL AND array_length(p_sales_person_ids, 1) > 0 THEN
    effective_sales_person_ids := p_sales_person_ids;
  ELSIF p_sales_person_id IS NOT NULL THEN
    effective_sales_person_ids := ARRAY[p_sales_person_id];
  ELSE
    effective_sales_person_ids := NULL;
  END IF;

  -- Get all pipeline stages for this tenant, ordered by sort_order
  FOR stage_record IN
    SELECT id, stage_key, label, color, sort_order
    FROM lead_pipeline_stages
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY sort_order ASC
  LOOP
    -- Only process if no stage filter or this stage is in the filter
    IF p_stages IS NULL OR stage_record.stage_key = ANY(p_stages) THEN
      
      -- Get total count for this stage
      SELECT COUNT(DISTINCT l.id)
      INTO stage_count
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_key
        AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
        -- Multi-select sales person filter using junction table
        AND (effective_sales_person_ids IS NULL OR EXISTS (
          SELECT 1 FROM lead_sales_people lsp
          WHERE lsp.lead_id = l.id
            AND lsp.tenant_id = l.tenant_id
            AND lsp.sales_person_id = ANY(effective_sales_person_ids)
        ))
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
        AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
        AND (NOT p_follow_up_today OR l.follow_up_date = CURRENT_DATE)
        AND (search_pattern IS NULL OR (
          lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.email, '')) LIKE search_pattern OR
          COALESCE(l.phone, '') LIKE search_pattern
        ))
        AND (p_tag_ids IS NULL OR EXISTS (
          SELECT 1 FROM chat_contact_tags cct
          WHERE cct.lead_id = l.id
            AND cct.tag_id = ANY(p_tag_ids)
        ));

      -- Get leads for this stage with limit and offset
      SELECT COALESCE(jsonb_agg(lead_data ORDER BY (lead_data->>'updated_at') DESC), '[]'::JSONB)
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
          'created_at', l.created_at,
          'updated_at', l.updated_at,
          'follow_up_date', l.follow_up_date,
          'estimated_deal_value', l.estimated_deal_value,
          'manychat_subscriber_id', l.manychat_subscriber_id,
          'tenant_id', l.tenant_id,
          'whatsapp_avatar_url', l.whatsapp_avatar_url,
          'active_chat_provider', l.active_chat_provider
        ) as lead_data
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.status = stage_record.stage_key
          AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
          -- Multi-select sales person filter using junction table
          AND (effective_sales_person_ids IS NULL OR EXISTS (
            SELECT 1 FROM lead_sales_people lsp
            WHERE lsp.lead_id = l.id
              AND lsp.tenant_id = l.tenant_id
              AND lsp.sales_person_id = ANY(effective_sales_person_ids)
          ))
          AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
          AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
          AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
          AND (NOT p_follow_up_today OR l.follow_up_date = CURRENT_DATE)
          AND (search_pattern IS NULL OR (
            lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.email, '')) LIKE search_pattern OR
            COALESCE(l.phone, '') LIKE search_pattern
          ))
          AND (p_tag_ids IS NULL OR EXISTS (
            SELECT 1 FROM chat_contact_tags cct
            WHERE cct.lead_id = l.id
              AND cct.tag_id = ANY(p_tag_ids)
          ))
        ORDER BY l.updated_at DESC
        LIMIT p_limit_per_stage
        OFFSET p_offset_per_stage
      ) sub;

      -- Add stage data to result
      result := result || jsonb_build_object(
        stage_record.stage_key,
        jsonb_build_object(
          'stage_id', stage_record.id,
          'stage_name', stage_record.label,
          'stage_color', stage_record.color,
          'stage_position', stage_record.sort_order,
          'leads', stage_leads,
          'total_count', stage_count
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;
