-- SEO staff (e.g. יובל) only see SEO reports whose client is SEO-tagged
-- (user_can_access_client → client_is_seo_tagged). A few live SEO reports sat
-- on clients without the tag, or on a domain-named placeholder client, so they
-- were missing from the SEO reports list.

-- מרינה דיוורס, פ.ד פסגות: have an SEO report but no 'seo' service.
UPDATE public.clients AS c
SET services = array_append(COALESCE(c.services, ARRAY[]::text[]), 'seo')
WHERE c.id IN (
    '78c97883-1c66-45da-a230-c929370ac9f0',
    'fd3c1984-7ca2-4e32-9064-dfb634522c11'
  )
  AND NOT ('seo' = ANY (COALESCE(c.services, ARRAY[]::text[])))
  AND EXISTS (
    SELECT 1
    FROM public.crm_tables t
    WHERE t.client_id = c.id
      AND t.integration_type = 'ahrefs'
  );

-- dl-cpa.co.il report was attached to the placeholder client "dl-cpa.co.il";
-- the real SEO client for that site is דורון לוין. agency_id follows the
-- client via crm_tables_fill_agency.
UPDATE public.crm_tables AS t
SET
  client_id = '496e649a-1a0d-4724-8761-84bff81c44fd',
  integration_settings = jsonb_set(
    COALESCE(t.integration_settings, '{}'::jsonb),
    '{clientId}',
    to_jsonb('496e649a-1a0d-4724-8761-84bff81c44fd'::text),
    true
  )
WHERE t.id = '4ca9cd63-a493-41d4-95be-5aab85757311'
  AND t.integration_type = 'ahrefs'
  AND t.client_id = 'a8017cff-70a4-4bcf-9995-da2a93869fbc'
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = '496e649a-1a0d-4724-8761-84bff81c44fd'
  );

-- Stale duplicate SEO reports (last synced 2026-08-07) for sites whose real
-- report lives on the proper client card: tavnicol.co.il → פעמית עסקים,
-- studiodil.co.il → שפי אריזות, yts → YTS. They hang off placeholder clients
-- (or no client), so SEO staff could not open them anyway.
DELETE FROM public.crm_tables AS t
WHERE t.integration_type = 'ahrefs'
  AND t.id IN (
    '38dfca6a-0904-40c2-94cd-ba58e330fc1c',
    '9bb29405-c9f4-4e2c-b08b-a272dd3ec2dd',
    '1566a5c6-19ee-4770-8968-98dfd0044c17',
    'de2012f7-5677-4624-a87d-b734a955d096',
    'a785145e-b132-4f74-850e-c52fd8d8093c',
    '600e4829-4eaa-48e7-b218-87d897fa8120'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_records r
    WHERE r.table_id = t.id
  );
