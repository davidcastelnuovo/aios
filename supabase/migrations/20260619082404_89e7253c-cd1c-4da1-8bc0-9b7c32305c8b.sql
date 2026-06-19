
CREATE OR REPLACE FUNCTION public.find_campaign_tables(p_client_ids uuid[])
RETURNS TABLE(table_id uuid, client_id uuid, slug text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ct.id, ct.client_id, ct.slug, ct.name
  FROM public.crm_tables ct
  WHERE ct.client_id = ANY(p_client_ids)
    AND EXISTS (
      SELECT 1 FROM public.crm_records r
      WHERE r.table_id = ct.id
        AND r.data ? 'spend'
        AND (r.data ? 'campaign_name' OR r.data ? 'campaign_id')
      LIMIT 1
    );
$$;

GRANT EXECUTE ON FUNCTION public.find_campaign_tables(uuid[]) TO authenticated, service_role;
