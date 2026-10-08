-- Automatically surface published PBN articles in the client's monthly SEO work report.
-- The article appears under both "articles written" and "external links", keyed by
-- publishing article id so retries/republishing update rather than duplicate it.

-- Older production snapshots were created without the UNIQUE(client_id, month)
-- constraint from the canonical table migration. The monthly UI and this trigger
-- both rely on that conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS seo_monthly_updates_client_month_key
  ON public.seo_monthly_updates (client_id, month);

CREATE OR REPLACE FUNCTION public.sync_published_article_to_seo_monthly_work()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_month date;
  v_report_tenant_id uuid;
  v_site_name text;
  v_work jsonb;
  v_articles jsonb;
  v_links jsonb;
  v_article_item jsonb;
  v_link_item jsonb;
BEGIN
  IF NEW.status <> 'published'
     OR NEW.live_url IS NULL
     OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.tenant_id
    INTO v_report_tenant_id
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_report_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_month := date_trunc(
    'month',
    COALESCE(NEW.source_month, NEW.published_at::date, current_date)
  )::date;

  SELECT ps.name
    INTO v_site_name
  FROM public.publishing_sites ps
  WHERE ps.id = NEW.site_id;

  -- Serialize updates to one client/month JSON document.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.client_id::text || ':' || v_month::text, 0)
  );

  SELECT smu.work
    INTO v_work
  FROM public.seo_monthly_updates smu
  WHERE smu.client_id = NEW.client_id
    AND smu.month = v_month
  FOR UPDATE;

  v_work := COALESCE(v_work, '{}'::jsonb);
  v_articles := COALESCE(v_work->'articles', '[]'::jsonb);
  v_links := COALESCE(v_work->'links', '[]'::jsonb);

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_articles
  FROM jsonb_array_elements(v_articles) item
  WHERE item->>'id' <> 'pbn-article-' || NEW.id::text;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_links
  FROM jsonb_array_elements(v_links) item
  WHERE item->>'id' <> 'pbn-link-' || NEW.id::text;

  v_article_item := jsonb_strip_nulls(jsonb_build_object(
    'id', 'pbn-article-' || NEW.id::text,
    'title', NEW.title,
    'topic', COALESCE(NEW.proposed_topic, NEW.primary_keyword, ''),
    'url', NEW.live_url,
    'notes', CASE
      WHEN v_site_name IS NOT NULL THEN 'פורסם ב־' || v_site_name
      ELSE 'פורסם ברשת PBN'
    END
  ));

  v_link_item := jsonb_strip_nulls(jsonb_build_object(
    'id', 'pbn-link-' || NEW.id::text,
    'url', NEW.live_url,
    'anchor', COALESCE(NEW.anchor_text, NEW.primary_keyword),
    'notes', COALESCE(NEW.title, v_site_name, 'מאמר PBN')
  ));

  v_work := jsonb_set(v_work, '{onsite}', COALESCE(v_work->'onsite', '[]'::jsonb), true);
  v_work := jsonb_set(v_work, '{articles}', v_articles || jsonb_build_array(v_article_item), true);
  v_work := jsonb_set(v_work, '{links}', v_links || jsonb_build_array(v_link_item), true);

  INSERT INTO public.seo_monthly_updates (
    client_id,
    tenant_id,
    month,
    status,
    work
  )
  VALUES (
    NEW.client_id,
    v_report_tenant_id,
    v_month,
    'stable'::public.seo_monthly_status,
    v_work
  )
  ON CONFLICT (client_id, month)
  DO UPDATE SET work = EXCLUDED.work;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_published_article_monthly_work
  ON public.publishing_articles;

CREATE TRIGGER sync_published_article_monthly_work
AFTER INSERT OR UPDATE
ON public.publishing_articles
FOR EACH ROW
EXECUTE FUNCTION public.sync_published_article_to_seo_monthly_work();

COMMENT ON FUNCTION public.sync_published_article_to_seo_monthly_work() IS
  'Upserts published PBN articles and their live links into seo_monthly_updates.work for the assignment month.';
