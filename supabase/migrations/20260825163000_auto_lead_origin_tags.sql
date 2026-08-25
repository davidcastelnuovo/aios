-- Automatically create/assign chat tags from lead campaign_name and source
-- so CRM filters can slice by origin (e.g. שיווק, מכירות, FB). Additive only:
-- never deletes tags, never widens RLS.

CREATE OR REPLACE FUNCTION public.lead_source_tag_name(p_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN s IN ('other', 'אחר') THEN NULL
    WHEN s IN ('paid_ads', 'facebook', 'fb') THEN 'FB'
    WHEN s = 'website' THEN 'אתר'
    WHEN s = 'referral' THEN 'הפניה'
    WHEN s = 'social_media' THEN 'רשתות חברתיות'
    WHEN s = 'cold_call' THEN 'שיחה קרה'
    WHEN s = 'email_campaign' THEN 'דיוור'
    WHEN s = 'event' THEN 'אירוע'
    WHEN s = 'whatsapp' THEN 'וואטסאפ'
    WHEN s = 'phone' THEN 'טלפון'
    WHEN s = 'google' THEN 'גוגל'
    WHEN s = '' THEN NULL
    ELSE NULLIF(btrim(p_source), '')
  END
  FROM (SELECT lower(btrim(COALESCE(p_source, ''))) AS s) AS src(s);
$$;

CREATE OR REPLACE FUNCTION public.lead_origin_tag_names(
  p_campaign_name text,
  p_source text
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  names text[] := ARRAY[]::text[];
  campaign text;
  source_label text;
BEGIN
  campaign := NULLIF(btrim(COALESCE(p_campaign_name, '')), '');
  IF campaign IS NOT NULL AND lower(campaign) NOT IN ('אחר', 'other') THEN
    names := names || campaign;
  END IF;

  source_label := public.lead_source_tag_name(p_source);
  IF source_label IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM unnest(names) AS n(name) WHERE lower(n.name) = lower(source_label)
     )
  THEN
    names := names || source_label;
  END IF;

  RETURN names;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lead_origin_tags_for_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  tag_name text;
  found_tag_id uuid;
  actor uuid;
  next_sort integer;
  source_label text;
  tag_color text;
BEGIN
  SELECT id, tenant_id, campaign_name, source
  INTO rec
  FROM public.leads
  WHERE id = p_lead_id;

  IF rec.id IS NULL OR rec.tenant_id IS NULL THEN
    RETURN;
  END IF;

  actor := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  source_label := public.lead_source_tag_name(rec.source);

  FOREACH tag_name IN ARRAY public.lead_origin_tag_names(rec.campaign_name, rec.source)
  LOOP
    SELECT id INTO found_tag_id
    FROM public.chat_tags
    WHERE tenant_id = rec.tenant_id
      AND lower(name) = lower(tag_name)
    LIMIT 1;

    IF found_tag_id IS NULL THEN
      SELECT COALESCE(MAX(sort_order), 0) + 1 INTO next_sort
      FROM public.chat_tags
      WHERE tenant_id = rec.tenant_id;

      tag_color := CASE
        WHEN source_label IS NOT NULL AND lower(tag_name) = lower(source_label) THEN '#3B82F6'
        ELSE '#8B5CF6'
      END;

      INSERT INTO public.chat_tags (tenant_id, name, color, sort_order)
      VALUES (rec.tenant_id, tag_name, tag_color, next_sort)
      ON CONFLICT (tenant_id, name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO found_tag_id;
    END IF;

    IF found_tag_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.chat_contact_tags (tag_id, lead_id, tenant_id, user_id)
    VALUES (found_tag_id, rec.id, rec.tenant_id, actor)
    ON CONFLICT (tag_id, lead_id)
    DO NOTHING;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'sync_lead_origin_tags_for_lead failed for %: %', p_lead_id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_lead_origin_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_lead_origin_tags_for_lead(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_origin_tags ON public.leads;
CREATE TRIGGER trg_sync_lead_origin_tags
AFTER INSERT OR UPDATE OF campaign_name, source
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_lead_origin_tags();

REVOKE ALL ON FUNCTION public.sync_lead_origin_tags_for_lead(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_lead_origin_tags() FROM PUBLIC;

-- Backfill existing leads that already have a campaign or source.
INSERT INTO public.chat_tags (tenant_id, name, color, sort_order)
SELECT DISTINCT
  l.tenant_id,
  btrim(l.campaign_name),
  '#8B5CF6',
  0
FROM public.leads l
WHERE l.tenant_id IS NOT NULL
  AND NULLIF(btrim(l.campaign_name), '') IS NOT NULL
  AND lower(btrim(l.campaign_name)) NOT IN ('אחר', 'other')
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.chat_tags (tenant_id, name, color, sort_order)
SELECT DISTINCT
  l.tenant_id,
  public.lead_source_tag_name(l.source),
  '#3B82F6',
  0
FROM public.leads l
WHERE l.tenant_id IS NOT NULL
  AND public.lead_source_tag_name(l.source) IS NOT NULL
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.chat_contact_tags (tag_id, lead_id, tenant_id, user_id)
SELECT t.id, l.id, l.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid
FROM public.leads l
JOIN public.chat_tags t
  ON t.tenant_id = l.tenant_id
 AND lower(t.name) = lower(btrim(l.campaign_name))
WHERE l.tenant_id IS NOT NULL
  AND NULLIF(btrim(l.campaign_name), '') IS NOT NULL
ON CONFLICT (tag_id, lead_id) DO NOTHING;

INSERT INTO public.chat_contact_tags (tag_id, lead_id, tenant_id, user_id)
SELECT t.id, l.id, l.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid
FROM public.leads l
JOIN public.chat_tags t
  ON t.tenant_id = l.tenant_id
 AND lower(t.name) = lower(public.lead_source_tag_name(l.source))
WHERE l.tenant_id IS NOT NULL
  AND public.lead_source_tag_name(l.source) IS NOT NULL
ON CONFLICT (tag_id, lead_id) DO NOTHING;
