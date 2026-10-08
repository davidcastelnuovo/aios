-- Create a function to get leads filtered by tags efficiently
CREATE OR REPLACE FUNCTION public.get_leads_by_tags(
  p_tenant_id UUID,
  p_tag_ids UUID[],
  p_agency_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
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
    AND (
      l.tenant_id = p_tenant_id 
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    )
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Create a function to count leads by tags
CREATE OR REPLACE FUNCTION public.count_leads_by_tags(
  p_tenant_id UUID,
  p_tag_ids UUID[],
  p_agency_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT l.id)::INTEGER
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND (
      l.tenant_id = p_tenant_id 
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    );
$$;