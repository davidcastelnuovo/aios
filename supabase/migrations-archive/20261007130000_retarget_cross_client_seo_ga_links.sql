-- SEO tables sometimes store linkedGaTableId pointing at another client's
-- Google Analytics crm_table (same property copied onto the wrong card).
-- crm-records allows that read only when the viewer can access the other
-- client, so campaigners see an empty Analytics section while owners do not.
-- When this client already has its own Analytics table, point the link there.
-- Links with no same-client replacement are left alone.

UPDATE public.crm_tables AS seo
SET
  integration_settings = jsonb_set(
    seo.integration_settings,
    '{linkedGaTableId}',
    to_jsonb(fix.good_id::text),
    true
  ),
  updated_at = now()
FROM (
  SELECT picked.seo_id, picked.good_id
  FROM (
    SELECT
      seo_row.id AS seo_id,
      (
        SELECT g.id
        FROM public.crm_tables AS bad
        JOIN public.crm_tables AS g
          ON g.client_id = seo_row.client_id
         AND g.integration_type = 'google_analytics'
         AND g.id <> bad.id
        WHERE bad.id = (seo_row.integration_settings->>'linkedGaTableId')::uuid
          AND bad.client_id IS DISTINCT FROM seo_row.client_id
        ORDER BY
          (g.integration_settings->>'propertyId' IS NOT DISTINCT FROM bad.integration_settings->>'propertyId') DESC,
          g.updated_at DESC NULLS LAST
        LIMIT 1
      ) AS good_id
    FROM public.crm_tables AS seo_row
    WHERE seo_row.integration_type = 'ahrefs'
      AND seo_row.client_id IS NOT NULL
      AND seo_row.integration_settings->>'linkedGaTableId' ~* '^[0-9a-f-]{36}$'
  ) AS picked
  WHERE picked.good_id IS NOT NULL
) AS fix
WHERE seo.id = fix.seo_id;
