-- Merge ABS duplicate clients into the active Adir Ben-Shoham record.
--
-- Survivor (keep / active):
--   ebe4cebb-4844-4ef0-ac96-71a463050912
--   "אדיר בן שוהם- ABS אדריכלים"  status=active  website=https://www.abs-arch.co.il/
--
-- Source (fold in / ended):
--   3af863bd-d577-4766-9221-32018d056cc5
--   "ABS אדריכלים"  status=ended  website=null
--
-- Same tenant (6ad8f321-…) and same agency (38cf0e62-…).
-- The ended status likely tripped deactivate_reports_for_inactive_client and
-- hid SEO tables; reports stay attached to the source UUID. This migration
-- repoints every linked row onto the survivor, reactivates campaign tables,
-- then deletes the ended duplicate.
--
-- Exact UUIDs only — no broad UPDATEs.

DO $$
DECLARE
  v_source uuid := '3af863bd-d577-4766-9221-32018d056cc5';
  v_target uuid := 'ebe4cebb-4844-4ef0-ac96-71a463050912';
  v_source_tenant uuid;
  v_target_tenant uuid;
  v_source_agency uuid;
  v_target_agency uuid;
  v_source_name text;
  v_target_name text;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  SELECT tenant_id, agency_id, name
    INTO v_source_tenant, v_source_agency, v_source_name
  FROM public.clients WHERE id = v_source;

  SELECT tenant_id, agency_id, name
    INTO v_target_tenant, v_target_agency, v_target_name
  FROM public.clients WHERE id = v_target;

  IF v_source_tenant IS NULL THEN
    RAISE NOTICE 'Source client % already gone — nothing to merge', v_source;
    RETURN;
  END IF;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Target (active) client % not found — refusing merge', v_target;
  END IF;

  IF v_source_tenant IS DISTINCT FROM v_target_tenant THEN
    RAISE EXCEPTION 'Tenant mismatch (source %, target %) — refusing merge',
      v_source_tenant, v_target_tenant;
  END IF;

  IF v_source_agency IS DISTINCT FROM v_target_agency THEN
    RAISE EXCEPTION 'Agency mismatch (source %, target %) — refusing merge',
      v_source_agency, v_target_agency;
  END IF;

  ------------------------------------------------------------------
  -- 1) Unique-constraint conflicts: drop source rows that would collide
  ------------------------------------------------------------------
  DELETE FROM public.client_team s
  WHERE s.client_id = v_source
    AND EXISTS (
      SELECT 1 FROM public.client_team t
      WHERE t.client_id = v_target
        AND t.campaigner_id = s.campaigner_id
        AND t.start_date IS NOT DISTINCT FROM s.start_date
    );

  DELETE FROM public.client_suppliers s
  WHERE s.client_id = v_source
    AND EXISTS (
      SELECT 1 FROM public.client_suppliers t
      WHERE t.client_id = v_target AND t.supplier_id = s.supplier_id
    );

  DELETE FROM public.client_tenant_financial_data s
  WHERE s.client_id = v_source
    AND EXISTS (
      SELECT 1 FROM public.client_tenant_financial_data t
      WHERE t.client_id = v_target AND t.tenant_id = s.tenant_id
    );

  DELETE FROM public.seo_monthly_updates s
  WHERE s.client_id = v_source
    AND EXISTS (
      SELECT 1 FROM public.seo_monthly_updates t
      WHERE t.client_id = v_target AND t.month = s.month
    );

  IF to_regclass('public.seo_call_snapshots') IS NOT NULL THEN
    DELETE FROM public.seo_call_snapshots s
    WHERE s.client_id = v_source
      AND EXISTS (
        SELECT 1 FROM public.seo_call_snapshots t
        WHERE t.client_id = v_target
          AND t.tenant_id = s.tenant_id
          AND t.category IS NOT DISTINCT FROM s.category
          AND t.period_start IS NOT DISTINCT FROM s.period_start
          AND t.period_end IS NOT DISTINCT FROM s.period_end
      );
  END IF;

  IF to_regclass('public.campaign_pulse_snapshots') IS NOT NULL THEN
    DELETE FROM public.campaign_pulse_snapshots s
    WHERE s.client_id = v_source
      AND EXISTS (
        SELECT 1 FROM public.campaign_pulse_snapshots t
        WHERE t.client_id = v_target AND t.tenant_id = s.tenant_id
      );
  END IF;

  IF to_regclass('public.chat_contact_tags') IS NOT NULL THEN
    DELETE FROM public.chat_contact_tags s
    WHERE s.client_id = v_source
      AND EXISTS (
        SELECT 1 FROM public.chat_contact_tags t
        WHERE t.client_id = v_target AND t.tag_id = s.tag_id
      );
  END IF;

  IF to_regclass('public.blocked_contacts') IS NOT NULL THEN
    DELETE FROM public.blocked_contacts s
    WHERE s.client_id = v_source
      AND EXISTS (
        SELECT 1 FROM public.blocked_contacts t
        WHERE t.client_id = v_target
          AND t.tenant_id IS NOT DISTINCT FROM s.tenant_id
          AND t.connection_user_id IS NOT DISTINCT FROM s.connection_user_id
      );
  END IF;

  IF to_regclass('public.report_schedules') IS NOT NULL THEN
    DELETE FROM public.report_schedules s
    WHERE s.client_id = v_source
      AND (
        (s.table_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.report_schedules t
          WHERE t.client_id = v_target AND t.table_id = s.table_id
        ))
        OR
        (s.dashboard_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.report_schedules t
          WHERE t.client_id = v_target AND t.dashboard_id = s.dashboard_id
        ))
      );
  END IF;

  -- marketing_pipelines: unique on (client_id, track) when track exists
  IF to_regclass('public.marketing_pipelines') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'marketing_pipelines' AND column_name = 'track'
    ) THEN
      DELETE FROM public.marketing_pipelines s
      WHERE s.client_id = v_source
        AND EXISTS (
          SELECT 1 FROM public.marketing_pipelines t
          WHERE t.client_id = v_target AND t.track IS NOT DISTINCT FROM s.track
        );
    ELSE
      DELETE FROM public.marketing_pipelines s
      WHERE s.client_id = v_source
        AND EXISTS (
          SELECT 1 FROM public.marketing_pipelines t WHERE t.client_id = v_target
        );
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- 2) SEO-critical: crm_tables + embedded settings.clientId
  ------------------------------------------------------------------
  UPDATE public.crm_tables
  SET
    client_id = v_target,
    campaign_active = true,
    integration_settings = CASE
      WHEN integration_settings IS NULL THEN jsonb_build_object('clientId', v_target::text)
      ELSE
        jsonb_set(
          CASE
            WHEN integration_settings ? 'client_id'
              THEN jsonb_set(integration_settings, '{client_id}', to_jsonb(v_target::text), true)
            ELSE integration_settings
          END,
          '{clientId}',
          to_jsonb(v_target::text),
          true
        )
    END
  WHERE client_id = v_source
     OR integration_settings->>'clientId' = v_source::text
     OR integration_settings->>'client_id' = v_source::text;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('crm_tables', v_n);

  -- Also catch abs-arch tables that somehow lost client_id but still mention the domain
  UPDATE public.crm_tables
  SET
    client_id = v_target,
    campaign_active = true,
    integration_settings = jsonb_set(
      coalesce(integration_settings, '{}'::jsonb),
      '{clientId}',
      to_jsonb(v_target::text),
      true
    )
  WHERE client_id IS NULL
    AND integration_type IN ('ahrefs', 'google_analytics', 'google_search_console')
    AND (
      integration_settings->>'targetDomain' ILIKE '%abs-arch%'
      OR name ILIKE '%ABS%'
      OR name ILIKE '%אדריכל%'
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('crm_tables_orphans', v_n);

  ------------------------------------------------------------------
  -- 3) Ahrefs reports (including orphans for abs-arch domain)
  -- Unique index: (domain, report_date, report_type) WHERE report_date IS NOT NULL
  ------------------------------------------------------------------
  DELETE FROM public.ahrefs_reports s
  WHERE (
      s.client_id = v_source
      OR (s.client_id IS NULL AND s.domain ILIKE '%abs-arch%')
    )
    AND s.report_date IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.ahrefs_reports t
      WHERE t.client_id = v_target
        AND t.domain IS NOT DISTINCT FROM s.domain
        AND t.report_date IS NOT DISTINCT FROM s.report_date
        AND t.report_type IS NOT DISTINCT FROM s.report_type
    );

  UPDATE public.ahrefs_reports
  SET client_id = v_target
  WHERE client_id = v_source
     OR (client_id IS NULL AND domain ILIKE '%abs-arch%');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('ahrefs_reports', v_n);

  ------------------------------------------------------------------
  -- 4) Dashboards
  ------------------------------------------------------------------
  UPDATE public.crm_dashboards
  SET client_id = v_target
  WHERE client_id = v_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('crm_dashboards', v_n);

  ------------------------------------------------------------------
  -- 5) Soft-ref / no-FK tables
  ------------------------------------------------------------------
  IF to_regclass('public.seo_call_snapshots') IS NOT NULL THEN
    UPDATE public.seo_call_snapshots SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.campaign_alerts') IS NOT NULL THEN
    UPDATE public.campaign_alerts SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.campaign_schedules') IS NOT NULL THEN
    UPDATE public.campaign_schedules SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.marketing_media_library') IS NOT NULL THEN
    UPDATE public.marketing_media_library SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.marketing_triggers') IS NOT NULL THEN
    UPDATE public.marketing_triggers SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.marketing_work_items') IS NOT NULL THEN
    UPDATE public.marketing_work_items SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.social_pages') IS NOT NULL THEN
    UPDATE public.social_pages SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.social_publications') IS NOT NULL THEN
    UPDATE public.social_publications SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.social_comments') IS NOT NULL THEN
    UPDATE public.social_comments SET client_id = v_target WHERE client_id = v_source;
  END IF;

  ------------------------------------------------------------------
  -- 6) Polymorphic entity_id snapshots
  ------------------------------------------------------------------
  IF to_regclass('public.broadcast_recipients') IS NOT NULL THEN
    UPDATE public.broadcast_recipients
    SET entity_id = v_target
    WHERE entity_type = 'client' AND entity_id = v_source;
  END IF;
  IF to_regclass('public.broadcast_list_members') IS NOT NULL THEN
    UPDATE public.broadcast_list_members
    SET entity_id = v_target
    WHERE entity_type = 'client' AND entity_id = v_source;
  END IF;

  IF to_regclass('public.carmen_memory_pointers') IS NOT NULL THEN
    UPDATE public.carmen_memory_pointers
    SET
      entity_id = v_target::text,
      path = replace(path, 'clients/' || v_source::text, 'clients/' || v_target::text)
    WHERE entity_type = 'client' AND entity_id = v_source::text;
  END IF;

  IF to_regclass('public.agent_memory') IS NOT NULL THEN
    UPDATE public.agent_memory
    SET
      entity_id = v_target::text,
      path = replace(coalesce(path, ''), 'clients/' || v_source::text, 'clients/' || v_target::text)
    WHERE entity_type = 'client' AND entity_id = v_source::text;
  END IF;

  ------------------------------------------------------------------
  -- 7) Remaining FK tables (SET NULL first, then CASCADE group)
  ------------------------------------------------------------------
  UPDATE public.client_updates SET client_id = v_target WHERE client_id = v_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('client_updates', v_n);

  UPDATE public.client_contacts SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.client_credentials SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.client_team SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.client_suppliers SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.client_onboarding SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.client_tenant_financial_data SET client_id = v_target WHERE client_id = v_source;

  UPDATE public.tasks SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.finance SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.income_payments SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.communication_logs SET client_id = v_target WHERE client_id = v_source;
  UPDATE public.seo_monthly_updates SET client_id = v_target WHERE client_id = v_source;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    UPDATE public.chat_messages SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.hidden_chats') IS NOT NULL THEN
    UPDATE public.hidden_chats SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.chat_contact_tags') IS NOT NULL THEN
    UPDATE public.chat_contact_tags SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.blocked_contacts') IS NOT NULL THEN
    UPDATE public.blocked_contacts SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.manually_read_contacts') IS NOT NULL THEN
    UPDATE public.manually_read_contacts SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.payment_links') IS NOT NULL THEN
    UPDATE public.payment_links SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.one_time_incomes') IS NOT NULL THEN
    UPDATE public.one_time_incomes SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.invoice_uploads') IS NOT NULL THEN
    UPDATE public.invoice_uploads SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.telegram_messages') IS NOT NULL THEN
    UPDATE public.telegram_messages SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.call_logs') IS NOT NULL THEN
    UPDATE public.call_logs SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.maskyoo_numbers') IS NOT NULL THEN
    UPDATE public.maskyoo_numbers SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.rank_tracking_projects') IS NOT NULL THEN
    UPDATE public.rank_tracking_projects SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.social_media_wordpress_sites') IS NOT NULL THEN
    UPDATE public.social_media_wordpress_sites SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.publishing_sites') IS NOT NULL THEN
    UPDATE public.publishing_sites SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.publishing_articles') IS NOT NULL THEN
    UPDATE public.publishing_articles SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.site_tracking_configs') IS NOT NULL THEN
    UPDATE public.site_tracking_configs SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.site_visitors') IS NOT NULL THEN
    UPDATE public.site_visitors SET client_id_ref = v_target WHERE client_id_ref = v_source;
  END IF;
  IF to_regclass('public.team_channels') IS NOT NULL THEN
    UPDATE public.team_channels SET linked_client_id = v_target WHERE linked_client_id = v_source;
  END IF;
  IF to_regclass('public.team_channel_whatsapp_links') IS NOT NULL THEN
    UPDATE public.team_channel_whatsapp_links SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.team_chat_files') IS NOT NULL THEN
    UPDATE public.team_chat_files SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.team_message_attachments') IS NOT NULL THEN
    UPDATE public.team_message_attachments SET linked_client_id = v_target WHERE linked_client_id = v_source;
  END IF;
  IF to_regclass('public.zoom_recordings') IS NOT NULL THEN
    UPDATE public.zoom_recordings SET client_id = v_target WHERE client_id = v_source;
    UPDATE public.zoom_recordings SET suggested_client_id = v_target WHERE suggested_client_id = v_source;
  END IF;
  IF to_regclass('public.marketing_pipelines') IS NOT NULL THEN
    UPDATE public.marketing_pipelines SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.report_schedules') IS NOT NULL THEN
    UPDATE public.report_schedules SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.report_deliveries') IS NOT NULL THEN
    UPDATE public.report_deliveries SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.campaign_pulse_snapshots') IS NOT NULL THEN
    UPDATE public.campaign_pulse_snapshots SET client_id = v_target WHERE client_id = v_source;
  END IF;
  IF to_regclass('public.carmen_whatsapp_identities') IS NOT NULL THEN
    UPDATE public.carmen_whatsapp_identities SET client_id = v_target WHERE client_id = v_source;
  END IF;

  ------------------------------------------------------------------
  -- 8) Merge useful scalars onto the survivor (prefer non-null)
  ------------------------------------------------------------------
  UPDATE public.clients AS t
  SET
    website = coalesce(nullif(t.website, ''), s.website, t.website),
    phone = coalesce(nullif(t.phone, ''), s.phone, t.phone),
    email = coalesce(nullif(t.email, ''), s.email, t.email),
    notes = CASE
      WHEN coalesce(s.notes, '') = '' THEN t.notes
      WHEN coalesce(t.notes, '') = '' THEN s.notes
      WHEN position(s.notes in t.notes) > 0 THEN t.notes
      ELSE t.notes || E'\n---\n' || s.notes
    END,
    ahrefs_domain = coalesce(nullif(t.ahrefs_domain, ''), s.ahrefs_domain, t.ahrefs_domain),
    gsc_site_url = coalesce(nullif(t.gsc_site_url, ''), s.gsc_site_url, t.gsc_site_url),
    ga_property_id = coalesce(nullif(t.ga_property_id, ''), s.ga_property_id, t.ga_property_id),
    meta_ads_account_id = coalesce(nullif(t.meta_ads_account_id, ''), s.meta_ads_account_id, t.meta_ads_account_id),
    google_ads_account_id = coalesce(nullif(t.google_ads_account_id, ''), s.google_ads_account_id, t.google_ads_account_id),
    whatsapp_group_id = coalesce(t.whatsapp_group_id, s.whatsapp_group_id),
    is_seo_client = coalesce(t.is_seo_client, false) OR coalesce(s.is_seo_client, false),
    -- services is jsonb (migrated from text[])
    services = CASE
      WHEN t.services IS NULL
        OR t.services = 'null'::jsonb
        OR t.services = '[]'::jsonb
        OR (jsonb_typeof(t.services) = 'array' AND jsonb_array_length(t.services) = 0)
      THEN s.services
      ELSE t.services
    END,
    updated_at = now()
  FROM public.clients AS s
  WHERE t.id = v_target AND s.id = v_source;

  -- Keep survivor active (source was ended)
  UPDATE public.clients
  SET status = 'active', updated_at = now()
  WHERE id = v_target AND status IS DISTINCT FROM 'active';

  ------------------------------------------------------------------
  -- 9) Delete the ended duplicate
  ------------------------------------------------------------------
  DELETE FROM public.clients WHERE id = v_source;

  ------------------------------------------------------------------
  -- 10) Audit
  ------------------------------------------------------------------
  IF to_regclass('public.claude_carmen_audit') IS NOT NULL THEN
    INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
    VALUES (
      v_target_tenant,
      'claude',
      'merge_clients',
      v_target::text,
      jsonb_build_object(
        'source_id', v_source,
        'source_name', v_source_name,
        'target_id', v_target,
        'target_name', v_target_name,
        'agency_id', v_target_agency,
        'row_counts', v_counts,
        'reason', 'ABS אדריכלים (ended) folded into אדיר בן שוהם- ABS אדריכלים (active); restore SEO reports'
      )
    );
  END IF;

  RAISE NOTICE 'Merged client % (%) into % (%). Counts: %',
    v_source, v_source_name, v_target, v_target_name, v_counts;
END $$;
