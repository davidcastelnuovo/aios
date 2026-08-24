-- When a report table (crm_tables) is created or assigned to a client, keep the
-- client's connection fields (google_ads_account_id, meta_ads_account_id, etc.)
-- in sync with integration_settings. Backfill existing mismatches (e.g. Aviali).

CREATE OR REPLACE FUNCTION public.normalize_google_customer_id(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN regexp_replace(trim(COALESCE(raw, '')), '-', '', 'g') ~ '^\d+$'
      THEN NULLIF(regexp_replace(trim(COALESCE(raw, '')), '-', '', 'g'), '')
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_meta_ad_account_id(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN trim(COALESCE(raw, '')) = '' THEN NULL
    WHEN regexp_replace(trim(raw), '^act_', '', 'i') ~ '^\d+$'
      THEN 'act_' || regexp_replace(trim(raw), '^act_', '', 'i')
    ELSE trim(raw)
  END;
$$;

CREATE OR REPLACE FUNCTION public.extract_report_table_account_id(
  p_integration_type text,
  p_settings jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw text;
BEGIN
  IF p_integration_type IS NULL OR p_settings IS NULL THEN
    RETURN NULL;
  END IF;

  CASE p_integration_type
    WHEN 'google_ads' THEN
      v_raw := COALESCE(p_settings->>'customer_id', p_settings->>'account_id');
      RETURN public.normalize_google_customer_id(v_raw);
    WHEN 'facebook_insights', 'facebook_ecommerce' THEN
      v_raw := COALESCE(
        p_settings->>'ad_account_id',
        p_settings->>'account_id',
        p_settings->>'meta_account_id'
      );
      RETURN public.normalize_meta_ad_account_id(v_raw);
    WHEN 'google_analytics' THEN
      v_raw := COALESCE(p_settings->>'property_id', p_settings->>'ga_property_id');
      RETURN NULLIF(trim(COALESCE(v_raw, '')), '');
    WHEN 'ahrefs' THEN
      v_raw := COALESCE(p_settings->>'targetDomain', p_settings->>'domain', p_settings->>'target_domain');
      RETURN NULLIF(trim(COALESCE(v_raw, '')), '');
    WHEN 'google_search_console' THEN
      v_raw := COALESCE(p_settings->>'site_url', p_settings->>'gsc_site_url');
      RETURN NULLIF(trim(COALESCE(v_raw, '')), '');
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_card_from_crm_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id text;
  v_field text;
BEGIN
  IF NEW.client_id IS NULL OR NEW.integration_type IS NULL THEN
    RETURN NEW;
  END IF;

  v_account_id := public.extract_report_table_account_id(NEW.integration_type, NEW.integration_settings);
  IF v_account_id IS NULL THEN
    RAISE LOG '[client-report-sync] table % client % type % missing account id in settings',
      NEW.id, NEW.client_id, NEW.integration_type;
    RETURN NEW;
  END IF;

  CASE NEW.integration_type
    WHEN 'google_ads' THEN v_field := 'google_ads_account_id';
    WHEN 'facebook_insights', 'facebook_ecommerce' THEN v_field := 'meta_ads_account_id';
    WHEN 'google_analytics' THEN v_field := 'ga_property_id';
    WHEN 'ahrefs' THEN v_field := 'ahrefs_domain';
    WHEN 'google_search_console' THEN v_field := 'gsc_site_url';
    ELSE RETURN NEW;
  END CASE;

  EXECUTE format(
    'UPDATE public.clients SET %I = $1 WHERE id = $2 AND (%I IS DISTINCT FROM $1)',
    v_field, v_field
  ) USING v_account_id, NEW.client_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tables_sync_client_card ON public.crm_tables;
CREATE TRIGGER crm_tables_sync_client_card
AFTER INSERT OR UPDATE OF client_id, integration_type, integration_settings ON public.crm_tables
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_card_from_crm_table();

-- Backfill: align client card fields from already-assigned report tables.
UPDATE public.clients c
SET google_ads_account_id = sub.account_id
FROM (
  SELECT DISTINCT ON (t.client_id)
    t.client_id,
    public.extract_report_table_account_id('google_ads', t.integration_settings) AS account_id
  FROM public.crm_tables t
  WHERE t.client_id IS NOT NULL
    AND t.integration_type = 'google_ads'
    AND public.extract_report_table_account_id('google_ads', t.integration_settings) IS NOT NULL
  ORDER BY t.client_id, t.last_sync_at DESC NULLS LAST, t.updated_at DESC
) sub
WHERE c.id = sub.client_id
  AND c.google_ads_account_id IS DISTINCT FROM sub.account_id;

UPDATE public.clients c
SET meta_ads_account_id = sub.account_id
FROM (
  SELECT DISTINCT ON (t.client_id)
    t.client_id,
    public.extract_report_table_account_id(t.integration_type, t.integration_settings) AS account_id
  FROM public.crm_tables t
  WHERE t.client_id IS NOT NULL
    AND t.integration_type IN ('facebook_insights', 'facebook_ecommerce')
    AND public.extract_report_table_account_id(t.integration_type, t.integration_settings) IS NOT NULL
  ORDER BY t.client_id, t.last_sync_at DESC NULLS LAST, t.updated_at DESC
) sub
WHERE c.id = sub.client_id
  AND c.meta_ads_account_id IS DISTINCT FROM sub.account_id;

UPDATE public.clients c
SET ga_property_id = sub.account_id
FROM (
  SELECT DISTINCT ON (t.client_id)
    t.client_id,
    public.extract_report_table_account_id('google_analytics', t.integration_settings) AS account_id
  FROM public.crm_tables t
  WHERE t.client_id IS NOT NULL
    AND t.integration_type = 'google_analytics'
    AND public.extract_report_table_account_id('google_analytics', t.integration_settings) IS NOT NULL
  ORDER BY t.client_id, t.last_sync_at DESC NULLS LAST, t.updated_at DESC
) sub
WHERE c.id = sub.client_id
  AND c.ga_property_id IS DISTINCT FROM sub.account_id;

UPDATE public.clients c
SET ahrefs_domain = sub.account_id
FROM (
  SELECT DISTINCT ON (t.client_id)
    t.client_id,
    public.extract_report_table_account_id('ahrefs', t.integration_settings) AS account_id
  FROM public.crm_tables t
  WHERE t.client_id IS NOT NULL
    AND t.integration_type = 'ahrefs'
    AND public.extract_report_table_account_id('ahrefs', t.integration_settings) IS NOT NULL
  ORDER BY t.client_id, t.last_sync_at DESC NULLS LAST, t.updated_at DESC
) sub
WHERE c.id = sub.client_id
  AND c.ahrefs_domain IS DISTINCT FROM sub.account_id;

UPDATE public.clients c
SET gsc_site_url = sub.account_id
FROM (
  SELECT DISTINCT ON (t.client_id)
    t.client_id,
    public.extract_report_table_account_id('google_search_console', t.integration_settings) AS account_id
  FROM public.crm_tables t
  WHERE t.client_id IS NOT NULL
    AND t.integration_type = 'google_search_console'
    AND public.extract_report_table_account_id('google_search_console', t.integration_settings) IS NOT NULL
  ORDER BY t.client_id, t.last_sync_at DESC NULLS LAST, t.updated_at DESC
) sub
WHERE c.id = sub.client_id
  AND c.gsc_site_url IS DISTINCT FROM sub.account_id;
