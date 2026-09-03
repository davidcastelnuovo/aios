-- פ.ד פסגות (tenant ac7f9a3e-a042-4a64-afea-53e21a544d3d)
-- Keep only tags: רשימת דוד, רשימת גבי on leads.
-- All other lead tag links → append to leads.notes, then delete link.

BEGIN;

WITH to_migrate AS (
  SELECT
    cct.lead_id,
    t.name AS tag_name
  FROM public.chat_contact_tags cct
  INNER JOIN public.chat_tags t ON t.id = cct.tag_id
  WHERE cct.tenant_id = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d'
    AND cct.lead_id IS NOT NULL
    AND t.name NOT IN ('רשימת דוד', 'רשימת גבי')
),
lead_tags AS (
  SELECT
    lead_id,
    string_agg(tag_name, ', ' ORDER BY tag_name) AS tag_line
  FROM to_migrate
  GROUP BY lead_id
)
UPDATE public.leads l
SET
  notes = CASE
    WHEN NULLIF(trim(l.notes), '') IS NULL THEN 'תגיות: ' || lt.tag_line
    WHEN position(lt.tag_line in l.notes) > 0 THEN l.notes
    ELSE trim(both E'\n' from l.notes) || E'\n\n' || 'תגיות: ' || lt.tag_line
  END,
  updated_at = timezone('utc', now())
FROM lead_tags lt
WHERE l.id = lt.lead_id
  AND l.tenant_id = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d';

DELETE FROM public.chat_contact_tags cct
USING public.chat_tags t
WHERE cct.tag_id = t.id
  AND cct.tenant_id = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d'
  AND cct.lead_id IS NOT NULL
  AND t.name NOT IN ('רשימת דוד', 'רשימת גבי');

COMMIT;
