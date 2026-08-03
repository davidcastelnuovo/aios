-- Google Ads CRM records store spend as `cost`, not `spend`.
-- find_campaign_tables previously required data ? 'spend', so Google report
-- tables were invisible to analyze_campaign_performance / Carmen tools even
-- when connected and freshly synced. Accept either spend or cost.
-- Also return integration_type so callers can detect facebook_ecommerce.
-- DROP required because the OUT/return row type is changing.
DROP FUNCTION IF EXISTS public.find_campaign_tables(uuid[]);
CREATE OR REPLACE FUNCTION public.find_campaign_tables(p_client_ids uuid[])
RETURNS TABLE(
  table_id uuid,
  client_id uuid,
  slug text,
  name text,
  integration_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ct.id, ct.client_id, ct.slug, ct.name, ct.integration_type
  FROM public.crm_tables ct
  WHERE ct.client_id = ANY(p_client_ids)
    AND EXISTS (
      SELECT 1 FROM public.crm_records r
      WHERE r.table_id = ct.id
        AND (r.data ? 'spend' OR r.data ? 'cost')
        AND (r.data ? 'campaign_name' OR r.data ? 'campaign_id')
      LIMIT 1
    );
$$;

COMMENT ON FUNCTION public.find_campaign_tables(uuid[]) IS
  'Campaign report tables for the given clients. Matches Meta (spend) and Google Ads (cost) synced CRM records.';

GRANT EXECUTE ON FUNCTION public.find_campaign_tables(uuid[]) TO authenticated, service_role;
