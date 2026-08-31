-- Mirror whatsapp_groups.invite_link across tenants for the same physical group
-- (same group_chat_id). MC and DMM often each have a row for the same WA group.

CREATE OR REPLACE FUNCTION public.propagate_whatsapp_group_invite_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invite_link IS NOT NULL AND btrim(NEW.invite_link) <> '' THEN
    UPDATE public.whatsapp_groups AS wg
    SET invite_link = NEW.invite_link,
        updated_at = now()
    WHERE wg.group_chat_id = NEW.group_chat_id
      AND wg.id <> NEW.id
      AND (wg.invite_link IS NULL OR wg.invite_link <> NEW.invite_link);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_whatsapp_group_invite_link ON public.whatsapp_groups;
CREATE TRIGGER trg_propagate_whatsapp_group_invite_link
  AFTER INSERT OR UPDATE OF invite_link ON public.whatsapp_groups
  FOR EACH ROW
  WHEN (NEW.invite_link IS NOT NULL AND btrim(NEW.invite_link) <> '')
  EXECUTE FUNCTION public.propagate_whatsapp_group_invite_link();

-- Backfill: copy invite_link from any sibling row that already has one.
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
