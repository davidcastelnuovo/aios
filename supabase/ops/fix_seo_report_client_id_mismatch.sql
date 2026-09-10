-- SEO tables linked to duplicate/wrong client cards while ahrefs_reports live on
-- the canonical client (or another row with the same domain). Yuval saw empty dashboards.

-- periodontics: duplicate "דר יבגני" vs "periodontics.co.il | יבגני"
UPDATE public.crm_tables
SET
  client_id = '93b61475-8a95-452f-a1a7-3fb5143381a5',
  integration_settings = integration_settings
    || jsonb_build_object('clientId', '93b61475-8a95-452f-a1a7-3fb5143381a5'),
  updated_at = now()
WHERE id = '84e4d725-4cec-4292-aa56-30ccbbc6ad0a';

-- gg-ds: stray "gg ds" card vs "ג.ג - אנגלית"
UPDATE public.crm_tables
SET
  client_id = 'b43ea2a4-ebed-40fb-893a-4bcee3c639a7',
  integration_settings = integration_settings
    || jsonb_build_object(
      'clientId', 'b43ea2a4-ebed-40fb-893a-4bcee3c639a7',
      'targetDomain', 'gg-ds.com'
    ),
  updated_at = now()
WHERE id = '0d72bb74-82d7-4368-acf7-f9d6abf07a3c';

-- studiodil: reports saved under other client_ids for the same domain
UPDATE public.ahrefs_reports
SET client_id = '7f7ed121-12c5-467f-86c1-8743a9331646'
WHERE lower(domain) LIKE '%studiodil.co.il%'
  AND client_id IS DISTINCT FROM '7f7ed121-12c5-467f-86c1-8743a9331646';
