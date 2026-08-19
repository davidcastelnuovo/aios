-- Backfill mirrored whatsapp_groups.invite_link rows (MC/DMM share group_chat_id).
-- Safe to run repeatedly.

UPDATE public.whatsapp_groups AS target
SET invite_link = source.invite_link,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (group_chat_id)
    group_chat_id,
    invite_link
  FROM public.whatsapp_groups
  WHERE invite_link IS NOT NULL AND btrim(invite_link) <> ''
  ORDER BY group_chat_id, updated_at DESC
) AS source
WHERE target.group_chat_id = source.group_chat_id
  AND (target.invite_link IS NULL OR btrim(target.invite_link) = '');
