-- CANDIDATE: untested; apply only to a fresh local Supabase database.
-- Production already has these objects: do not execute this baseline there.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."agency_status" AS ENUM (
    'active',
    'paused',
    'former'
);


ALTER TYPE "public"."agency_status" OWNER TO "postgres";


CREATE TYPE "public"."agent_memory_layer" AS ENUM (
    'working',
    'episodic',
    'semantic',
    'user_model'
);


ALTER TYPE "public"."agent_memory_layer" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'owner',
    'agency_owner',
    'team_manager',
    'campaigner',
    'sales_person',
    'super_admin',
    'seo'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."automation_action" AS ENUM (
    'webhook',
    'email',
    'notification',
    'update_status',
    'send_whatsapp',
    'create_manychat_subscriber',
    'send_greenapi_message',
    'add_lead_update',
    'add_client_update',
    'send_greenapi_to_campaigner',
    'create_task',
    'create_lead',
    'send_meta_whatsapp_message',
    'send_signature'
);


ALTER TYPE "public"."automation_action" OWNER TO "postgres";


CREATE TYPE "public"."automation_trigger" AS ENUM (
    'task_assigned',
    'task_status_changed',
    'lead_status_changed',
    'lead_created',
    'client_created',
    'client_status_changed',
    'onboarding_status_changed',
    'meeting_created',
    'task_calendar_created',
    'task_overdue',
    'meeting_day_after',
    'meeting_same_day',
    'inbound_webhook_task',
    'inbound_webhook_lead',
    'manual_command',
    'whatsapp_message_received',
    'carmen_whatsapp_session'
);


ALTER TYPE "public"."automation_trigger" OWNER TO "postgres";


CREATE TYPE "public"."chat_provider" AS ENUM (
    'manychat',
    'green_api',
    'internal',
    'manus_wa',
    'meta_whatsapp'
);


ALTER TYPE "public"."chat_provider" OWNER TO "postgres";


CREATE TYPE "public"."client_mood_status" AS ENUM (
    'happy',
    'wavering',
    'churn_risk',
    'not_progressing'
);


ALTER TYPE "public"."client_mood_status" OWNER TO "postgres";


CREATE TYPE "public"."client_status" AS ENUM (
    'active',
    'paused',
    'ended',
    'onboarding',
    'inactive'
);


ALTER TYPE "public"."client_status" OWNER TO "postgres";


CREATE TYPE "public"."client_tier" AS ENUM (
    'A',
    'B',
    'C'
);


ALTER TYPE "public"."client_tier" OWNER TO "postgres";


CREATE TYPE "public"."communication_status" AS ENUM (
    'normal',
    'sensitive',
    'complaint'
);


ALTER TYPE "public"."communication_status" OWNER TO "postgres";


CREATE TYPE "public"."finance_type" AS ENUM (
    'income',
    'expense'
);


ALTER TYPE "public"."finance_type" OWNER TO "postgres";


CREATE TYPE "public"."interaction_type" AS ENUM (
    'client_initiated',
    'campaigner_initiated',
    'call',
    'whatsapp',
    'meeting',
    'other',
    'system_alert'
);


ALTER TYPE "public"."interaction_type" OWNER TO "postgres";


CREATE TYPE "public"."job_priority" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."job_priority" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'queued',
    'running',
    'done',
    'failed',
    'dead_letter'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."job_type" AS ENUM (
    'user_action',
    'workflow',
    'integration',
    'heavy_job'
);


ALTER TYPE "public"."job_type" OWNER TO "postgres";


CREATE TYPE "public"."lead_response_status" AS ENUM (
    'no_answer_1',
    'no_answer_2',
    'no_answer_3',
    'no_answer_4',
    'denies_contact',
    'not_relevant',
    'in_progress'
);


ALTER TYPE "public"."lead_response_status" OWNER TO "postgres";


CREATE TYPE "public"."lead_source" AS ENUM (
    'website',
    'referral',
    'social_media',
    'paid_ads',
    'cold_call',
    'email_campaign',
    'event',
    'other',
    'whatsapp'
);


ALTER TYPE "public"."lead_source" OWNER TO "postgres";


CREATE TYPE "public"."lead_status" AS ENUM (
    'new',
    'contacted',
    'follow_up',
    'proposal_sent',
    'closed',
    'transferred_to_onboarding',
    'meeting_scheduled'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE TYPE "public"."marketing_approval_mode" AS ENUM (
    'manual',
    'auto',
    'hybrid'
);


ALTER TYPE "public"."marketing_approval_mode" OWNER TO "postgres";


CREATE TYPE "public"."marketing_item_status" AS ENUM (
    'draft',
    'in_progress',
    'waiting_approval',
    'approved',
    'published',
    'failed',
    'archived'
);


ALTER TYPE "public"."marketing_item_status" OWNER TO "postgres";


CREATE TYPE "public"."marketing_stage_type" AS ENUM (
    'strategy',
    'copy',
    'creative',
    'target_paid',
    'target_seo',
    'target_organic',
    'measurement'
);


ALTER TYPE "public"."marketing_stage_type" OWNER TO "postgres";


CREATE TYPE "public"."onboarding_status" AS ENUM (
    'research_meeting',
    'receiving_access',
    'setup_and_content',
    'campaign_live'
);


ALTER TYPE "public"."onboarding_status" OWNER TO "postgres";


CREATE TYPE "public"."org_type" AS ENUM (
    'root',
    'organization',
    'sub_organization'
);


ALTER TYPE "public"."org_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'card',
    'wire',
    'check'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."priority_level" AS ENUM (
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."priority_level" OWNER TO "postgres";


CREATE TYPE "public"."seo_monthly_status" AS ENUM (
    'up',
    'stable',
    'down'
);


ALTER TYPE "public"."seo_monthly_status" OWNER TO "postgres";


CREATE TYPE "public"."supplier_type" AS ENUM (
    'campaigner',
    'media',
    'design',
    'creative',
    'dev',
    'other'
);


ALTER TYPE "public"."supplier_type" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'open',
    'in_progress',
    'done'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."task_type" AS ENUM (
    'campaign',
    'collection',
    'creative',
    'other'
);


ALTER TYPE "public"."task_type" OWNER TO "postgres";


CREATE TYPE "public"."tenant_status" AS ENUM (
    'active',
    'inactive',
    'suspended',
    'trial'
);


ALTER TYPE "public"."tenant_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_memory_fts_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.fts := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,''));
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."agent_memory_fts_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_skills_update_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('simple',
      coalesce(NEW.name,'') || ' ' ||
      coalesce(NEW.description,'') || ' ' ||
      coalesce(array_to_string(NEW.trigger_phrases, ' '), '')
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ai_skills_update_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_leads"("p_lead_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.leads
  SET archived_at = now(),
      archived_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים להעביר לידים לארכיון';
  END IF;
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."archive_leads"("p_lead_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_role_by_email"("_email" "text", "_role" "public"."app_role") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = _email;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _user_id;
END;
$$;


ALTER FUNCTION "public"."assign_role_by_email"("_email" "text", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_apply_list_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r RECORD; v_statuses jsonb; v_sources jsonb;
BEGIN
  FOR r IN SELECT * FROM public.broadcast_list_rules
    WHERE enabled = true AND trigger = 'lead_created' AND tenant_id = NEW.tenant_id
  LOOP
    v_statuses := COALESCE(r.filter->'statusKeys', '[]'::jsonb);
    v_sources  := COALESCE(r.filter->'sources', '[]'::jsonb);
    IF jsonb_array_length(v_statuses) > 0 AND NOT (v_statuses ? COALESCE(NEW.status, '')) THEN CONTINUE; END IF;
    IF jsonb_array_length(v_sources) > 0 AND NOT (v_sources ? COALESCE(NEW.source::text, '')) THEN CONTINUE; END IF;
    INSERT INTO public.broadcast_list_members (list_id, tenant_id, entity_type, entity_id, name, phone, email, added_via)
    VALUES (r.list_id, NEW.tenant_id, 'lead', NEW.id, COALESCE(NEW.contact_name, NEW.company_name), NEW.phone, NEW.email, 'rule')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_apply_list_rules failed: %', SQLERRM;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."broadcast_apply_list_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_ai_skill_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.system_prompt   IS DISTINCT FROM OLD.system_prompt
    OR NEW.output_template IS DISTINCT FROM OLD.output_template
    OR NEW.allowed_tools   IS DISTINCT FROM OLD.allowed_tools
    OR NEW.triggers        IS DISTINCT FROM OLD.triggers
    OR NEW.steps           IS DISTINCT FROM OLD.steps
    OR NEW.goal            IS DISTINCT FROM OLD.goal
    OR NEW.constraints     IS DISTINCT FROM OLD.constraints
    OR NEW.handoff_slugs   IS DISTINCT FROM OLD.handoff_slugs
  ) THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bump_ai_skill_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.ai_skills
  set usage_count = coalesce(usage_count, 0) + 1,
      last_used_at = now()
  where slug = any(coalesce(p_slugs, '{}'::text[]))
    and (scope = 'global' or tenant_id = p_tenant_id);
$$;


ALTER FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") IS 'Increment usage_count/last_used_at for trigger-matched skins (called by run-ai-agent, fire-and-forget).';



CREATE OR REPLACE FUNCTION "public"."can_access_agency"("_user_id" "uuid", "_agency_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    is_super_admin(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = _agency_id
      AND a.tenant_id = get_user_tenant_id(_user_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM agency_tenant_access ata
      WHERE ata.agency_id = _agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(_user_id)
    )
$$;


ALTER FUNCTION "public"."can_access_agency"("_user_id" "uuid", "_agency_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_lead_archive"("_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = _tenant_id
          AND ur.role = 'owner'::app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
          AND tu.tenant_id = _tenant_id
          AND lower(tu.role) IN ('owner', 'admin')
      )
    );
$$;


ALTER FUNCTION "public"."can_manage_lead_archive"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_user_permissions"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  OR
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN tenant_users tu_manager ON tu_manager.user_id = ur.user_id
    JOIN tenant_users tu_target ON tu_target.tenant_id = tu_manager.tenant_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
      AND tu_target.user_id = target_user_id
  )
  OR
  target_user_id = auth.uid();
$$;


ALTER FUNCTION "public"."can_manage_user_permissions"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_cross_tenant_campaigner"("_campaigner_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigner_agencies ca
    JOIN public.agency_tenant_access ata ON ata.agency_id = ca.agency_id
    WHERE ca.campaigner_id = _campaigner_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$$;


ALTER FUNCTION "public"."can_view_cross_tenant_campaigner"("_campaigner_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_activate_system_graph"("p_version" "text", "p_expected_nodes" integer, "p_expected_edges" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_nodes integer;
  v_edges integer;
begin
  select count(*) into v_nodes from public.aios_graph_nodes where version = p_version;
  select count(*) into v_edges from public.aios_graph_edges where version = p_version;

  if v_nodes <> p_expected_nodes or v_edges <> p_expected_edges then
    update public.aios_graph_versions set status = 'failed' where version = p_version;
    raise exception 'Graph count mismatch: nodes %/%, edges %/%', v_nodes, p_expected_nodes, v_edges, p_expected_edges;
  end if;

  update public.aios_graph_versions set status = 'archived' where status = 'active';
  update public.aios_graph_versions
    set status = 'active', node_count = v_nodes, edge_count = v_edges, activated_at = now()
    where version = p_version and status = 'staging';

  if not found then
    raise exception 'Graph version % is not in staging state', p_version;
  end if;

  return jsonb_build_object('version', p_version, 'nodes', v_nodes, 'edges', v_edges, 'active', true);
end;
$$;


ALTER FUNCTION "public"."carmen_activate_system_graph"("p_version" "text", "p_expected_nodes" integer, "p_expected_edges" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_allowed_phones_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_new jsonb;
  v_old jsonb;
  v_phone text;
  v_integ uuid;
begin
  if new.action_type is distinct from 'carmen_whatsapp_session'
     or new.step_type is distinct from 'trigger' then
    return new;
  end if;
  v_new := coalesce(new.configuration -> 'carmen_allowed_phones', '[]'::jsonb);
  v_old := case when tg_op = 'UPDATE'
    then coalesce(old.configuration -> 'carmen_allowed_phones', '[]'::jsonb)
    else '[]'::jsonb end;
  if v_new = v_old then
    return new;
  end if;
  v_integ := nullif(new.configuration ->> 'carmen_integration_id', '')::uuid;
  for v_phone in select jsonb_array_elements_text(v_new)
  loop
    if not exists (
      select 1 from jsonb_array_elements_text(v_old) o(val)
      where regexp_replace(o.val, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    ) then
      perform public.carmen_send_activation(new.tenant_id, v_integ, v_phone);
    end if;
  end loop;
  return new;
exception when others then
  return new;
end;
$$;


ALTER FUNCTION "public"."carmen_allowed_phones_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_fix_campaigner_access"("p_campaigner_id" "uuid", "p_client_id" "uuid", "p_tenant" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_client    record;
  v_campaigner record;
  v_in_agency boolean;
  v_has_team  boolean;
  v_outcome   text;
  v_message   text;
begin
  select id, name, agency_id, tenant_id into v_client from public.clients where id = p_client_id;
  if v_client.id is null or v_client.tenant_id is distinct from p_tenant then
    return jsonb_build_object('outcome','error','message','client not found in this tenant');
  end if;

  select id, full_name, tenant_id into v_campaigner from public.campaigners where id = p_campaigner_id;
  if v_campaigner.id is null or v_campaigner.tenant_id is distinct from p_tenant then
    return jsonb_build_object('outcome','error','message','campaigner not found in this tenant');
  end if;

  -- LEGITIMACY: the campaigner must already belong to the client's agency.
  select exists(
    select 1 from public.campaigner_agencies
    where campaigner_id = p_campaigner_id and agency_id = v_client.agency_id
  ) into v_in_agency;

  select exists(
    select 1 from public.client_team
    where campaigner_id = p_campaigner_id and client_id = p_client_id
  ) into v_has_team;

  if not v_in_agency then
    -- Out of scope — REFUSE. Never widen beyond the campaigner's agencies.
    v_outcome := 'refused_out_of_scope';
    v_message := format('הקמפיינר %s אינו שייך לסוכנות של הלקוח %s — אסור להעלות גישה. הפנה את הבקשה לדוד.',
                        v_campaigner.full_name, v_client.name);
  elsif v_has_team then
    v_outcome := 'already_assigned';
    v_message := format('הקמפיינר %s כבר משויך ללקוח %s ב-client_team. אם עדיין לא רואה — ייתכן שהבעיה היא קישור הפרופיל (profiles.campaigner_id) או role חסר; הפנה לבדיקה.',
                        v_campaigner.full_name, v_client.name);
  else
    insert into public.client_team (client_id, campaigner_id) values (p_client_id, p_campaigner_id);
    v_outcome := 'granted';
    v_message := format('שויך הקמפיינר %s ללקוח %s (בתוך הסוכנות שלו). כעת יראה את הדוחות.',
                        v_campaigner.full_name, v_client.name);
  end if;

  insert into public.claude_carmen_audit (tenant_id, actor, action, target, details)
  values (p_tenant, 'carmen', 'fix_campaigner_access', v_client.name,
          jsonb_build_object('campaigner_id', p_campaigner_id, 'client_id', p_client_id,
                             'agency_id', v_client.agency_id, 'outcome', v_outcome));

  return jsonb_build_object(
    'outcome', v_outcome, 'message', v_message,
    'campaigner', v_campaigner.full_name, 'client', v_client.name,
    'in_agency', v_in_agency, 'already_assigned', v_has_team
  );
end;
$$;


ALTER FUNCTION "public"."carmen_fix_campaigner_access"("p_campaigner_id" "uuid", "p_client_id" "uuid", "p_tenant" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_identity_activation_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  new.updated_at := now();

  if new.status = 'approved' then
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
    new.verified_at := coalesce(new.verified_at, now());
  elsif new.status in ('rejected', 'revoked') then
    new.verified_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."carmen_identity_activation_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_memory_decay_episodes"("p_lambda" double precision DEFAULT 0.02) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.carmen_memory_episodes
  SET retention_score = GREATEST(0.0,
        (COALESCE(importance,5)::float / 10.0)
        * exp(-p_lambda * EXTRACT(EPOCH FROM (now() - COALESCE(last_accessed_at, created_at))) / 86400.0)
        * (1.0 + LEAST(2.0, log(GREATEST(1, COALESCE(access_count,0))+1)))
      ),
      updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."carmen_memory_decay_episodes"("p_lambda" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO 'pg_catalog'
    AS $_$
  select case
    when regexp_replace(value, '\D', '', 'g') ~ '^0[5-9][0-9]{8}$'
      then '972' || substr(regexp_replace(value, '\D', '', 'g'), 2)
    when regexp_replace(value, '\D', '', 'g') ~ '^[5-9][0-9]{8}$'
      then '972' || regexp_replace(value, '\D', '', 'g')
    else regexp_replace(value, '\D', '', 'g')
  end
$_$;


ALTER FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_outbox_enqueue"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_op TEXT;
  v_tenant_id UUID;
  v_entity_id TEXT;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_op := 'delete';
    v_entity_id := COALESCE((OLD.id)::text, '');
    v_tenant_id := (OLD.tenant_id);
    v_payload := to_jsonb(OLD);
  ELSE
    v_op := lower(TG_OP);
    v_entity_id := COALESCE((NEW.id)::text, '');
    v_tenant_id := (NEW.tenant_id);
    v_payload := to_jsonb(NEW);
  END IF;

  INSERT INTO public.carmen_memory_outbox (tenant_id, entity_type, entity_id, op, payload)
  VALUES (v_tenant_id, v_entity_type, v_entity_id, v_op, v_payload);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


ALTER FUNCTION "public"."carmen_outbox_enqueue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_query_system_graph"("p_query" "text", "p_depth" integer DEFAULT 2, "p_limit" integer DEFAULT 40) RETURNS TABLE("node_id" "text", "label" "text", "file_type" "text", "source_file" "text", "source_location" "text", "community_name" "text", "distance" integer, "connections" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with recursive active as (
    select version from public.aios_graph_versions where status = 'active' limit 1
  ), seeds as (
    select n.id
    from public.aios_graph_nodes n join active a using (version)
    where n.search_document @@ websearch_to_tsquery('simple', p_query)
       or lower(n.label) like '%' || lower(p_query) || '%'
       or lower(coalesce(n.source_file, '')) like '%' || lower(p_query) || '%'
    order by
      ts_rank(n.search_document, websearch_to_tsquery('simple', p_query)) desc,
      case when lower(n.label) = lower(p_query) then 0 else 1 end,
      n.label
    limit 8
  ), walk(node_id, distance) as (
    select id, 0 from seeds
    union
    select case when e.source_id = w.node_id then e.target_id else e.source_id end,
           w.distance + 1
    from walk w
    join active a on true
    join public.aios_graph_edges e
      on e.version = a.version and (e.source_id = w.node_id or e.target_id = w.node_id)
    where w.distance < least(greatest(p_depth, 0), 3)
  ), nearest as (
    select node_id, min(distance) as distance
    from walk group by node_id
    order by min(distance), node_id
    limit least(greatest(p_limit, 1), 80)
  )
  select n.id, n.label, n.file_type, n.source_file, n.source_location, n.community_name,
         nearest.distance,
         coalesce((
           select jsonb_agg(jsonb_build_object('relation', c.relation, 'node_id', c.connected_id) order by c.relation)
           from (
             select e.relation,
                    case when e.source_id = n.id then e.target_id else e.source_id end as connected_id
             from public.aios_graph_edges e
             where e.version = n.version and (e.source_id = n.id or e.target_id = n.id)
             order by e.weight desc nulls last, e.relation
             limit 20
           ) c
         ), '[]'::jsonb)
  from nearest
  join active a on true
  join public.aios_graph_nodes n on n.version = a.version and n.id = nearest.node_id
  order by nearest.distance, n.label;
$$;


ALTER FUNCTION "public"."carmen_query_system_graph"("p_query" "text", "p_depth" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carmen_send_activation"("p_tenant" "uuid", "p_integration" "uuid", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_bearer text;
  v_code text;
  v_id uuid;
  v_req bigint;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  if exists (select 1 from public.wa_lid_map where phone = v_digits) then
    return jsonb_build_object('ok', true, 'skipped', 'already_mapped');
  end if;

  if exists (
    select 1 from public.wa_pending_activations
    where tenant_id = p_tenant and phone = v_digits and status = 'pending'
      and created_at > now() - interval '48 hours'
  ) then
    return jsonb_build_object('ok', true, 'skipped', 'pending_exists');
  end if;

  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  insert into public.wa_pending_activations (tenant_id, integration_id, phone, code)
  values (p_tenant, p_integration, v_digits, v_code)
  returning id into v_id;

  select decrypted_secret into v_bearer
  from vault.decrypted_secrets where name = 'claude_mcp_bearer' limit 1;

  select net.http_post(
    url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-activate-phone',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_bearer, '')
    ),
    body := jsonb_build_object(
      'activation_id', v_id::text,
      'tenant_id', p_tenant::text,
      'integration_id', coalesce(p_integration::text, ''),
      'phone', v_digits,
      'code', v_code
    )
  ) into v_req;

  return jsonb_build_object('ok', true, 'activation_id', v_id, 'request_id', v_req);
end;
$$;


ALTER FUNCTION "public"."carmen_send_activation"("p_tenant" "uuid", "p_integration" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_circuit_breaker"("p_tenant_id" "uuid", "p_provider" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_record integration_health%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM integration_health
  WHERE tenant_id = p_tenant_id AND provider = p_provider;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_record.is_circuit_open THEN
    IF v_record.cooldown_until IS NOT NULL AND now() > v_record.cooldown_until THEN
      UPDATE integration_health SET is_circuit_open = false, consecutive_failures = 0
      WHERE tenant_id = p_tenant_id AND provider = p_provider;
      RETURN true;
    END IF;
    RETURN false;
  END IF;
  RETURN true;
END; $$;


ALTER FUNCTION "public"."check_circuit_breaker"("p_tenant_id" "uuid", "p_provider" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_idempotency"("p_tenant_id" "uuid", "p_event_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO processed_events (tenant_id, event_key)
  VALUES (p_tenant_id, p_event_key) ON CONFLICT (event_key) DO NOTHING;
  RETURN FOUND;
END; $$;


ALTER FUNCTION "public"."check_idempotency"("p_tenant_id" "uuid", "p_event_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_limit RECORD;
BEGIN
  SELECT * INTO v_limit FROM tenant_rate_limits WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type;
  IF NOT FOUND THEN RETURN TRUE; END IF;
  IF v_limit.window_start < now() - interval '1 minute' THEN
    UPDATE tenant_rate_limits SET current_count = 1, window_start = now() WHERE id = v_limit.id;
    RETURN TRUE;
  END IF;
  IF v_limit.current_count >= v_limit.max_per_minute THEN RETURN FALSE; END IF;
  UPDATE tenant_rate_limits SET current_count = current_count + 1 WHERE id = v_limit.id;
  RETURN TRUE;
END; $$;


ALTER FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text", "p_default_max" integer DEFAULT 300) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_max integer; v_count integer; v_window timestamptz;
BEGIN
  SELECT max_per_minute, current_count, window_start INTO v_max, v_count, v_window
  FROM tenant_rate_limits WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type;
  IF NOT FOUND THEN
    INSERT INTO tenant_rate_limits (tenant_id, resource_type, max_per_minute, current_count, window_start)
    VALUES (p_tenant_id, p_resource_type, p_default_max, 1, now()) ON CONFLICT (tenant_id, resource_type) DO NOTHING;
    RETURN true;
  END IF;
  IF v_window < now() - interval '1 minute' THEN
    UPDATE tenant_rate_limits SET current_count = 1, window_start = now()
    WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type; RETURN true;
  END IF;
  IF v_count >= v_max THEN RETURN false; END IF;
  UPDATE tenant_rate_limits SET current_count = current_count + 1
  WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type;
  RETURN true;
END; $$;


ALTER FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text", "p_default_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_campaign_pulse_delivery"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  local_now timestamp := timezone('Asia/Jerusalem', now());
  current_slot timestamp;
  affected_rows integer := 0;
BEGIN
  IF EXTRACT(ISODOW FROM local_now) <> 7 THEN
    RETURN false;
  END IF;

  IF local_now::time < time '07:20' OR local_now::time >= time '07:40' THEN
    RETURN false;
  END IF;

  current_slot := date_trunc('day', local_now) + interval '7 hours 30 minutes';

  UPDATE public.tenant_heartbeat_settings
  SET campaign_pulse_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      campaign_pulse_last_sent_at IS NULL
      OR timezone('Asia/Jerusalem', campaign_pulse_last_sent_at) < current_slot
    );
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;


ALTER FUNCTION "public"."claim_campaign_pulse_delivery"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_client_retention_delivery"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."claim_client_retention_delivery"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_health_digest_delivery"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  local_now timestamp := timezone('Asia/Jerusalem', now());
  current_slot timestamp;
  affected_rows integer := 0;
BEGIN
  IF EXTRACT(ISODOW FROM local_now) <> 7 THEN
    RETURN false;
  END IF;

  IF local_now::time < time '07:20' OR local_now::time >= time '07:50' THEN
    RETURN false;
  END IF;

  current_slot := date_trunc('day', local_now) + interval '7 hours 30 minutes';

  UPDATE public.tenant_heartbeat_settings
  SET health_digest_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND (
      health_digest_last_sent_at IS NULL
      OR timezone('Asia/Jerusalem', health_digest_last_sent_at) < current_slot
    );
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;


ALTER FUNCTION "public"."claim_health_digest_delivery"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_next_job"("p_job_types" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "job_type" "text", "priority" integer, "payload" "jsonb", "attempts" integer, "max_attempts" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue jq
  SET status = 'running', started_at = now(), attempts = jq.attempts + 1
  FROM (
    SELECT jq2.id FROM job_queue jq2
    WHERE jq2.status = 'queued'
      AND (p_job_types IS NULL OR jq2.job_type = ANY(p_job_types))
    ORDER BY jq2.priority ASC, jq2.created_at ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED
  ) sub
  WHERE jq.id = sub.id
  RETURNING jq.id, jq.tenant_id, jq.job_type, jq.priority, jq.payload, jq.attempts, jq.max_attempts;
END; $$;


ALTER FUNCTION "public"."claim_next_job"("p_job_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claude_notify_david"("p_message" "text", "p_tenant" "uuid" DEFAULT '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::"uuid", "p_chat_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_bearer text;
  v_req bigint;
begin
  select decrypted_secret into v_bearer
  from vault.decrypted_secrets where name = 'claude_mcp_bearer' limit 1;

  select net.http_post(
    url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/claude-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_bearer, '')
    ),
    body := jsonb_build_object('tenant_id', p_tenant::text, 'message', p_message)
            || case when p_chat_id is not null then jsonb_build_object('chat_id', p_chat_id) else '{}'::jsonb end
  ) into v_req;

  return jsonb_build_object('queued', true, 'request_id', v_req);
end;
$$;


ALTER FUNCTION "public"."claude_notify_david"("p_message" "text", "p_tenant" "uuid", "p_chat_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM processed_events WHERE processed_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $$;


ALTER FUNCTION "public"."cleanup_old_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM job_queue WHERE status IN ('done', 'dead_letter') AND finished_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $$;


ALTER FUNCTION "public"."cleanup_old_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_user_active_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id
  ) THEN
    DELETE FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id;
  END IF;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_user_active_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_update_documents_phone_call"("p_content" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN COALESCE(btrim(p_content), '') = '' THEN false
    WHEN p_content ~* '(לא|טרם|עוד לא)[[:space:]]+([^[:space:]]+[[:space:]]+){0,2}(לדבר|דיבר|שוחח)'
      OR p_content ~* 'אין[[:space:]]+מענה'
      OR p_content ~* '(הלקוח|הלקוחה)[[:space:]]+לא[[:space:]]+(ענה|ענתה)'
      THEN false
    ELSE p_content ~* '(דיברתי|דיברנו|דיברה|דיבר|שוחחתי|שוחחנו|שוחחה|שוחח).{0,40}(טלפונית|בטלפון|עם[[:space:]]+(הלקוח|הלקוחה))'
      OR p_content ~* '(טלפונית|בטלפון).{0,40}(דיברתי|דיברנו|דיברה|דיבר|שוחחתי|שוחחנו|שוחחה|שוחח)'
      OR p_content ~* '(שיחה טלפונית|שיחת טלפון).{0,30}(הלקוח|הלקוחה|לקוח|לקוחה)'
      OR p_content ~* 'בוצעה[[:space:]]+שיחה.{0,20}(הלקוח|הלקוחה|לקוח|לקוחה)'
  END;
$$;


ALTER FUNCTION "public"."client_update_documents_phone_call"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_success" boolean, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_attempts integer; v_max integer;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max FROM job_queue WHERE id = p_job_id;
  IF p_success THEN
    UPDATE job_queue SET status = 'done', finished_at = now() WHERE id = p_job_id;
  ELSE
    IF v_attempts >= v_max THEN
      UPDATE job_queue SET status = 'dead_letter', finished_at = now(), error = p_error WHERE id = p_job_id;
    ELSE
      UPDATE job_queue SET status = 'queued', error = p_error, started_at = NULL WHERE id = p_job_id;
    END IF;
  END IF;
END; $$;


ALTER FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_success" boolean, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_custom_fields_to_tenant"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.custom_fields (
    tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  )
  SELECT
    _target_tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  FROM public.custom_fields
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, entity_type, field_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."copy_custom_fields_to_tenant"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_tenant_template"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.custom_fields (
    tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  )
  SELECT
    _target_tenant_id, entity_type, field_key, field_label, field_type,
    is_required, is_visible, options, sort_order
  FROM public.custom_fields
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, entity_type, field_key) DO NOTHING;

  INSERT INTO public.menu_items (
    tenant_id, menu_key, original_label, custom_label, route, icon,
    sort_order, is_visible, category, parent_menu_key, badge, hidden_from_child_tenants
  )
  SELECT
    _target_tenant_id, menu_key, original_label, custom_label, route, icon,
    sort_order, is_visible, category, parent_menu_key, badge, hidden_from_child_tenants
  FROM public.menu_items
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;

  INSERT INTO public.tenant_terminology (tenant_id, term_key, custom_value)
  SELECT _target_tenant_id, term_key, custom_value
  FROM public.tenant_terminology
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, term_key) DO NOTHING;

  INSERT INTO public.lead_pipeline_stages (
    tenant_id, stage_key, label, color, sort_order, is_active
  )
  SELECT _target_tenant_id, stage_key, label, color, sort_order, is_active
  FROM public.lead_pipeline_stages
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;

  INSERT INTO public.lead_statuses (tenant_id, status_key, label, color, sort_order, is_active)
  SELECT _target_tenant_id, status_key, label, color, sort_order, is_active
  FROM public.lead_statuses
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, status_key) DO NOTHING;

  INSERT INTO public.tenant_settings (tenant_id, setting_key, setting_value)
  SELECT _target_tenant_id, setting_key, setting_value
  FROM public.tenant_settings
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  INSERT INTO public.automations (
    tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  )
  SELECT _target_tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  FROM public.automations
  WHERE tenant_id = _source_tenant_id;

END;
$$;


ALTER FUNCTION "public"."copy_tenant_template"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(DISTINCT l.id)::INTEGER
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND l.archived_at IS NULL
    AND (
      l.tenant_id = p_tenant_id
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    );
$$;


ALTER FUNCTION "public"."count_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_client_with_assignment"("p_tenant_id" "uuid", "p_agency_id" "uuid", "p_name" "text", "p_contact_name" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_folder_link" "text" DEFAULT NULL::"text", "p_retainer" numeric DEFAULT NULL::numeric, "p_monthly_budget" numeric DEFAULT NULL::numeric, "p_website" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_is_seo_client" boolean DEFAULT false, "p_services" "text"[] DEFAULT ARRAY[]::"text"[], "p_meta_ads_account_id" "text" DEFAULT NULL::"text", "p_google_ads_account_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_campaigner_id uuid;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_allowed :=
    public.is_super_admin(v_user_id)
    OR (
      p_tenant_id = public.get_user_tenant_id(v_user_id)
      AND (
        public.has_role(v_user_id, 'owner'::app_role)
        OR public.has_role(v_user_id, 'team_manager'::app_role)
        OR public.has_role(v_user_id, 'sales_person'::app_role)
        OR public.has_role(v_user_id, 'campaigner'::app_role)
      )
    );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to create clients in this tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.id = p_agency_id
      AND (
        a.tenant_id = p_tenant_id
        OR EXISTS (
          SELECT 1 FROM agency_tenant_access ata
          WHERE ata.agency_id = a.id
            AND ata.accessing_tenant_id = p_tenant_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Agency does not belong to this tenant';
  END IF;

  INSERT INTO public.clients (
    name, contact_name, agency_id, tenant_id, phone, email, folder_link,
    retainer, monthly_budget, website, notes, is_seo_client, services,
    meta_ads_account_id, google_ads_account_id
  ) VALUES (
    p_name, p_contact_name, p_agency_id, p_tenant_id, p_phone, p_email, p_folder_link,
    p_retainer, p_monthly_budget, p_website, p_notes, p_is_seo_client, to_jsonb(p_services),
    p_meta_ads_account_id, p_google_ads_account_id
  ) RETURNING id INTO v_client_id;

  v_campaigner_id := public.get_user_campaigner_id(v_user_id);
  IF v_campaigner_id IS NOT NULL THEN
    INSERT INTO public.client_team (client_id, campaigner_id)
    VALUES (v_client_id, v_campaigner_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_client_id;
END;
$$;


ALTER FUNCTION "public"."create_client_with_assignment"("p_tenant_id" "uuid", "p_agency_id" "uuid", "p_name" "text", "p_contact_name" "text", "p_phone" "text", "p_email" "text", "p_folder_link" "text", "p_retainer" numeric, "p_monthly_budget" numeric, "p_website" "text", "p_notes" "text", "p_is_seo_client" boolean, "p_services" "text"[], "p_meta_ads_account_id" "text", "p_google_ads_account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_next_recurring_task"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_task_id uuid;
  next_due_date date;
  next_target_date date;
  series_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM 'done'
     AND NEW.status = 'done'
     AND NEW.recurrence_frequency IS NOT NULL THEN
    next_due_date := public.next_task_recurrence_date(
      NEW.due_date,
      NEW.recurrence_frequency,
      NEW.recurrence_interval,
      CURRENT_DATE,
      NEW.recurrence_weekday,
      NEW.recurrence_monthday
    );
    next_target_date := CASE
      WHEN NEW.target_date IS NULL THEN NULL
      ELSE public.next_task_recurrence_date(
        NEW.target_date,
        NEW.recurrence_frequency,
        NEW.recurrence_interval,
        CURRENT_DATE,
        NEW.recurrence_weekday,
        NEW.recurrence_monthday
      )
    END;
    series_id := COALESCE(NEW.recurrence_series_id, NEW.id);

    INSERT INTO public.tasks (
      title,
      task_type,
      agency_id,
      client_id,
      lead_id,
      campaigner_id,
      sales_person_id,
      due_date,
      due_time,
      target_date,
      status,
      priority,
      notes,
      tenant_id,
      created_by,
      duration_minutes,
      sort_order,
      attachments,
      goal_id,
      assigned_agent,
      recurrence_frequency,
      recurrence_interval,
      recurrence_weekday,
      recurrence_monthday,
      recurrence_series_id,
      recurrence_previous_task_id
    )
    VALUES (
      NEW.title,
      NEW.task_type,
      NEW.agency_id,
      NEW.client_id,
      NEW.lead_id,
      NEW.campaigner_id,
      NEW.sales_person_id,
      next_due_date,
      NEW.due_time,
      next_target_date,
      'open',
      NEW.priority,
      NEW.notes,
      NEW.tenant_id,
      NEW.created_by,
      NEW.duration_minutes,
      NEW.sort_order,
      NEW.attachments,
      NEW.goal_id,
      NEW.assigned_agent,
      NEW.recurrence_frequency,
      NEW.recurrence_interval,
      NEW.recurrence_weekday,
      NEW.recurrence_monthday,
      series_id,
      NEW.id
    )
    ON CONFLICT (recurrence_previous_task_id) WHERE recurrence_previous_task_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO next_task_id;

    IF next_task_id IS NOT NULL THEN
      INSERT INTO public.task_checklist_items (
        task_id,
        tenant_id,
        title,
        is_done,
        sort_order,
        created_by
      )
      SELECT
        next_task_id,
        tenant_id,
        title,
        false,
        sort_order,
        created_by
      FROM public.task_checklist_items
      WHERE task_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_next_recurring_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crm_tables_fill_agency_from_client"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_agency uuid;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT c.agency_id INTO v_agency
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    IF v_agency IS NOT NULL THEN
      NEW.agency_id := v_agency;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."crm_tables_fill_agency_from_client"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_signature_by_token"("_token" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT public.decline_signature_by_token(_token, NULL::text); $$;


ALTER FUNCTION "public"."decline_signature_by_token"("_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_signature_by_token"("_token" "uuid", "_ip" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_doc public.signature_documents%ROWTYPE;
  v_document_id uuid;
BEGIN
  SELECT document_id INTO v_document_id FROM public.signature_recipients WHERE sign_token = _token;
  IF v_document_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  SELECT * INTO v_doc FROM public.signature_documents WHERE id = v_document_id FOR UPDATE;
  SELECT * INTO v_rec FROM public.signature_recipients WHERE sign_token = _token FOR UPDATE;
  IF v_rec.status <> 'pending' THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  IF v_doc.id IS NULL OR v_rec.tenant_id <> v_doc.tenant_id OR v_doc.is_template
    OR v_doc.status NOT IN ('pending','partially_signed') THEN RAISE EXCEPTION 'document_not_signable'; END IF;
  UPDATE public.signature_recipients SET status = 'declined', ip_address = COALESCE(_ip, ip_address) WHERE id = v_rec.id;
  UPDATE public.signature_documents SET status = 'cancelled', completed_at = NULL, updated_at = now() WHERE id = v_doc.id;
  PERFORM public.log_signature_event(v_doc.id, v_rec.id, 'declined', _ip, jsonb_build_object('email', v_rec.email, 'name', v_rec.name));
  RETURN jsonb_build_object('ok', true, 'document_id', v_doc.id, 'document_status', 'cancelled', 'tenant_id', v_doc.tenant_id);
END;
$$;


ALTER FUNCTION "public"."decline_signature_by_token"("_token" "uuid", "_ip" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_job"("p_tenant_id" "uuid", "p_job_type" "text", "p_priority" integer DEFAULT 5, "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_max_attempts" integer DEFAULT 3) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_job_id uuid; v_rate_ok boolean;
BEGIN
  v_rate_ok := check_rate_limit(p_tenant_id, p_job_type);
  IF NOT v_rate_ok THEN
    RAISE EXCEPTION 'Rate limit exceeded for tenant % on resource %', p_tenant_id, p_job_type;
  END IF;
  INSERT INTO job_queue (tenant_id, job_type, priority, status, payload, max_attempts)
  VALUES (p_tenant_id, p_job_type, p_priority, 'queued', p_payload, p_max_attempts)
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END; $$;


ALTER FUNCTION "public"."enqueue_job"("p_tenant_id" "uuid", "p_job_type" "text", "p_priority" integer, "p_payload" "jsonb", "p_max_attempts" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_agency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE agencies SET is_default = false 
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_agency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_report_table_account_id"("p_integration_type" "text", "p_settings" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
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


ALTER FUNCTION "public"."extract_report_table_account_id"("p_integration_type" "text", "p_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) RETURNS TABLE("table_id" "uuid", "client_id" "uuid", "slug" "text", "name" "text", "integration_type" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT ct.id, ct.client_id, ct.slug, ct.name, ct.integration_type
  FROM public.crm_tables ct
  WHERE ct.client_id = ANY(p_client_ids)
    AND EXISTS (
      SELECT 1 FROM public.crm_records r
      WHERE r.table_id = ct.id
        AND (r.data ? 'spend' OR r.data ? 'cost')
        AND (r.data ? 'campaign_name' OR r.data ? 'campaign_id')
      LIMIT 1
    );
$$;


ALTER FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) IS 'Campaign report tables for the given clients. Matches Meta (spend) and Google Ads (cost) synced CRM records.';



CREATE OR REPLACE FUNCTION "public"."format_client_mood_status_label"("status" "public"."client_mood_status") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN status IS NULL THEN 'לא הוגדר'
    WHEN status = 'happy'::public.client_mood_status THEN '😊 מבסוט / תקין'
    WHEN status = 'wavering'::public.client_mood_status THEN '😐 מתנדנד / רגיש'
    WHEN status = 'churn_risk'::public.client_mood_status THEN '😟 סכנת נטישה / תלונה'
    WHEN status = 'not_progressing'::public.client_mood_status THEN '😔 לא מתקדם'
    ELSE status::text
  END;
$$;


ALTER FUNCTION "public"."format_client_mood_status_label"("status" "public"."client_mood_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_tracking_id"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_id := 'mc_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    SELECT COUNT(*) INTO exists_count FROM site_tracking_configs WHERE tracking_id = new_id;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_tracking_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_carmen_memory_counts"("p_tenant_id" "uuid") RETURNS TABLE("pointer_count" bigint, "episode_count" bigint, "total_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select
    (select count(*) from public.carmen_memory_pointers where tenant_id = p_tenant_id),
    (select count(*) from public.carmen_memory_episodes where tenant_id = p_tenant_id),
    (select count(*) from public.carmen_memory_pointers where tenant_id = p_tenant_id)
      + (select count(*) from public.carmen_memory_episodes where tenant_id = p_tenant_id);
$$;


ALTER FUNCTION "public"."get_carmen_memory_counts"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_invite_by_token"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', i.id,
    'channel_id', i.channel_id,
    'token', i.token,
    'is_active', i.is_active,
    'tenant_id', i.tenant_id,
    'team_channels', jsonb_build_object(
      'name', c.name,
      'color', c.color
    )
  ) INTO result
  FROM public.team_channel_invites i
  LEFT JOIN public.team_channels c ON c.id = i.channel_id
  WHERE i.token = _token AND i.is_active = true
  LIMIT 1;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_channel_invite_by_token"("_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_contacts"() RETURNS TABLE("contact_id" "uuid", "contact_type" "text", "name" "text", "contact_name" "text", "phone" "text", "email" "text", "agency_id" "uuid", "agency_name" "text", "unread_count" bigint, "last_message_at" timestamp with time zone, "is_blocked" boolean, "manychat_subscriber_id" "text", "active_chat_provider" "public"."chat_provider")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
BEGIN
  current_tenant_id := get_user_tenant_id(auth.uid());
  current_user_id := auth.uid();
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients (only non-blocked)
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id 
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.client_id = c.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.client_id = c.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Leads (only non-blocked)
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.lead_id = l.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.lead_id = l.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Groups (only non-blocked)
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.group_id = g.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.group_id = g.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_chat_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("contact_id" "uuid", "contact_type" "text", "name" "text", "contact_name" "text", "phone" "text", "email" "text", "agency_id" "uuid", "agency_name" "text", "unread_count" bigint, "last_message_at" timestamp with time zone, "is_blocked" boolean, "manychat_subscriber_id" "text", "active_chat_provider" "public"."chat_provider", "whatsapp_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
BEGIN
  current_tenant_id := COALESCE(p_tenant_id, get_user_tenant_id(auth.uid()));
  current_user_id := auth.uid();
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients (only non-blocked)
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id 
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider,
    c.whatsapp_avatar_url
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.client_id = c.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.client_id = c.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Leads (only non-blocked)
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider,
    l.whatsapp_avatar_url
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.lead_id = l.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.lead_id = l.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Groups (only non-blocked)
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider,
    g.whatsapp_avatar_url
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.group_id = g.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.group_id = g.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid", "p_connection_user_ids" "uuid"[], "p_provider" "public"."chat_provider") RETURNS TABLE("contact_id" "uuid", "contact_type" "text", "name" "text", "contact_name" "text", "phone" "text", "email" "text", "agency_id" "uuid", "agency_name" "text", "unread_count" bigint, "last_message_at" timestamp with time zone, "is_blocked" boolean, "manychat_subscriber_id" "text", "active_chat_provider" "public"."chat_provider", "whatsapp_avatar_url" "text", "sender_phone" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  is_admin boolean;
  allowed_user_ids uuid[];
  user_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  is_admin := COALESCE(public.is_super_admin(current_user_id), false);
  current_tenant_id := public.get_user_tenant_id(current_user_id);

  -- Only a super admin may ask for a tenant other than their own.
  IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM current_tenant_id THEN
    IF NOT is_admin THEN
      RETURN;
    END IF;
    current_tenant_id := p_tenant_id;
  END IF;

  IF current_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Connection owners this caller may read: their own line, a line explicitly shared
  -- with them, and org-wide lines.
  SELECT array_agg(DISTINCT owners.owner_id)
  INTO allowed_user_ids
  FROM (
    SELECT current_user_id AS owner_id
    UNION
    SELECT ti.user_id
    FROM public.tenant_integrations ti
    WHERE ti.tenant_id = current_tenant_id
      AND ti.user_id IS NOT NULL
      AND (
        is_admin
        OR ti.user_id = current_user_id
        OR ti.connection_visibility = 'org'
        OR EXISTS (
          SELECT 1
          FROM public.integration_user_permissions iup
          WHERE iup.integration_id = ti.id
            AND iup.user_id = current_user_id
        )
      )
  ) owners;

  user_ids := CASE
    WHEN p_connection_user_ids IS NULL THEN ARRAY[current_user_id]
    ELSE ARRAY(
      SELECT unnest(p_connection_user_ids)
      INTERSECT
      SELECT unnest(COALESCE(allowed_user_ids, ARRAY[current_user_id]))
    )
  END;

  IF array_length(user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      c.id AS contact_id,
      'client'::text AS contact_type,
      c.name AS name,
      c.contact_name AS contact_name,
      c.phone AS phone,
      c.email AS email,
      c.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      c.manychat_subscriber_id AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      c.whatsapp_avatar_url AS whatsapp_avatar_url,
      c.phone AS sender_phone
    FROM public.clients c
    JOIN public.agencies a ON c.agency_id = a.id
    WHERE c.tenant_id = current_tenant_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.client_id = c.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    SELECT
      l.id AS contact_id,
      'lead'::text AS contact_type,
      l.company_name AS name,
      l.contact_name AS contact_name,
      l.phone AS phone,
      l.email AS email,
      l.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      l.manychat_subscriber_id AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      l.whatsapp_avatar_url AS whatsapp_avatar_url,
      l.phone AS sender_phone
    FROM public.leads l
    LEFT JOIN public.agencies a ON l.agency_id = a.id
    WHERE l.tenant_id = current_tenant_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.lead_id = l.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    SELECT
      g.id AS contact_id,
      'group'::text AS contact_type,
      g.group_name AS name,
      NULL::text AS contact_name,
      NULL::text AS phone,
      NULL::text AS email,
      g.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      NULL::text AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      g.whatsapp_avatar_url AS whatsapp_avatar_url,
      NULL::text AS sender_phone
    FROM public.whatsapp_groups g
    LEFT JOIN public.agencies a ON g.agency_id = a.id
    WHERE g.tenant_id = current_tenant_id
      AND g.is_blocked = false
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.group_id = g.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    -- Threads with a number that is not linked to a client, lead or group yet.
    SELECT
      md5(cm.sender_phone)::uuid AS contact_id,
      'unknown'::text AS contact_type,
      COALESCE((array_agg(NULLIF(cm.sender_name, '') ORDER BY cm.created_at DESC))[1], cm.sender_phone, 'Unknown') AS name,
      NULL::text AS contact_name,
      cm.sender_phone AS phone,
      NULL::text AS email,
      NULL::uuid AS agency_id,
      NULL::text AS agency_name,
      COUNT(*) FILTER (
        WHERE cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
      )::bigint AS unread_count,
      MAX(cm.created_at) AS last_message_at,
      false AS is_blocked,
      NULL::text AS manychat_subscriber_id,
      COALESCE(p_provider, (array_agg(cm.provider ORDER BY cm.created_at DESC))[1]) AS active_chat_provider,
      (array_agg((cm.raw_provider_data->>'senderProfileImage')::text ORDER BY cm.created_at DESC))[1] AS whatsapp_avatar_url,
      cm.sender_phone AS sender_phone
    FROM public.chat_messages cm
    WHERE cm.tenant_id = current_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.connection_user_id = ANY(user_ids)
      AND (p_provider IS NULL OR cm.provider = p_provider)
      AND cm.is_blocked = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.sender_phone = cm.sender_phone
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )
    GROUP BY cm.sender_phone
  ) sub
  ORDER BY sub.last_message_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid", "p_connection_user_ids" "uuid"[], "p_provider" "public"."chat_provider") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_tenant_id"("_client_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id FROM public.clients WHERE id = _client_id
$$;


ALTER FUNCTION "public"."get_client_tenant_id"("_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cron_job_history"("p_jobid" bigint, "p_limit" integer DEFAULT 50) RETURNS TABLE("runid" bigint, "start_time" timestamp with time zone, "end_time" timestamp with time zone, "status" "text", "return_message" "text", "duration_ms" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'cron'
    AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY SELECT d.runid, d.start_time, d.end_time, d.status, d.return_message,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000
  FROM cron.job_run_details d WHERE d.jobid = p_jobid ORDER BY d.start_time DESC LIMIT p_limit;
END; $$;


ALTER FUNCTION "public"."get_cron_job_history"("p_jobid" bigint, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cross_tenant_campaigner_ids"("p_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY_AGG(DISTINCT campaigner_id) FROM (
    SELECT ct.campaigner_id
    FROM client_team ct
    JOIN clients c ON c.id = ct.client_id
    WHERE user_manages_agency(p_user_id, c.agency_id)
      OR (c.agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata 
        WHERE ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
      ))
    UNION
    SELECT ca.campaigner_id
    FROM campaigner_agencies ca
    WHERE user_manages_agency(p_user_id, ca.agency_id)
  ) AS all_campaigners
$$;


ALTER FUNCTION "public"."get_cross_tenant_campaigner_ids"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_setting"("_tenant_id" "uuid", "_setting_key" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT setting_value FROM public.tenant_settings 
     WHERE tenant_id = _tenant_id AND setting_key = _setting_key),
    (SELECT setting_value FROM public.global_settings 
     WHERE setting_key = _setting_key)
  )
$$;


ALTER FUNCTION "public"."get_effective_setting"("_tenant_id" "uuid", "_setting_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_active_tenant WHERE user_id = auth.uid() LIMIT 1),
    (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."get_effective_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_effective_tenant_id"() IS 'Returns the effective tenant ID for the current user. Used by RLS policies to ensure tenant isolation.';



CREATE OR REPLACE FUNCTION "public"."get_latest_client_call_updates"("p_client_ids" "uuid"[]) RETURNS TABLE("client_id" "uuid", "last_client_call_at" timestamp with time zone, "last_client_call_by" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT ON (updates.client_id)
    updates.client_id,
    updates.created_at AS last_client_call_at,
    COALESCE(NULLIF(profiles.full_name, ''), profiles.email) AS last_client_call_by
  FROM public.client_updates AS updates
  LEFT JOIN public.profiles AS profiles ON profiles.id = updates.user_id
  WHERE updates.client_id = ANY (p_client_ids)
    AND (
      updates.update_type = 'call'
      OR (
        updates.update_type = 'weekly_update'
        AND public.client_update_documents_phone_call(updates.content)
      )
    )
  ORDER BY updates.client_id, updates.created_at DESC;
$$;


ALTER FUNCTION "public"."get_latest_client_call_updates"("p_client_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_lead_visitor_journey"("p_lead_id" "uuid") RETURNS TABLE("session_id" "uuid", "started_at" timestamp with time zone, "duration_seconds" integer, "page_count" integer, "utm_source" "text", "utm_medium" "text", "utm_campaign" "text", "referrer" "text", "landing_page" "text", "device_type" "text", "pages" "jsonb", "events" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id, s.started_at, s.duration_seconds, s.page_count,
    s.utm_source, s.utm_medium, s.utm_campaign, s.referrer, s.landing_page, s.device_type,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pv.page_url,'title', pv.page_title,'time_on_page', pv.time_on_page,'scroll_depth', pv.scroll_depth,'viewed_at', pv.viewed_at) ORDER BY pv.viewed_at) FROM site_pageviews pv WHERE pv.session_id = s.id),'[]'::jsonb) as pages,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name', e.event_name,'category', e.event_category,'label', e.event_label,'data', e.event_data,'occurred_at', e.occurred_at) ORDER BY e.occurred_at) FROM site_events e WHERE e.session_id = s.id),'[]'::jsonb) as events
  FROM site_sessions s
  JOIN site_visitors v ON s.visitor_id = v.id
  WHERE v.lead_id = p_lead_id
  ORDER BY s.started_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_lead_visitor_journey"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leads_by_stages"("p_tenant_id" "uuid", "p_agency_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_stages" "text"[] DEFAULT NULL::"text"[], "p_limit_per_stage" integer DEFAULT 50, "p_search_query" "text" DEFAULT NULL::"text", "p_from_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_sales_person_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_response_statuses" "text"[] DEFAULT NULL::"text"[], "p_follow_up_today" boolean DEFAULT false, "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_tag_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_offset_per_stage" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  stage_record RECORD;
  stage_leads JSONB;
  stage_count BIGINT;
  search_pattern TEXT;
  phone_digits TEXT;
  effective_start_date timestamp with time zone;
  effective_end_date timestamp with time zone;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    search_pattern := '%' || lower(p_search_query) || '%';
    IF length(regexp_replace(p_search_query, '\D', '', 'g')) >= 8 THEN
      phone_digits := right(regexp_replace(p_search_query, '\D', '', 'g'), 9);
    END IF;
  END IF;

  effective_start_date := COALESCE(p_start_date, p_from_date);
  effective_end_date := COALESCE(p_end_date, p_to_date);

  FOR stage_record IN
    SELECT id, stage_key, label, color, sort_order
    FROM lead_pipeline_stages
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY sort_order ASC
  LOOP
    IF p_stages IS NULL OR stage_record.stage_key = ANY(p_stages) THEN

      SELECT COUNT(*)
      INTO stage_count
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.archived_at IS NULL
        AND l.status = stage_record.stage_key
        AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
        AND (
          p_sales_person_ids IS NULL
          OR EXISTS (
            SELECT 1
            FROM lead_sales_people lsp
            WHERE lsp.lead_id = l.id
              AND lsp.tenant_id = l.tenant_id
              AND lsp.sales_person_id = ANY(p_sales_person_ids)
          )
        )
        AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
        AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
        AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
        AND (NOT p_follow_up_today OR l.follow_up_date <= CURRENT_DATE)
        AND (search_pattern IS NULL OR (
          lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
          lower(COALESCE(l.email, '')) LIKE search_pattern OR
          COALESCE(l.phone, '') LIKE search_pattern OR
          lower(COALESCE(l.campaign_name, '')) LIKE search_pattern OR
          (
            phone_digits IS NOT NULL
            AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE '%' || phone_digits || '%'
          )
        ))
        AND (p_tag_ids IS NULL OR EXISTS (
          SELECT 1
          FROM chat_contact_tags cct
          WHERE cct.lead_id = l.id
            AND cct.tag_id = ANY(p_tag_ids)
        ));

      SELECT COALESCE(jsonb_agg(lead_data ORDER BY
        CASE WHEN p_follow_up_today THEN (lead_data->>'follow_up_date') END ASC NULLS LAST,
        (lead_data->>'created_at') DESC
      ), '[]'::JSONB)
      INTO stage_leads
      FROM (
        SELECT jsonb_build_object(
          'id', l.id,
          'contact_name', l.contact_name,
          'company_name', l.company_name,
          'email', l.email,
          'phone', l.phone,
          'source', l.source,
          'first_source', l.first_source,
          'campaign_name', l.campaign_name,
          'status', l.status,
          'response_status', l.response_status,
          'notes', l.notes,
          'agency_id', l.agency_id,
          'sales_person_id', l.sales_person_id,
          'created_at', l.created_at,
          'first_created_at', l.first_created_at,
          'updated_at', l.updated_at,
          'follow_up_date', l.follow_up_date,
          'estimated_deal_value', l.estimated_deal_value,
          'won_date', l.won_date,
          'folder_link', l.folder_link,
          'industry', l.industry,
          'tenant_id', l.tenant_id,
          'manychat_subscriber_id', l.manychat_subscriber_id,
          'active_chat_provider', l.active_chat_provider,
          'whatsapp_avatar_url', l.whatsapp_avatar_url,
          'leadgen_id', NULL,
          'lead_sales_people', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('sales_person_id', lsp.sales_person_id))
             FROM lead_sales_people lsp
             WHERE lsp.lead_id = l.id AND lsp.tenant_id = l.tenant_id),
            '[]'::jsonb
          )
        ) as lead_data
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.archived_at IS NULL
          AND l.status = stage_record.stage_key
          AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
          AND (
            p_sales_person_ids IS NULL
            OR EXISTS (
              SELECT 1
              FROM lead_sales_people lsp
              WHERE lsp.lead_id = l.id
                AND lsp.tenant_id = l.tenant_id
                AND lsp.sales_person_id = ANY(p_sales_person_ids)
            )
          )
          AND (p_response_statuses IS NULL OR l.response_status = ANY(p_response_statuses))
          AND (effective_start_date IS NULL OR l.created_at >= effective_start_date)
          AND (effective_end_date IS NULL OR l.created_at <= effective_end_date)
          AND (NOT p_follow_up_today OR l.follow_up_date <= CURRENT_DATE)
          AND (search_pattern IS NULL OR (
            lower(COALESCE(l.contact_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.company_name, '')) LIKE search_pattern OR
            lower(COALESCE(l.email, '')) LIKE search_pattern OR
            COALESCE(l.phone, '') LIKE search_pattern OR
            lower(COALESCE(l.campaign_name, '')) LIKE search_pattern OR
            (
              phone_digits IS NOT NULL
              AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE '%' || phone_digits || '%'
            )
          ))
          AND (p_tag_ids IS NULL OR EXISTS (
            SELECT 1
            FROM chat_contact_tags cct
            WHERE cct.lead_id = l.id
              AND cct.tag_id = ANY(p_tag_ids)
          ))
        ORDER BY
          CASE WHEN p_follow_up_today THEN l.follow_up_date END ASC NULLS LAST,
          l.created_at DESC
        LIMIT p_limit_per_stage
        OFFSET p_offset_per_stage
      ) sub;

      result := result || jsonb_build_object(
        stage_record.stage_key,
        jsonb_build_object(
          'id', stage_record.id,
          'label', stage_record.label,
          'color', stage_record.color,
          'sort_order', stage_record.sort_order,
          'leads', stage_leads,
          'total_count', stage_count
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_leads_by_stages"("p_tenant_id" "uuid", "p_agency_ids" "uuid"[], "p_stages" "text"[], "p_limit_per_stage" integer, "p_search_query" "text", "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone, "p_sales_person_ids" "uuid"[], "p_response_statuses" "text"[], "p_follow_up_today" boolean, "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_tag_ids" "uuid"[], "p_offset_per_stage" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "source" "public"."lead_source" DEFAULT 'other'::"public"."lead_source" NOT NULL,
    "estimated_deal_value" numeric,
    "industry" "text",
    "notes" "text",
    "sales_person_id" "uuid",
    "agency_id" "uuid",
    "folder_link" "text",
    "lost_reason" "text",
    "won_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposal_sent_date" "date",
    "general_status" "text",
    "monthly_budget" numeric,
    "three_month_budget" numeric,
    "proposal_date" "date",
    "closing_date" "date",
    "products" "text",
    "sale_date" "date",
    "tenant_id" "uuid",
    "campaign_name" "text",
    "itai_meeting_date" "date",
    "manychat_subscriber_id" "text",
    "active_chat_provider" "public"."chat_provider",
    "meeting_set_date" timestamp with time zone,
    "meeting_date" "date",
    "meeting_time" "text",
    "meeting_location" "text",
    "meeting_reminder_day_after_sent_at" timestamp with time zone,
    "meeting_reminder_same_day_sent_at" timestamp with time zone,
    "response_status" "text",
    "whatsapp_avatar_url" "text",
    "status" "text" DEFAULT 'new'::"public"."lead_status" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "folder_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "follow_up_date" "date",
    "client_id" "uuid",
    "facebook_form_id" "text",
    "facebook_leadgen_id" "text",
    "form_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "form_qa_summary" "text",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "first_created_at" timestamp with time zone,
    "first_source" "public"."lead_source"
);

ALTER TABLE ONLY "public"."leads" REPLICA IDENTITY FULL;


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."products" IS 'Products/services discussed';



COMMENT ON COLUMN "public"."leads"."sale_date" IS 'Sale/contract date';



COMMENT ON COLUMN "public"."leads"."manychat_subscriber_id" IS 'ManyChat subscriber ID for WhatsApp integration';



COMMENT ON COLUMN "public"."leads"."response_status" IS 'Lead response status (סטטוס תגובה)';



COMMENT ON COLUMN "public"."leads"."status" IS 'Pipeline stage (שלב במשפך)';



COMMENT ON COLUMN "public"."leads"."follow_up_date" IS 'Date to follow up with this lead';



COMMENT ON COLUMN "public"."leads"."archived_at" IS 'When set, the lead is hidden from the pipeline and lives in the archive';



COMMENT ON COLUMN "public"."leads"."archived_by" IS 'User who archived the lead';



COMMENT ON COLUMN "public"."leads"."first_created_at" IS 'Original created_at; kept when a repeat inbound bumps created_at to the top of the list';



COMMENT ON COLUMN "public"."leads"."first_source" IS 'Original arrival source; kept when a later inbound arrives from a different channel';



CREATE OR REPLACE FUNCTION "public"."get_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."leads"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT l.*
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND l.archived_at IS NULL
    AND (
      l.tenant_id = p_tenant_id
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    )
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_signature_by_token"("_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  v_rec_id uuid;
  v_doc_id uuid;
  v_business_name text;
  v_company_id text;
BEGIN
  IF _token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT r.id, r.document_id INTO v_rec_id, v_doc_id
  FROM public.signature_recipients r
  WHERE r.sign_token = _token
  LIMIT 1;

  IF v_rec_id IS NOT NULL THEN
    UPDATE public.signature_recipients
    SET viewed_at = COALESCE(viewed_at, now())
    WHERE id = v_rec_id AND viewed_at IS NULL;

    IF FOUND THEN
      PERFORM public.log_signature_event(v_doc_id, v_rec_id, 'viewed', NULL, '{}'::jsonb);
    END IF;
  END IF;

  SELECT
    COALESCE(
      NULLIF(d.business_stamp_name, ''),
      NULLIF(c.name, ''),
      NULLIF(l.company_name, '')
    ),
    NULLIF(d.business_stamp_company_id, '')
  INTO v_business_name, v_company_id
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  LEFT JOIN public.clients c ON c.id = d.client_id
  LEFT JOIN public.leads l ON l.id = d.lead_id
  WHERE r.sign_token = _token
  LIMIT 1;

  SELECT jsonb_build_object(
    'id', r.id,
    'document_id', r.document_id,
    'name', r.name,
    'email', r.email,
    'status', r.status,
    'sign_order', r.sign_order,
    'sign_token', r.sign_token,
    'signature_position', r.signature_position,
    'field_values', COALESCE(r.field_values, '{}'::jsonb),
    'signed_at', r.signed_at,
    'viewed_at', r.viewed_at,
    'business_stamp', jsonb_build_object(
      'name', v_business_name,
      'company_id', v_company_id
    ),
    'signature_documents', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'file_url', d.file_url,
      'document_type', d.document_type,
      'status', d.status,
      'document_fields', COALESCE(d.document_fields, '[]'::jsonb),
      'client_id', d.client_id,
      'lead_id', d.lead_id,
      'business_stamp_name', d.business_stamp_name,
      'business_stamp_company_id', d.business_stamp_company_id
    )
  ) INTO result
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  WHERE r.sign_token = _token
  LIMIT 1;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_signature_by_token"("_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM (
    SELECT
      a.id,
      0 AS pri,
      CASE WHEN a.is_default THEN 0 ELSE 1 END AS sec,
      a.created_at
    FROM public.agencies a
    WHERE a.tenant_id = _tenant_id
      AND (a.status IS NULL OR a.status = 'active')
    UNION ALL
    SELECT
      ata.agency_id,
      1 AS pri,
      1 AS sec,
      ata.created_at
    FROM public.agency_tenant_access ata
    JOIN public.agencies a ON a.id = ata.agency_id
    WHERE ata.accessing_tenant_id = _tenant_id
      AND (a.status IS NULL OR a.status = 'active')
  ) x
  ORDER BY pri, sec, created_at
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") IS 'Owned default agency, else first owned, else first agency shared into the tenant';



CREATE OR REPLACE FUNCTION "public"."get_unknown_chat_contacts"() RETURNS TABLE("id" "text", "name" "text", "sender_phone" "text", "contact_type" "text", "last_message_at" timestamp with time zone, "unread_count" bigint, "is_blocked" boolean, "agency_id" "uuid", "agency_name" "text", "wid" "text", "whatsapp_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  effective_tenant_id UUID;
  current_user_id UUID;
BEGIN
  effective_tenant_id := get_effective_tenant_id();
  current_user_id := auth.uid();
  
  IF effective_tenant_id IS NULL OR current_user_id IS NULL THEN
    RAISE EXCEPTION 'No active tenant or user found';
  END IF;

  RETURN QUERY
  WITH phone_contacts AS (
    SELECT DISTINCT cm.sender_phone as phone
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
  ),
  inbound_names AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone as phone,
      cm.sender_name
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.sender_name IS NOT NULL
      AND cm.sender_phone IS NOT NULL
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  outbound_names AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone as phone,
      cm.raw_provider_data->'senderData'->>'chatName' as recipient_name
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'outbound'
      AND cm.sender_phone IS NOT NULL
      AND cm.raw_provider_data->'senderData'->>'chatName' IS NOT NULL
      AND cm.raw_provider_data->'senderData'->>'chatName' != ''
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  contact_avatars AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone as phone,
      cm.raw_provider_data->>'senderProfileImage' as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.connection_user_id = current_user_id
      AND cm.sender_phone IS NOT NULL
      AND cm.raw_provider_data->>'senderProfileImage' IS NOT NULL
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  campaigner_matches AS (
    SELECT 
      c.full_name as campaigner_name,
      substring(regexp_replace(c.phone, '[^0-9]', '', 'g') from '.{9}$') as normalized_phone
    FROM campaigners c
    WHERE c.tenant_id = effective_tenant_id
      AND c.phone IS NOT NULL
      AND c.phone != ''
  )
  SELECT 
    pc.phone::TEXT as id,
    COALESCE(
      (SELECT cm_match.campaigner_name 
       FROM campaigner_matches cm_match 
       WHERE cm_match.normalized_phone = substring(regexp_replace(pc.phone, '[^0-9]', '', 'g') from '.{9}$')
       LIMIT 1),
      inb.sender_name,
      outb.recipient_name,
      pc.phone
    ) as name,
    pc.phone as sender_phone,
    'unknown'::TEXT as contact_type,
    (SELECT MAX(cm.created_at) 
     FROM chat_messages cm 
     WHERE cm.sender_phone = pc.phone 
       AND cm.tenant_id = effective_tenant_id
       AND cm.connection_user_id = current_user_id) as last_message_at,
    (SELECT COUNT(*)::BIGINT 
     FROM chat_messages cm 
     WHERE cm.sender_phone = pc.phone 
       AND cm.tenant_id = effective_tenant_id
       AND cm.connection_user_id = current_user_id
       AND cm.read_at IS NULL 
       AND cm.direction = 'inbound') as unread_count,
    false as is_blocked,
    NULL::UUID as agency_id,
    NULL::TEXT as agency_name,
    NULL::TEXT as wid,
    ca.avatar_url as whatsapp_avatar_url
  FROM phone_contacts pc
  LEFT JOIN inbound_names inb ON inb.phone = pc.phone
  LEFT JOIN outbound_names outb ON outb.phone = pc.phone
  LEFT JOIN contact_avatars ca ON ca.phone = pc.phone
  WHERE NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.sender_phone = pc.phone
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = effective_tenant_id
  )
  ORDER BY last_message_at DESC NULLS LAST;
END;
$_$;


ALTER FUNCTION "public"."get_unknown_chat_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unknown_chat_contacts"("p_tenant_id" "uuid") RETURNS TABLE("id" "text", "name" "text", "sender_phone" "text", "contact_type" "text", "last_message_at" timestamp with time zone, "unread_count" bigint, "is_blocked" boolean, "agency_id" "uuid", "agency_name" "text", "wid" "text", "whatsapp_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF p_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH last_messages AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.created_at as last_message_at,
      (cm.raw_provider_data->>'senderProfileImage')::text as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  inbound_names AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.sender_name IS NOT NULL
      AND cm.sender_name != ''
      AND cm.is_blocked = false
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  unread_counts AS (
    SELECT
      cm.sender_phone,
      COUNT(*)::bigint AS unread_count
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.read_at IS NULL
      AND cm.is_blocked = false
    GROUP BY cm.sender_phone
  )
  SELECT
    lm.sender_phone::text AS id,
    COALESCE(inb.sender_name, lm.sender_phone) AS name,
    lm.sender_phone,
    'unknown'::text AS contact_type,
    lm.last_message_at,
    COALESCE(uc.unread_count, 0) AS unread_count,
    false AS is_blocked,
    NULL::uuid AS agency_id,
    NULL::text AS agency_name,
    NULL::text AS wid,
    lm.avatar_url AS whatsapp_avatar_url
  FROM last_messages lm
  LEFT JOIN inbound_names inb ON inb.sender_phone = lm.sender_phone
  LEFT JOIN unread_counts uc ON uc.sender_phone = lm.sender_phone
  ORDER BY lm.last_message_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_unknown_chat_contacts"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_agency_ids"("_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY_AGG(ca.agency_id)
  FROM public.profiles p
  JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
  WHERE p.id = _user_id
$$;


ALTER FUNCTION "public"."get_user_agency_ids"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_campaigner_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT campaigner_id FROM public.profiles WHERE id = _user_id
$$;


ALTER FUNCTION "public"."get_user_campaigner_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_client_ids"("_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH campaigner_clients AS (
    SELECT ct.client_id
    FROM public.profiles p
    JOIN public.client_team ct ON ct.campaigner_id = p.campaigner_id
    WHERE p.id = _user_id
      AND public.has_role(_user_id, 'campaigner'::app_role)
  ),
  seo_clients AS (
    SELECT c.id AS client_id
    FROM public.clients c
    WHERE public.user_has_seo_scope(_user_id)
      AND (
        c.is_seo_client = true
        OR c.services @> '["seo"]'::jsonb
      )
      AND (
        c.tenant_id = public.get_user_tenant_id(_user_id)
        OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
      )
  )
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT client_id),
    ARRAY[]::uuid[]
  )
  FROM (
    SELECT client_id FROM campaigner_clients
    UNION ALL
    SELECT client_id FROM seo_clients
  ) combined
$$;


ALTER FUNCTION "public"."get_user_client_ids"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_sales_person_agency_ids"("_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY_AGG(spa.agency_id)
  FROM public.profiles p JOIN public.sales_person_agencies spa ON spa.sales_person_id = p.sales_person_id
  WHERE p.id = _user_id
$$;


ALTER FUNCTION "public"."get_user_sales_person_agency_ids"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_sales_person_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT sales_person_id FROM public.profiles WHERE id = _user_id
$$;


ALTER FUNCTION "public"."get_user_sales_person_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id FROM (
    SELECT tenant_id FROM public.user_active_tenant WHERE user_id = _user_id
    UNION ALL
    SELECT tenant_id FROM public.tenant_users WHERE user_id = _user_id LIMIT 1
  ) sub LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_tenant_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_campaigner_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.tenant_users WHERE user_id = NEW.id LIMIT 1;
  IF NEW.campaigner_id IS NOT NULL AND (OLD.campaigner_id IS NULL OR OLD.campaigner_id != NEW.campaigner_id) THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'campaigner', v_tenant_id) ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  IF NEW.campaigner_id IS NULL AND OLD.campaigner_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_team WHERE campaigner_id = OLD.campaigner_id) THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'campaigner' AND tenant_id = v_tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_campaigner_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_client_onboarding_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE default_campaigner_id uuid;
BEGIN
  IF NEW.status = 'onboarding' AND (OLD.status IS NULL OR OLD.status != 'onboarding') THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_onboarding WHERE client_id = NEW.id AND status != 'campaign_live') THEN
      SELECT id INTO default_campaigner_id FROM public.campaigners WHERE full_name = 'דוד' AND active = true LIMIT 1;
      IF default_campaigner_id IS NULL THEN SELECT campaigner_id INTO default_campaigner_id FROM public.client_team WHERE client_id = NEW.id LIMIT 1; END IF;
      IF default_campaigner_id IS NULL THEN SELECT id INTO default_campaigner_id FROM public.campaigners WHERE active = true LIMIT 1; END IF;
      IF default_campaigner_id IS NOT NULL THEN
        INSERT INTO public.client_onboarding (client_id, agency_id, campaigner_id, title, status, notes, tenant_id)
        VALUES (NEW.id, NEW.agency_id, default_campaigner_id, 'קליטת לקוח: ' || NEW.name, 'research_meeting', 'נוצר אוטומטית מעדכון סטטוס לקוח', NEW.tenant_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_client_onboarding_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_lead_to_onboarding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE new_client_id uuid;
BEGIN
  IF NEW.status = 'closed' AND NEW.won_date IS NOT NULL AND (OLD.won_date IS NULL OR OLD.won_date != NEW.won_date)
     AND NOT EXISTS (SELECT 1 FROM public.clients WHERE name = NEW.company_name AND agency_id = NEW.agency_id AND notes LIKE 'נוצר מליד:%' AND created_at > NOW() - INTERVAL '5 minutes') THEN
    INSERT INTO public.clients (name, agency_id, email, phone, industry, notes, status, folder_link, tenant_id)
    VALUES (NEW.company_name, NEW.agency_id, NEW.email, NEW.phone, NEW.industry, 'נוצר מליד: ' || COALESCE(NEW.notes, ''), 'onboarding', NEW.folder_link, NEW.tenant_id) RETURNING id INTO new_client_id;
    INSERT INTO public.client_onboarding (client_id, agency_id, campaigner_id, title, status, notes, tenant_id)
    SELECT new_client_id, NEW.agency_id, (SELECT id FROM public.campaigners WHERE full_name = 'דוד' AND active = true LIMIT 1), 'קליטת לקוח: ' || NEW.company_name, 'research_meeting', 'נוצר אוטומטית מליד - נא לבחור קמפיינר', NEW.tenant_id
    WHERE EXISTS (SELECT 1 FROM public.campaigners WHERE full_name = 'דוד' AND active = true);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_lead_to_onboarding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_tenant_lead_statuses"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN PERFORM initialize_tenant_lead_statuses(NEW.id); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."handle_new_tenant_lead_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_tenant_menu_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN PERFORM initialize_tenant_menu_items(NEW.id); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."handle_new_tenant_menu_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_tenant_pipeline_stages"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN PERFORM initialize_tenant_pipeline_stages(NEW.id); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."handle_new_tenant_pipeline_stages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv    public.invitation_tokens%ROWTYPE;
  v_meta   jsonb;
  v_role   text;
  v_tenant uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Merge any pre-provisioned orphan profile with the same email.
  BEGIN
    PERFORM public.merge_orphan_profile_by_email(NEW.id, NEW.email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user orphan merge failed for %: %', NEW.email, SQLERRM;
  END;

  BEGIN
    SELECT * INTO v_inv
    FROM public.invitation_tokens
    WHERE lower(email) = lower(NEW.email)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inv.id IS NOT NULL AND v_inv.tenant_id IS NOT NULL THEN
      v_meta   := COALESCE(v_inv.metadata, '{}'::jsonb);
      v_role   := NULLIF(v_meta->>'role', '');
      v_tenant := v_inv.tenant_id;

      INSERT INTO public.tenant_users (user_id, tenant_id, role)
      SELECT NEW.id, v_tenant, COALESCE(v_role, 'member')
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE user_id = NEW.id AND tenant_id = v_tenant
      );

      INSERT INTO public.user_active_tenant (user_id, tenant_id)
      SELECT NEW.id, v_tenant
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_active_tenant WHERE user_id = NEW.id
      );

      IF v_role IS NOT NULL THEN
        BEGIN
          INSERT INTO public.user_roles (user_id, role, tenant_id)
          VALUES (NEW.id, v_role::public.app_role, v_tenant)
          ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'handle_new_user: bad role % for %: %', v_role, NEW.email, SQLERRM;
        END;
      END IF;

      IF jsonb_typeof(v_meta->'modulePermissions') = 'array' THEN
        INSERT INTO public.user_permissions (user_id, module, can_access)
        SELECT NEW.id, m.value, true
        FROM jsonb_array_elements_text(v_meta->'modulePermissions') AS m(value)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_permissions up
          WHERE up.user_id = NEW.id AND up.module = m.value
        );
      END IF;

      IF NULLIF(v_meta->>'campaignerId', '') IS NOT NULL THEN
        UPDATE public.profiles SET campaigner_id = (v_meta->>'campaignerId')::uuid WHERE id = NEW.id;
      END IF;
      IF NULLIF(v_meta->>'salesPersonId', '') IS NOT NULL THEN
        UPDATE public.profiles SET sales_person_id = (v_meta->>'salesPersonId')::uuid WHERE id = NEW.id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user auto-link failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_onboarding_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'campaign_live' AND (OLD.status IS NULL OR OLD.status != 'campaign_live') THEN
    UPDATE public.clients SET status = 'active' WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_onboarding_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sales_person_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.tenant_users WHERE user_id = NEW.id LIMIT 1;
  IF NEW.sales_person_id IS NOT NULL AND (OLD.sales_person_id IS NULL OR OLD.sales_person_id != NEW.sales_person_id) THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'sales_person', v_tenant_id) ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  IF NEW.sales_person_id IS NULL AND OLD.sales_person_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'sales_person' AND tenant_id = v_tenant_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sales_person_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_finance_permission"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND module = 'finance_view' AND can_access = true)
  OR has_role(_user_id, 'owner'::app_role) OR is_super_admin(_user_id)
$$;


ALTER FUNCTION "public"."has_finance_permission"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = _role AND ( (_role = 'super_admin' AND ur.tenant_id IS NULL) OR ur.tenant_id = public.get_user_tenant_id(_user_id) OR ( ur.tenant_id IS NULL AND EXISTS ( SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = _user_id AND tu.tenant_id = public.get_user_tenant_id(_user_id) AND tu.role::text = _role::text ) ) ) ) $$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_skill_usage"("skill_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.ai_skills SET usage_count = usage_count + 1, last_used_at = now() WHERE id = ANY(skill_ids);
$$;


ALTER FUNCTION "public"."increment_skill_usage"("skill_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_all_tenants_menu_items"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE t RECORD;
BEGIN FOR t IN SELECT id FROM public.tenants LOOP PERFORM public.initialize_tenant_menu_items(t.id); END LOOP; END;
$$;


ALTER FUNCTION "public"."initialize_all_tenants_menu_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_default_custom_fields"("_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE source_tenant_id uuid;
BEGIN
  SELECT id INTO source_tenant_id FROM public.tenants WHERE slug = 'marketingcaptain' LIMIT 1;
  IF source_tenant_id IS NOT NULL THEN PERFORM copy_custom_fields_to_tenant(source_tenant_id, _tenant_id); END IF;
END;
$$;


ALTER FUNCTION "public"."initialize_default_custom_fields"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_default_pipeline_stages"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order)
  VALUES
    (p_tenant_id, 'new', 'חדש', '#3B82F6', 1), (p_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2),
    (p_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3), (p_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4),
    (p_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5), (p_tenant_id, 'won', 'נסגר בהצלחה', '#22C55E', 6),
    (p_tenant_id, 'lost', 'אבוד', '#EF4444', 7)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_default_pipeline_stages"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_tenant_lead_statuses"("_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.lead_statuses (tenant_id, status_key, label, color, sort_order)
  VALUES
    (_tenant_id, 'no_status', 'ללא סטטוס', '#9ca3af', 0), (_tenant_id, 'no_answer_1', 'אין מענה 1', '#fbbf24', 1),
    (_tenant_id, 'no_answer_2', 'אין מענה 2', '#f97316', 2), (_tenant_id, 'no_answer_3', 'אין מענה 3', '#ef4444', 3),
    (_tenant_id, 'no_answer_4', 'אין מענה 4', '#dc2626', 4), (_tenant_id, 'in_progress', 'בעבודה', '#3b82f6', 5),
    (_tenant_id, 'denies_contact', 'מכחיש פניה', '#8b5cf6', 6), (_tenant_id, 'not_relevant', 'לא רלוונטי', '#6b7280', 7)
  ON CONFLICT (tenant_id, status_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_lead_statuses"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_tenant_menu_items"("_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
  VALUES
    -- Main menu items
    (_tenant_id, 'agencies', 'סוכנויות', '/agencies', 'Building2', 1, true, 'main', NULL),
    (_tenant_id, 'clients', 'לקוחות', '/clients', 'Users', 2, true, 'main', NULL),
    (_tenant_id, 'tasks', 'משימות', '/tasks', 'CheckSquare', 3, true, 'main', NULL),
    (_tenant_id, 'client-onboarding', 'לקוחות בקליטה', '/client-onboarding', 'UserPlus', 4, true, 'main', NULL),
    (_tenant_id, 'time-tracking', 'שעון נוכחות', '/time-tracking', 'Clock', 5, true, 'main', NULL),
    (_tenant_id, 'campaigners', 'צוות', '/campaigners', 'Megaphone', 6, true, 'main', NULL),
    (_tenant_id, 'users', 'ניהול משתמשים', '/users', 'ShieldCheck', 7, true, 'main', NULL),
    (_tenant_id, 'my-profile', 'אזור אישי', '/my-profile', 'User', 8, true, 'main', NULL),
    (_tenant_id, 'chat', 'צ''אט', '/chat', 'MessageCircle', 9, true, 'main', NULL),
    
    -- Management group
    (_tenant_id, 'management', 'ניהול', '#', 'Settings', 100, true, 'group', NULL),
    (_tenant_id, 'dashboard', 'דשבורד', '/dashboard', 'LayoutDashboard', 101, true, 'management', 'management'),
    (_tenant_id, 'finance', 'כספים', '/finance', 'DollarSign', 102, true, 'management', 'management'),
    (_tenant_id, 'reports', 'דוחות', '/reports', 'BarChart3', 103, true, 'management', 'management'),
    (_tenant_id, 'suppliers', 'ספקים', '/suppliers', 'Truck', 104, true, 'management', 'management'),
    (_tenant_id, 'automations', 'אוטומציות', '/automations', 'Zap', 105, true, 'management', 'management'),
    (_tenant_id, 'tenants', 'ניהול ארגונים', '/tenants', 'Building', 106, true, 'management', 'management'),
    (_tenant_id, 'branding', 'התאמת מערכת', '/branding', 'Palette', 107, true, 'management', 'management'),
    (_tenant_id, 'accounting-integrations', 'הנהלת חשבונות', '/accounting-integrations', 'Building', 108, true, 'management', 'management'),
    (_tenant_id, 'ai-support', 'תמיכה טכנית AI', '/ai-support', 'Bot', 109, true, 'management', 'management'),
    (_tenant_id, 'menu-management', 'ניהול תפריטים', '/menu-management', 'Menu', 110, true, 'management', 'management'),
    (_tenant_id, 'fields-management', 'ניהול שדות', '/fields-management', 'ListTree', 111, true, 'management', 'management'),
    
    -- Sales group
    (_tenant_id, 'sales', 'ניהול מכירות', '#', 'TrendingUp', 200, true, 'group', NULL),
    (_tenant_id, 'sales-dashboard', 'דשבורד מכירות', '/sales-dashboard', 'TrendingUp', 201, true, 'sales', 'sales'),
    (_tenant_id, 'leads', 'לידים', '/leads', 'Target', 202, true, 'sales', 'sales'),
    (_tenant_id, 'products', 'מוצרים ושירותים', '/products', 'Package', 203, true, 'sales', 'sales'),
    (_tenant_id, 'sales-people', 'אנשי מכירות', '/sales-people', 'UserCheck', 204, true, 'sales', 'sales'),
    (_tenant_id, 'integrations', 'אינטגרציות', '/integrations', 'Plug', 206, true, 'sales', 'sales')
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_menu_items"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_tenant_pipeline_stages"("_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order, is_active)
  VALUES
    (_tenant_id, 'new', 'חדש', '#3B82F6', 1, true), (_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2, true),
    (_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3, true), (_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4, true),
    (_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5, true), (_tenant_id, 'closed', 'נסגר', '#22C55E', 6, true)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_pipeline_stages"("_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_tenant_terminology"("_tenant_id" "uuid", "_business_type" "text" DEFAULT 'marketing_agency'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _terms JSONB;
BEGIN
  IF _business_type = 'general_business' THEN
    _terms := '[{"key":"agency","singular":"מחלקה","plural":"מחלקות","orig_s":"סוכנות","orig_p":"סוכנויות"},{"key":"client","singular":"לקוח","plural":"לקוחות","orig_s":"לקוח","orig_p":"לקוחות"},{"key":"lead","singular":"ליד","plural":"לידים","orig_s":"ליד","orig_p":"לידים"},{"key":"task","singular":"משימה","plural":"משימות","orig_s":"משימה","orig_p":"משימות"},{"key":"campaigner","singular":"עובד","plural":"עובדים","orig_s":"קמפיינר","orig_p":"קמפיינרים"},{"key":"sales_person","singular":"איש מכירות","plural":"אנשי מכירות","orig_s":"איש מכירות","orig_p":"אנשי מכירות"},{"key":"supplier","singular":"ספק","plural":"ספקים","orig_s":"ספק","orig_p":"ספקים"},{"key":"product","singular":"מוצר","plural":"מוצרים","orig_s":"מוצר","orig_p":"מוצרים"},{"key":"onboarding","singular":"קליטה","plural":"קליטות","orig_s":"קליטה","orig_p":"קליטות"},{"key":"role_owner","singular":"בעלים","plural":"בעלים","orig_s":"בעלים","orig_p":"בעלים"},{"key":"role_team_manager","singular":"מנהל","plural":"מנהלים","orig_s":"מנהל צוות","orig_p":"מנהלי צוות"},{"key":"role_campaigner","singular":"עובד","plural":"עובדים","orig_s":"קמפיינר","orig_p":"קמפיינרים"},{"key":"role_sales_person","singular":"איש מכירות","plural":"אנשי מכירות","orig_s":"איש מכירות","orig_p":"אנשי מכירות"},{"key":"role_seo","singular":"מנהל פרויקט","plural":"מנהלי פרויקטים","orig_s":"SEO","orig_p":"SEO"},{"key":"role_super_admin","singular":"מנהל מערכת","plural":"מנהלי מערכת","orig_s":"סופר אדמין","orig_p":"סופר אדמינים"},{"key":"task_tab_all","singular":"כל המשימות","plural":"כל המשימות","orig_s":"כל המשימות","orig_p":"כל המשימות"},{"key":"task_tab_seo","singular":"משימות פרויקט","plural":"משימות פרויקט","orig_s":"משימות ללקוחות","orig_p":"משימות ללקוחות"},{"key":"task_tab_campaign","singular":"משימות כלליות","plural":"משימות כלליות","orig_s":"משימות ללידים","orig_p":"משימות ללידים"}]'::JSONB;
  ELSE
    _terms := '[{"key":"agency","singular":"סוכנות","plural":"סוכנויות","orig_s":"סוכנות","orig_p":"סוכנויות"},{"key":"client","singular":"לקוח","plural":"לקוחות","orig_s":"לקוח","orig_p":"לקוחות"},{"key":"lead","singular":"ליד","plural":"לידים","orig_s":"ליד","orig_p":"לידים"},{"key":"task","singular":"משימה","plural":"משימות","orig_s":"משימה","orig_p":"משימות"},{"key":"campaigner","singular":"קמפיינר","plural":"קמפיינרים","orig_s":"קמפיינר","orig_p":"קמפיינרים"},{"key":"sales_person","singular":"איש מכירות","plural":"אנשי מכירות","orig_s":"איש מכירות","orig_p":"אנשי מכירות"},{"key":"supplier","singular":"ספק","plural":"ספקים","orig_s":"ספק","orig_p":"ספקים"},{"key":"product","singular":"מוצר","plural":"מוצרים","orig_s":"מוצר","orig_p":"מוצרים"},{"key":"onboarding","singular":"קליטה","plural":"קליטות","orig_s":"קליטה","orig_p":"קליטות"},{"key":"role_owner","singular":"בעלים","plural":"בעלים","orig_s":"בעלים","orig_p":"בעלים"},{"key":"role_team_manager","singular":"מנהל צוות","plural":"מנהלי צוות","orig_s":"מנהל צוות","orig_p":"מנהלי צוות"},{"key":"role_campaigner","singular":"קמפיינר","plural":"קמפיינרים","orig_s":"קמפיינר","orig_p":"קמפיינרים"},{"key":"role_sales_person","singular":"איש מכירות","plural":"אנשי מכירות","orig_s":"איש מכירות","orig_p":"אנשי מכירות"},{"key":"role_seo","singular":"SEO","plural":"SEO","orig_s":"SEO","orig_p":"SEO"},{"key":"role_super_admin","singular":"סופר אדמין","plural":"סופר אדמינים","orig_s":"סופר אדמין","orig_p":"סופר אדמינים"},{"key":"task_tab_all","singular":"כל המשימות","plural":"כל המשימות","orig_s":"כל המשימות","orig_p":"כל המשימות"},{"key":"task_tab_seo","singular":"משימות ללקוחות","plural":"משימות ללקוחות","orig_s":"משימות ללקוחות","orig_p":"משימות ללקוחות"},{"key":"task_tab_campaign","singular":"משימות ללידים","plural":"משימות ללידים","orig_s":"משימות ללידים","orig_p":"משימות ללידים"}]'::JSONB;
  END IF;
  INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
  SELECT _tenant_id, term->>'key', term->>'singular', term->>'plural', term->>'orig_s', term->>'orig_p'
  FROM jsonb_array_elements(_terms) AS term
  ON CONFLICT (tenant_id, term_key) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_terminology"("_tenant_id" "uuid", "_business_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_tenant_terminology_from_preset"("_tenant_id" "uuid", "_preset_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _preset RECORD; _term JSONB;
BEGIN
  SELECT * INTO _preset FROM terminology_presets WHERE id = _preset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preset not found'; END IF;
  FOR _term IN SELECT * FROM jsonb_array_elements(_preset.terms) LOOP
    INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
    VALUES (_tenant_id, _term->>'key', _term->>'singular', _term->>'plural', _term->>'singular', _term->>'plural')
    ON CONFLICT (tenant_id, term_key) DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_terminology_from_preset"("_tenant_id" "uuid", "_preset_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_automation_shared_to_tenant"("_automation_id" "uuid", "_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.automation_shared_tenants WHERE automation_id = _automation_id AND tenant_id = _tenant_id)
$$;


ALTER FUNCTION "public"."is_automation_shared_to_tenant"("_automation_id" "uuid", "_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_channel_member"("p_channel_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_channel_members WHERE channel_id = p_channel_id AND user_id = p_user_id AND tenant_id = get_user_tenant_id(p_user_id))
$$;


ALTER FUNCTION "public"."is_channel_member"("p_channel_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_root_tenant"("tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND parent_tenant_id IS NOT NULL);
$$;


ALTER FUNCTION "public"."is_root_tenant"("tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_seo_staff"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.campaigners c ON c.id = p.campaigner_id
    WHERE p.id = _user_id AND c.role @> ARRAY['SEO']::text[]
      AND NOT (c.role @> ARRAY['קמפיינר']::text[] OR c.role @> ARRAY['מנהל צוות']::text[])
  )
$$;


ALTER FUNCTION "public"."is_seo_staff"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin' AND tenant_id IS NULL)
$$;


ALTER FUNCTION "public"."is_super_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_admin_of_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automations a JOIN public.user_roles ur ON ur.tenant_id = a.tenant_id AND ur.user_id = _user_id
    WHERE a.id = _automation_id AND ur.role IN ('owner'::app_role, 'team_manager'::app_role, 'agency_owner'::app_role)
  )
$$;


ALTER FUNCTION "public"."is_user_admin_of_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_in_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automations a JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE a.id = _automation_id AND tu.user_id = _user_id
  )
$$;


ALTER FUNCTION "public"."is_user_in_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kb_match_pointers"("p_tenant_id" "uuid", "p_query_embedding" "public"."vector", "p_category" "text" DEFAULT NULL::"text", "p_since_days" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "category" "text", "subcategory" "text", "path" "text", "entity_type" "text", "entity_id" "text", "title" "text", "summary" "text", "ref_date" timestamp with time zone, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id, p.category, p.subcategory, p.path, p.entity_type, p.entity_id, p.title, p.summary, p.ref_date,
         1 - (p.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.carmen_memory_pointers p
  WHERE p.tenant_id = p_tenant_id AND p.summary_embedding IS NOT NULL
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_since_days IS NULL OR p.ref_date >= now() - (p_since_days || ' days')::interval)
  ORDER BY p.summary_embedding <=> p_query_embedding LIMIT p_limit;
$$;


ALTER FUNCTION "public"."kb_match_pointers"("p_tenant_id" "uuid", "p_query_embedding" "public"."vector", "p_category" "text", "p_since_days" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kick_internal_function"("p_function" "text", "p_body" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
DECLARE
  project_url text;
  worker_secret text;
  request_id bigint;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_function NOT IN (
    'cron-sync-google-ads',
    'cron-sync-facebook-insights',
    'cron-sync-facebook-ecommerce',
    'cron-sync-google-analytics'
  ) THEN
    RAISE EXCEPTION 'invalid function';
  END IF;

  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL', 'supabase_url', 'project_url')
  ORDER BY CASE name WHEN 'SUPABASE_URL' THEN 0 WHEN 'supabase_url' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT decrypted_secret INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR worker_secret IS NULL OR worker_secret = '' THEN
    RAISE EXCEPTION 'kick secrets missing';
  END IF;

  SELECT net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 150000
  ) INTO request_id;

  RETURN request_id;
END;
$$;


ALTER FUNCTION "public"."kick_internal_function"("p_function" "text", "p_body" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lead_origin_tag_names"("p_campaign_name" "text", "p_source" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."lead_origin_tag_names"("p_campaign_name" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lead_source_tag_name"("p_source" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."lead_source_tag_name"("p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_assign_home_agency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.agency_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    NEW.agency_id := public.get_tenant_home_agency_id(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leads_assign_home_agency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_set_first_origin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.first_created_at IS NULL THEN
    NEW.first_created_at := COALESCE(NEW.created_at, now());
  END IF;
  IF NEW.first_source IS NULL THEN
    NEW.first_source := NEW.source;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leads_set_first_origin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_visitor_to_lead"("p_visitor_fingerprint" "text", "p_tracking_id" "text", "p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_visitor_id UUID; v_tracking_config_id UUID;
BEGIN
  SELECT id INTO v_tracking_config_id FROM site_tracking_configs WHERE tracking_id = p_tracking_id;
  IF v_tracking_config_id IS NULL THEN RETURN NULL; END IF;
  UPDATE site_visitors SET lead_id = p_lead_id WHERE tracking_config_id = v_tracking_config_id AND visitor_fingerprint = p_visitor_fingerprint RETURNING id INTO v_visitor_id;
  RETURN v_visitor_id;
END;
$$;


ALTER FUNCTION "public"."link_visitor_to_lead"("p_visitor_fingerprint" "text", "p_tracking_id" "text", "p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_system_cron_jobs"() RETURNS TABLE("jobid" bigint, "jobname" "text", "schedule" "text", "active" boolean, "command" "text", "last_run_at" timestamp with time zone, "last_status" "text", "last_duration_ms" bigint, "last_return_message" "text", "success_count_7d" bigint, "fail_count_7d" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'cron'
    AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY
  WITH last_run AS (SELECT DISTINCT ON (d.jobid) d.jobid, d.start_time AS last_run_at, d.status AS last_status, EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000 AS last_duration_ms, d.return_message AS last_return_message FROM cron.job_run_details d ORDER BY d.jobid, d.start_time DESC),
  stats AS (SELECT d.jobid, COUNT(*) FILTER (WHERE d.status='succeeded') AS success_count_7d, COUNT(*) FILTER (WHERE d.status='failed') AS fail_count_7d FROM cron.job_run_details d WHERE d.start_time > now() - interval '7 days' GROUP BY d.jobid)
  SELECT j.jobid, j.jobname, j.schedule, j.active, j.command, lr.last_run_at, lr.last_status, lr.last_duration_ms, lr.last_return_message, COALESCE(s.success_count_7d, 0), COALESCE(s.fail_count_7d, 0)
  FROM cron.job j LEFT JOIN last_run lr ON lr.jobid=j.jobid LEFT JOIN stats s ON s.jobid=j.jobid ORDER BY j.jobname;
END; $$;


ALTER FUNCTION "public"."list_system_cron_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_client_mood_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  actor uuid := auth.uid();
  old_label text;
  new_label text;
  body text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.mood_status IS NOT DISTINCT FROM OLD.mood_status THEN
    RETURN NEW;
  END IF;

  -- Skip system/service-role writes with no authenticated actor.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  old_label := public.format_client_mood_status_label(OLD.mood_status);
  new_label := public.format_client_mood_status_label(NEW.mood_status);

  IF OLD.mood_status IS NULL THEN
    body := 'עודכנה שביעות רצון: ' || new_label;
  ELSE
    body := 'שביעות רצון: ' || old_label || ' → ' || new_label;
  END IF;

  INSERT INTO public.client_updates (
    client_id,
    tenant_id,
    user_id,
    content,
    update_type
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    actor,
    body,
    'mood_status'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_client_mood_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_signature_event"("_document_id" "uuid", "_recipient_id" "uuid", "_event_type" "text", "_ip" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.signature_documents WHERE id = _document_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'document_not_found'; END IF;
  IF _recipient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.signature_recipients
    WHERE id = _recipient_id AND document_id = _document_id AND tenant_id = v_tenant_id
  ) THEN RAISE EXCEPTION 'invalid_event_recipient'; END IF;
  INSERT INTO public.signature_events (document_id, recipient_id, tenant_id, event_type, ip_address, metadata)
  VALUES (_document_id, _recipient_id, v_tenant_id, _event_type, _ip, COALESCE(_metadata, '{}'::jsonb));
END;
$$;


ALTER FUNCTION "public"."log_signature_event"("_document_id" "uuid", "_recipient_id" "uuid", "_event_type" "text", "_ip" "text", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_chats_read"("p_tenant_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE chat_messages SET read_at = now() WHERE tenant_id = p_tenant_id AND direction = 'inbound' AND read_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT; RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_chats_read"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_log_id uuid;
  v_code text;
  v_detail text;
  v_reason text;
  v_ops text;
BEGIN
  IF coalesce(p_provider_message_id, '') = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_log_id
  FROM public.automation_logs
  WHERE triggered_at > now() - interval '7 days'
    AND jsonb_path_query_array(response, '$.**.messageId'::jsonpath, '{}'::jsonb, false)
        @> to_jsonb(p_provider_message_id)
  ORDER BY triggered_at DESC
  LIMIT 1;

  IF v_log_id IS NULL THEN
    RETURN false;
  END IF;

  v_code := nullif(p_error->>'code', '');
  v_detail := coalesce(
    nullif(p_error->'error_data'->>'details', ''),
    nullif(p_error->>'title', ''),
    nullif(p_error->>'message', ''),
    'סיבה לא ידועה'
  );

  IF v_code = '131049' THEN
    v_reason := 'Meta חסמה את המסירה (קוד 131049) — מגבלת מעורבות/איכות על הודעות שיווקיות לנמען זה.';
    v_ops := 'תפעול: בדקו Quality Rating ב-Meta, הפחיתו נפח תבניות לנמענים שלא מגיבים. אל תריצו מחדש מיד.';
  ELSIF v_code = '131042' THEN
    v_reason := 'Meta לא שלחה בגלל בעיית תשלום/חיוב בחשבון WhatsApp Business (קוד 131042).';
    v_ops := 'תפעול: Meta Business → WhatsApp Manager → Billing — תקנו אמצעי תשלום/חוב.';
  ELSIF v_code = '131026' THEN
    v_reason := 'Meta דיווחה שההודעה לא ניתנת למשלוח (קוד 131026).';
    v_ops := 'תפעול: בדקו שמספר הלקוח תקין ופעיל ב-WhatsApp.';
  ELSIF v_code = '131047' THEN
    v_reason := 'חלון השירות של 24 שעות נסגר (קוד 131047). יש לשלוח תבנית מאושרת.';
    v_ops := 'תפעול: העבירו את השלב ל-template.';
  ELSIF v_code = '200' THEN
    v_reason := 'אין הרשאה לשלוח בשם חשבון ה-WhatsApp Business (קוד 200).';
    v_ops := 'תפעול: חדשו חיבור Meta WhatsApp ב-AIOS.';
  ELSE
    v_reason := 'Meta לא מסרה את ההודעה'
      || coalesce(' (קוד ' || v_code || ')', '')
      || ': ' || v_detail;
    v_ops := 'תפעול: בדקו סטטוס המספר ב-Meta Business Manager.';
  END IF;

  UPDATE public.automation_logs
  SET success = false,
      error_message = left(
        coalesce(nullif(error_message, '') || ' | ', '')
          || v_reason
          || ' — '
          || v_ops,
        1000
      )
  WHERE id = v_log_id
    AND (success IS DISTINCT FROM false OR coalesce(error_message, '') NOT LIKE '%' || v_reason || '%');

  RETURN true;
END;
$_$;


ALTER FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_agent_memory"("p_agent_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "title" "text", "summary" "text", "category" "text", "importance" integer, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT m.id, m.title, m.summary, m.category, m.importance, 1 - (m.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.agent_memory m WHERE m.agent_id = p_agent_id AND m.summary_embedding IS NOT NULL
  ORDER BY m.summary_embedding <=> p_query_embedding LIMIT p_limit;
$$;


ALTER FUNCTION "public"."match_agent_memory"("p_agent_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_agent_tools"("query_embedding" "public"."vector", "match_count" integer DEFAULT 50) RETURNS TABLE("tool_name" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    e.tool_name,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.agent_tool_embeddings e
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1)
$$;


ALTER FUNCTION "public"."match_agent_tools"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  kept public.campaigners%ROWTYPE;
  dup public.campaigners%ROWTYPE;
  dup_email text;
  dup_phone text;
  dup_role text[];
  dup_notes text;
  dup_active boolean;
BEGIN
  IF p_canonical IS NULL OR p_duplicate IS NULL OR p_canonical = p_duplicate THEN
    RETURN NULL;
  END IF;

  SELECT * INTO kept FROM public.campaigners WHERE id = p_canonical;
  SELECT * INTO dup FROM public.campaigners WHERE id = p_duplicate;
  IF kept.id IS NULL OR dup.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF kept.tenant_id IS DISTINCT FROM dup.tenant_id THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE campaigner_id = p_canonical
      AND NULLIF(lower(btrim(email)), '') IS NOT NULL
      AND lower(btrim(email)) = NULLIF(lower(btrim(dup.email)), '')
  ) THEN
    RETURN NULL;
  END IF;

  IF (
    SELECT count(DISTINCT campaigner_id)
    FROM public.profiles
    WHERE campaigner_id IS NOT NULL
      AND NULLIF(lower(btrim(email)), '') = NULLIF(lower(btrim(dup.email)), '')
  ) > 1 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE campaigner_id = p_duplicate
  ) THEN
    RETURN NULL;
  END IF;

  dup_email := NULLIF(btrim(dup.email), '');
  dup_phone := NULLIF(btrim(dup.phone), '');
  dup_role := dup.role;
  dup_notes := dup.notes;
  dup_active := dup.active;

  UPDATE public.campaigners
  SET
    email = COALESCE(NULLIF(btrim(email), ''), dup_email),
    phone = COALESCE(NULLIF(btrim(phone), ''), dup_phone),
    role = CASE
      WHEN role IS NULL OR coalesce(cardinality(role), 0) = 0 THEN dup_role
      ELSE role
    END,
    notes = COALESCE(notes, dup_notes),
    active = active OR dup_active,
    updated_at = now()
  WHERE id = p_canonical;

  INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
  SELECT p_canonical, agency_id
  FROM public.campaigner_agencies
  WHERE campaigner_id = p_duplicate
  ON CONFLICT (campaigner_id, agency_id) DO NOTHING;

  UPDATE public.tasks
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  DELETE FROM public.task_collaborators AS extra
  USING public.task_collaborators AS kept_row
  WHERE extra.campaigner_id = p_duplicate
    AND kept_row.campaigner_id = p_canonical
    AND kept_row.task_id = extra.task_id;

  UPDATE public.task_collaborators
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.client_team AS extra
  SET campaigner_id = p_canonical
  WHERE extra.campaigner_id = p_duplicate
    AND NOT EXISTS (
      SELECT 1
      FROM public.client_team AS kept_row
      WHERE kept_row.client_id = extra.client_id
        AND kept_row.campaigner_id = p_canonical
        AND kept_row.start_date IS NOT DISTINCT FROM extra.start_date
    );

  DELETE FROM public.client_team WHERE campaigner_id = p_duplicate;

  UPDATE public.client_onboarding
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.time_entries
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  UPDATE public.suppliers
  SET related_campaigner_id = p_canonical
  WHERE related_campaigner_id = p_duplicate;

  UPDATE public.profiles
  SET campaigner_id = p_canonical
  WHERE campaigner_id = p_duplicate;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'zoom_recordings'
      AND column_name = 'campaigner_ids'
  ) THEN
    UPDATE public.zoom_recordings AS recording
    SET campaigner_ids = (
      SELECT COALESCE(array_agg(DISTINCT item), ARRAY[]::uuid[])
      FROM unnest(array_replace(recording.campaigner_ids, p_duplicate, p_canonical)) AS item
    )
    WHERE recording.campaigner_ids @> ARRAY[p_duplicate]::uuid[];
  END IF;

  DELETE FROM public.campaigners WHERE id = p_duplicate;
  RETURN p_canonical;
END;
$$;


ALTER FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_orphan_profile_by_email"("_auth_user_id" "uuid", "_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_orphan_id uuid;
BEGIN
  IF _auth_user_id IS NULL OR NULLIF(trim(_email), '') IS NULL THEN
    RETURN;
  END IF;

  SELECT p.id
  INTO v_orphan_id
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
    AND p.id <> _auth_user_id
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
  LIMIT 1;

  IF v_orphan_id IS NULL THEN
    RETURN;
  END IF;

  -- Copy team-member links onto the real auth profile.
  UPDATE public.profiles dst
  SET
    full_name = COALESCE(NULLIF(dst.full_name, ''), src.full_name),
    campaigner_id = COALESCE(dst.campaigner_id, src.campaigner_id),
    sales_person_id = COALESCE(dst.sales_person_id, src.sales_person_id),
    phone = COALESCE(dst.phone, src.phone),
    avatar_url = COALESCE(dst.avatar_url, src.avatar_url),
    ui_mode = COALESCE(dst.ui_mode, src.ui_mode),
    status = 'active',
    updated_at = now()
  FROM public.profiles src
  WHERE dst.id = _auth_user_id
    AND src.id = v_orphan_id;

  INSERT INTO public.tenant_users (user_id, tenant_id, role)
  SELECT _auth_user_id, tu.tenant_id, tu.role
  FROM public.tenant_users tu
  WHERE tu.user_id = v_orphan_id
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  SELECT _auth_user_id, ur.role, ur.tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_orphan_id
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  INSERT INTO public.user_permissions (user_id, module, can_access)
  SELECT _auth_user_id, up.module, up.can_access
  FROM public.user_permissions up
  WHERE up.user_id = v_orphan_id
  ON CONFLICT (user_id, module) DO UPDATE
    SET can_access = EXCLUDED.can_access;

  INSERT INTO public.user_active_tenant (user_id, tenant_id, updated_at)
  SELECT _auth_user_id, uat.tenant_id, now()
  FROM public.user_active_tenant uat
  WHERE uat.user_id = v_orphan_id
  ON CONFLICT (user_id) DO NOTHING;

  DELETE FROM public.user_permissions WHERE user_id = v_orphan_id;
  DELETE FROM public.user_roles WHERE user_id = v_orphan_id;
  DELETE FROM public.tenant_users WHERE user_id = v_orphan_id;
  DELETE FROM public.user_active_tenant WHERE user_id = v_orphan_id;
  DELETE FROM public.profiles WHERE id = v_orphan_id;
END;
$$;


ALTER FUNCTION "public"."merge_orphan_profile_by_email"("_auth_user_id" "uuid", "_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_task_recurrence_date"("base_date" "date", "frequency" "text", "frequency_interval" integer, "as_of_date" "date" DEFAULT CURRENT_DATE, "weekday" integer DEFAULT NULL::integer, "monthday" integer DEFAULT NULL::integer) RETURNS "date"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  candidate date := COALESCE(base_date, as_of_date);
  step_days integer;
  target_weekday integer;
  target_monthday integer;
  last_day integer;
BEGIN
  IF frequency IS NULL OR frequency_interval IS NULL OR frequency_interval < 1 THEN
    RETURN NULL;
  END IF;

  IF frequency = 'daily' THEN
    candidate := (candidate + make_interval(days => frequency_interval))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (candidate + make_interval(days => frequency_interval))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  IF frequency = 'weekly' THEN
    target_weekday := COALESCE(weekday, EXTRACT(DOW FROM candidate)::integer);
    candidate := (candidate + make_interval(days => 7 * frequency_interval))::date;
    step_days := ((target_weekday - EXTRACT(DOW FROM candidate)::integer) + 7) % 7;
    candidate := (candidate + make_interval(days => step_days))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (candidate + make_interval(days => 7 * frequency_interval))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  IF frequency = 'monthly' THEN
    target_monthday := COALESCE(monthday, EXTRACT(DAY FROM candidate)::integer);
    candidate := (date_trunc('month', candidate) + make_interval(months => frequency_interval))::date;
    last_day := EXTRACT(DAY FROM (date_trunc('month', candidate) + INTERVAL '1 month - 1 day'))::integer;
    candidate := (date_trunc('month', candidate) + make_interval(days => LEAST(target_monthday, last_day) - 1))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (date_trunc('month', candidate) + make_interval(months => frequency_interval))::date;
      last_day := EXTRACT(DAY FROM (date_trunc('month', candidate) + INTERVAL '1 month - 1 day'))::integer;
      candidate := (date_trunc('month', candidate) + make_interval(days => LEAST(target_monthday, last_day) - 1))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."next_task_recurrence_date"("base_date" "date", "frequency" "text", "frequency_interval" integer, "as_of_date" "date", "weekday" integer, "monthday" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_google_customer_id"("raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT CASE
    WHEN regexp_replace(trim(COALESCE(raw, '')), '-', '', 'g') ~ '^\d+$'
      THEN NULLIF(regexp_replace(trim(COALESCE(raw, '')), '-', '', 'g'), '')
    ELSE NULL
  END;
$_$;


ALTER FUNCTION "public"."normalize_google_customer_id"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_meta_ad_account_id"("raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT CASE
    WHEN trim(COALESCE(raw, '')) = '' THEN NULL
    WHEN regexp_replace(trim(raw), '^act_', '', 'i') ~ '^\d+$'
      THEN 'act_' || regexp_replace(trim(raw), '^act_', '', 'i')
    ELSE trim(raw)
  END;
$_$;


ALTER FUNCTION "public"."normalize_meta_ad_account_id"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_task_notification_worker"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
       OR OLD.sales_person_id IS DISTINCT FROM NEW.sales_person_id THEN
      NEW.assignment_notification_sent_at := NULL;
      IF NEW.status <> 'done' THEN
        NEW.high_priority_reminder_sent_at := NULL;
        NEW.high_priority_creator_notified_at := NULL;
      END IF;
    END IF;

    IF OLD.due_date IS DISTINCT FROM NEW.due_date AND NEW.status <> 'done' THEN
      IF NEW.due_date IS NOT NULL
         AND (OLD.due_date IS NULL OR NEW.due_date > OLD.due_date) THEN
        NEW.overdue_notified_at := NULL;
        NEW.overdue_creator_notified_at := NULL;
      END IF;
    END IF;

    IF OLD.self_reminder_at IS DISTINCT FROM NEW.self_reminder_at THEN
      NEW.self_reminder_sent_at := NULL;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done' THEN
      NEW.completion_creator_notified_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/task-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('task_id', NEW.id),
      timeout_milliseconds := 5000
    );
  ELSIF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
     OR OLD.sales_person_id IS DISTINCT FROM NEW.sales_person_id
     OR OLD.self_reminder_at IS DISTINCT FROM NEW.self_reminder_at
     OR OLD.due_date IS DISTINCT FROM NEW.due_date
     OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done') THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/task-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('task_id', NEW.id),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_notification_worker failed for task %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_task_notification_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."permanently_delete_archived_leads"("p_lead_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.leads
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NOT NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים למחוק לידים לצמיתות';
  END IF;
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."permanently_delete_archived_leads"("p_lead_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_whatsapp_group_invite_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."propagate_whatsapp_group_invite_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_integration_failure"("p_tenant_id" "uuid", "p_provider" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_failures integer;
BEGIN
  INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, total_calls, total_failures)
  VALUES (p_tenant_id, p_provider, 1, now(), 1, 1)
  ON CONFLICT (tenant_id, provider) DO UPDATE
  SET consecutive_failures = integration_health.consecutive_failures + 1, last_failure_at = now(), total_calls = integration_health.total_calls + 1, total_failures = integration_health.total_failures + 1
  RETURNING consecutive_failures INTO v_failures;
  IF v_failures >= 5 THEN UPDATE integration_health SET is_circuit_open = true, cooldown_until = now() + interval '5 minutes' WHERE tenant_id = p_tenant_id AND provider = p_provider; END IF;
END; $$;


ALTER FUNCTION "public"."record_integration_failure"("p_tenant_id" "uuid", "p_provider" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_integration_result"("p_tenant_id" "uuid", "p_provider" "text", "p_success" boolean, "p_failure_threshold" integer DEFAULT 5, "p_cooldown_minutes" integer DEFAULT 5) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_success THEN
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 0, NULL, false, NULL)
    ON CONFLICT (tenant_id, provider) DO UPDATE SET consecutive_failures = 0, is_circuit_open = false, cooldown_until = NULL;
  ELSE
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 1, now(), false, NULL)
    ON CONFLICT (tenant_id, provider) DO UPDATE SET consecutive_failures = integration_health.consecutive_failures + 1, last_failure_at = now(),
      is_circuit_open = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold THEN true ELSE false END,
      cooldown_until = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold THEN now() + (p_cooldown_minutes || ' minutes')::interval ELSE integration_health.cooldown_until END;
  END IF;
END; $$;


ALTER FUNCTION "public"."record_integration_result"("p_tenant_id" "uuid", "p_provider" "text", "p_success" boolean, "p_failure_threshold" integer, "p_cooldown_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_integration_success"("p_tenant_id" "uuid", "p_provider" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_success_at, is_circuit_open, total_calls)
  VALUES (p_tenant_id, p_provider, 0, now(), false, 1)
  ON CONFLICT (tenant_id, provider) DO UPDATE SET consecutive_failures = 0, last_success_at = now(), is_circuit_open = false, cooldown_until = NULL, total_calls = integration_health.total_calls + 1;
END; $$;


ALTER FUNCTION "public"."record_integration_success"("p_tenant_id" "uuid", "p_provider" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF p_destination_key IS NULL OR length(trim(p_destination_key)) = 0 THEN
    RETURN;
  END IF;
  DELETE FROM public.manychat_destination_send_locks
  WHERE destination_key = p_destination_key;
END;
$$;


ALTER FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_archived_leads"("p_lead_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.leads
  SET archived_at = NULL,
      archived_by = NULL,
      updated_at = now()
  WHERE id = ANY (p_lead_ids)
    AND archived_at IS NOT NULL
    AND public.can_manage_lead_archive(leads.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = ANY (p_lead_ids)
      AND NOT public.can_manage_lead_archive(l.tenant_id)
  ) THEN
    RAISE EXCEPTION 'רק בעלים יכולים לשחזר לידים מהארכיון';
  END IF;
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."restore_archived_leads"("p_lead_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_ddl_once"("sql" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  EXECUTE sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;


ALTER FUNCTION "public"."run_ddl_once"("sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_system_cron_job_now"("p_jobid" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'cron'
    AS $$
DECLARE v_command text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  SELECT command INTO v_command FROM cron.job WHERE jobid = p_jobid;
  IF v_command IS NULL THEN RAISE EXCEPTION 'job not found'; END IF;
  EXECUTE v_command; RETURN 'ok';
END; $$;


ALTER FUNCTION "public"."run_system_cron_job_now"("p_jobid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text") RETURNS TABLE("contact_id" "uuid", "contact_type" "text", "name" "text", "contact_name" "text", "phone" "text", "email" "text", "agency_id" "uuid", "agency_name" "text", "manychat_subscriber_id" "text", "active_chat_provider" "public"."chat_provider", "has_messages" boolean, "last_message_at" timestamp with time zone, "unread_count" bigint, "is_blocked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id uuid;
  v_user_agency_ids uuid[];
BEGIN
  -- Get user's tenant and agencies
  v_tenant_id := get_user_tenant_id(auth.uid());
  v_user_agency_ids := get_user_agency_ids(auth.uid());
  
  -- Search clients
  RETURN QUERY
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    c.manychat_subscriber_id,
    c.active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.client_id = c.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM clients c
  JOIN agencies a ON a.id = c.agency_id
  WHERE c.tenant_id = v_tenant_id
    AND (c.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND (
      c.name ILIKE '%' || p_search_term || '%'
      OR c.contact_name ILIKE '%' || p_search_term || '%'
      OR c.phone ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
    )
  
  UNION ALL
  
  -- Search leads
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    l.manychat_subscriber_id,
    l.active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.lead_id = l.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM leads l
  JOIN agencies a ON a.id = l.agency_id
  WHERE l.tenant_id = v_tenant_id
    AND (l.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND (
      l.company_name ILIKE '%' || p_search_term || '%'
      OR l.contact_name ILIKE '%' || p_search_term || '%'
      OR l.phone ILIKE '%' || p_search_term || '%'
      OR l.email ILIKE '%' || p_search_term || '%'
    )
  
  UNION ALL
  
  -- Search WhatsApp groups
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    NULL::text as manychat_subscriber_id,
    'green_api'::chat_provider as active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.group_id = g.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON a.id = g.agency_id
  WHERE g.tenant_id = v_tenant_id
    AND (g.agency_id IS NULL OR g.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND g.group_name ILIKE '%' || p_search_term || '%'
  
  ORDER BY has_messages DESC, last_message_at DESC NULLS LAST, name
  LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("contact_id" "text", "contact_type" "text", "name" "text", "contact_name" "text", "phone" "text", "email" "text", "agency_id" "uuid", "agency_name" "text", "unread_count" bigint, "last_message_at" timestamp with time zone, "is_blocked" boolean, "manychat_subscriber_id" "text", "active_chat_provider" "public"."chat_provider", "sender_phone" "text", "has_messages" boolean, "whatsapp_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  search_pattern text;
BEGIN
  current_user_id := auth.uid();
  search_pattern := '%' || lower(p_search_term) || '%';

  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  current_tenant_id := get_user_tenant_id(current_user_id);

  -- Only a super admin may ask for a tenant other than their own.
  IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM current_tenant_id THEN
    IF NOT COALESCE(is_super_admin(current_user_id), false) THEN
      RETURN;
    END IF;
    current_tenant_id := p_tenant_id;
  END IF;

  IF current_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients
  SELECT 
    c.id::text as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id 
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider,
    c.phone as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.client_id = c.id AND cm.connection_user_id = current_user_id) as has_messages,
    c.whatsapp_avatar_url
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND (
    lower(c.name) LIKE search_pattern
    OR lower(COALESCE(c.contact_name, '')) LIKE search_pattern
    OR lower(COALESCE(c.phone, '')) LIKE search_pattern
    OR lower(COALESCE(c.email, '')) LIKE search_pattern
  )

  UNION ALL

  -- Leads
  SELECT 
    l.id::text as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider,
    l.phone as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.lead_id = l.id AND cm.connection_user_id = current_user_id) as has_messages,
    l.whatsapp_avatar_url
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND (
    lower(l.company_name) LIKE search_pattern
    OR lower(COALESCE(l.contact_name, '')) LIKE search_pattern
    OR lower(COALESCE(l.phone, '')) LIKE search_pattern
    OR lower(COALESCE(l.email, '')) LIKE search_pattern
  )

  UNION ALL

  -- Groups - FIXED: use g.whatsapp_avatar_url instead of g.avatar_url
  SELECT 
    g.id::text as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    'green_api'::chat_provider as active_chat_provider,
    NULL::text as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.group_id = g.id AND cm.connection_user_id = current_user_id) as has_messages,
    g.whatsapp_avatar_url
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND (
    lower(g.group_name) LIKE search_pattern
    OR lower(COALESCE(g.description, '')) LIKE search_pattern
  )

  UNION ALL

  -- Unknown contacts (messages without client/lead/group)
  SELECT 
    uc.sender_phone as contact_id,
    'unknown'::text as contact_type,
    COALESCE(uc.sender_name, uc.sender_phone) as name,
    NULL::text as contact_name,
    uc.sender_phone as phone,
    NULL::text as email,
    NULL::uuid as agency_id,
    NULL::text as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.sender_phone = uc.sender_phone 
       AND cm.client_id IS NULL 
       AND cm.lead_id IS NULL 
       AND cm.group_id IS NULL
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id
       AND cm.tenant_id = current_tenant_id),
      0
    ) as unread_count,
    uc.last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    uc.provider as active_chat_provider,
    uc.sender_phone as sender_phone,
    true as has_messages,
    uc.avatar_url as whatsapp_avatar_url
  FROM (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name,
      cm.provider,
      MAX(cm.created_at) OVER (PARTITION BY cm.sender_phone) as last_message_at,
      (cm.raw_provider_data->>'senderProfileImage')::text as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = current_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
      AND (
        lower(cm.sender_phone) LIKE search_pattern
        OR lower(COALESCE(cm.sender_name, '')) LIKE search_pattern
      )
    ORDER BY cm.sender_phone, cm.created_at DESC
  ) uc
  WHERE NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.sender_phone = uc.sender_phone
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_agency_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN SELECT tenant_id INTO NEW.tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_agency_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_campaigner_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN SELECT tenant_id INTO NEW.tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_campaigner_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_client_onboarding_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    ELSE
      SELECT public.get_user_tenant_id(auth.uid()) INTO NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_client_onboarding_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_client_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.agencies 
    WHERE id = NEW.agency_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_client_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_client_tenant_id"() IS 'Automatically sets tenant_id for new clients based on their agency';



CREATE OR REPLACE FUNCTION "public"."set_lead_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id 
      FROM public.agencies 
      WHERE id = NEW.agency_id;
    ELSE
      SELECT tenant_id INTO NEW.tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_lead_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_lead_tenant_id"() IS 'Automatically sets tenant_id for new leads based on their agency or user';



CREATE OR REPLACE FUNCTION "public"."set_product_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_product_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_product_tenant_id"() IS 'Automatically sets tenant_id for new products based on the current user';



CREATE OR REPLACE FUNCTION "public"."set_task_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tracking_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := generate_tracking_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tracking_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."signature_png_is_valid"("_value" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  bytes bytea;
  width bigint;
  height bigint;
BEGIN
  IF _value IS NULL OR length(_value) > 5000000 OR length(_value) < 100
    OR _value NOT LIKE 'data:image/png;base64,%' THEN RETURN false; END IF;
  bytes := decode(substr(_value, 23), 'base64');
  IF octet_length(bytes) < 67
    OR substring(bytes FROM 1 FOR 8) <> decode('89504e470d0a1a0a', 'hex')
    OR substring(bytes FROM 9 FOR 8) <> decode('0000000d49484452', 'hex')
    OR substring(bytes FROM octet_length(bytes) - 11) <> decode('0000000049454e44ae426082', 'hex')
    THEN RETURN false; END IF;
  width := get_byte(bytes,16)::bigint*16777216 + get_byte(bytes,17)*65536 + get_byte(bytes,18)*256 + get_byte(bytes,19);
  height := get_byte(bytes,20)::bigint*16777216 + get_byte(bytes,21)*65536 + get_byte(bytes,22)*256 + get_byte(bytes,23);
  RETURN width BETWEEN 2 AND 4096 AND height BETWEEN 2 AND 4096;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;


ALTER FUNCTION "public"."signature_png_is_valid"("_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT public.submit_signature_by_token(_token, _signature_data, _ip, '{}'::jsonb); $$;


ALTER FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text" DEFAULT NULL::"text", "_field_values" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_doc public.signature_documents%ROWTYPE;
  v_document_id uuid;
  v_field jsonb;
  v_value text;
  v_values jsonb := '{}'::jsonb;
  v_new_status text;
  v_stamp boolean := false;
  v_stamp_name text;
  v_stamp_id text;
BEGIN
  IF _token IS NULL OR NOT public.signature_png_is_valid(_signature_data) THEN
    RAISE EXCEPTION 'invalid_signature';
  END IF;
  IF _field_values IS NULL OR jsonb_typeof(_field_values) <> 'object' OR octet_length(_field_values::text) > 10000000 THEN
    RAISE EXCEPTION 'invalid_field_values';
  END IF;
  SELECT document_id INTO v_document_id FROM public.signature_recipients WHERE sign_token = _token;
  IF v_document_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_signed'; END IF;
  -- Always lock the document first, serializing concurrent signers and cancellation.
  SELECT * INTO v_doc FROM public.signature_documents WHERE id = v_document_id FOR UPDATE;
  SELECT * INTO v_rec FROM public.signature_recipients WHERE sign_token = _token FOR UPDATE;
  IF v_rec.status <> 'pending' THEN RAISE EXCEPTION 'not_found_or_already_signed'; END IF;
  IF v_doc.id IS NULL OR v_rec.tenant_id <> v_doc.tenant_id OR v_doc.is_template
    OR v_doc.status NOT IN ('pending','partially_signed')
    OR EXISTS (SELECT 1 FROM public.signature_recipients WHERE document_id = v_doc.id AND status = 'declined')
    THEN RAISE EXCEPTION 'document_not_signable'; END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.document_fields, '[]'::jsonb)) LOOP
    IF COALESCE((v_field->>'recipient_index')::int, 0) <> GREATEST(0, v_rec.sign_order - 1) THEN CONTINUE; END IF;
    v_value := NULLIF(btrim(_field_values->>(v_field->>'id')), '');
    IF COALESCE((v_field->>'required')::boolean, false) AND v_value IS NULL THEN
      RAISE EXCEPTION 'missing_required_field';
    END IF;
    IF v_value IS NULL THEN CONTINUE; END IF;
    IF jsonb_typeof(_field_values->(v_field->>'id')) <> 'string' THEN RAISE EXCEPTION 'invalid_field_values'; END IF;
    IF v_field->>'type' IN ('signature','signature_stamp') THEN
      IF NOT public.signature_png_is_valid(v_value) THEN RAISE EXCEPTION 'invalid_signature'; END IF;
      IF v_field->>'type' = 'signature_stamp' THEN v_stamp := true; END IF;
    ELSIF length(v_value) > 10000 THEN RAISE EXCEPTION 'invalid_field_values';
    END IF;
    IF v_field->>'type' = 'company_name' THEN v_stamp_name := COALESCE(v_stamp_name, v_value); END IF;
    IF v_field->>'type' = 'id_number' THEN v_stamp_id := COALESCE(v_stamp_id, v_value); END IF;
    v_values := v_values || jsonb_build_object(v_field->>'id', v_value);
  END LOOP;
  IF v_stamp THEN
    v_stamp_name := COALESCE(v_stamp_name, NULLIF(btrim(_field_values->>'__stamp_name'), ''), NULLIF(btrim(v_doc.business_stamp_name), ''));
    v_stamp_id := COALESCE(v_stamp_id, NULLIF(btrim(_field_values->>'__stamp_company_id'), ''), NULLIF(btrim(v_doc.business_stamp_company_id), ''));
    IF v_stamp_name IS NULL OR v_stamp_id IS NULL THEN RAISE EXCEPTION 'missing_stamp_details'; END IF;
    IF length(v_stamp_name) > 200 OR length(v_stamp_id) > 64 THEN RAISE EXCEPTION 'invalid_field_values'; END IF;
    v_values := v_values || jsonb_build_object('__stamp_name', v_stamp_name, '__stamp_company_id', v_stamp_id);
  END IF;

  UPDATE public.signature_recipients SET status = 'signed', signature_data = _signature_data,
    field_values = v_values, signed_at = now(), ip_address = COALESCE(_ip, ip_address)
  WHERE id = v_rec.id;
  PERFORM public.log_signature_event(v_doc.id, v_rec.id, 'signed', _ip,
    jsonb_build_object('email', v_rec.email, 'name', v_rec.name, 'field_values', v_values));
  SELECT CASE WHEN bool_and(status = 'signed') THEN 'completed' ELSE 'partially_signed' END INTO v_new_status
  FROM public.signature_recipients WHERE document_id = v_doc.id;
  UPDATE public.signature_documents SET status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE NULL END, updated_at = now()
  WHERE id = v_doc.id;
  RETURN jsonb_build_object('ok', true, 'document_id', v_doc.id, 'document_status', v_new_status, 'tenant_id', v_doc.tenant_id);
END;
$$;


ALTER FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text", "_field_values" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_campaigner_carmen_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_phone text;
  v_old_phone text;
begin
  v_phone := public.carmen_normalize_staff_phone(new.phone);
  if tg_op = 'UPDATE' then
    v_old_phone := public.carmen_normalize_staff_phone(old.phone);
    if v_old_phone <> v_phone
       or old.tenant_id <> new.tenant_id
       or new.active is not true then
      update public.carmen_whatsapp_identities
      set status = 'revoked', updated_at = now()
      where tenant_id = old.tenant_id
        and phone = v_old_phone
        and entity_type = 'campaigner'
        and entity_id = old.id;
    end if;
  end if;

  if new.active is true and length(v_phone) between 9 and 15 then
    insert into public.carmen_whatsapp_identities (
      tenant_id, phone, entity_type, entity_id, display_name, role_title,
      status, approved_at, verified_at
    ) values (
      new.tenant_id, v_phone, 'campaigner', new.id, new.full_name, 'campaigner',
      'approved', now(), now()
    )
    on conflict (tenant_id, phone) do update set
      entity_type = 'campaigner',
      entity_id = excluded.entity_id,
      client_id = null,
      display_name = excluded.display_name,
      role_title = excluded.role_title,
      status = 'approved',
      approved_at = coalesce(public.carmen_whatsapp_identities.approved_at, now()),
      verified_at = coalesce(public.carmen_whatsapp_identities.verified_at, now()),
      updated_at = now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_campaigner_carmen_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_client_card_from_crm_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."sync_client_card_from_crm_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_client_status_to_onboarding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  IF NEW.status = 'onboarding' AND OLD.status != 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'receiving_access', updated_at = now()
    WHERE client_id = NEW.id
      AND status = 'campaign_live';
  END IF;

  IF NEW.status IN ('paused', 'ended') AND OLD.status = 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_client_status_to_onboarding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  SELECT id, tenant_id, campaign_name, source::text
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


ALTER FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_published_article_to_seo_monthly_work"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_published_article_to_seo_monthly_work"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_published_article_to_seo_monthly_work"() IS 'Upserts published PBN articles and their live links into seo_monthly_updates.work for the assignment month.';



CREATE OR REPLACE FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_integrations ti
    WHERE ti.id = p_integration_id
      AND ti.is_active = true
      AND (
        ti.tenant_id = p_tenant_id
        OR EXISTS (
          SELECT 1
          FROM public.integration_tenant_access ita
          WHERE ita.integration_id = ti.id
            AND ita.accessing_tenant_id = p_tenant_id
        )
      )
  );
$$;


ALTER FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_wa_warm_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_wa_warm_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_deleted_facebook_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_leadgen_id text;
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes LIKE '%leadgen_id:%' THEN
    v_leadgen_id := trim(split_part(split_part(OLD.notes, 'leadgen_id: ', 2), E'\n', 1));
    IF v_leadgen_id IS NOT NULL AND v_leadgen_id != '' THEN
      INSERT INTO deleted_facebook_leads (tenant_id, leadgen_id)
      VALUES (OLD.tenant_id, v_leadgen_id)
      ON CONFLICT (tenant_id, leadgen_id) DO NOTHING;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."track_deleted_facebook_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_lead_origin_tags"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.sync_lead_origin_tags_for_lead(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_sync_lead_origin_tags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_ad_account_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  old_status text;
  new_status text;
  last_trigger_at timestamptz;
  payload_body jsonb;
  blocked_statuses text[] := ARRAY['disabled','unsettled','pending_risk_review','pending_settlement','closed'];
BEGIN
  old_status := OLD.integration_settings->>'account_status';
  new_status := NEW.integration_settings->>'account_status';

  IF new_status IS NULL OR NOT (new_status = ANY(blocked_statuses)) THEN
    RETURN NEW;
  END IF;

  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  last_trigger_at := (NEW.integration_settings->>'last_blocked_trigger_at')::timestamptz;
  IF last_trigger_at IS NOT NULL AND last_trigger_at > now() - interval '24 hours' THEN
    RETURN NEW;
  END IF;

  payload_body := jsonb_build_object(
    'trigger_type', 'ad_account_blocked',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'table_id', NEW.id,
      'table_name', NEW.name,
      'integration_type', NEW.integration_type,
      'ad_account_id', NEW.integration_settings->>'ad_account_id',
      'account_status', new_status,
      'previous_status', old_status,
      'disable_reason', NEW.integration_settings->>'account_disable_reason',
      'blocked_at', now()
    )
  );

  PERFORM net.http_post(
    url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := payload_body
  );

  NEW.integration_settings := COALESCE(NEW.integration_settings, '{}'::jsonb)
    || jsonb_build_object('last_blocked_trigger_at', now());

  RAISE LOG 'Ad account blocked trigger fired: tenant=% table=% status=%', NEW.tenant_id, NEW.id, new_status;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_ad_account_blocked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_sync_new_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.manychat_subscriber_id IS NULL AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    PERFORM net.http_post(
      url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/auto-sync-new-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    );
    
    RAISE LOG 'Auto-sync triggered for lead: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_auto_sync_new_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_carmen_learn_from_session"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fn_url text := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/carmen-learn-from-session';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM';
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('closed','ended','expired'))
     OR (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL) THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object('session_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_carmen_learn_from_session"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_integration_disconnected"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  old_needs_reauth boolean;
  new_needs_reauth boolean;
  last_trigger_at timestamptz;
  integration_label text;
  payload_body jsonb;
BEGIN
  old_needs_reauth := COALESCE((OLD.settings->>'needs_reauth')::boolean, false);
  new_needs_reauth := COALESCE((NEW.settings->>'needs_reauth')::boolean, false);

  IF NOT (new_needs_reauth = true AND old_needs_reauth = false) THEN
    RETURN NEW;
  END IF;

  last_trigger_at := (NEW.settings->>'last_disconnect_trigger_at')::timestamptz;
  IF last_trigger_at IS NOT NULL AND last_trigger_at > now() - interval '24 hours' THEN
    RETURN NEW;
  END IF;

  integration_label := CASE NEW.integration_type
    WHEN 'google_analytics' THEN 'Google Analytics'
    WHEN 'google_search_console' THEN 'Google Search Console'
    WHEN 'google_ads' THEN 'Google Ads'
    WHEN 'google_calendar' THEN 'Google Calendar'
    WHEN 'gmail' THEN 'Gmail'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'meta_ads' THEN 'Meta Ads'
    WHEN 'ahrefs' THEN 'Ahrefs'
    WHEN 'green_api' THEN 'WhatsApp (Green API)'
    WHEN 'manychat' THEN 'ManyChat'
    WHEN 'telegram' THEN 'Telegram'
    ELSE COALESCE(NEW.integration_type, 'Integration')
  END;

  payload_body := jsonb_build_object(
    'trigger_type', 'integration_disconnected',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'integration_id', NEW.id,
      'integration_type', NEW.integration_type,
      'integration_name', integration_label,
      'last_error', NEW.settings->>'last_auth_error',
      'last_error_at', NEW.settings->>'last_auth_error_at',
      'disconnected_at', now()
    )
  );

  PERFORM net.http_post(
    url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := payload_body
  );

  NEW.settings := COALESCE(NEW.settings, '{}'::jsonb)
    || jsonb_build_object('last_disconnect_trigger_at', now());

  RAISE LOG 'Integration disconnect trigger fired: tenant=% integration=%', NEW.tenant_id, NEW.integration_type;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_integration_disconnected"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_validate_crm_record"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.validate_crm_record(NEW.table_id, NEW.data);
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_validate_crm_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer DEFAULT 90) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  got_lock boolean := false;
BEGIN
  IF p_destination_key IS NULL OR length(trim(p_destination_key)) = 0 THEN
    RETURN true;
  END IF;

  DELETE FROM public.manychat_destination_send_locks
  WHERE expires_at <= now();

  INSERT INTO public.manychat_destination_send_locks (destination_key, expires_at)
  VALUES (p_destination_key, now() + make_interval(secs => greatest(p_ttl_seconds, 15)))
  ON CONFLICT (destination_key) DO NOTHING;

  GET DIAGNOSTICS got_lock = ROW_COUNT;
  RETURN got_lock;
END;
$$;


ALTER FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_cron_job"("p_jobid" bigint, "p_schedule" "text" DEFAULT NULL::"text", "p_active" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'cron'
    AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF p_schedule IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, schedule := p_schedule); END IF;
  IF p_active IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, active := p_active); END IF;
END; $$;


ALTER FUNCTION "public"."update_system_cron_job"("p_jobid" bigint, "p_schedule" "text", "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_client"("_user_id" "uuid", "_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH client_scope AS (
    SELECT id, tenant_id, agency_id, is_seo_client, services
    FROM public.clients
    WHERE id = _client_id
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM client_scope c
    WHERE
      public.is_super_admin(_user_id)
      OR (
        (public.has_role(_user_id, 'owner'::app_role) OR public.has_role(_user_id, 'agency_owner'::app_role))
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.tenant_users tu
          WHERE tu.user_id = _user_id
            AND tu.role IN ('owner', 'agency_owner')
            AND (
              c.tenant_id = tu.tenant_id
              OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
            )
        )
      )
      OR (
        public.has_role(_user_id, 'team_manager'::app_role)
        AND public.user_manages_agency(_user_id, c.agency_id)
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.tenant_users tu
          WHERE tu.user_id = _user_id
            AND tu.role = 'team_manager'
            AND (
              c.tenant_id = tu.tenant_id
              OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
            )
        )
        AND public.user_manages_agency(_user_id, c.agency_id)
      )
      OR (
        public.has_role(_user_id, 'sales_person'::app_role)
        AND c.agency_id = ANY(COALESCE(public.get_user_sales_person_agency_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        public.has_role(_user_id, 'campaigner'::app_role)
        AND c.id = ANY(COALESCE(public.get_user_client_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        public.user_has_seo_scope(_user_id)
        AND (
          c.is_seo_client = true
          OR c.services @> '["seo"]'::jsonb
        )
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."user_can_access_client"("_user_id" "uuid", "_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_crm_table"("_user_id" "uuid", "_table_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH table_scope AS (
    SELECT id, tenant_id, agency_id, client_id
    FROM public.crm_tables
    WHERE id = _table_id
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM table_scope t
    WHERE
      public.is_super_admin(_user_id)
      OR (
        t.client_id IS NOT NULL
        AND public.user_can_access_client(_user_id, t.client_id)
      )
      OR (
        NOT public.user_is_restricted_client_viewer(_user_id)
        AND t.client_id IS NULL
        AND (
          t.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, t.agency_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."user_can_access_crm_table"("_user_id" "uuid", "_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'owner')
        OR l.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
        OR l.agency_id = ANY (public.get_user_sales_person_agency_ids(auth.uid()))
        OR public.user_has_cross_tenant_agency_access(auth.uid(), l.agency_id)
        OR (
          l.tenant_id = public.get_effective_tenant_id()
          AND (
            l.agency_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.agency_tenant_access ata
              WHERE ata.agency_id = l.agency_id
                AND ata.accessing_tenant_id = public.get_effective_tenant_id()
            )
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") IS 'Whether the current user may view/create lead_updates for this lead';



CREATE OR REPLACE FUNCTION "public"."user_can_delete_users_for_tenant"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = check_tenant_id
        AND ur.role IN ('owner'::public.app_role, 'agency_owner'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = check_tenant_id
        AND tu.role IN ('owner', 'agency_owner')
    );
$$;


ALTER FUNCTION "public"."user_can_delete_users_for_tenant"("check_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_campaigners_for_tenant"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = check_tenant_id
        AND ur.role IN ('owner'::public.app_role, 'team_manager'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = check_tenant_id
        AND tu.role IN ('owner', 'agency_owner', 'team_manager')
    );
$$;


ALTER FUNCTION "public"."user_can_manage_campaigners_for_tenant"("check_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_crm_dashboard"("_user_id" "uuid", "_tenant_id" "uuid", "_agency_id" "uuid", "_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      _client_id IS NOT NULL
      AND public.user_can_access_client(_user_id, _client_id)
    )
    OR (
      NOT public.user_is_restricted_client_viewer(_user_id)
      AND (
        _tenant_id = public.get_user_tenant_id(_user_id)
        OR (
          _agency_id IS NOT NULL
          AND public.user_has_cross_tenant_agency_access(_user_id, _agency_id)
        )
      )
    );
$$;


ALTER FUNCTION "public"."user_can_manage_crm_dashboard"("_user_id" "uuid", "_tenant_id" "uuid", "_agency_id" "uuid", "_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_view_campaigner"("_user_id" "uuid", "_campaigner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT is_super_admin(_user_id)
  OR
  EXISTS (
    SELECT 1 FROM campaigners c
    WHERE c.id = _campaigner_id
    AND c.tenant_id = get_user_tenant_id(_user_id)
    AND has_role(_user_id, 'owner'::app_role)
  )
  OR
  EXISTS (
    SELECT 1 FROM campaigners c
    JOIN campaigner_agencies ca ON ca.campaigner_id = c.id
    WHERE c.id = _campaigner_id
    AND has_role(_user_id, 'team_manager'::app_role)
    AND user_manages_agency(_user_id, ca.agency_id)
  )
  OR
  (get_user_campaigner_id(_user_id) = _campaigner_id)
$$;


ALTER FUNCTION "public"."user_can_view_campaigner"("_user_id" "uuid", "_campaigner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_agency_access"("_user_id" "uuid", "_agency_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
    WHERE p.id = _user_id AND ca.agency_id = _agency_id
  )
$$;


ALTER FUNCTION "public"."user_has_agency_access"("_user_id" "uuid", "_agency_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_calendar_access"("_accessor_user_id" "uuid", "_owner_user_id" "uuid", "_required_permission" "text" DEFAULT 'view'::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    _accessor_user_id = _owner_user_id
    OR
    EXISTS (
      SELECT 1 FROM public.calendar_shares
      WHERE owner_user_id = _owner_user_id
        AND shared_with_user_id = _accessor_user_id
        AND (
          permission_level = 'full'
          OR
          (permission_level = 'book' AND _required_permission IN ('view', 'book'))
          OR
          (permission_level = 'view' AND _required_permission = 'view')
        )
    )
    OR
    is_super_admin(_accessor_user_id)
$$;


ALTER FUNCTION "public"."user_has_calendar_access"("_accessor_user_id" "uuid", "_owner_user_id" "uuid", "_required_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_cross_tenant_agency_access"("_user_id" "uuid", "_agency_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.agency_id = _agency_id AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  )
$$;


ALTER FUNCTION "public"."user_has_cross_tenant_agency_access"("_user_id" "uuid", "_agency_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_cross_tenant_client_access"("p_user_id" "uuid", "p_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = p_client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
  )
$$;


ALTER FUNCTION "public"."user_has_cross_tenant_client_access"("p_user_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_cross_tenant_integration_access"("_user_id" "uuid", "_integration_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = _integration_tenant_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$$;


ALTER FUNCTION "public"."user_has_cross_tenant_integration_access"("_user_id" "uuid", "_integration_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_integration_access"("p_integration_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE v_integration RECORD;
    BEGIN
      SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id;
      IF NOT FOUND THEN RETURN FALSE; END IF;
      IF v_integration.user_id = auth.uid() THEN RETURN TRUE; END IF;
      IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
        RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = auth.uid());
      END IF;
      IF v_integration.connection_visibility = 'shared' THEN
        RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = auth.uid());
      END IF;
      RETURN FALSE;
    END; $$;


ALTER FUNCTION "public"."user_has_integration_access"("p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_integration_permission"("p_user_id" "uuid", "p_integration_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE v_integration RECORD;
    BEGIN
      SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id;
      IF NOT FOUND THEN RETURN FALSE; END IF;
      IF is_super_admin(p_user_id) THEN RETURN TRUE; END IF;
      IF v_integration.user_id = p_user_id THEN RETURN TRUE; END IF;
      IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
        RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = p_user_id);
      END IF;
      IF v_integration.connection_visibility = 'shared' THEN
        RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = p_user_id);
      END IF;
      RETURN FALSE;
    END; $$;


ALTER FUNCTION "public"."user_has_integration_permission"("p_user_id" "uuid", "p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.has_role(_user_id, 'seo'::app_role)
    OR public.is_seo_staff(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.campaigners c ON c.id = p.campaigner_id
      WHERE p.id = _user_id
        AND c.role @> ARRAY['SEO']::text[]
    );
$$;


ALTER FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") IS 'True for seo app_role, pure SEO staff (is_seo_staff), or any campaigner profile tagged SEO (including hybrid קמפיינר+SEO).';



CREATE OR REPLACE FUNCTION "public"."user_is_restricted_client_viewer"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    _user_id IS NOT NULL
    AND NOT public.is_super_admin(_user_id)
    AND NOT public.has_role(_user_id, 'owner'::app_role)
    AND NOT public.has_role(_user_id, 'team_manager'::app_role)
    AND (
      public.has_role(_user_id, 'campaigner'::app_role)
      OR public.has_role(_user_id, 'seo'::app_role)
    );
$$;


ALTER FUNCTION "public"."user_is_restricted_client_viewer"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_tenant_member"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    AND tenant_id = check_tenant_id
  );
$$;


ALTER FUNCTION "public"."user_is_tenant_member"("check_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_manages_agency"("_user_id" "uuid", "_agency_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_managed_agencies
    WHERE user_id = _user_id AND agency_id = _agency_id
  )
$$;


ALTER FUNCTION "public"."user_manages_agency"("_user_id" "uuid", "_agency_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_owns_agency"("_user_id" "uuid", "_agency_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = _agency_id AND a.tenant_id = public.get_user_tenant_id(_user_id)
  )
$$;


ALTER FUNCTION "public"."user_owns_agency"("_user_id" "uuid", "_agency_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_owns_integration"("p_integration_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_integrations 
    WHERE id = p_integration_id 
    AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."user_owns_integration"("p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_crm_record"("p_table_id" "uuid", "p_data" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  field RECORD;
  value TEXT;
BEGIN
  FOR field IN 
    SELECT * FROM public.crm_fields 
    WHERE table_id = p_table_id AND is_required = true
  LOOP
    IF NOT p_data ? field.key THEN
      RAISE EXCEPTION 'Required field % is missing', field.key;
    END IF;
    
    value := p_data->>field.key;
    
    IF value IS NOT NULL AND value != '' THEN
      CASE field.type
        WHEN 'number' THEN
          IF value !~ '^-?[0-9]+\.?[0-9]*$' THEN
            RAISE EXCEPTION 'Field % must be a number', field.key;
          END IF;
        WHEN 'email' THEN
          IF value !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Field % must be a valid email', field.key;
          END IF;
        WHEN 'url' THEN
          IF value !~ '^https?://' THEN
            RAISE EXCEPTION 'Field % must be a valid URL', field.key;
          END IF;
        WHEN 'checkbox' THEN
          IF value NOT IN ('true', 'false') THEN
            RAISE EXCEPTION 'Field % must be a boolean', field.key;
          END IF;
        ELSE
          NULL;
      END CASE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$_$;


ALTER FUNCTION "public"."validate_crm_record"("p_table_id" "uuid", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wa_lid_map_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."wa_lid_map_touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_campag" (
    "campaigner_id" "uuid",
    "agency_id" "uuid"
);


ALTER TABLE "public"."_d_campag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_prof" (
    "email" "text",
    "old_id" "uuid",
    "campaigner_id" "uuid",
    "sales_person_id" "uuid"
);


ALTER TABLE "public"."_d_prof" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_spag" (
    "sales_person_id" "uuid",
    "agency_id" "uuid"
);


ALTER TABLE "public"."_d_spag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_tu" (
    "email" "text",
    "role" "text",
    "tenant_id" "uuid"
);


ALTER TABLE "public"."_d_tu" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_uma" (
    "email" "text",
    "agency_id" "uuid"
);


ALTER TABLE "public"."_d_uma" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_d_ur" (
    "email" "text",
    "role" "text",
    "tenant_id" "uuid"
);


ALTER TABLE "public"."_d_ur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_pol_log" (
    "seq" integer NOT NULL,
    "stmt" "text",
    "err" "text"
);


ALTER TABLE "public"."_pol_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_pol_log_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_pol_log_seq_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_pol_log_seq_seq" OWNED BY "public"."_pol_log"."seq";



CREATE TABLE IF NOT EXISTS "public"."_pol_stage" (
    "part" integer NOT NULL,
    "chunk" "text"
);


ALTER TABLE "public"."_pol_stage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_sqlbuf" (
    "row_id" integer,
    "seq" integer,
    "chunk" "text"
);


ALTER TABLE "public"."_sqlbuf" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "phone" "text",
    "email" "text",
    "status" "public"."agency_status" DEFAULT 'active'::"public"."agency_status" NOT NULL,
    "start_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_link" "text",
    "tenant_id" "uuid",
    "is_default" boolean DEFAULT false
);

ALTER TABLE ONLY "public"."agencies" REPLICA IDENTITY FULL;


ALTER TABLE "public"."agencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_tenant_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_tenant_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "accessing_tenant_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'read_write'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "notes" "text",
    CONSTRAINT "agency_tenant_access_access_level_check" CHECK (("access_level" = ANY (ARRAY['read_only'::"text", 'read_write'::"text"])))
);


ALTER TABLE "public"."agency_tenant_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_action_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "action_type" "text" NOT NULL,
    "action_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "user_id" "uuid",
    "conversation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tokens_in" integer,
    "tokens_out" integer,
    "cost_usd" numeric(10,6),
    "duration_ms" integer,
    "tool_calls" integer,
    "model" "text",
    "run_id" "uuid",
    "step_index" integer,
    "step_kind" "text",
    "thought" "text",
    "observation" "jsonb"
);


ALTER TABLE "public"."agent_action_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_approval_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "requested_by" "uuid",
    "action_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "context" "jsonb",
    "proposed_changes" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "execution_result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tool_name" "text",
    "tool_input" "jsonb",
    "run_id" "uuid",
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."agent_approval_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_batch_reports" (
    "batch_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_batch_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_batch_reports" IS 'One row per delegate_parallel batch whose aggregated WhatsApp report was sent. PK batch_id = atomic single-send claim (run-agent-task).';



CREATE TABLE IF NOT EXISTS "public"."agent_brain_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "route_type" "text" DEFAULT 'internal'::"text" NOT NULL,
    "provider" "text",
    "connection_id" "uuid",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_brain_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_channel_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "brain_route_id" "uuid",
    "provider" "text" NOT NULL,
    "external_session_id" "text",
    "external_run_id" "text",
    "external_url" "text",
    "conversation_key" "text",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "parliament_run_id" "uuid",
    "parliament_round" integer,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."agent_channel_sessions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."agent_channel_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_eval_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "eval_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "total_cases" integer DEFAULT 0 NOT NULL,
    "passed_cases" integer DEFAULT 0 NOT NULL,
    "avg_score" numeric(5,2),
    "results" "jsonb" DEFAULT '[]'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."agent_eval_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_evals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "dataset" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pass_threshold" integer DEFAULT 70 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_evals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "target_date" "date",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_knowledge_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "parent_folder_id" "uuid",
    "name" "text" NOT NULL,
    "icon" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_knowledge_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_knowledge_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "folder_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text",
    "kind" "text" DEFAULT 'note'::"text" NOT NULL,
    "url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_knowledge_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_mcp_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "transport" "text" DEFAULT 'http'::"text" NOT NULL,
    "state" "text" DEFAULT 'ready'::"text" NOT NULL,
    "auth_url" "text",
    "oauth_tokens" "jsonb",
    "client_metadata" "jsonb",
    "available_tools" "jsonb" DEFAULT '[]'::"jsonb",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_mcp_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'conversation'::"text" NOT NULL,
    "subcategory" "text",
    "path" "text",
    "entity_type" "text",
    "entity_id" "text",
    "title" "text" NOT NULL,
    "summary" "text",
    "summary_embedding" "public"."vector"(1536),
    "importance" integer DEFAULT 50 NOT NULL,
    "ref_date" "date",
    "valid_until" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "memory_type" "public"."agent_memory_layer" DEFAULT 'semantic'::"public"."agent_memory_layer" NOT NULL,
    "contact_phone" "text",
    "fts" "tsvector"
);


ALTER TABLE "public"."agent_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "goal" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "current_step" integer DEFAULT 0 NOT NULL,
    "max_steps" integer DEFAULT 12 NOT NULL,
    "final_answer" "text",
    "error_message" "text",
    "pending_approval_id" "uuid",
    "model" "text",
    "total_tokens_in" integer DEFAULT 0 NOT NULL,
    "total_tokens_out" integer DEFAULT 0 NOT NULL,
    "total_cost_usd" numeric(10,6) DEFAULT 0 NOT NULL,
    "duration_ms" integer,
    "conversation_id" "uuid",
    "trigger_source" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_run_id" "uuid",
    "delegated_to_agent_id" "uuid",
    "replay_of_run_id" "uuid"
);


ALTER TABLE "public"."agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_supervisors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "supervisor_agent_id" "uuid" NOT NULL,
    "child_agent_id" "uuid" NOT NULL,
    "routing_hint" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_supervisors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "result" "jsonb",
    "created_by" "uuid",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "schedule_type" "text" DEFAULT 'once'::"text",
    "cron_expression" "text",
    "task_skills" "jsonb",
    "task_mode" "text",
    "parallel_execution" boolean DEFAULT false,
    "parallel_subtasks" "jsonb",
    "enabled" boolean DEFAULT true,
    "scheduled_at" timestamp with time zone,
    "last_run" timestamp with time zone,
    "run_count" integer DEFAULT 0,
    "idempotency_key" "text",
    "batch_id" "text",
    "queue_position" integer,
    "is_dangerous" boolean DEFAULT true NOT NULL,
    "goal_id" "uuid"
);


ALTER TABLE "public"."agent_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agent_tasks"."idempotency_key" IS 'Optional dedupe key; a live task with the same (tenant_id, key) is reused instead of duplicated.';



COMMENT ON COLUMN "public"."agent_tasks"."batch_id" IS 'Groups subtasks spawned together by delegate_parallel for set-wise aggregation.';



COMMENT ON COLUMN "public"."agent_tasks"."queue_position" IS 'Order within a batch dangerous (serial) lane; null for safe/parallel subtasks.';



COMMENT ON COLUMN "public"."agent_tasks"."is_dangerous" IS 'TRUE = mutating/side-effecting -> serial lane; FALSE = read-only -> parallel lane.';



CREATE TABLE IF NOT EXISTS "public"."agent_tool_embeddings" (
    "tool_name" "text" NOT NULL,
    "sig" "text" NOT NULL,
    "embedding" "public"."vector"(1536) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_tool_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "description" "text",
    "input_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "handler_kind" "text" DEFAULT 'edge'::"text" NOT NULL,
    "handler_ref" "text",
    "requires_approval" boolean DEFAULT false NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "contact_phone" "text" NOT NULL,
    "display_name" "text",
    "profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_interaction_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ahrefs_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "client_id" "uuid",
    "agency_id" "uuid",
    "domain" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "report_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "report_date" "date",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comparison_data" "jsonb"
);


ALTER TABLE "public"."ahrefs_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "engine" "text" DEFAULT 'google/gemini-2.5-flash'::"text" NOT NULL,
    "personality" "text",
    "soul" "text",
    "talent" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "allowed_tools" "text"[] DEFAULT '{}'::"text"[],
    "system_prompt" "text",
    "max_tool_rounds" integer DEFAULT 3,
    "description" "text",
    "mood" "text",
    "voice" "text",
    "disabled_tools" "text"[] DEFAULT '{}'::"text"[],
    "disabled_skins" "text"[] DEFAULT '{}'::"text"[],
    "disabled_integrations" "text"[] DEFAULT '{}'::"text"[],
    "language" "text" DEFAULT 'he'::"text",
    "response_length" "text",
    "writing_style" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "brain_mode" "text" DEFAULT 'internal'::"text" NOT NULL,
    "brain_route_id" "uuid"
);


ALTER TABLE "public"."ai_agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_agents"."allowed_tools" IS 'רשימת שמות הtools שהסוכן מורשה להפעיל. ריק = גישה לכל הtools.';



COMMENT ON COLUMN "public"."ai_agents"."system_prompt" IS 'פרומפט מערכת מותאם אישית לסוכן (מחליף את הבנייה האוטומטית מ-personality/soul/talent)';



COMMENT ON COLUMN "public"."ai_agents"."max_tool_rounds" IS 'מספר מקסימלי של סיבובי tool calling (ברירת מחדל: 3)';



COMMENT ON COLUMN "public"."ai_agents"."mood" IS 'Swappable persona mood: fun|focused|tired|angry|random|NULL. Read by run-ai-agent to modulate tone only.';



COMMENT ON COLUMN "public"."ai_agents"."voice" IS 'OpenAI TTS voice id for spoken replies (alloy|echo|fable|onyx|nova|shimmer|coral|sage) or NULL for text-only.';



COMMENT ON COLUMN "public"."ai_agents"."disabled_tools" IS 'Tool names turned OFF for this agent. Empty = all tools enabled.';



COMMENT ON COLUMN "public"."ai_agents"."disabled_skins" IS 'Skin slugs turned OFF for this agent. Empty = all skins enabled.';



COMMENT ON COLUMN "public"."ai_agents"."disabled_integrations" IS 'Integration/MCP connection names turned OFF for this agent. Empty = all enabled.';



CREATE TABLE IF NOT EXISTS "public"."ai_conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "speaker" "text",
    "channel" "text",
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "event_type" "text" DEFAULT 'message'::"text" NOT NULL,
    "external_message_id" "text",
    "correlation_id" "uuid",
    "idempotency_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ai_conversation_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ai_conversation_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agent_id" "uuid",
    "brain_route_id" "uuid",
    "routing_mode" "text" DEFAULT 'internal'::"text" NOT NULL,
    "status" "text" DEFAULT 'idle'::"text" NOT NULL
);

ALTER TABLE ONLY "public"."ai_conversations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_detection_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "brand_name" "text" NOT NULL,
    "keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "competitor_names" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "url" "text",
    "description" "text"
);


ALTER TABLE "public"."ai_detection_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_detection_competitor_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "competitor_name" "text" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "is_mentioned" boolean DEFAULT false NOT NULL,
    "position" integer,
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scan_id" "text"
);


ALTER TABLE "public"."ai_detection_competitor_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_detection_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "category" "text" DEFAULT 'כללי'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."ai_detection_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_detection_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "is_mentioned" boolean DEFAULT false NOT NULL,
    "position" integer,
    "sentiment" "text",
    "response_snippet" "text",
    "citations" "text"[],
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scan_id" "text"
);


ALTER TABLE "public"."ai_detection_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_detection_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "chatgpt_score" integer,
    "gemini_score" integer,
    "perplexity_score" integer,
    "total_prompts" integer DEFAULT 0 NOT NULL,
    "mentioned_prompts" integer DEFAULT 0 NOT NULL,
    "week_start" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_detection_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "key" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "steps" "text" NOT NULL,
    "trigger_phrases" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_vector" "tsvector",
    "usage_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "success_rate" numeric(4,3) DEFAULT 1.0,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by_agent" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "slug" "text",
    "system_prompt" "text",
    "output_template" "text",
    "allowed_tools" "text"[] DEFAULT '{}'::"text"[],
    "scope" "text" DEFAULT 'tenant'::"text" NOT NULL,
    "model" "text",
    "triggers" "text"[] DEFAULT '{}'::"text"[],
    "goal" "text",
    "constraints" "text",
    "handoff_slugs" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."ai_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "source" "text" NOT NULL,
    "model" "text",
    "tokens_in" integer,
    "tokens_out" integer,
    "cost_usd" numeric(12,6),
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_usage_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aios_graph_edges" (
    "version" "text" NOT NULL,
    "edge_key" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "relation" "text" NOT NULL,
    "confidence" "text",
    "confidence_score" double precision,
    "source_file" "text",
    "source_location" "text",
    "weight" double precision
);


ALTER TABLE "public"."aios_graph_edges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aios_graph_nodes" (
    "version" "text" NOT NULL,
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "file_type" "text",
    "source_file" "text",
    "source_location" "text",
    "community" integer,
    "community_name" "text",
    "search_document" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", ((((COALESCE("label", ''::"text") || ' '::"text") || COALESCE("source_file", ''::"text")) || ' '::"text") || COALESCE("community_name", ''::"text")))) STORED
);


ALTER TABLE "public"."aios_graph_nodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aios_graph_versions" (
    "version" "text" NOT NULL,
    "commit_sha" "text",
    "status" "text" DEFAULT 'staging'::"text" NOT NULL,
    "node_count" integer DEFAULT 0 NOT NULL,
    "edge_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activated_at" timestamp with time zone,
    CONSTRAINT "aios_graph_versions_status_check" CHECK (("status" = ANY (ARRAY['staging'::"text", 'active'::"text", 'archived'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."aios_graph_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "automation_id" "uuid",
    "trigger_type" "text",
    "entity_id" "text",
    "depth" integer DEFAULT 0 NOT NULL,
    "actions_count" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."automation_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_flow_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "step_type" "text" DEFAULT 'action'::"text" NOT NULL,
    "action_type" "text",
    "label" "text",
    "configuration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "position_x" integer DEFAULT 0 NOT NULL,
    "position_y" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "parent_step_id" "uuid",
    "condition_branch" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."automation_flow_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "success" boolean NOT NULL,
    "error_message" "text",
    "payload" "jsonb",
    "response" "jsonb",
    "execution_time_ms" integer
);


ALTER TABLE "public"."automation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_shared_tenants" (
    "automation_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "shared_by" "uuid",
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."automation_shared_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_type" "public"."automation_trigger" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "action_type" "public"."automation_action" NOT NULL,
    "configuration" "jsonb" NOT NULL,
    "active" boolean DEFAULT true,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_flow" boolean DEFAULT false NOT NULL,
    "source_automation_id" "uuid",
    "source_tenant_id" "uuid"
);


ALTER TABLE "public"."automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "connection_user_id" "uuid" NOT NULL,
    "sender_phone" "text",
    "client_id" "uuid",
    "lead_id" "uuid",
    "group_id" "uuid",
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocked_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocked_contacts_at_least_one_identifier" CHECK ((("sender_phone" IS NOT NULL) OR ("client_id" IS NOT NULL) OR ("lead_id" IS NOT NULL) OR ("group_id" IS NOT NULL)))
);


ALTER TABLE "public"."blocked_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_email_domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "from_name" "text",
    "default_local" "text" DEFAULT 'noreply'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."broadcast_email_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_list_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "entity_id" "uuid",
    "name" "text",
    "phone" "text",
    "email" "text",
    "added_via" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "broadcast_list_members_added_via_check" CHECK (("added_via" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'sheet'::"text", 'rule'::"text", 'crm'::"text"]))),
    CONSTRAINT "broadcast_list_members_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['client'::"text", 'lead'::"text", 'campaigner'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."broadcast_list_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_list_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "trigger" "text" DEFAULT 'lead_created'::"text" NOT NULL,
    "filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "broadcast_list_rules_trigger_check" CHECK (("trigger" = 'lead_created'::"text"))
);


ALTER TABLE "public"."broadcast_list_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "kind" "text" DEFAULT 'static'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "auto_sync_enabled" boolean DEFAULT false NOT NULL,
    "last_synced_at" timestamp with time zone,
    "last_sync_status" "text",
    "member_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "broadcast_lists_kind_check" CHECK (("kind" = ANY (ARRAY['static'::"text", 'dynamic'::"text"]))),
    CONSTRAINT "broadcast_lists_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'google_sheet'::"text", 'crm_filter'::"text"])))
);


ALTER TABLE "public"."broadcast_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_opt_outs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone" "text",
    "email" "text",
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "reason" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "broadcast_opt_outs_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."broadcast_opt_outs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "broadcast_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "phone" "text",
    "email" "text",
    "contact_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_message_id" "text",
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_chat_id" "text",
    CONSTRAINT "broadcast_recipients_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['client'::"text", 'lead'::"text", 'campaigner'::"text", 'manual'::"text", 'wa_group'::"text"]))),
    CONSTRAINT "broadcast_recipients_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text", 'opted_out'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."broadcast_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" DEFAULT 'דיוור חדש'::"text" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "provider" "text" NOT NULL,
    "integration_id" "uuid",
    "body_text" "text",
    "media_url" "text",
    "subject" "text",
    "audience_filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'Asia/Jerusalem'::"text" NOT NULL,
    "throttle_min_seconds" integer DEFAULT 12 NOT NULL,
    "throttle_max_seconds" integer DEFAULT 20 NOT NULL,
    "daily_cap" integer DEFAULT 300 NOT NULL,
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "from_email" "text",
    "from_name" "text",
    "reply_to" "text",
    CONSTRAINT "broadcasts_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text"]))),
    CONSTRAINT "broadcasts_provider_check" CHECK (("provider" = ANY (ARRAY['green_api'::"text", 'manus_wa'::"text", 'resend'::"text"]))),
    CONSTRAINT "broadcasts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'sending'::"text", 'sent'::"text", 'paused'::"text", 'failed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid" NOT NULL,
    "permission_level" "text" DEFAULT 'full'::"text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calendar_shares_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['view'::"text", 'book'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."calendar_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "google_email" "text",
    "watch_channel_id" "text",
    "watch_resource_id" "text",
    "watch_expires_at" timestamp with time zone,
    "next_sync_token" "text",
    "last_sync_at" timestamp with time zone,
    "sync_status" "text",
    "sync_error" "text",
    "needs_reconnect" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."calendar_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "client_id" "uuid",
    "caller_user_id" "uuid" NOT NULL,
    "from_number" "text",
    "to_number" "text" NOT NULL,
    "duration" integer DEFAULT 0,
    "status" "text" DEFAULT 'initiated'::"text" NOT NULL,
    "recording_url" "text",
    "recording_duration" integer,
    "provider_call_id" "text",
    "provider" "text" DEFAULT 'paycall'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "call_logs_status_check" CHECK (("status" = ANY (ARRAY['initiated'::"text", 'ringing'::"text", 'in-progress'::"text", 'completed'::"text", 'failed'::"text", 'no-answer'::"text", 'busy'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "ad_account_id" "text",
    "alert_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "resolved_at" timestamp with time zone,
    "notified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_pulse_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "algorithm_status" "text" NOT NULL,
    "override_status" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "algorithm_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "algorithm_metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "snapshot_calculated_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cleared_at" timestamp with time zone,
    "cleared_by" "uuid",
    CONSTRAINT "campaign_pulse_overrides_override_status_check" CHECK (("override_status" = ANY (ARRAY['green'::"text", 'yellow'::"text", 'red'::"text"]))),
    CONSTRAINT "campaign_pulse_overrides_reason_check" CHECK (("char_length"(TRIM(BOTH FROM "reason")) >= 3))
);


ALTER TABLE "public"."campaign_pulse_overrides" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign_pulse_overrides" IS 'Human overrides of deterministic campaign pulse colors, with rationale for Carmen calibration.';



CREATE TABLE IF NOT EXISTS "public"."campaign_pulse_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_fresh_through" "date",
    "status" "text" NOT NULL,
    "is_ecommerce" boolean DEFAULT false NOT NULL,
    "spend_7d" numeric DEFAULT 0 NOT NULL,
    "leads_7d" numeric DEFAULT 0 NOT NULL,
    "cpl_7d" numeric,
    "cpl_change_pct" numeric,
    "purchases_7d" numeric DEFAULT 0 NOT NULL,
    "revenue_7d" numeric DEFAULT 0 NOT NULL,
    "roas_7d" numeric,
    "flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'synced_crm'::"text" NOT NULL,
    "last_meta_change_at" timestamp with time zone,
    "last_meta_change_type" "text",
    "last_meta_change_actor" "text",
    "last_meta_change_object" "text",
    "meta_change_availability" "text",
    "last_client_call_at" timestamp with time zone,
    "last_client_call_by" "text",
    "campaign_goal_mode" "text" DEFAULT 'leads'::"text" NOT NULL,
    "lead_spend_7d" numeric DEFAULT 0 NOT NULL,
    "ecommerce_spend_7d" numeric DEFAULT 0 NOT NULL,
    "roas_change_pct" numeric,
    "lead_goal_status" "text",
    "ecommerce_goal_status" "text",
    "campaign_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "campaign_pulse_snapshots_campaign_goal_mode_check" CHECK (("campaign_goal_mode" = ANY (ARRAY['leads'::"text", 'ecommerce'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "campaign_pulse_snapshots_ecommerce_goal_status_check" CHECK ((("ecommerce_goal_status" IS NULL) OR ("ecommerce_goal_status" = ANY (ARRAY['healthy'::"text", 'warning'::"text", 'critical'::"text", 'no_data'::"text"])))),
    CONSTRAINT "campaign_pulse_snapshots_lead_goal_status_check" CHECK ((("lead_goal_status" IS NULL) OR ("lead_goal_status" = ANY (ARRAY['healthy'::"text", 'warning'::"text", 'critical'::"text", 'no_data'::"text"])))),
    CONSTRAINT "campaign_pulse_snapshots_status_check" CHECK (("status" = ANY (ARRAY['healthy'::"text", 'warning'::"text", 'critical'::"text", 'no_data'::"text"])))
);


ALTER TABLE "public"."campaign_pulse_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign_pulse_snapshots" IS 'Latest deterministic campaign pulse per active client, calculated only from synced CRM data.';



COMMENT ON COLUMN "public"."campaign_pulse_snapshots"."meta_change_availability" IS 'available, no_campaign_change_in_30d, ad_account_not_connected, meta_token_unavailable, or meta_api_unavailable';



COMMENT ON COLUMN "public"."campaign_pulse_snapshots"."last_client_call_at" IS 'Timestamp of the latest client_updates row whose update_type is call.';



COMMENT ON COLUMN "public"."campaign_pulse_snapshots"."last_client_call_by" IS 'Display name or email of the user who recorded the latest client call update.';



COMMENT ON COLUMN "public"."campaign_pulse_snapshots"."campaign_breakdown" IS 'Deterministic campaign rows classified by platform objective/explicit mapping into leads, engagement, ecommerce, or unknown. Includes complete-day 3d/7d trends, weekday-normalized 28d baseline, approved target, status reason, and alert eligibility.';



CREATE TABLE IF NOT EXISTS "public"."campaign_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "entity_id" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "cron_expression" "text",
    "run_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'Asia/Jerusalem'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "last_run_status" "text",
    "last_run_error" "text",
    "next_run_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigner_agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaigner_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."campaigner_agencies" REPLICA IDENTITY FULL;


ALTER TABLE "public"."campaigner_agencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "role" "text"[],
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_link" "text",
    "tenant_id" "uuid" NOT NULL,
    "whatsapp_group_id" "text"
);

ALTER TABLE ONLY "public"."campaigners" REPLICA IDENTITY FULL;


ALTER TABLE "public"."campaigners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_access_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "private_phones" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "allowed_group_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "require_direct_address" boolean DEFAULT true NOT NULL,
    "open_member_groups" boolean DEFAULT false NOT NULL,
    "deny_message_he" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carmen_access_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_batch_deliveries" (
    "batch_id" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "automation_id" "uuid",
    "connection_user_id" "uuid",
    "chat_id" "text" NOT NULL,
    "phone_number" "text",
    "is_group" boolean DEFAULT false NOT NULL,
    "task_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "delivered_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carmen_batch_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'delivered'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."carmen_batch_deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."carmen_batch_deliveries" IS 'Delivery routing/status for delegate_parallel batches, so run-agent-task can auto-send one synthesized report to the originating WhatsApp chat when every subtask in the batch completes, instead of relying on Carmen recalling the batch_id across conversation turns.';



CREATE TABLE IF NOT EXISTS "public"."carmen_client_group_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "whatsapp_group_id" "uuid" NOT NULL,
    "allow_client_contacts" boolean DEFAULT true NOT NULL,
    "allow_assigned_campaigners" boolean DEFAULT true NOT NULL,
    "info_boundary" "text" DEFAULT 'external_only'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carmen_client_group_access_info_boundary_check" CHECK (("info_boundary" = ANY (ARRAY['external_only'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."carmen_client_group_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_command_center_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "campaigner_id" "uuid",
    "dev_escalation_tier" "text",
    "surfaces" "text"[] DEFAULT ARRAY['command_center'::"text"] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carmen_cc_access_subject_chk" CHECK ((("user_id" IS NOT NULL) OR ("campaigner_id" IS NOT NULL))),
    CONSTRAINT "carmen_command_center_access_dev_escalation_tier_check" CHECK ((("dev_escalation_tier" IS NULL) OR ("dev_escalation_tier" = ANY (ARRAY['full'::"text", 'bugfix'::"text"]))))
);


ALTER TABLE "public"."carmen_command_center_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_memory_episodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "session_ref" "text",
    "topic" "text",
    "topic_tags" "text"[] DEFAULT '{}'::"text"[],
    "summary" "text" NOT NULL,
    "summary_embedding" "public"."vector"(1536),
    "source_table" "text",
    "source_ids" "text"[] DEFAULT '{}'::"text"[],
    "participants" "jsonb" DEFAULT '[]'::"jsonb",
    "importance" smallint DEFAULT 50 NOT NULL,
    "retention_score" real DEFAULT 1.0 NOT NULL,
    "ref_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_accessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carmen_memory_episodes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."carmen_memory_outbox_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."carmen_memory_outbox_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_memory_outbox" (
    "id" bigint DEFAULT "nextval"('"public"."carmen_memory_outbox_id_seq"'::"regclass") NOT NULL,
    "tenant_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "op" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carmen_memory_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_memory_pointers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "path" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "title" "text" NOT NULL,
    "summary" "text",
    "summary_embedding" "public"."vector"(1536),
    "ref_date" timestamp with time zone,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "importance" smallint DEFAULT 50 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carmen_memory_pointers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_whatsapp_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "display_name" "text",
    "role_title" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surfaces" "text"[] DEFAULT ARRAY['whatsapp_private'::"text", 'whatsapp_group'::"text"] NOT NULL,
    "allowed_group_ids" "uuid"[],
    "scope_mode" "text" DEFAULT 'assigned_clients'::"text" NOT NULL,
    "dev_escalation_tier" "text",
    "escalation_agents" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "carmen_whatsapp_identities_dev_escalation_tier_check" CHECK ((("dev_escalation_tier" IS NULL) OR ("dev_escalation_tier" = ANY (ARRAY['full'::"text", 'bugfix'::"text"])))),
    CONSTRAINT "carmen_whatsapp_identities_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['campaigner'::"text", 'client_contact'::"text"]))),
    CONSTRAINT "carmen_whatsapp_identities_phone_format" CHECK ((("phone" = "regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text")) AND (("length"("phone") >= 9) AND ("length"("phone") <= 15)))),
    CONSTRAINT "carmen_whatsapp_identities_scope_mode_check" CHECK (("scope_mode" = ANY (ARRAY['org'::"text", 'assigned_clients'::"text", 'single_client'::"text"]))),
    CONSTRAINT "carmen_whatsapp_identities_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."carmen_whatsapp_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_whatsapp_identity_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "group_chat_id" "text" NOT NULL,
    "phone" "text",
    "whatsapp_lid" "text",
    "whatsapp_name" "text",
    "self_reported_identity" "text",
    "status" "text" DEFAULT 'awaiting_identity'::"text" NOT NULL,
    "last_prompted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carmen_whatsapp_identity_candidates_status_check" CHECK (("status" = ANY (ARRAY['awaiting_identity'::"text", 'awaiting_approval'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."carmen_whatsapp_identity_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carmen_whatsapp_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "chat_id" "text" NOT NULL,
    "phone" "text",
    "sender_name" "text",
    "agent_id" "uuid",
    "connection_user_id" "text",
    "conversation_history" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "started_by_keyword" "text" DEFAULT 'כרמן'::"text",
    "end_keyword" "text" DEFAULT 'סיימנו כרמן'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "ai_conversation_id" "uuid",
    "automation_id" "uuid",
    "integration_id" "uuid",
    "open_group" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."carmen_whatsapp_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."carmen_whatsapp_sessions"."integration_id" IS 'tenant_integrations.id of the channel that opened this session (manus_wa / green_api). NULL for pre-migration sessions.';



COMMENT ON COLUMN "public"."carmen_whatsapp_sessions"."open_group" IS 'True when the session was opened via open-member-groups mode: group not in any allow-list, replies require a direct address on every message.';



CREATE TABLE IF NOT EXISTS "public"."chat_contact_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "group_id" "uuid",
    "sender_phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_contact_tags_contact_check" CHECK ((((((("client_id" IS NOT NULL))::integer + (("lead_id" IS NOT NULL))::integer) + (("group_id" IS NOT NULL))::integer) + (("sender_phone" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."chat_contact_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "message_text" "text" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "sent_by_user_id" "uuid",
    "raw_provider_data" "jsonb" DEFAULT '{}'::"jsonb",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lead_id" "uuid",
    "provider" "public"."chat_provider" DEFAULT 'internal'::"public"."chat_provider" NOT NULL,
    "sender_phone" "text",
    "sender_name" "text",
    "is_blocked" boolean DEFAULT false NOT NULL,
    "blocked_at" timestamp with time zone,
    "blocked_by_user_id" "uuid",
    "group_id" "uuid",
    "connection_user_id" "uuid",
    "integration_id" "uuid",
    CONSTRAINT "chat_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."chat_messages"."lead_id" IS 'Lead ID if message is associated with a lead';



CREATE TABLE IF NOT EXISTS "public"."chat_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_carmen_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "actor" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "claude_carmen_audit_actor_check" CHECK (("actor" = ANY (ARRAY['claude'::"text", 'carmen'::"text"])))
);


ALTER TABLE "public"."claude_carmen_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."claude_carmen_audit" IS 'Audit trail of autonomous fixes/actions by Claude (routine sessions) or Carmen on production — for safety review.';



CREATE TABLE IF NOT EXISTS "public"."claude_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "agent_id" "uuid",
    "tool" "text" NOT NULL,
    "request_text" "text" NOT NULL,
    "context" "text",
    "branch" "text",
    "session_url" "text",
    "status" "text" DEFAULT 'dispatched'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "claude_dispatches_tool_check" CHECK (("tool" = ANY (ARRAY['request_dev_task'::"text", 'ask_claude'::"text"])))
);


ALTER TABLE "public"."claude_dispatches" OWNER TO "postgres";


COMMENT ON TABLE "public"."claude_dispatches" IS 'Carmen → Claude routine dispatches: what Carmen asked, the Claude Code session URL, and status. Powers dispatch visibility + cross-session memory in claude-mcp.';



CREATE TABLE IF NOT EXISTS "public"."client_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contact_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "role" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "username" "text",
    "password" "text",
    "url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_onboarding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "campaigner_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "status" "public"."onboarding_status" DEFAULT 'research_meeting'::"public"."onboarding_status" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."client_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_team" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "campaigner_id" "uuid" NOT NULL,
    "role_on_account" "text",
    "allocation_percent" integer DEFAULT 100,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaigner_payment" numeric DEFAULT 0,
    CONSTRAINT "client_team_allocation_percent_check" CHECK ((("allocation_percent" >= 0) AND ("allocation_percent" <= 100)))
);

ALTER TABLE ONLY "public"."client_team" REPLICA IDENTITY FULL;


ALTER TABLE "public"."client_team" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_tenant_financial_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "retainer" numeric,
    "monthly_budget" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_tenant_financial_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_tenant_financial_data" IS 'Stores tenant-specific financial data for clients, allowing each tenant to manage their own retainer and budget for shared clients';



CREATE TABLE IF NOT EXISTS "public"."client_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "update_type" "text"
);


ALTER TABLE "public"."client_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "industry" "text",
    "monthly_budget" numeric(12,2),
    "start_date" "date",
    "status" "public"."client_status" DEFAULT 'active'::"public"."client_status" NOT NULL,
    "website" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_link" "text",
    "phone" "text",
    "email" "text",
    "retainer" numeric,
    "tenant_id" "uuid",
    "is_seo_client" boolean DEFAULT false,
    "manychat_subscriber_id" "text",
    "active_chat_provider" "public"."chat_provider",
    "contact_name" "text",
    "mood_status" "public"."client_mood_status" DEFAULT 'happy'::"public"."client_mood_status",
    "whatsapp_avatar_url" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "folder_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "whatsapp_group_id" "uuid",
    "end_date" "date",
    "is_ecommerce" boolean DEFAULT false,
    "tier" "text",
    "services" "jsonb" DEFAULT '[]'::"jsonb",
    "health_score" integer DEFAULT 100,
    "overall_status" "text" DEFAULT 'green'::"text",
    "active_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "meta_ads_account_id" "text",
    "google_ads_account_id" "text",
    "monthly_fixed_expense" numeric DEFAULT 0,
    "ga_property_id" "text",
    "gsc_site_url" "text",
    "ahrefs_domain" "text",
    "seo_keyword_relevance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE ONLY "public"."clients" REPLICA IDENTITY FULL;


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."ga_property_id" IS 'Google Analytics GA4 property id (e.g. properties/123456789)';



COMMENT ON COLUMN "public"."clients"."gsc_site_url" IS 'Google Search Console site URL (e.g. sc-domain:example.com)';



COMMENT ON COLUMN "public"."clients"."ahrefs_domain" IS 'Ahrefs project domain (e.g. example.com)';



COMMENT ON COLUMN "public"."clients"."seo_keyword_relevance" IS 'Manual SEO keyword relevance overrides: { force_relevant: string[], force_irrelevant: string[] }. Used by in-app tables and public share links.';



CREATE TABLE IF NOT EXISTS "public"."communication_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'normal'::"text" NOT NULL,
    "interaction_type" "text" DEFAULT 'other'::"text",
    "note" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communication_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_dashboards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "uuid",
    "agency_id" "uuid",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_type" "text" DEFAULT 'client'::"text",
    CONSTRAINT "crm_dashboards_type_check" CHECK (("dashboard_type" = ANY (ARRAY['client'::"text", 'agency'::"text"])))
);


ALTER TABLE "public"."crm_dashboards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key" "text" NOT NULL,
    "type" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_fields_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'long_text'::"text", 'number'::"text", 'date'::"text", 'datetime'::"text", 'checkbox'::"text", 'single_select'::"text", 'multi_select'::"text", 'reference'::"text", 'email'::"text", 'phone'::"text", 'url'::"text"])))
);


ALTER TABLE "public"."crm_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid"
);


ALTER TABLE "public"."crm_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "integration_type" "text",
    "integration_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "agency_id" "uuid",
    "client_id" "uuid",
    "integrations" "jsonb" DEFAULT '[]'::"jsonb",
    "last_sync_at" timestamp with time zone,
    "campaign_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."crm_tables" OWNER TO "postgres";


COMMENT ON COLUMN "public"."crm_tables"."integration_type" IS 'Type of integration: null for regular table, facebook_insights for Facebook-linked tables';



COMMENT ON COLUMN "public"."crm_tables"."integration_settings" IS 'Integration settings JSON: page_id, ad_account_id, sync_frequency, last_sync_at, etc.';



COMMENT ON COLUMN "public"."crm_tables"."integrations" IS 'Array of platform integrations: [{type: "facebook_insights", settings: {...}}, {type: "google_ads", settings: {...}}]';



CREATE TABLE IF NOT EXISTS "public"."cursor_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "agent_id" "uuid",
    "tool" "text" NOT NULL,
    "request_text" "text" NOT NULL,
    "context" "text",
    "branch" "text",
    "session_url" "text",
    "cursor_agent_id" "text",
    "status" "text" DEFAULT 'dispatched'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "human_task_id" "uuid",
    CONSTRAINT "cursor_dispatches_tool_check" CHECK (("tool" = ANY (ARRAY['request_dev_task'::"text", 'ask_cursor'::"text"])))
);


ALTER TABLE "public"."cursor_dispatches" OWNER TO "postgres";


COMMENT ON TABLE "public"."cursor_dispatches" IS 'Carmen → Cursor Cloud Agent dispatches: what Carmen asked, the agent URL, and status. Powers visibility + cross-session memory in cursor-mcp.';



CREATE TABLE IF NOT EXISTS "public"."cursor_sticky_agents" (
    "tenant_id" "uuid" NOT NULL,
    "cursor_agent_id" "text" NOT NULL,
    "session_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cursor_sticky_agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."cursor_sticky_agents" IS 'Maps tenant → durable Cursor Cloud Agent id (bc-…). cursor-mcp reuses it via POST /v1/agents/{id}/runs.';



CREATE TABLE IF NOT EXISTS "public"."custom_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "field_key" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_fields_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['task'::"text", 'client'::"text", 'lead'::"text"]))),
    CONSTRAINT "custom_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'number'::"text", 'date'::"text", 'select'::"text", 'textarea'::"text", 'checkbox'::"text", 'email'::"text", 'phone'::"text"])))
);


ALTER TABLE "public"."custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dashboard_id" "uuid" NOT NULL,
    "share_token" "text" DEFAULT "substr"("md5"((("random"())::"text" || ("clock_timestamp"())::"text")), 1, 24) NOT NULL,
    "allowed_emails" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deleted_facebook_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "leadgen_id" "text" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deleted_facebook_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_task_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dev_task_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "actor" "text",
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dev_task_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "problem" "text",
    "expected_behavior" "text",
    "current_behavior" "text",
    "scope" "text",
    "affected_areas" "text",
    "constraints" "text",
    "acceptance_criteria" "text",
    "base_branch" "text" DEFAULT 'develop'::"text" NOT NULL,
    "environment" "text" DEFAULT 'staging'::"text" NOT NULL,
    "requested_by" "text",
    "requested_by_user_id" "uuid",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "assigned_agent" "text" DEFAULT 'cursor'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "source_conversation_id" "uuid",
    "source_message" "text",
    "cursor_session_id" "text",
    "cursor_session_url" "text",
    "pr_url" "text",
    "human_task_id" "uuid",
    "dedup_of" "uuid",
    "dispatch_error" "text",
    "brief" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dispatched_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "goal_id" "uuid",
    CONSTRAINT "dev_tasks_assigned_agent_check" CHECK (("assigned_agent" = ANY (ARRAY['cursor'::"text", 'grok'::"text", 'manus'::"text", 'claude'::"text"]))),
    CONSTRAINT "dev_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "dev_tasks_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'sent_to_cursor'::"text", 'in_progress'::"text", 'blocked'::"text", 'pr_opened'::"text", 'ready_for_review'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."dev_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "source" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_stack" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "url" "text",
    "user_id" "uuid",
    "resolved" boolean DEFAULT false,
    "sent_to_agent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "expense_type" "text" NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "expense_name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_month" "text" NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"(),
    "paid_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "expense_payments_expense_type_check" CHECK (("expense_type" = ANY (ARRAY['supplier'::"text", 'campaigner'::"text"])))
);


ALTER TABLE "public"."expense_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."finance_type" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_method" "public"."payment_method",
    "category" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid",
    CONSTRAINT "finance_amount_check" CHECK (("amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."finance" REPLICA IDENTITY FULL;


ALTER TABLE "public"."finance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_processed_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "leadgen_id" "text" NOT NULL,
    "facebook_form_id" "text",
    "processed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flow_processed_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_allowed_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label_id" "text" NOT NULL,
    "label_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gmail_allowed_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_blocked_senders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_address" "text" NOT NULL,
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gmail_blocked_senders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gmail_label_id" "text"
);


ALTER TABLE "public"."gmail_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "subject_pattern" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gmail_category_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_message_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gmail_message_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "google_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gmail_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "iteration_id" "uuid",
    "step_id" "uuid",
    "action_type" "text" NOT NULL,
    "tool_name" "text",
    "input_hash" "text",
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "goal_actions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."goal_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_blockers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocker_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "requires_human" boolean DEFAULT false NOT NULL,
    "human_action_required" "text",
    CONSTRAINT "goal_blockers_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."goal_blockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_brain_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "iteration_id" "uuid",
    "step_id" "uuid",
    "action_id" "uuid",
    "request_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cursor_session_id" "text",
    "prompt_summary" "text",
    "response_json" "jsonb",
    "error_message" "text",
    "callback_token" "text",
    "delivered_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_brain_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['plan'::"text", 'step_execute'::"text", 'efficiency_review'::"text", 'manual_guidance'::"text"]))),
    CONSTRAINT "goal_brain_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'completed'::"text", 'failed'::"text", 'busy'::"text"])))
);


ALTER TABLE "public"."goal_brain_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."goal_brain_requests" IS 'Async orchestration requests sent to Cursor Direct; completed via goal-brain-callback.';



CREATE TABLE IF NOT EXISTS "public"."goal_engine_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "input_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "handler_ref" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_engine_tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor" "text",
    "actor_user_id" "uuid",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "criterion_id" "uuid",
    "evidence_type" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_action_id" "uuid",
    "verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_loop_iterations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "iteration_number" integer NOT NULL,
    "phase" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "summary" "text",
    "context_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error_message" "text",
    CONSTRAINT "goal_loop_iterations_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."goal_loop_iterations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "due_date" "date",
    "owner_id" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_milestones_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."goal_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_model_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid",
    "iteration_id" "uuid",
    "profile" "text" NOT NULL,
    "provider" "text",
    "model" "text",
    "tokens_in" integer,
    "tokens_out" integer,
    "cost_usd" numeric(10,6),
    "latency_ms" integer,
    "error_class" "text",
    "failover_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_model_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_orchestrator_brain" (
    "tenant_id" "uuid" NOT NULL,
    "cursor_session_id" "text" NOT NULL,
    "cursor_session_url" "text",
    "session_source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_orchestrator_brain" OWNER TO "postgres";


COMMENT ON TABLE "public"."goal_orchestrator_brain" IS 'Sticky Cursor Direct session (bc-…) used as the autonomous goal engine orchestration brain per tenant.';



CREATE TABLE IF NOT EXISTS "public"."goal_plan_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "parent_step_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "action_type" "text" DEFAULT 'model'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sub_project_key" "text",
    "sub_project_label" "text",
    "parallel_track" boolean DEFAULT false NOT NULL,
    "cursor_agent_id" "text",
    "cursor_session_url" "text",
    CONSTRAINT "goal_plan_steps_action_type_check" CHECK (("action_type" = ANY (ARRAY['model'::"text", 'tool'::"text", 'cursor'::"text", 'verify'::"text", 'observe'::"text"]))),
    CONSTRAINT "goal_plan_steps_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text", 'failed'::"text", 'skipped'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."goal_plan_steps" OWNER TO "postgres";


COMMENT ON COLUMN "public"."goal_plan_steps"."sub_project_key" IS 'Stable id for a sub-project track (e.g. creative, copy, seo) — owns its own Cursor agent.';



COMMENT ON COLUMN "public"."goal_plan_steps"."parallel_track" IS 'When true, this cursor step runs in parallel with other parallel_track steps on the same goal.';



COMMENT ON COLUMN "public"."goal_plan_steps"."cursor_agent_id" IS 'Sticky Cursor agent (bc-…) dedicated to this sub-project track.';



CREATE TABLE IF NOT EXISTS "public"."goal_success_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "criterion_key" "text" NOT NULL,
    "description" "text" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "verification_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "verification_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "evidence_required" "text",
    "status" "text" DEFAULT 'NOT_TESTED'::"text" NOT NULL,
    "last_verified_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_success_criteria_status_check" CHECK (("status" = ANY (ARRAY['PASS'::"text", 'FAIL'::"text", 'UNKNOWN'::"text", 'NOT_TESTED'::"text"]))),
    CONSTRAINT "goal_success_criteria_verification_type_check" CHECK (("verification_type" = ANY (ARRAY['manual'::"text", 'http_check'::"text", 'sql_assert'::"text", 'test_pass'::"text", 'cursor_evidence'::"text", 'metric'::"text"])))
);


ALTER TABLE "public"."goal_success_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "parent_goal_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "owner_type" "text" DEFAULT 'campaigner'::"text" NOT NULL,
    "owner_id" "text",
    "progress_percent" numeric(5,2) DEFAULT 0,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "next_action" "text",
    "completion_criteria" "text",
    "owner_user_id" "uuid",
    "execution_mode" boolean DEFAULT false NOT NULL,
    "autonomous_mode" boolean DEFAULT false NOT NULL,
    "engine_status" "text" DEFAULT 'PLANNING'::"text" NOT NULL,
    "objective" "text",
    "constraints" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scope" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "risk_level" "text" DEFAULT 'READ'::"text" NOT NULL,
    "plan" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "next_run_at" timestamp with time zone,
    "last_iteration_at" timestamp with time zone,
    "iteration_count" integer DEFAULT 0 NOT NULL,
    "stuck_score" integer DEFAULT 0 NOT NULL,
    "agent_id" "uuid",
    "lock_until" timestamp with time zone,
    "lock_holder" "text",
    "cursor_agent_id" "text",
    "cursor_session_url" "text",
    CONSTRAINT "goals_engine_status_check" CHECK (("engine_status" = ANY (ARRAY['PLANNING'::"text", 'EXECUTING'::"text", 'VERIFYING'::"text", 'REPLANNING'::"text", 'BLOCKED'::"text", 'COMPLETED'::"text", 'AWAITING_BRAIN'::"text"]))),
    CONSTRAINT "goals_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "goals_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['READ'::"text", 'SAFE_WRITE'::"text", 'REVERSIBLE'::"text", 'PRODUCTION'::"text", 'DESTRUCTIVE'::"text"]))),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'in_progress'::"text", 'blocked'::"text", 'completed'::"text", 'cancelled'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."goals"."execution_mode" IS 'When true, goal is managed via Command Center execution workflow (milestones, blockers, Carmen).';



COMMENT ON COLUMN "public"."goals"."autonomous_mode" IS 'When true, autonomous-goal-worker runs the server-side loop until Completion Gate passes.';



COMMENT ON COLUMN "public"."goals"."engine_status" IS 'Autonomous engine state machine. AWAITING_BRAIN = waiting on Cursor Direct orchestrator reply.';



COMMENT ON COLUMN "public"."goals"."cursor_agent_id" IS 'Sticky Cursor Cloud Agent (bc-…) for this goal. All technical work on the goal follows up here.';



COMMENT ON COLUMN "public"."goals"."cursor_session_url" IS 'https://cursor.com/agents/bc-… for the goal sticky session.';



CREATE TABLE IF NOT EXISTS "public"."heartbeat_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tasks_reviewed" integer DEFAULT 0,
    "actions_taken" "jsonb" DEFAULT '[]'::"jsonb",
    "summary" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."heartbeat_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hidden_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "group_id" "uuid",
    "sender_phone" "text",
    "hidden_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hidden_chats_contact_check" CHECK ((((((("client_id" IS NOT NULL))::integer + (("lead_id" IS NOT NULL))::integer) + (("group_id" IS NOT NULL))::integer) + (("sender_phone" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."hidden_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "import_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_content" "text" NOT NULL,
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "records_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_history_import_type_check" CHECK (("import_type" = ANY (ARRAY['leads'::"text", 'clients'::"text"])))
);


ALTER TABLE "public"."import_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "client_name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_month" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"(),
    "received_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."income_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "account_id" "text",
    "alert_type" "text" NOT NULL,
    "reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fired_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_alerts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "consecutive_failures" integer DEFAULT 0 NOT NULL,
    "last_failure_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "is_circuit_open" boolean DEFAULT false NOT NULL,
    "cooldown_until" timestamp with time zone,
    "total_calls" integer DEFAULT 0 NOT NULL,
    "total_failures" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."integration_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_tenant_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "accessing_tenant_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_tenant_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "email" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."invitation_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "uploaded_by" "uuid",
    "file_path" "text" NOT NULL,
    "mime_type" "text",
    "vendor_name" "text",
    "invoice_number" "text",
    "invoice_date" "date",
    "total_amount" numeric,
    "currency" "text" DEFAULT 'ILS'::"text",
    "vat_amount" numeric,
    "description" "text",
    "raw_extraction" "jsonb",
    "supplier_id" "uuid",
    "client_id" "uuid",
    "agency_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "finance_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_type" "public"."job_type" DEFAULT 'workflow'::"public"."job_type" NOT NULL,
    "priority" "public"."job_priority" DEFAULT 'medium'::"public"."job_priority" NOT NULL,
    "status" "public"."job_status" DEFAULT 'queued'::"public"."job_status" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "error" "text",
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "locked_until" timestamp with time zone
);


ALTER TABLE "public"."job_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_alert_failure_notifications" (
    "automation_log_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_phone" "text",
    "lead_name" "text",
    "client_name" "text",
    "error_message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone
);


ALTER TABLE "public"."lead_alert_failure_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_alert_failure_notifications" IS 'Failed ManyChat lead-alert sends; Carmen notifies David when delivery fails.';



CREATE TABLE IF NOT EXISTS "public"."lead_filter_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_filter_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "client_id" "uuid",
    "form_id" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_notification_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_pipeline_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "stage_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_pipeline_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_sales_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "sales_person_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_sales_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "status_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" DEFAULT '#e5e7eb'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manually_read_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "group_id" "uuid",
    "sender_phone" "text",
    "marked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "at_least_one_contact" CHECK ((("client_id" IS NOT NULL) OR ("lead_id" IS NOT NULL) OR ("group_id" IS NOT NULL) OR ("sender_phone" IS NOT NULL)))
);


ALTER TABLE "public"."manually_read_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manus_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "task_id" "text" NOT NULL,
    "title" "text",
    "prompt" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "task_url" "text",
    "share_url" "text",
    "output" "jsonb",
    "credit_usage" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manus_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manychat_destination_send_locks" (
    "destination_key" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."manychat_destination_send_locks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_ab_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "stage_id" "uuid",
    "content" "text" NOT NULL,
    "label" "text",
    "selected" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_ab_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "run_id" "uuid",
    "stage_id" "uuid",
    "type" "text" NOT NULL,
    "url" "text",
    "content" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_item_transitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_stage_id" "uuid",
    "to_stage_id" "uuid",
    "triggered_by" "uuid",
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_item_transitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_media_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "bucket_path" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint,
    "width" integer,
    "height" integer,
    "duration_seconds" numeric,
    "source" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "source_message_id" "uuid",
    "caption" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ad_ready" boolean DEFAULT true NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_media_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_pipeline_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "stage_type" "public"."marketing_stage_type" NOT NULL,
    "name" "text" NOT NULL,
    "agent_id" "uuid",
    "approval_mode" "public"."marketing_approval_mode" DEFAULT 'manual'::"public"."marketing_approval_mode" NOT NULL,
    "position_x" integer DEFAULT 0 NOT NULL,
    "position_y" integer DEFAULT 0 NOT NULL,
    "parent_stage_id" "uuid",
    "configuration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_pipeline_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'מחלקת שיווק'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "track" "text" DEFAULT 'campaigns'::"text" NOT NULL
);


ALTER TABLE "public"."marketing_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error" "text",
    "model" "text",
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_stage_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "track" "text" NOT NULL,
    "stage_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "default_agent_id" "uuid",
    "default_approval_mode" "text" DEFAULT 'manual'::"text" NOT NULL,
    "default_instructions" "text",
    "default_tools" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_target" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_stage_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "trigger_type" "text" DEFAULT 'schedule'::"text" NOT NULL,
    "schedule_cron" "text",
    "schedule_preset" "text",
    "schedule_hour" integer DEFAULT 9,
    "schedule_dow" integer,
    "schedule_dom" integer,
    "event_type" "text",
    "template_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_triggers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_work_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "current_stage_id" "uuid",
    "target_channel" "text",
    "title" "text",
    "status" "public"."marketing_item_status" DEFAULT 'draft'::"public"."marketing_item_status" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_work_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."marketing_work_items"."pipeline_id" IS 'Optional workflow pipeline. General content can exist before being assigned to a client workflow.';



COMMENT ON COLUMN "public"."marketing_work_items"."client_id" IS 'Optional client assignment. NULL represents tenant-wide general content.';



CREATE TABLE IF NOT EXISTS "public"."maskyoo_manual_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "maskyoo_last9" "text" NOT NULL,
    "period_days" integer DEFAULT 30 NOT NULL,
    "incoming_count" integer,
    "unique_count" integer,
    "answered_count" integer,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maskyoo_manual_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maskyoo_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone_last9" "text" NOT NULL,
    "display_number" "text" NOT NULL,
    "label" "text",
    "client_id" "uuid",
    "category" "text" DEFAULT 'general'::"text",
    "is_ignored" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maskyoo_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maskyoo_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "base_url" "text" NOT NULL,
    "api_token" "text" NOT NULL,
    "default_user_phone" "text",
    "click2call_service" "text" DEFAULT 'onetouch'::"text" NOT NULL,
    "webhook_secret" "text",
    "last_cdr_sync_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maskyoo_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_bot_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "meeting_url" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "meeting_topic" "text",
    "provider" "text" DEFAULT 'recall'::"text" NOT NULL,
    "external_bot_id" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "status_detail" "text",
    "zoom_recording_id" "uuid",
    "calendar_event_id" "text",
    "scheduled_start" timestamp with time zone,
    "joined_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_by" "uuid",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agency_id" "uuid",
    "campaigner_ids" "uuid"[],
    "summary_scope" "text" DEFAULT 'auto'::"text" NOT NULL,
    CONSTRAINT "meeting_bot_sessions_platform_check" CHECK (("platform" = ANY (ARRAY['zoom'::"text", 'google_meet'::"text", 'teams'::"text", 'unknown'::"text"]))),
    CONSTRAINT "meeting_bot_sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'joining'::"text", 'waiting_room'::"text", 'in_meeting'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "meeting_bot_sessions_summary_scope_check" CHECK (("summary_scope" = ANY (ARRAY['auto'::"text", 'client'::"text", 'lead'::"text", 'campaigner'::"text", 'agency'::"text"])))
);


ALTER TABLE "public"."meeting_bot_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."meeting_bot_sessions" IS 'Tracks Recall.ai (or other) meeting bots dispatched as Carmen — Zoom, Google Meet, Teams.';



CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "menu_key" "text" NOT NULL,
    "custom_label" "text",
    "original_label" "text" NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "icon" "text",
    "route" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "badge" "text",
    "parent_menu_key" "text",
    "category" "text",
    CONSTRAINT "menu_items_badge_check" CHECK (("badge" = ANY (ARRAY['coming_soon'::"text", 'premium'::"text", NULL::"text"])))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_items"."parent_menu_key" IS 'References menu_key of parent item for hierarchical menus';



CREATE TABLE IF NOT EXISTS "public"."meta_whatsapp_tenant_credentials" (
    "tenant_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "token_type" "text",
    "api_token_last_4" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meta_whatsapp_tenant_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meta_whatsapp_tokens" (
    "integration_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meta_whatsapp_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."one_time_incomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "payment_month" "text" NOT NULL,
    "notes" "text",
    "is_paid" boolean DEFAULT false NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "supplier_id" "uuid",
    "expense_amount" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."one_time_incomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "description" "text",
    "payment_url" "text" NOT NULL,
    "sumit_payment_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "send_email" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_by" "uuid",
    CONSTRAINT "payment_links_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payment_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pbn_service_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "allowed_resource_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pbn_service_commands_scope_check" CHECK (("scope" = ANY (ARRAY['deploy_pbn_site'::"text", 'generate_pbn_articles'::"text"])))
);


ALTER TABLE "public"."pbn_service_commands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "event_key" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."processed_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_webhook_messages" (
    "provider" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "external_message_id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."processed_webhook_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agency_id" "uuid"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."agency_id" IS 'Optional agency association for sharing products with connected tenants';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaigner_id" "uuid",
    "sales_person_id" "uuid",
    "calendar_iframe_code" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "phone" "text",
    "avatar_url" "text",
    "notification_group_link" "text",
    "ui_mode" "text" DEFAULT 'classic'::"text" NOT NULL,
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."calendar_iframe_code" IS 'Google Calendar iframe embed code for user personal calendar';



CREATE TABLE IF NOT EXISTS "public"."publishing_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "site_id" "uuid",
    "import_id" "uuid",
    "customer_name" "text",
    "primary_keyword" "text" NOT NULL,
    "proposed_topic" "text",
    "target_url" "text",
    "anchor_text" "text",
    "category" "text",
    "slug" "text",
    "title" "text",
    "excerpt" "text",
    "content" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "internal_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'imported'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "live_url" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_month" "date",
    "source_sheet" "text",
    "source_row" integer,
    "row_fingerprint" "text",
    "hero_image_url" "text",
    "inline_image_url" "text",
    "image_alt" "text",
    "faq" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "infographic" "jsonb" DEFAULT '{"items": [], "title": ""}'::"jsonb" NOT NULL,
    CONSTRAINT "publishing_articles_status_check" CHECK (("status" = ANY (ARRAY['imported'::"text", 'draft'::"text", 'review'::"text", 'approved'::"text", 'published'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."publishing_articles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."publishing_articles"."published_at" IS 'Actual timestamp at which the article was published by the system.';



COMMENT ON COLUMN "public"."publishing_articles"."source_month" IS 'Assignment date derived from the Excel sheet month; used as the public article date.';



COMMENT ON COLUMN "public"."publishing_articles"."faq" IS 'Structured FAQ entries rendered on article pages and exposed as FAQPage JSON-LD.';



COMMENT ON COLUMN "public"."publishing_articles"."infographic" IS 'Structured, fact-safe visual summary rendered as accessible HTML.';



CREATE TABLE IF NOT EXISTS "public"."publishing_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "sheet_count" integer DEFAULT 1 NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "imported_count" integer DEFAULT 0 NOT NULL,
    "duplicate_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "error_message" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "publishing_imports_duplicate_count_check" CHECK (("duplicate_count" >= 0)),
    CONSTRAINT "publishing_imports_imported_count_check" CHECK (("imported_count" >= 0)),
    CONSTRAINT "publishing_imports_row_count_check" CHECK (("row_count" >= 0)),
    CONSTRAINT "publishing_imports_sheet_count_check" CHECK (("sheet_count" > 0)),
    CONSTRAINT "publishing_imports_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."publishing_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publishing_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "destination_type" "text" DEFAULT 'pbn'::"text" NOT NULL,
    "client_id" "uuid",
    "connection_id" "text",
    "base_url" "text",
    "categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    CONSTRAINT "publishing_sites_destination_type_check" CHECK (("destination_type" = ANY (ARRAY['pbn'::"text", 'wordpress'::"text", 'custom_api'::"text"]))),
    CONSTRAINT "publishing_sites_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."publishing_sites" OWNER TO "postgres";


COMMENT ON COLUMN "public"."publishing_sites"."connection_id" IS 'External destination identifier, for example a Vercel project ID or WordPress connection UUID.';



COMMENT ON COLUMN "public"."publishing_sites"."is_hidden" IS 'Hides destinations that are not relevant to the tenant publishing workflow.';



CREATE TABLE IF NOT EXISTS "public"."pulse_instant_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "rule_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "recipient_phone" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_key" "text",
    "fingerprint" "text",
    "severity_score" numeric,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "pulse_instant_alert_log_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['no_contact'::"text", 'cpl_spike'::"text", 'connection_lost'::"text", 'campaign_exception'::"text"])))
);


ALTER TABLE "public"."pulse_instant_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_alert_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_id" "uuid" NOT NULL,
    "keyword_id" "uuid",
    "message" "text" NOT NULL,
    "old_position" integer,
    "new_position" integer,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rank_tracking_alert_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "threshold" integer DEFAULT 5 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notify_email" boolean DEFAULT true NOT NULL,
    "notify_whatsapp" boolean DEFAULT false NOT NULL,
    "last_triggered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rank_tracking_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['position_drop'::"text", 'position_gain'::"text", 'left_top10'::"text", 'entered_top10'::"text", 'competitor_overtake'::"text"])))
);


ALTER TABLE "public"."rank_tracking_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rank_tracking_competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword_id" "uuid" NOT NULL,
    "position" integer,
    "url_found" "text",
    "serp_features" "jsonb" DEFAULT '[]'::"jsonb",
    "competitors_data" "jsonb" DEFAULT '[]'::"jsonb",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rank_tracking_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_keywords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "keyword" "text" NOT NULL,
    "target_url" "text",
    "current_position" integer,
    "previous_position" integer,
    "best_position" integer,
    "worst_position" integer,
    "position_change" integer DEFAULT 0,
    "found_url" "text",
    "search_volume" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rank_tracking_keywords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rank_tracking_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "agency_id" "uuid",
    "name" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "country" "text" DEFAULT 'il'::"text" NOT NULL,
    "language" "text" DEFAULT 'he'::"text" NOT NULL,
    "device" "text" DEFAULT 'desktop'::"text" NOT NULL,
    "check_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rank_tracking_projects_check_frequency_check" CHECK (("check_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'manual'::"text"]))),
    CONSTRAINT "rank_tracking_projects_device_check" CHECK (("device" = ANY (ARRAY['desktop'::"text", 'mobile'::"text", 'tablet'::"text"])))
);


ALTER TABLE "public"."rank_tracking_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recording_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recording_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "metric" "text" NOT NULL,
    "comparison_type" "text" NOT NULL,
    "operator" "text" NOT NULL,
    "threshold" numeric NOT NULL,
    "is_percentage" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_triggered_at" timestamp with time zone,
    "last_triggered_data" "jsonb"
);


ALTER TABLE "public"."report_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "active" boolean DEFAULT true NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "notes" "text",
    "folder_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."sales_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_person_agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_person_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sales_person_agencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seo_call_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "incoming_count" integer DEFAULT 0 NOT NULL,
    "is_manual" boolean DEFAULT false NOT NULL,
    "note" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seo_call_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seo_monthly_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "share_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seo_monthly_shares" OWNER TO "postgres";


COMMENT ON TABLE "public"."seo_monthly_shares" IS 'Public slideshow shares for SEO monthly work reports. snapshot is refreshed live from seo_monthly_updates on each public open.';



CREATE TABLE IF NOT EXISTS "public"."seo_monthly_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "status" "public"."seo_monthly_status" NOT NULL,
    "notes" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."seo_monthly_updates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."seo_monthly_updates"."work" IS 'Monthly SEO work log: { summary, onsite[], articles[], links[] }. Used by the SEO report "עבודה חודשית" tab.';



CREATE TABLE IF NOT EXISTS "public"."service_health_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "service" "text" NOT NULL,
    "status" "text" NOT NULL,
    "latency_ms" integer,
    "detail" "text",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_health_checks_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'warn'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."service_health_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signature_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "file_url" "text",
    "document_type" "text" DEFAULT 'created'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "business_stamp_name" "text",
    "business_stamp_company_id" "text",
    "signed_file_url" "text",
    "is_template" boolean DEFAULT false NOT NULL,
    "template_name" "text",
    "document_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "lead_id" "uuid",
    "client_id" "uuid",
    "saved_to_entity_at" timestamp with time zone,
    CONSTRAINT "signature_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['created'::"text", 'uploaded'::"text"]))),
    CONSTRAINT "signature_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'partially_signed'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."signature_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signature_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "ip_address" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signature_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['sent'::"text", 'viewed'::"text", 'signed'::"text", 'declined'::"text", 'pdf_generated'::"text"])))
);


ALTER TABLE "public"."signature_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signature_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'signer'::"text",
    "sign_order" integer DEFAULT 1,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "signature_data" "text",
    "signed_at" timestamp with time zone,
    "sign_token" "uuid" DEFAULT "gen_random_uuid"(),
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "signature_position" "jsonb",
    "viewed_at" timestamp with time zone,
    "field_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "signature_recipients_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'signed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."signature_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "tracking_config_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_category" "text",
    "event_label" "text",
    "event_value" numeric,
    "event_data" "jsonb",
    "page_url" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."site_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_pageviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "tracking_config_id" "uuid" NOT NULL,
    "page_url" "text" NOT NULL,
    "page_path" "text",
    "page_title" "text",
    "time_on_page" integer DEFAULT 0,
    "scroll_depth" integer DEFAULT 0,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."site_pageviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "tracking_config_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer DEFAULT 0,
    "page_count" integer DEFAULT 0,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "referrer" "text",
    "landing_page" "text",
    "exit_page" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "screen_resolution" "text",
    "country" "text",
    "city" "text",
    "is_bounce" boolean DEFAULT false,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_tracking_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "tracking_id" "text" DEFAULT ''::"text",
    "website_domain" "text",
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{"track_forms": true, "track_clicks": true, "track_scroll": true, "track_outbound": true}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_tracking_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tracking_config_id" "uuid" NOT NULL,
    "visitor_fingerprint" "text" NOT NULL,
    "first_visit" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_visit" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visit_count" integer DEFAULT 1,
    "lead_id" "uuid",
    "client_id_ref" "uuid",
    "first_utm" "jsonb",
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid"
);


ALTER TABLE "public"."site_visitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "page_id" "uuid",
    "platform" "text" NOT NULL,
    "external_comment_id" "text" NOT NULL,
    "external_post_id" "text",
    "parent_comment_id" "text",
    "author_id" "text",
    "author_name" "text",
    "message" "text",
    "is_from_page" boolean DEFAULT false,
    "sentiment" "text",
    "replied_at" timestamp with time zone,
    "reply_text" "text",
    "hidden_at" timestamp with time zone,
    "created_at_external" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_gantt_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "topic" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "platform" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "copy_text" "text",
    "creative_url" "text",
    "creative_prompt" "text",
    "copy_prompt" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_gantt_posts_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'tiktok'::"text", 'linkedin'::"text", 'twitter'::"text"]))),
    CONSTRAINT "social_gantt_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_review'::"text", 'approved'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."social_gantt_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_media_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "channel_name" "text" NOT NULL,
    "channel_id" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_media_channels_platform_check" CHECK (("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'linkedin'::"text", 'youtube'::"text"])))
);


ALTER TABLE "public"."social_media_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_media_post_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "platform_post_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_media_post_channels_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'publishing'::"text", 'published'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."social_media_post_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_media_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "title" "text",
    "content" "text" NOT NULL,
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "post_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "wordpress_post_id" "text",
    "wordpress_site_url" "text",
    "publish_to_wordpress" boolean DEFAULT false,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_media_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'carousel'::"text", 'story'::"text", 'reel'::"text"]))),
    CONSTRAINT "social_media_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'publishing'::"text", 'published'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."social_media_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_media_wordpress_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_url" "text" NOT NULL,
    "username" "text" NOT NULL,
    "app_password" "text" NOT NULL,
    "site_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "agency_id" "uuid",
    "campaign_url_mapping" "jsonb" DEFAULT '{}'::"jsonb",
    "campaign_form_mapping" "jsonb" DEFAULT '{}'::"jsonb",
    "woocommerce_enabled" boolean DEFAULT false NOT NULL,
    "woocommerce_consumer_key" "text",
    "woocommerce_consumer_secret" "text",
    "last_woocommerce_sync_at" timestamp with time zone,
    "notes" "text",
    "woo_sync_enabled" boolean DEFAULT false NOT NULL,
    "woo_last_sync_at" timestamp with time zone
);


ALTER TABLE "public"."social_media_wordpress_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "platform" "text" NOT NULL,
    "page_id" "text" NOT NULL,
    "page_name" "text",
    "page_access_token" "text",
    "ig_business_id" "text",
    "category" "text",
    "picture_url" "text",
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_pages_shared_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "social_page_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "shared_by" "uuid",
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_pages_shared_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_publications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "page_id" "uuid",
    "platform" "text" NOT NULL,
    "post_type" "text" NOT NULL,
    "caption" "text",
    "media_url" "text",
    "external_id" "text",
    "permalink" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "published_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_publications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "invoice_name" "text" DEFAULT ''::"text" NOT NULL,
    "invoice_amount" numeric DEFAULT 0 NOT NULL,
    "invoice_date" "date",
    "invoice_month" "text" DEFAULT ''::"text" NOT NULL,
    "file_url" "text",
    "file_name" "text",
    "ai_extracted" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplier_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."supplier_type" NOT NULL,
    "related_campaigner_id" "uuid",
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_link" "text",
    "payment_1" numeric,
    "agency_id_1" "uuid",
    "payment_2" numeric,
    "agency_id_2" "uuid",
    "payment_3" numeric,
    "agency_id_3" "uuid",
    "tenant_id" "uuid",
    "payment" numeric
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_type" "text" DEFAULT 'manychat_sync'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "progress" "jsonb" DEFAULT '{"failed": 0, "results": [], "conflicts": 0, "processed": 0, "remaining": 0}'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'stopped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "share_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "allowed_emails" "text"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."table_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."task_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "campaigner_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "uuid"
);


ALTER TABLE "public"."task_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_notification_deliveries" (
    "task_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "recipient_key" "text" DEFAULT ''::"text" NOT NULL,
    "delivered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_notification_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "update_type" "text" DEFAULT 'comment'::"text" NOT NULL
);


ALTER TABLE "public"."task_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "task_type" "public"."task_type" DEFAULT 'other'::"public"."task_type",
    "agency_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "campaigner_id" "uuid",
    "due_date" "date",
    "status" "public"."task_status" DEFAULT 'open'::"public"."task_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "overdue_notified_at" timestamp with time zone,
    "sales_person_id" "uuid",
    "due_time" time without time zone,
    "sort_order" integer DEFAULT 0,
    "duration_minutes" integer DEFAULT 30,
    "google_calendar_event_id" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "priority" integer DEFAULT 5 NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "goal_id" "uuid",
    "assigned_agent" "text",
    "impersonated_by" "uuid",
    "assignment_notification_sent_at" timestamp with time zone,
    "high_priority_reminder_sent_at" timestamp with time zone,
    "high_priority_creator_notified_at" timestamp with time zone,
    "completion_creator_notified_at" timestamp with time zone,
    "self_reminder_at" timestamp with time zone,
    "self_reminder_sent_at" timestamp with time zone,
    "overdue_creator_notified_at" timestamp with time zone,
    "target_date" "date",
    "recurrence_frequency" "text",
    "recurrence_interval" integer DEFAULT 1 NOT NULL,
    "recurrence_series_id" "uuid",
    "recurrence_previous_task_id" "uuid",
    "recurrence_weekday" integer,
    "recurrence_monthday" integer,
    CONSTRAINT "tasks_recurrence_frequency_check" CHECK ((("recurrence_frequency" IS NULL) OR ("recurrence_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"])))),
    CONSTRAINT "tasks_recurrence_interval_check" CHECK (("recurrence_interval" > 0)),
    CONSTRAINT "tasks_recurrence_monthday_check" CHECK ((("recurrence_monthday" IS NULL) OR (("recurrence_monthday" >= 1) AND ("recurrence_monthday" <= 31)))),
    CONSTRAINT "tasks_recurrence_weekday_check" CHECK ((("recurrence_weekday" IS NULL) OR (("recurrence_weekday" >= 0) AND ("recurrence_weekday" <= 6))))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."impersonated_by" IS 'Authenticated super-admin who created the task while viewing as another user. created_by remains the effective business actor.';



COMMENT ON COLUMN "public"."tasks"."target_date" IS 'Deadline by which the task should be completed. due_date/due_time schedule execution on the calendar.';



CREATE TABLE IF NOT EXISTS "public"."team_channel_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT '📁'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_channel_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_channel_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."team_channel_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_channel_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "notify_enabled" boolean DEFAULT true,
    "notify_override_phone" "text",
    "notify_override_group" "text",
    CONSTRAINT "team_channel_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."team_channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_channel_whatsapp_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "whatsapp_group_id" "uuid",
    "whatsapp_chat_id" "text",
    "client_id" "uuid",
    "lead_id" "uuid",
    "display_name" "text",
    "forward_files" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."team_channel_whatsapp_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3B82F6'::"text",
    "avatar_url" "text",
    "created_by" "uuid" NOT NULL,
    "is_private" boolean DEFAULT false,
    "linked_client_id" "uuid",
    "linked_lead_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agency_id" "uuid",
    "category" "text" DEFAULT 'team'::"text" NOT NULL,
    "category_id" "uuid",
    "notification_group_link" "text"
);


ALTER TABLE "public"."team_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_chat_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "uploaded_by" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text" DEFAULT 'file'::"text" NOT NULL,
    "file_size" bigint,
    "client_id" "uuid",
    "lead_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_chat_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "linked_client_id" "uuid",
    "linked_lead_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_message_read_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_message_id" "uuid",
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_message_read_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_message_id" "uuid",
    "is_edited" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."team_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_bot_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "update_offset" bigint DEFAULT 0 NOT NULL,
    "bot_username" "text",
    "bot_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shared_from_state_id" "uuid"
);


ALTER TABLE "public"."telegram_bot_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "update_id" bigint,
    "chat_id" bigint NOT NULL,
    "text" "text",
    "direction" "text" DEFAULT 'inbound'::"text" NOT NULL,
    "sender_name" "text",
    "sender_username" "text",
    "raw_update" "jsonb",
    "client_id" "uuid",
    "lead_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."telegram_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telephony_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "personal_phone" "text",
    "virtual_number" "text",
    "auto_record" boolean DEFAULT true,
    "provider" "text" DEFAULT 'paycall'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."telephony_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_heartbeat_settings" (
    "tenant_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "interval_hours" integer DEFAULT 8 NOT NULL,
    "active_hours_start" integer DEFAULT 7 NOT NULL,
    "active_hours_end" integer DEFAULT 22 NOT NULL,
    "allowed_actions" "jsonb" DEFAULT '["reminders", "status_update", "daily_summary"]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_pulse_enabled" boolean DEFAULT false NOT NULL,
    "campaign_pulse_phone" "text",
    "campaign_pulse_last_sent_at" timestamp with time zone,
    "health_digest_last_sent_at" timestamp with time zone,
    "campaign_pulse_deliver_to_campaigners" boolean DEFAULT false NOT NULL,
    "campaign_pulse_deliver_to_team_managers" boolean DEFAULT false NOT NULL,
    "campaign_pulse_preview_phone" "text",
    "pulse_alert_rules" "jsonb" DEFAULT '{"cpl_spike_pct": 50, "no_contact_days": 14, "cpl_spike_enabled": true, "instant_wa_enabled": true, "no_contact_enabled": true, "disconnected_enabled": true}'::"jsonb" NOT NULL,
    "client_retention_last_sent_at" timestamp with time zone
);


ALTER TABLE "public"."tenant_heartbeat_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenant_heartbeat_settings"."campaign_pulse_deliver_to_campaigners" IS 'When true, scoped pulse digests are sent to each active campaigner (client_team assignments).';



COMMENT ON COLUMN "public"."tenant_heartbeat_settings"."campaign_pulse_deliver_to_team_managers" IS 'When true, scoped pulse digests are also sent to team managers for their managed agencies.';



COMMENT ON COLUMN "public"."tenant_heartbeat_settings"."campaign_pulse_preview_phone" IS 'Owner phone that receives a preview of each scoped digest immediately before it is sent to the campaigner/manager.';



COMMENT ON COLUMN "public"."tenant_heartbeat_settings"."pulse_alert_rules" IS 'Tenant-level instant pulse WhatsApp alert toggles and thresholds.';



CREATE TABLE IF NOT EXISTS "public"."tenant_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "integration_type" "text" DEFAULT 'sumit'::"text" NOT NULL,
    "api_key" "text",
    "company_id" "text",
    "is_active" boolean DEFAULT false NOT NULL,
    "auto_sync_enabled" boolean DEFAULT false NOT NULL,
    "last_sync_at" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instance_id" "text",
    "api_token_last_4" "text",
    "user_id" "uuid",
    "shared_from_integration_id" "uuid",
    "display_name" "text",
    "connection_visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    CONSTRAINT "tenant_integrations_connection_visibility_check" CHECK (("connection_visibility" = ANY (ARRAY['private'::"text", 'org'::"text", 'shared'::"text"])))
);


ALTER TABLE "public"."tenant_integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenant_integrations"."shared_from_integration_id" IS 'Reference to the original integration this connection is shared from';



CREATE TABLE IF NOT EXISTS "public"."tenant_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "max_per_minute" integer DEFAULT 300 NOT NULL,
    "current_count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_terminology" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "term_key" "text" NOT NULL,
    "singular" "text" NOT NULL,
    "plural" "text" NOT NULL,
    "original_singular" "text" NOT NULL,
    "original_plural" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_terminology" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "subdomain" "text",
    "status" "public"."tenant_status" DEFAULT 'active'::"public"."tenant_status" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "contact_email" "text",
    "contact_name" "text",
    "notes" "text",
    "parent_tenant_id" "uuid",
    "allow_super_admin_access" boolean DEFAULT true NOT NULL,
    "slug" "text" NOT NULL,
    "org_type" "public"."org_type" DEFAULT 'organization'::"public"."org_type" NOT NULL,
    "is_premium" boolean DEFAULT false,
    CONSTRAINT "sub_org_must_have_parent" CHECK ((("org_type" <> 'sub_organization'::"public"."org_type") OR (("org_type" = 'sub_organization'::"public"."org_type") AND ("parent_tenant_id" IS NOT NULL))))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenants"."settings" IS 'הגדרות JSON של הטנט, כולל team_roles - תפקידי צוות מותאמים אישית';



COMMENT ON COLUMN "public"."tenants"."parent_tenant_id" IS 'Parent tenant ID for sub-organizations';



COMMENT ON COLUMN "public"."tenants"."slug" IS 'URL-friendly unique identifier for the tenant';



CREATE TABLE IF NOT EXISTS "public"."terminology_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by_tenant_id" "uuid",
    "created_by_user_id" "uuid",
    "terms" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."terminology_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaigner_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entry_breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_entry_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."time_entry_breaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_active_tenant" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_active_tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'openai'::"text" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_managed_agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_managed_agencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module" "text" NOT NULL,
    "can_access" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_permissions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'User roles per tenant. Super admin role (with tenant_id = null) is global across all tenants.';



CREATE TABLE IF NOT EXISTS "public"."user_workspace_layout" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "module_id" "text" NOT NULL,
    "x_position" integer DEFAULT 0 NOT NULL,
    "y_position" integer DEFAULT 0 NOT NULL,
    "width" integer DEFAULT 320 NOT NULL,
    "height" integer DEFAULT 220 NOT NULL,
    "is_open" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_workspace_layout" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "group_chat_id" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "wa_id" "text",
    "name" "text",
    "contact_type" "text" DEFAULT 'unknown'::"text",
    "contact_id" "uuid",
    "contact_name" "text",
    "is_admin" boolean DEFAULT false,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_lid_map" (
    "lid" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "connection_user_id" "uuid",
    "source" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wa_lid_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_pending_activations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "integration_id" "uuid",
    "phone" "text" NOT NULL,
    "code" "text" NOT NULL,
    "activation_message_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "completed_lid" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "wa_pending_activations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."wa_pending_activations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_warm_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" DEFAULT 'חימום מספר לידים'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "optin_template_name" "text" DEFAULT 'lead_optin_confirm_he'::"text" NOT NULL,
    "optin_template_language" "text" DEFAULT 'he'::"text" NOT NULL,
    "thanks_text" "text" DEFAULT 'תודה שפניתם אלינו. זהו מספר טלפון לשליחת לידים ועדכונים. תודה שאישרתם קבלת לידים.'::"text" NOT NULL,
    "audience_source" "text" DEFAULT 'prior_meta_chats'::"text" NOT NULL,
    "audience_filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "throttle_min_seconds" integer DEFAULT 25 NOT NULL,
    "throttle_max_seconds" integer DEFAULT 45 NOT NULL,
    "daily_cap" integer DEFAULT 80 NOT NULL,
    "admin_confirmed_at" timestamp with time zone,
    "admin_confirm_phrase" "text",
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wa_warm_campaigns_audience_source_check" CHECK (("audience_source" = ANY (ARRAY['prior_meta_chats'::"text", 'clients_with_phone'::"text", 'manual'::"text"]))),
    CONSTRAINT "wa_warm_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'confirmed'::"text", 'running'::"text", 'paused'::"text", 'completed'::"text", 'canceled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."wa_warm_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_warm_opt_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "contact_name" "text",
    "source" "text" DEFAULT 'button'::"text" NOT NULL,
    "campaign_id" "uuid",
    "last_auto_reply_at" timestamp with time zone,
    "opted_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wa_warm_opt_ins_source_check" CHECK (("source" = ANY (ARRAY['button'::"text", 'inbound_text'::"text", 'manual'::"text", 'campaign'::"text"])))
);


ALTER TABLE "public"."wa_warm_opt_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_warm_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "contact_name" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_message_id" "text",
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "opted_in_at" timestamp with time zone,
    "thanked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wa_warm_recipients_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['client'::"text", 'lead'::"text", 'chat'::"text", 'manual'::"text"]))),
    CONSTRAINT "wa_warm_recipients_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text", 'skipped'::"text", 'opted_in'::"text", 'thanked'::"text"])))
);


ALTER TABLE "public"."wa_warm_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "group_chat_id" "text" NOT NULL,
    "group_name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "whatsapp_avatar_url" "text",
    "invite_link" "text"
);


ALTER TABLE "public"."whatsapp_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."whatsapp_groups"."is_blocked" IS 'When true, messages from this group will not be saved to the database';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "chat_id" "text" NOT NULL,
    "conversation_history" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."woocommerce_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "woo_customer_id" bigint NOT NULL,
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "username" "text",
    "role" "text",
    "orders_count" integer DEFAULT 0,
    "total_spent" numeric DEFAULT 0,
    "avatar_url" "text",
    "billing" "jsonb" DEFAULT '{}'::"jsonb",
    "shipping" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."woocommerce_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."woocommerce_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "woo_order_id" bigint NOT NULL,
    "order_number" "text",
    "status" "text",
    "currency" "text",
    "total" numeric DEFAULT 0,
    "subtotal" numeric DEFAULT 0,
    "total_tax" numeric DEFAULT 0,
    "shipping_total" numeric DEFAULT 0,
    "discount_total" numeric DEFAULT 0,
    "customer_id" bigint,
    "customer_email" "text",
    "customer_first_name" "text",
    "customer_last_name" "text",
    "customer_phone" "text",
    "billing" "jsonb" DEFAULT '{}'::"jsonb",
    "shipping" "jsonb" DEFAULT '{}'::"jsonb",
    "line_items" "jsonb" DEFAULT '[]'::"jsonb",
    "payment_method" "text",
    "payment_method_title" "text",
    "date_created" timestamp with time zone,
    "date_modified" timestamp with time zone,
    "date_completed" timestamp with time zone,
    "date_paid" timestamp with time zone,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "attribution" "jsonb"
);


ALTER TABLE "public"."woocommerce_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."woocommerce_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "woo_product_id" bigint NOT NULL,
    "name" "text",
    "slug" "text",
    "status" "text",
    "type" "text",
    "sku" "text",
    "price" numeric,
    "regular_price" numeric,
    "sale_price" numeric,
    "stock_quantity" integer,
    "stock_status" "text",
    "total_sales" integer DEFAULT 0,
    "categories" "jsonb" DEFAULT '[]'::"jsonb",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."woocommerce_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."woocommerce_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "orders_synced" integer DEFAULT 0,
    "products_synced" integer DEFAULT 0,
    "customers_synced" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."woocommerce_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wordpress_sites_shared_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "shared_by" "uuid",
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wordpress_sites_shared_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoom_recordings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "meeting_id" "text" NOT NULL,
    "meeting_topic" "text",
    "host_email" "text",
    "start_time" timestamp with time zone,
    "duration" integer,
    "recording_url" "text",
    "recording_password" "text",
    "recording_type" "text",
    "file_size" bigint,
    "client_id" "uuid",
    "lead_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'zoom'::"text" NOT NULL,
    "file_path" "text",
    "transcription" "text",
    "transcription_status" "text",
    "transcription_error" "text",
    "summary_file_url" "text",
    "audio_file_path" "text",
    "audio_file_paths" "text"[],
    "summary_md" "text",
    "summary_generated_at" timestamp with time zone,
    "folder_id" "uuid",
    "thumbnail_path" "text",
    "suggested_client_id" "uuid",
    "campaigner_ids" "uuid"[],
    "agency_id" "uuid",
    "summary_scope" "text",
    "calendar_event_id" "text",
    "calendar_matched_at" timestamp with time zone,
    CONSTRAINT "zoom_recordings_summary_scope_check" CHECK ((("summary_scope" IS NULL) OR ("summary_scope" = ANY (ARRAY['auto'::"text", 'client'::"text", 'lead'::"text", 'campaigner'::"text", 'agency'::"text"]))))
);


ALTER TABLE "public"."zoom_recordings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."zoom_recordings"."audio_file_path" IS 'Low-bitrate audio-only sibling of file_path, used for transcription (chrome_extension source)';



COMMENT ON COLUMN "public"."zoom_recordings"."audio_file_paths" IS 'Ordered transcription audio segments (each a standalone file under the Whisper 25MB cap); when set, transcribe-recording transcribes each and concatenates';



COMMENT ON COLUMN "public"."zoom_recordings"."agency_id" IS 'Agency that owns an agency-wide or internal meeting summary.';



COMMENT ON COLUMN "public"."zoom_recordings"."summary_scope" IS 'Summary owner: auto/client/lead/campaigner/agency. Internal people are stored in campaigner_ids.';



COMMENT ON COLUMN "public"."zoom_recordings"."calendar_event_id" IS 'Google Calendar event used to name and optionally assign this recording.';



COMMENT ON COLUMN "public"."zoom_recordings"."calendar_matched_at" IS 'When deterministic calendar/time matching was applied.';



ALTER TABLE ONLY "public"."_pol_log" ALTER COLUMN "seq" SET DEFAULT "nextval"('"public"."_pol_log_seq_seq"'::"regclass");



ALTER TABLE ONLY "public"."_pol_stage"
    ADD CONSTRAINT "_pol_stage_pkey" PRIMARY KEY ("part");



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_source_tenant_id_agency_id_accessing_t_key" UNIQUE ("source_tenant_id", "agency_id", "accessing_tenant_id");



ALTER TABLE ONLY "public"."agent_batch_reports"
    ADD CONSTRAINT "agent_batch_reports_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."agent_brain_routes"
    ADD CONSTRAINT "agent_brain_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_brain_routes"
    ADD CONSTRAINT "agent_brain_routes_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."agent_channel_sessions"
    ADD CONSTRAINT "agent_channel_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_embeddings"
    ADD CONSTRAINT "agent_tool_embeddings_pkey" PRIMARY KEY ("tool_name");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversation_messages"
    ADD CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_detection_brands"
    ADD CONSTRAINT "ai_detection_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_detection_competitor_results"
    ADD CONSTRAINT "ai_detection_competitor_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_detection_prompts"
    ADD CONSTRAINT "ai_detection_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_detection_results"
    ADD CONSTRAINT "ai_detection_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_detection_scores"
    ADD CONSTRAINT "ai_detection_scores_brand_week_unique" UNIQUE ("brand_id", "week_start");



ALTER TABLE ONLY "public"."ai_detection_scores"
    ADD CONSTRAINT "ai_detection_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_memory"
    ADD CONSTRAINT "ai_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aios_graph_edges"
    ADD CONSTRAINT "aios_graph_edges_pkey" PRIMARY KEY ("version", "edge_key");



ALTER TABLE ONLY "public"."aios_graph_nodes"
    ADD CONSTRAINT "aios_graph_nodes_pkey" PRIMARY KEY ("version", "id");



ALTER TABLE ONLY "public"."aios_graph_versions"
    ADD CONSTRAINT "aios_graph_versions_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."automation_flow_steps"
    ADD CONSTRAINT "automation_flow_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_email_domains"
    ADD CONSTRAINT "broadcast_email_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_list_members"
    ADD CONSTRAINT "broadcast_list_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_list_rules"
    ADD CONSTRAINT "broadcast_list_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_lists"
    ADD CONSTRAINT "broadcast_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_opt_outs"
    ADD CONSTRAINT "broadcast_opt_outs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_recipients"
    ADD CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_shares"
    ADD CONSTRAINT "calendar_shares_owner_user_id_shared_with_user_id_key" UNIQUE ("owner_user_id", "shared_with_user_id");



ALTER TABLE ONLY "public"."calendar_shares"
    ADD CONSTRAINT "calendar_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_tokens"
    ADD CONSTRAINT "calendar_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_tokens"
    ADD CONSTRAINT "calendar_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_pulse_overrides"
    ADD CONSTRAINT "campaign_pulse_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_pulse_snapshots"
    ADD CONSTRAINT "campaign_pulse_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_pulse_snapshots"
    ADD CONSTRAINT "campaign_pulse_snapshots_tenant_id_client_id_key" UNIQUE ("tenant_id", "client_id");



ALTER TABLE ONLY "public"."campaigner_agencies"
    ADD CONSTRAINT "campaigner_agencies_campaigner_id_agency_id_key" UNIQUE ("campaigner_id", "agency_id");



ALTER TABLE ONLY "public"."campaigner_agencies"
    ADD CONSTRAINT "campaigner_agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigners"
    ADD CONSTRAINT "campaigners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carmen_access_policies"
    ADD CONSTRAINT "carmen_access_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carmen_access_policies"
    ADD CONSTRAINT "carmen_access_policies_tenant_id_agent_id_key" UNIQUE ("tenant_id", "agent_id");



ALTER TABLE ONLY "public"."carmen_batch_deliveries"
    ADD CONSTRAINT "carmen_batch_deliveries_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."carmen_client_group_access"
    ADD CONSTRAINT "carmen_client_group_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carmen_client_group_access"
    ADD CONSTRAINT "carmen_client_group_access_tenant_id_client_id_whatsapp_gro_key" UNIQUE ("tenant_id", "client_id", "whatsapp_group_id");



ALTER TABLE ONLY "public"."carmen_command_center_access"
    ADD CONSTRAINT "carmen_command_center_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carmen_whatsapp_identities"
    ADD CONSTRAINT "carmen_whatsapp_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carmen_whatsapp_identities"
    ADD CONSTRAINT "carmen_whatsapp_identities_tenant_id_phone_key" UNIQUE ("tenant_id", "phone");



ALTER TABLE ONLY "public"."carmen_whatsapp_identity_candidates"
    ADD CONSTRAINT "carmen_whatsapp_identity_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tag_id_client_id_key" UNIQUE ("tag_id", "client_id");



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tag_id_group_id_key" UNIQUE ("tag_id", "group_id");



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tag_id_lead_id_key" UNIQUE ("tag_id", "lead_id");



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tag_id_sender_phone_key" UNIQUE ("tag_id", "sender_phone");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_tags"
    ADD CONSTRAINT "chat_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_tags"
    ADD CONSTRAINT "chat_tags_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."claude_carmen_audit"
    ADD CONSTRAINT "claude_carmen_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_dispatches"
    ADD CONSTRAINT "claude_dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_credentials"
    ADD CONSTRAINT "client_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_suppliers"
    ADD CONSTRAINT "client_suppliers_client_id_supplier_id_key" UNIQUE ("client_id", "supplier_id");



ALTER TABLE ONLY "public"."client_suppliers"
    ADD CONSTRAINT "client_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_team"
    ADD CONSTRAINT "client_team_client_id_campaigner_id_start_date_key" UNIQUE ("client_id", "campaigner_id", "start_date");



ALTER TABLE ONLY "public"."client_team"
    ADD CONSTRAINT "client_team_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_tenant_financial_data"
    ADD CONSTRAINT "client_tenant_financial_data_client_id_tenant_id_key" UNIQUE ("client_id", "tenant_id");



ALTER TABLE ONLY "public"."client_tenant_financial_data"
    ADD CONSTRAINT "client_tenant_financial_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_updates"
    ADD CONSTRAINT "client_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_dashboards"
    ADD CONSTRAINT "crm_dashboards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_fields"
    ADD CONSTRAINT "crm_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_fields"
    ADD CONSTRAINT "crm_fields_table_id_key_key" UNIQUE ("table_id", "key");



ALTER TABLE ONLY "public"."crm_records"
    ADD CONSTRAINT "crm_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."cursor_dispatches"
    ADD CONSTRAINT "cursor_dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cursor_sticky_agents"
    ADD CONSTRAINT "cursor_sticky_agents_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."custom_fields"
    ADD CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_fields"
    ADD CONSTRAINT "custom_fields_tenant_id_entity_type_field_key_key" UNIQUE ("tenant_id", "entity_type", "field_key");



ALTER TABLE ONLY "public"."dashboard_shares"
    ADD CONSTRAINT "dashboard_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_shares"
    ADD CONSTRAINT "dashboard_shares_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."deleted_facebook_leads"
    ADD CONSTRAINT "deleted_facebook_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deleted_facebook_leads"
    ADD CONSTRAINT "deleted_facebook_leads_tenant_id_leadgen_id_key" UNIQUE ("tenant_id", "leadgen_id");



ALTER TABLE ONLY "public"."dev_task_events"
    ADD CONSTRAINT "dev_task_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_payments"
    ADD CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance"
    ADD CONSTRAINT "finance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flow_processed_leads"
    ADD CONSTRAINT "flow_processed_leads_automation_id_leadgen_id_key" UNIQUE ("automation_id", "leadgen_id");



ALTER TABLE ONLY "public"."flow_processed_leads"
    ADD CONSTRAINT "flow_processed_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."gmail_allowed_labels"
    ADD CONSTRAINT "gmail_allowed_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_allowed_labels"
    ADD CONSTRAINT "gmail_allowed_labels_user_id_label_id_key" UNIQUE ("user_id", "label_id");



ALTER TABLE ONLY "public"."gmail_blocked_senders"
    ADD CONSTRAINT "gmail_blocked_senders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_blocked_senders"
    ADD CONSTRAINT "gmail_blocked_senders_user_id_email_address_key" UNIQUE ("user_id", "email_address");



ALTER TABLE ONLY "public"."gmail_categories"
    ADD CONSTRAINT "gmail_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_category_rules"
    ADD CONSTRAINT "gmail_category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_category_rules"
    ADD CONSTRAINT "gmail_category_rules_user_id_subject_pattern_key" UNIQUE ("user_id", "subject_pattern");



ALTER TABLE ONLY "public"."gmail_message_categories"
    ADD CONSTRAINT "gmail_message_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_message_categories"
    ADD CONSTRAINT "gmail_message_categories_user_id_message_id_category_id_key" UNIQUE ("user_id", "message_id", "category_id");



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."goal_actions"
    ADD CONSTRAINT "goal_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_blockers"
    ADD CONSTRAINT "goal_blockers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_engine_tools"
    ADD CONSTRAINT "goal_engine_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_engine_tools"
    ADD CONSTRAINT "goal_engine_tools_tenant_id_goal_id_name_key" UNIQUE ("tenant_id", "goal_id", "name");



ALTER TABLE ONLY "public"."goal_events"
    ADD CONSTRAINT "goal_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_evidence"
    ADD CONSTRAINT "goal_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_loop_iterations"
    ADD CONSTRAINT "goal_loop_iterations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_milestones"
    ADD CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_model_events"
    ADD CONSTRAINT "goal_model_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_orchestrator_brain"
    ADD CONSTRAINT "goal_orchestrator_brain_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."goal_plan_steps"
    ADD CONSTRAINT "goal_plan_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_success_criteria"
    ADD CONSTRAINT "goal_success_criteria_goal_id_criterion_key_key" UNIQUE ("goal_id", "criterion_key");



ALTER TABLE ONLY "public"."goal_success_criteria"
    ADD CONSTRAINT "goal_success_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hidden_chats"
    ADD CONSTRAINT "hidden_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_payments"
    ADD CONSTRAINT "income_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_tenant_access"
    ADD CONSTRAINT "integration_tenant_access_integration_id_accessing_tenant_i_key" UNIQUE ("integration_id", "accessing_tenant_id");



ALTER TABLE ONLY "public"."integration_tenant_access"
    ADD CONSTRAINT "integration_tenant_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_user_permissions"
    ADD CONSTRAINT "integration_user_permissions_integration_id_user_id_key" UNIQUE ("integration_id", "user_id");



ALTER TABLE ONLY "public"."integration_user_permissions"
    ADD CONSTRAINT "integration_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."lead_alert_failure_notifications"
    ADD CONSTRAINT "lead_alert_failure_notifications_pkey" PRIMARY KEY ("automation_log_id");



ALTER TABLE ONLY "public"."lead_filter_presets"
    ADD CONSTRAINT "lead_filter_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_notification_events"
    ADD CONSTRAINT "lead_notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_notification_events"
    ADD CONSTRAINT "lead_notification_events_tenant_id_source_external_id_key" UNIQUE ("tenant_id", "source", "external_id");



ALTER TABLE ONLY "public"."lead_pipeline_stages"
    ADD CONSTRAINT "lead_pipeline_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_pipeline_stages"
    ADD CONSTRAINT "lead_pipeline_stages_tenant_id_stage_key_key" UNIQUE ("tenant_id", "stage_key");



ALTER TABLE ONLY "public"."lead_sales_people"
    ADD CONSTRAINT "lead_sales_people_lead_id_sales_person_id_key" UNIQUE ("lead_id", "sales_person_id");



ALTER TABLE ONLY "public"."lead_sales_people"
    ADD CONSTRAINT "lead_sales_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_statuses"
    ADD CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_statuses"
    ADD CONSTRAINT "lead_statuses_tenant_id_status_key_key" UNIQUE ("tenant_id", "status_key");



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manually_read_contacts"
    ADD CONSTRAINT "manually_read_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manus_tasks"
    ADD CONSTRAINT "manus_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manychat_destination_send_locks"
    ADD CONSTRAINT "manychat_destination_send_locks_pkey" PRIMARY KEY ("destination_key");



ALTER TABLE ONLY "public"."marketing_ab_variants"
    ADD CONSTRAINT "marketing_ab_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_pipeline_stages"
    ADD CONSTRAINT "marketing_pipeline_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_pipelines"
    ADD CONSTRAINT "marketing_pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_tenant_id_menu_key_key" UNIQUE ("tenant_id", "menu_key");



ALTER TABLE ONLY "public"."meta_whatsapp_tenant_credentials"
    ADD CONSTRAINT "meta_whatsapp_tenant_credentials_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."meta_whatsapp_tokens"
    ADD CONSTRAINT "meta_whatsapp_tokens_pkey" PRIMARY KEY ("integration_id");



ALTER TABLE ONLY "public"."one_time_incomes"
    ADD CONSTRAINT "one_time_incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pbn_service_commands"
    ADD CONSTRAINT "pbn_service_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pbn_service_commands"
    ADD CONSTRAINT "pbn_service_commands_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_tenant_id_target_url_primary_keyword_pr_key" UNIQUE ("tenant_id", "target_url", "primary_keyword", "proposed_topic");



ALTER TABLE ONLY "public"."publishing_imports"
    ADD CONSTRAINT "publishing_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishing_sites"
    ADD CONSTRAINT "publishing_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishing_sites"
    ADD CONSTRAINT "publishing_sites_tenant_id_site_key_key" UNIQUE ("tenant_id", "site_key");



ALTER TABLE ONLY "public"."pulse_instant_alert_log"
    ADD CONSTRAINT "pulse_instant_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_alert_logs"
    ADD CONSTRAINT "rank_tracking_alert_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_alerts"
    ADD CONSTRAINT "rank_tracking_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_competitors"
    ADD CONSTRAINT "rank_tracking_competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_competitors"
    ADD CONSTRAINT "rank_tracking_competitors_project_id_domain_key" UNIQUE ("project_id", "domain");



ALTER TABLE ONLY "public"."rank_tracking_history"
    ADD CONSTRAINT "rank_tracking_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_keywords"
    ADD CONSTRAINT "rank_tracking_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rank_tracking_keywords"
    ADD CONSTRAINT "rank_tracking_keywords_project_id_keyword_key" UNIQUE ("project_id", "keyword");



ALTER TABLE ONLY "public"."rank_tracking_projects"
    ADD CONSTRAINT "rank_tracking_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recording_folders"
    ADD CONSTRAINT "recording_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_alerts"
    ADD CONSTRAINT "report_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_people"
    ADD CONSTRAINT "sales_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_person_agencies"
    ADD CONSTRAINT "sales_person_agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_person_agencies"
    ADD CONSTRAINT "sales_person_agencies_sales_person_id_agency_id_key" UNIQUE ("sales_person_id", "agency_id");



ALTER TABLE ONLY "public"."seo_call_snapshots"
    ADD CONSTRAINT "seo_call_snapshots_unique_period" UNIQUE ("tenant_id", "client_id", "category", "period_start", "period_end");



ALTER TABLE ONLY "public"."seo_monthly_shares"
    ADD CONSTRAINT "seo_monthly_shares_client_id_month_key" UNIQUE ("client_id", "month");



ALTER TABLE ONLY "public"."seo_monthly_shares"
    ADD CONSTRAINT "seo_monthly_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seo_monthly_shares"
    ADD CONSTRAINT "seo_monthly_shares_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."service_health_checks"
    ADD CONSTRAINT "service_health_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signature_documents"
    ADD CONSTRAINT "signature_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signature_events"
    ADD CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signature_recipients"
    ADD CONSTRAINT "signature_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_events"
    ADD CONSTRAINT "site_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_pageviews"
    ADD CONSTRAINT "site_pageviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_sessions"
    ADD CONSTRAINT "site_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_tracking_configs"
    ADD CONSTRAINT "site_tracking_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_tracking_configs"
    ADD CONSTRAINT "site_tracking_configs_tracking_id_key" UNIQUE ("tracking_id");



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_tracking_config_id_visitor_fingerprint_key" UNIQUE ("tracking_config_id", "visitor_fingerprint");



ALTER TABLE ONLY "public"."social_gantt_posts"
    ADD CONSTRAINT "social_gantt_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_media_channels"
    ADD CONSTRAINT "social_media_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_media_post_channels"
    ADD CONSTRAINT "social_media_post_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_media_post_channels"
    ADD CONSTRAINT "social_media_post_channels_post_id_channel_id_key" UNIQUE ("post_id", "channel_id");



ALTER TABLE ONLY "public"."social_media_posts"
    ADD CONSTRAINT "social_media_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_media_wordpress_sites"
    ADD CONSTRAINT "social_media_wordpress_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_pages"
    ADD CONSTRAINT "social_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_pages_shared_tenants"
    ADD CONSTRAINT "social_pages_shared_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_pages_shared_tenants"
    ADD CONSTRAINT "social_pages_shared_tenants_social_page_id_tenant_id_key" UNIQUE ("social_page_id", "tenant_id");



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_jobs"
    ADD CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_shares"
    ADD CONSTRAINT "table_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_shares"
    ADD CONSTRAINT "table_shares_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_task_id_campaigner_id_key" UNIQUE ("task_id", "campaigner_id");



ALTER TABLE ONLY "public"."task_notification_deliveries"
    ADD CONSTRAINT "task_notification_deliveries_pkey" PRIMARY KEY ("task_id", "notification_type", "recipient_key");



ALTER TABLE ONLY "public"."task_updates"
    ADD CONSTRAINT "task_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_channel_categories"
    ADD CONSTRAINT "team_channel_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_channel_invites"
    ADD CONSTRAINT "team_channel_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_channel_invites"
    ADD CONSTRAINT "team_channel_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_channel_members"
    ADD CONSTRAINT "team_channel_members_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."team_channel_members"
    ADD CONSTRAINT "team_channel_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_channel_id_whatsapp_chat_id_key" UNIQUE ("channel_id", "whatsapp_chat_id");



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_channel_id_whatsapp_group_id_key" UNIQUE ("channel_id", "whatsapp_group_id");



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_message_attachments"
    ADD CONSTRAINT "team_message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_message_reactions"
    ADD CONSTRAINT "team_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."team_message_reactions"
    ADD CONSTRAINT "team_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_message_read_status"
    ADD CONSTRAINT "team_message_read_status_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."team_message_read_status"
    ADD CONSTRAINT "team_message_read_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telephony_settings"
    ADD CONSTRAINT "telephony_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telephony_settings"
    ADD CONSTRAINT "telephony_settings_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_setting_key_key" UNIQUE ("tenant_id", "setting_key");



ALTER TABLE ONLY "public"."tenant_templates"
    ADD CONSTRAINT "tenant_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_terminology"
    ADD CONSTRAINT "tenant_terminology_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_terminology"
    ADD CONSTRAINT "tenant_terminology_tenant_id_term_key_key" UNIQUE ("tenant_id", "term_key");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."terminology_presets"
    ADD CONSTRAINT "terminology_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entry_breaks"
    ADD CONSTRAINT "time_entry_breaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_active_tenant"
    ADD CONSTRAINT "user_active_tenant_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_managed_agencies"
    ADD CONSTRAINT "user_managed_agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_managed_agencies"
    ADD CONSTRAINT "user_managed_agencies_user_id_agency_id_key" UNIQUE ("user_id", "agency_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_module_key" UNIQUE ("user_id", "module");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_tenant_unique" UNIQUE ("user_id", "role", "tenant_id");



ALTER TABLE ONLY "public"."wa_group_members"
    ADD CONSTRAINT "wa_group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_group_members"
    ADD CONSTRAINT "wa_group_members_tenant_id_group_chat_id_phone_key" UNIQUE ("tenant_id", "group_chat_id", "phone");



ALTER TABLE ONLY "public"."wa_lid_map"
    ADD CONSTRAINT "wa_lid_map_pkey" PRIMARY KEY ("lid");



ALTER TABLE ONLY "public"."wa_pending_activations"
    ADD CONSTRAINT "wa_pending_activations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_warm_campaigns"
    ADD CONSTRAINT "wa_warm_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_warm_opt_ins"
    ADD CONSTRAINT "wa_warm_opt_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_warm_opt_ins"
    ADD CONSTRAINT "wa_warm_opt_ins_tenant_id_integration_id_phone_key" UNIQUE ("tenant_id", "integration_id", "phone");



ALTER TABLE ONLY "public"."wa_warm_recipients"
    ADD CONSTRAINT "wa_warm_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_tenant_id_group_chat_id_key" UNIQUE ("tenant_id", "group_chat_id");



ALTER TABLE ONLY "public"."woocommerce_customers"
    ADD CONSTRAINT "woocommerce_customers_site_id_woo_customer_id_key" UNIQUE ("site_id", "woo_customer_id");



ALTER TABLE ONLY "public"."woocommerce_orders"
    ADD CONSTRAINT "woocommerce_orders_site_id_woo_order_id_key" UNIQUE ("site_id", "woo_order_id");



ALTER TABLE ONLY "public"."woocommerce_products"
    ADD CONSTRAINT "woocommerce_products_site_id_woo_product_id_key" UNIQUE ("site_id", "woo_product_id");



ALTER TABLE ONLY "public"."wordpress_sites_shared_tenants"
    ADD CONSTRAINT "wordpress_sites_shared_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wordpress_sites_shared_tenants"
    ADD CONSTRAINT "wordpress_sites_shared_tenants_site_id_tenant_id_key" UNIQUE ("site_id", "tenant_id");



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "agent_channel_sessions_one_running_per_provider" ON "public"."agent_channel_sessions" USING "btree" ("conversation_id", "provider") WHERE ("status" = ANY (ARRAY['running'::"text", 'waiting'::"text"]));



CREATE INDEX "agent_tasks_batch_idx" ON "public"."agent_tasks" USING "btree" ("batch_id") WHERE ("batch_id" IS NOT NULL);



CREATE INDEX "agent_tasks_danger_lane_idx" ON "public"."agent_tasks" USING "btree" ("batch_id", "queue_position") WHERE (("batch_id" IS NOT NULL) AND "is_dangerous" AND ("status" = 'queued'::"text"));



CREATE UNIQUE INDEX "agent_tasks_idempotency_uniq" ON "public"."agent_tasks" USING "btree" ("tenant_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "ai_conversation_messages_external" ON "public"."ai_conversation_messages" USING "btree" ("tenant_id", "external_message_id") WHERE ("external_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "ai_conversation_messages_idempotency" ON "public"."ai_conversation_messages" USING "btree" ("tenant_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "ai_memory_uq_user_tenant_cat_key" ON "public"."ai_memory" USING "btree" ("user_id", "tenant_id", "category", "key") NULLS NOT DISTINCT;



CREATE INDEX "ai_skills_active_lookup_idx" ON "public"."ai_skills" USING "btree" ("slug", "scope", "tenant_id", "version") WHERE ("is_active" = true);



CREATE INDEX "ai_skills_search_vector_idx" ON "public"."ai_skills" USING "gin" ("search_vector");



CREATE UNIQUE INDEX "ai_skills_slug_global_uniq" ON "public"."ai_skills" USING "btree" ("slug") WHERE ("scope" = 'global'::"text");



CREATE INDEX "ai_skills_tenant_active_idx" ON "public"."ai_skills" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "aios_graph_edges_source_idx" ON "public"."aios_graph_edges" USING "btree" ("version", "source_id");



CREATE INDEX "aios_graph_edges_target_idx" ON "public"."aios_graph_edges" USING "btree" ("version", "target_id");



CREATE INDEX "aios_graph_nodes_search_idx" ON "public"."aios_graph_nodes" USING "gin" ("search_document");



CREATE INDEX "aios_graph_nodes_version_community_idx" ON "public"."aios_graph_nodes" USING "btree" ("version", "community");



CREATE UNIQUE INDEX "aios_graph_one_active_version" ON "public"."aios_graph_versions" USING "btree" ("status") WHERE ("status" = 'active'::"text");



CREATE INDEX "automation_logs_provider_message_ids_idx" ON "public"."automation_logs" USING "gin" ("jsonb_path_query_array"("response", '$.**."messageId"'::"jsonpath", '{}'::"jsonb", false) "jsonb_path_ops");



CREATE UNIQUE INDEX "blocked_contacts_client_unique" ON "public"."blocked_contacts" USING "btree" ("tenant_id", "connection_user_id", "client_id") WHERE ("client_id" IS NOT NULL);



CREATE UNIQUE INDEX "blocked_contacts_group_unique" ON "public"."blocked_contacts" USING "btree" ("tenant_id", "connection_user_id", "group_id") WHERE ("group_id" IS NOT NULL);



CREATE UNIQUE INDEX "blocked_contacts_lead_unique" ON "public"."blocked_contacts" USING "btree" ("tenant_id", "connection_user_id", "lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE UNIQUE INDEX "blocked_contacts_phone_unique" ON "public"."blocked_contacts" USING "btree" ("tenant_id", "connection_user_id", "sender_phone") WHERE ("sender_phone" IS NOT NULL);



CREATE INDEX "campaign_pulse_overrides_client_active_idx" ON "public"."campaign_pulse_overrides" USING "btree" ("client_id", "created_at" DESC) WHERE ("cleared_at" IS NULL);



CREATE INDEX "campaign_pulse_overrides_tenant_idx" ON "public"."campaign_pulse_overrides" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "campaign_pulse_snapshots_agency_idx" ON "public"."campaign_pulse_snapshots" USING "btree" ("agency_id", "calculated_at" DESC);



CREATE INDEX "campaign_pulse_snapshots_tenant_status_idx" ON "public"."campaign_pulse_snapshots" USING "btree" ("tenant_id", "status", "calculated_at" DESC);



CREATE INDEX "carmen_access_policies_tenant_idx" ON "public"."carmen_access_policies" USING "btree" ("tenant_id", "agent_id");



CREATE UNIQUE INDEX "carmen_cc_access_campaigner_uidx" ON "public"."carmen_command_center_access" USING "btree" ("tenant_id", "agent_id", "campaigner_id") WHERE ("campaigner_id" IS NOT NULL);



CREATE UNIQUE INDEX "carmen_cc_access_user_uidx" ON "public"."carmen_command_center_access" USING "btree" ("tenant_id", "agent_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "carmen_client_group_access_lookup_idx" ON "public"."carmen_client_group_access" USING "btree" ("tenant_id", "whatsapp_group_id", "client_id");



CREATE UNIQUE INDEX "carmen_identity_candidates_lid_group_uidx" ON "public"."carmen_whatsapp_identity_candidates" USING "btree" ("tenant_id", "group_chat_id", "whatsapp_lid") WHERE ("whatsapp_lid" IS NOT NULL);



CREATE UNIQUE INDEX "carmen_identity_candidates_phone_group_uidx" ON "public"."carmen_whatsapp_identity_candidates" USING "btree" ("tenant_id", "group_chat_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "carmen_memory_episodes_embedding_idx" ON "public"."carmen_memory_episodes" USING "hnsw" ("summary_embedding" "public"."vector_cosine_ops");



CREATE INDEX "carmen_memory_pointers_embedding_idx" ON "public"."carmen_memory_pointers" USING "hnsw" ("summary_embedding" "public"."vector_cosine_ops");



CREATE UNIQUE INDEX "carmen_sessions_one_active_per_chat" ON "public"."carmen_whatsapp_sessions" USING "btree" ("tenant_id", "connection_user_id", "chat_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "carmen_whatsapp_identities_lookup_idx" ON "public"."carmen_whatsapp_identities" USING "btree" ("tenant_id", "phone", "status");



CREATE UNIQUE INDEX "chat_contact_tags_target_unique" ON "public"."chat_contact_tags" USING "btree" ("tag_id", "user_id", "client_id", "lead_id", "group_id", "sender_phone") NULLS NOT DISTINCT;



CREATE INDEX "chat_messages_integration_id_idx" ON "public"."chat_messages" USING "btree" ("integration_id", "created_at" DESC) WHERE ("integration_id" IS NOT NULL);



CREATE INDEX "idx_action_log_run" ON "public"."agent_action_log" USING "btree" ("run_id");



CREATE INDEX "idx_action_log_tenant_time" ON "public"."agent_action_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_agencies_tenant" ON "public"."agencies" USING "btree" ("tenant_id");



CREATE INDEX "idx_agency_tenant_access_accessing" ON "public"."agency_tenant_access" USING "btree" ("accessing_tenant_id", "agency_id");



CREATE INDEX "idx_agency_tenant_access_source" ON "public"."agency_tenant_access" USING "btree" ("source_tenant_id", "agency_id");



CREATE INDEX "idx_agent_action_log_run_step" ON "public"."agent_action_log" USING "btree" ("run_id", "step_index") WHERE ("run_id" IS NOT NULL);



CREATE INDEX "idx_agent_brain_routes_tenant_active" ON "public"."agent_brain_routes" USING "btree" ("tenant_id", "active");



CREATE INDEX "idx_agent_channel_sessions_conversation" ON "public"."agent_channel_sessions" USING "btree" ("conversation_id", "last_activity_at" DESC);



CREATE INDEX "idx_agent_channel_sessions_tenant_status" ON "public"."agent_channel_sessions" USING "btree" ("tenant_id", "status", "last_activity_at" DESC);



CREATE INDEX "idx_agent_goals_agent" ON "public"."agent_goals" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_goals_tenant" ON "public"."agent_goals" USING "btree" ("tenant_id");



CREATE INDEX "idx_agent_memory_contact" ON "public"."agent_memory" USING "btree" ("agent_id", "contact_phone") WHERE ("contact_phone" IS NOT NULL);



CREATE INDEX "idx_agent_memory_fts" ON "public"."agent_memory" USING "gin" ("fts");



CREATE INDEX "idx_agent_memory_type" ON "public"."agent_memory" USING "btree" ("agent_id", "memory_type");



CREATE INDEX "idx_agent_runs_agent" ON "public"."agent_runs" USING "btree" ("agent_id", "started_at" DESC);



CREATE INDEX "idx_agent_runs_approval" ON "public"."agent_runs" USING "btree" ("pending_approval_id") WHERE ("pending_approval_id" IS NOT NULL);



CREATE INDEX "idx_agent_runs_parent" ON "public"."agent_runs" USING "btree" ("parent_run_id");



CREATE INDEX "idx_agent_runs_tenant_status" ON "public"."agent_runs" USING "btree" ("tenant_id", "status", "started_at" DESC);



CREATE INDEX "idx_agent_supervisors_supervisor" ON "public"."agent_supervisors" USING "btree" ("supervisor_agent_id");



CREATE INDEX "idx_agent_supervisors_tenant" ON "public"."agent_supervisors" USING "btree" ("tenant_id");



CREATE INDEX "idx_agent_tasks_goal" ON "public"."agent_tasks" USING "btree" ("goal_id") WHERE ("goal_id" IS NOT NULL);



CREATE INDEX "idx_ahrefs_reports_client_id" ON "public"."ahrefs_reports" USING "btree" ("client_id");



CREATE INDEX "idx_ahrefs_reports_domain" ON "public"."ahrefs_reports" USING "btree" ("domain");



CREATE INDEX "idx_ahrefs_reports_report_type" ON "public"."ahrefs_reports" USING "btree" ("report_type");



CREATE INDEX "idx_ahrefs_reports_tenant_id" ON "public"."ahrefs_reports" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_ahrefs_reports_unique_domain_date_type" ON "public"."ahrefs_reports" USING "btree" ("domain", "report_date", "report_type") WHERE ("report_date" IS NOT NULL);



CREATE INDEX "idx_ai_conversation_messages_conv" ON "public"."ai_conversation_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_ai_conversations_brain_route" ON "public"."ai_conversations" USING "btree" ("tenant_id", "brain_route_id") WHERE ("brain_route_id" IS NOT NULL);



CREATE INDEX "idx_ai_detection_brands_tenant" ON "public"."ai_detection_brands" USING "btree" ("tenant_id");



CREATE INDEX "idx_ai_detection_competitor_results_brand" ON "public"."ai_detection_competitor_results" USING "btree" ("brand_id");



CREATE INDEX "idx_ai_detection_prompts_brand" ON "public"."ai_detection_prompts" USING "btree" ("brand_id");



CREATE INDEX "idx_ai_detection_results_prompt" ON "public"."ai_detection_results" USING "btree" ("prompt_id");



CREATE INDEX "idx_ai_detection_results_scan_id" ON "public"."ai_detection_results" USING "btree" ("scan_id");



CREATE INDEX "idx_ai_detection_results_scanned" ON "public"."ai_detection_results" USING "btree" ("scanned_at" DESC);



CREATE INDEX "idx_ai_detection_scores_brand_week" ON "public"."ai_detection_scores" USING "btree" ("brand_id", "week_start" DESC);



CREATE INDEX "idx_ai_usage_log_created" ON "public"."ai_usage_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_usage_log_tenant" ON "public"."ai_usage_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_akf_agent" ON "public"."agent_knowledge_folders" USING "btree" ("agent_id");



CREATE INDEX "idx_akf_parent" ON "public"."agent_knowledge_folders" USING "btree" ("parent_folder_id");



CREATE INDEX "idx_aki_agent" ON "public"."agent_knowledge_items" USING "btree" ("agent_id");



CREATE INDEX "idx_aki_embedding" ON "public"."agent_knowledge_items" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_aki_folder" ON "public"."agent_knowledge_items" USING "btree" ("folder_id");



CREATE INDEX "idx_am_agent" ON "public"."agent_memory" USING "btree" ("agent_id");



CREATE INDEX "idx_am_embedding" ON "public"."agent_memory" USING "hnsw" ("summary_embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_am_tenant_agent_category" ON "public"."agent_memory" USING "btree" ("tenant_id", "agent_id", "category");



CREATE INDEX "idx_approval_pending" ON "public"."agent_approval_queue" USING "btree" ("tenant_id", "status", "created_at" DESC);



CREATE INDEX "idx_ast_automation" ON "public"."automation_shared_tenants" USING "btree" ("automation_id");



CREATE INDEX "idx_ast_tenant" ON "public"."automation_shared_tenants" USING "btree" ("tenant_id");



CREATE INDEX "idx_automation_executions_lookup" ON "public"."automation_executions" USING "btree" ("execution_id", "entity_id", "trigger_type");



CREATE INDEX "idx_automation_executions_tenant" ON "public"."automation_executions" USING "btree" ("tenant_id", "started_at");



CREATE INDEX "idx_automation_flow_steps_automation_id" ON "public"."automation_flow_steps" USING "btree" ("automation_id");



CREATE INDEX "idx_automation_flow_steps_tenant_id" ON "public"."automation_flow_steps" USING "btree" ("tenant_id");



CREATE INDEX "idx_automation_logs_automation_id" ON "public"."automation_logs" USING "btree" ("automation_id");



CREATE INDEX "idx_automation_logs_triggered_at" ON "public"."automation_logs" USING "btree" ("triggered_at" DESC);



CREATE INDEX "idx_automations_active" ON "public"."automations" USING "btree" ("active");



CREATE INDEX "idx_automations_source_automation_id" ON "public"."automations" USING "btree" ("source_automation_id");



CREATE INDEX "idx_automations_tenant_id" ON "public"."automations" USING "btree" ("tenant_id");



CREATE INDEX "idx_automations_trigger_type" ON "public"."automations" USING "btree" ("trigger_type");



CREATE INDEX "idx_bedomains_tenant" ON "public"."broadcast_email_domains" USING "btree" ("tenant_id");



CREATE INDEX "idx_blists_tenant" ON "public"."broadcast_lists" USING "btree" ("tenant_id");



CREATE INDEX "idx_blmembers_list" ON "public"."broadcast_list_members" USING "btree" ("list_id");



CREATE INDEX "idx_blmembers_tenant" ON "public"."broadcast_list_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_blrules_enabled" ON "public"."broadcast_list_rules" USING "btree" ("trigger") WHERE ("enabled" = true);



CREATE INDEX "idx_blrules_tenant" ON "public"."broadcast_list_rules" USING "btree" ("tenant_id");



CREATE INDEX "idx_br_broadcast" ON "public"."broadcast_recipients" USING "btree" ("broadcast_id");



CREATE INDEX "idx_br_group_chat_id" ON "public"."broadcast_recipients" USING "btree" ("broadcast_id", "group_chat_id") WHERE ("group_chat_id" IS NOT NULL);



CREATE INDEX "idx_br_pending" ON "public"."broadcast_recipients" USING "btree" ("broadcast_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_br_tenant" ON "public"."broadcast_recipients" USING "btree" ("tenant_id");



CREATE INDEX "idx_broadcasts_due" ON "public"."broadcasts" USING "btree" ("scheduled_at") WHERE ("status" = ANY (ARRAY['scheduled'::"text", 'sending'::"text"]));



CREATE INDEX "idx_broadcasts_tenant" ON "public"."broadcasts" USING "btree" ("tenant_id");



CREATE INDEX "idx_calendar_shares_owner" ON "public"."calendar_shares" USING "btree" ("owner_user_id");



CREATE INDEX "idx_calendar_shares_shared_with" ON "public"."calendar_shares" USING "btree" ("shared_with_user_id");



CREATE INDEX "idx_calendar_shares_tenant" ON "public"."calendar_shares" USING "btree" ("tenant_id");



CREATE INDEX "idx_calendar_tokens_channel_id" ON "public"."calendar_tokens" USING "btree" ("watch_channel_id");



CREATE INDEX "idx_calendar_tokens_watch_expires" ON "public"."calendar_tokens" USING "btree" ("watch_expires_at");



CREATE INDEX "idx_call_logs_client" ON "public"."call_logs" USING "btree" ("client_id");



CREATE INDEX "idx_call_logs_lead" ON "public"."call_logs" USING "btree" ("lead_id");



CREATE INDEX "idx_call_logs_provider_call_id" ON "public"."call_logs" USING "btree" ("provider_call_id") WHERE ("provider_call_id" IS NOT NULL);



CREATE INDEX "idx_call_logs_tenant" ON "public"."call_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_call_logs_user" ON "public"."call_logs" USING "btree" ("caller_user_id");



CREATE INDEX "idx_campaign_alerts_open" ON "public"."campaign_alerts" USING "btree" ("tenant_id", "campaign_id", "alert_type") WHERE (("acknowledged_at" IS NULL) AND ("resolved_at" IS NULL));



CREATE INDEX "idx_campaign_alerts_tenant" ON "public"."campaign_alerts" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_campaigner_agencies_agency" ON "public"."campaigner_agencies" USING "btree" ("agency_id");



CREATE INDEX "idx_campaigner_agencies_campaigner" ON "public"."campaigner_agencies" USING "btree" ("campaigner_id");



CREATE INDEX "idx_carmen_batch_deliveries_tenant_chat" ON "public"."carmen_batch_deliveries" USING "btree" ("tenant_id", "chat_id", "status");



CREATE INDEX "idx_carmen_episodes_session_ref" ON "public"."carmen_memory_episodes" USING "btree" ("tenant_id", "session_ref") WHERE ("session_ref" IS NOT NULL);



CREATE INDEX "idx_carmen_sessions_last_message" ON "public"."carmen_whatsapp_sessions" USING "btree" ("last_message_at");



CREATE INDEX "idx_carmen_sessions_lookup" ON "public"."carmen_whatsapp_sessions" USING "btree" ("tenant_id", "chat_id", "status");



CREATE INDEX "idx_chat_contact_tags_lead_id" ON "public"."chat_contact_tags" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_chat_contact_tags_tag" ON "public"."chat_contact_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_chat_contact_tags_tenant_lead" ON "public"."chat_contact_tags" USING "btree" ("tenant_id", "lead_id");



CREATE INDEX "idx_chat_contact_tags_user" ON "public"."chat_contact_tags" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_chat_messages_client" ON "public"."chat_messages" USING "btree" ("client_id");



CREATE INDEX "idx_chat_messages_client_direction_read" ON "public"."chat_messages" USING "btree" ("client_id", "direction", "read_at") WHERE ("direction" = 'inbound'::"text");



CREATE INDEX "idx_chat_messages_connection_user" ON "public"."chat_messages" USING "btree" ("connection_user_id", "tenant_id");



CREATE INDEX "idx_chat_messages_connection_user_id" ON "public"."chat_messages" USING "btree" ("connection_user_id");



CREATE INDEX "idx_chat_messages_created" ON "public"."chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_messages_group" ON "public"."chat_messages" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_group_id" ON "public"."chat_messages" USING "btree" ("group_id");



CREATE INDEX "idx_chat_messages_is_blocked" ON "public"."chat_messages" USING "btree" ("is_blocked");



CREATE INDEX "idx_chat_messages_lead" ON "public"."chat_messages" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_lead_direction_read" ON "public"."chat_messages" USING "btree" ("lead_id", "direction", "read_at") WHERE (("direction" = 'inbound'::"text") AND ("lead_id" IS NOT NULL));



CREATE INDEX "idx_chat_messages_lead_id" ON "public"."chat_messages" USING "btree" ("lead_id");



CREATE INDEX "idx_chat_messages_provider" ON "public"."chat_messages" USING "btree" ("tenant_id", "provider", "created_at" DESC);



CREATE INDEX "idx_chat_messages_provider_msg_id" ON "public"."chat_messages" USING "btree" ((("raw_provider_data" ->> 'idMessage'::"text"))) WHERE (("raw_provider_data" ->> 'idMessage'::"text") IS NOT NULL);



CREATE INDEX "idx_chat_messages_sender_phone" ON "public"."chat_messages" USING "btree" ("sender_phone");



CREATE INDEX "idx_chat_messages_tenant" ON "public"."chat_messages" USING "btree" ("tenant_id");



CREATE INDEX "idx_chat_messages_tenant_lead" ON "public"."chat_messages" USING "btree" ("tenant_id", "lead_id");



CREATE INDEX "idx_chat_messages_tenant_sender" ON "public"."chat_messages" USING "btree" ("tenant_id", "sender_phone");



CREATE INDEX "idx_chat_messages_unlinked_thread" ON "public"."chat_messages" USING "btree" ("connection_user_id", "tenant_id", "sender_phone", "created_at" DESC) WHERE (("client_id" IS NULL) AND ("lead_id" IS NULL) AND ("group_id" IS NULL) AND ("is_blocked" = false));



CREATE INDEX "idx_chat_messages_unread" ON "public"."chat_messages" USING "btree" ("read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_chat_tags_tenant" ON "public"."chat_tags" USING "btree" ("tenant_id");



CREATE INDEX "idx_claude_carmen_audit_tenant_time" ON "public"."claude_carmen_audit" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_claude_dispatches_tenant_time" ON "public"."claude_dispatches" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_client_team_campaigner_client" ON "public"."client_team" USING "btree" ("campaigner_id", "client_id");



CREATE INDEX "idx_client_tenant_financial_data_client_tenant" ON "public"."client_tenant_financial_data" USING "btree" ("client_id", "tenant_id");



CREATE INDEX "idx_client_updates_client_id" ON "public"."client_updates" USING "btree" ("client_id");



CREATE INDEX "idx_client_updates_client_type" ON "public"."client_updates" USING "btree" ("client_id", "update_type");



CREATE INDEX "idx_client_updates_tenant_id" ON "public"."client_updates" USING "btree" ("tenant_id");



CREATE INDEX "idx_client_updates_update_type" ON "public"."client_updates" USING "btree" ("update_type");



CREATE INDEX "idx_clients_agency_name" ON "public"."clients" USING "btree" ("agency_id", "name");



CREATE INDEX "idx_clients_is_ecommerce" ON "public"."clients" USING "btree" ("tenant_id", "is_ecommerce") WHERE ("is_ecommerce" = true);



CREATE INDEX "idx_clients_manychat_subscriber" ON "public"."clients" USING "btree" ("manychat_subscriber_id");



CREATE INDEX "idx_clients_phone" ON "public"."clients" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_clients_search" ON "public"."clients" USING "btree" ("tenant_id", "name", "contact_name", "phone") WHERE (("phone" IS NOT NULL) OR ("contact_name" IS NOT NULL));



CREATE INDEX "idx_clients_tenant" ON "public"."clients" USING "btree" ("tenant_id");



CREATE INDEX "idx_clients_tenant_agency" ON "public"."clients" USING "btree" ("tenant_id", "agency_id");



CREATE INDEX "idx_clients_whatsapp_avatar" ON "public"."clients" USING "btree" ("whatsapp_avatar_url") WHERE ("whatsapp_avatar_url" IS NOT NULL);



CREATE INDEX "idx_cme_retention" ON "public"."carmen_memory_episodes" USING "btree" ("tenant_id", "retention_score");



CREATE INDEX "idx_cme_session" ON "public"."carmen_memory_episodes" USING "btree" ("tenant_id", "session_ref");



CREATE INDEX "idx_cme_tenant_date" ON "public"."carmen_memory_episodes" USING "btree" ("tenant_id", "ref_date" DESC);



CREATE INDEX "idx_cme_topic" ON "public"."carmen_memory_episodes" USING "gin" ("topic_tags");



CREATE INDEX "idx_cmo_tenant" ON "public"."carmen_memory_outbox" USING "btree" ("tenant_id");



CREATE INDEX "idx_cmo_unprocessed" ON "public"."carmen_memory_outbox" USING "btree" ("created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_cmp_active" ON "public"."carmen_memory_pointers" USING "btree" ("tenant_id", "path") WHERE ("valid_until" IS NULL);



CREATE INDEX "idx_cmp_entity" ON "public"."carmen_memory_pointers" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_cmp_metadata" ON "public"."carmen_memory_pointers" USING "gin" ("metadata");



CREATE INDEX "idx_cmp_refdate" ON "public"."carmen_memory_pointers" USING "btree" ("tenant_id", "ref_date" DESC);



CREATE INDEX "idx_cmp_tenant_cat" ON "public"."carmen_memory_pointers" USING "btree" ("tenant_id", "category", "subcategory");



CREATE INDEX "idx_cmp_tenant_path" ON "public"."carmen_memory_pointers" USING "btree" ("tenant_id", "path");



CREATE INDEX "idx_communication_logs_client_tenant" ON "public"."communication_logs" USING "btree" ("client_id", "tenant_id", "created_at" DESC);



CREATE INDEX "idx_crm_dashboards_client_id" ON "public"."crm_dashboards" USING "btree" ("client_id");



CREATE INDEX "idx_crm_dashboards_tenant_id" ON "public"."crm_dashboards" USING "btree" ("tenant_id");



CREATE INDEX "idx_crm_fields_table" ON "public"."crm_fields" USING "btree" ("table_id");



CREATE INDEX "idx_crm_records_agency" ON "public"."crm_records" USING "btree" ("agency_id");



CREATE INDEX "idx_crm_records_data" ON "public"."crm_records" USING "gin" ("data");



CREATE INDEX "idx_crm_records_table" ON "public"."crm_records" USING "btree" ("table_id");



CREATE INDEX "idx_crm_records_table_id" ON "public"."crm_records" USING "btree" ("table_id");



CREATE INDEX "idx_crm_records_tenant" ON "public"."crm_records" USING "btree" ("tenant_id");



CREATE INDEX "idx_crm_tables_agency_id" ON "public"."crm_tables" USING "btree" ("agency_id");



CREATE INDEX "idx_crm_tables_client_id" ON "public"."crm_tables" USING "btree" ("client_id");



CREATE INDEX "idx_crm_tables_tenant" ON "public"."crm_tables" USING "btree" ("tenant_id");



CREATE INDEX "idx_cs_next_run" ON "public"."campaign_schedules" USING "btree" ("next_run_at") WHERE ("enabled" = true);



CREATE INDEX "idx_cs_tenant" ON "public"."campaign_schedules" USING "btree" ("tenant_id");



CREATE INDEX "idx_cursor_dispatches_human_task" ON "public"."cursor_dispatches" USING "btree" ("human_task_id") WHERE ("human_task_id" IS NOT NULL);



CREATE INDEX "idx_cursor_dispatches_tenant_time" ON "public"."cursor_dispatches" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_dashboard_shares_dashboard" ON "public"."dashboard_shares" USING "btree" ("dashboard_id");



CREATE INDEX "idx_dashboard_shares_token" ON "public"."dashboard_shares" USING "btree" ("share_token");



CREATE INDEX "idx_dev_task_events_task" ON "public"."dev_task_events" USING "btree" ("dev_task_id", "created_at" DESC);



CREATE INDEX "idx_dev_tasks_goal" ON "public"."dev_tasks" USING "btree" ("goal_id") WHERE ("goal_id" IS NOT NULL);



CREATE INDEX "idx_dev_tasks_tenant_status" ON "public"."dev_tasks" USING "btree" ("tenant_id", "status", "updated_at" DESC);



CREATE INDEX "idx_dev_tasks_tenant_title" ON "public"."dev_tasks" USING "btree" ("tenant_id", "lower"("title"));



CREATE INDEX "idx_error_logs_resolved" ON "public"."error_logs" USING "btree" ("resolved", "sent_to_agent");



CREATE INDEX "idx_error_logs_tenant" ON "public"."error_logs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_eval_runs_eval" ON "public"."agent_eval_runs" USING "btree" ("eval_id");



CREATE INDEX "idx_evals_agent" ON "public"."agent_evals" USING "btree" ("agent_id");



CREATE INDEX "idx_expense_payments_expense" ON "public"."expense_payments" USING "btree" ("expense_type", "expense_id");



CREATE INDEX "idx_expense_payments_tenant_month" ON "public"."expense_payments" USING "btree" ("tenant_id", "payment_month");



CREATE INDEX "idx_finance_agency_date" ON "public"."finance" USING "btree" ("agency_id", "date");



CREATE INDEX "idx_finance_client_date" ON "public"."finance" USING "btree" ("client_id", "date");



CREATE INDEX "idx_finance_date" ON "public"."finance" USING "btree" ("date");



CREATE INDEX "idx_finance_supplier_date" ON "public"."finance" USING "btree" ("supplier_id", "date");



CREATE INDEX "idx_flow_processed_leads_automation" ON "public"."flow_processed_leads" USING "btree" ("automation_id", "leadgen_id");



CREATE INDEX "idx_goal_actions_goal" ON "public"."goal_actions" USING "btree" ("goal_id", "started_at" DESC);



CREATE INDEX "idx_goal_blockers_goal" ON "public"."goal_blockers" USING "btree" ("goal_id", "status");



CREATE INDEX "idx_goal_brain_requests_goal_status" ON "public"."goal_brain_requests" USING "btree" ("goal_id", "status", "created_at" DESC);



CREATE INDEX "idx_goal_brain_requests_inflight" ON "public"."goal_brain_requests" USING "btree" ("goal_id", "request_type") WHERE ("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'busy'::"text"]));



CREATE INDEX "idx_goal_events_goal" ON "public"."goal_events" USING "btree" ("goal_id", "created_at" DESC);



CREATE INDEX "idx_goal_evidence_goal" ON "public"."goal_evidence" USING "btree" ("goal_id", "verified_at" DESC);



CREATE INDEX "idx_goal_loop_iterations_goal" ON "public"."goal_loop_iterations" USING "btree" ("goal_id", "iteration_number" DESC);



CREATE INDEX "idx_goal_milestones_goal" ON "public"."goal_milestones" USING "btree" ("goal_id", "sort_order");



CREATE INDEX "idx_goal_model_events_goal" ON "public"."goal_model_events" USING "btree" ("goal_id", "created_at" DESC);



CREATE INDEX "idx_goal_plan_steps_goal" ON "public"."goal_plan_steps" USING "btree" ("goal_id", "status", "sort_order");



CREATE INDEX "idx_goal_plan_steps_parallel" ON "public"."goal_plan_steps" USING "btree" ("goal_id", "parallel_track", "status") WHERE ("parallel_track" = true);



CREATE INDEX "idx_goal_success_criteria_goal" ON "public"."goal_success_criteria" USING "btree" ("goal_id", "sort_order");



CREATE INDEX "idx_goals_autonomous_due" ON "public"."goals" USING "btree" ("next_run_at") WHERE (("autonomous_mode" = true) AND ("engine_status" <> ALL (ARRAY['COMPLETED'::"text", 'BLOCKED'::"text"])));



CREATE INDEX "idx_goals_cursor_agent" ON "public"."goals" USING "btree" ("cursor_agent_id") WHERE ("cursor_agent_id" IS NOT NULL);



CREATE INDEX "idx_hidden_chats_client" ON "public"."hidden_chats" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_hidden_chats_group" ON "public"."hidden_chats" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "idx_hidden_chats_lead" ON "public"."hidden_chats" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_hidden_chats_phone" ON "public"."hidden_chats" USING "btree" ("sender_phone") WHERE ("sender_phone" IS NOT NULL);



CREATE INDEX "idx_hidden_chats_user_tenant" ON "public"."hidden_chats" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_import_history_imported_at" ON "public"."import_history" USING "btree" ("imported_at" DESC);



CREATE INDEX "idx_import_history_tenant_id" ON "public"."import_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_income_payments_client" ON "public"."income_payments" USING "btree" ("client_id");



CREATE INDEX "idx_income_payments_tenant_month" ON "public"."income_payments" USING "btree" ("tenant_id", "payment_month");



CREATE INDEX "idx_integration_alerts_log_lookup" ON "public"."integration_alerts_log" USING "btree" ("tenant_id", "provider", "account_id", "alert_type", "fired_at" DESC);



CREATE INDEX "idx_integration_tenant_access_integration" ON "public"."integration_tenant_access" USING "btree" ("integration_id");



CREATE INDEX "idx_integration_tenant_access_tenant" ON "public"."integration_tenant_access" USING "btree" ("accessing_tenant_id");



CREATE INDEX "idx_integration_tenant_access_tenant_integration" ON "public"."integration_tenant_access" USING "btree" ("accessing_tenant_id", "integration_id");



CREATE INDEX "idx_integration_user_permissions_integration_id" ON "public"."integration_user_permissions" USING "btree" ("integration_id");



CREATE INDEX "idx_integration_user_permissions_user_id" ON "public"."integration_user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_invoice_uploads_status" ON "public"."invoice_uploads" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_invoice_uploads_tenant" ON "public"."invoice_uploads" USING "btree" ("tenant_id");



CREATE INDEX "idx_job_queue_locked" ON "public"."job_queue" USING "btree" ("locked_until") WHERE ("status" = 'running'::"public"."job_status");



CREATE INDEX "idx_job_queue_status_priority" ON "public"."job_queue" USING "btree" ("status", "priority", "created_at") WHERE ("status" = 'queued'::"public"."job_status");



CREATE INDEX "idx_job_queue_tenant" ON "public"."job_queue" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_lead_alert_failure_notifications_notified" ON "public"."lead_alert_failure_notifications" USING "btree" ("tenant_id", "notified_at" DESC);



CREATE INDEX "idx_lead_alert_failure_notifications_pending" ON "public"."lead_alert_failure_notifications" USING "btree" ("tenant_id", "created_at") WHERE ("notified_at" IS NULL);



CREATE INDEX "idx_lead_filter_presets_user_tenant" ON "public"."lead_filter_presets" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_lead_notification_events_received" ON "public"."lead_notification_events" USING "btree" ("tenant_id", "received_at" DESC);



CREATE INDEX "idx_lead_sales_people_lead_id" ON "public"."lead_sales_people" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_sales_people_sales_person_id" ON "public"."lead_sales_people" USING "btree" ("sales_person_id");



CREATE INDEX "idx_lead_sales_people_tenant_id" ON "public"."lead_sales_people" USING "btree" ("tenant_id");



CREATE INDEX "idx_lead_updates_lead_id" ON "public"."lead_updates" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_updates_user_id" ON "public"."lead_updates" USING "btree" ("user_id");



CREATE INDEX "idx_leads_agency" ON "public"."leads" USING "btree" ("agency_id");



CREATE INDEX "idx_leads_agency_company" ON "public"."leads" USING "btree" ("agency_id", "company_name");



CREATE INDEX "idx_leads_agency_id" ON "public"."leads" USING "btree" ("agency_id");



CREATE INDEX "idx_leads_client_id" ON "public"."leads" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_leads_facebook_form_id" ON "public"."leads" USING "btree" ("tenant_id", "facebook_form_id") WHERE ("facebook_form_id" IS NOT NULL);



CREATE INDEX "idx_leads_follow_up_date" ON "public"."leads" USING "btree" ("follow_up_date");



CREATE INDEX "idx_leads_manychat_subscriber" ON "public"."leads" USING "btree" ("manychat_subscriber_id");



CREATE INDEX "idx_leads_meeting_date" ON "public"."leads" USING "btree" ("meeting_date") WHERE ("meeting_date" IS NOT NULL);



CREATE INDEX "idx_leads_meeting_set_date" ON "public"."leads" USING "btree" ("meeting_set_date") WHERE ("meeting_set_date" IS NOT NULL);



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_leads_response_status" ON "public"."leads" USING "btree" ("response_status");



CREATE INDEX "idx_leads_sales_person" ON "public"."leads" USING "btree" ("sales_person_id");



CREATE INDEX "idx_leads_sales_person_id" ON "public"."leads" USING "btree" ("sales_person_id");



CREATE INDEX "idx_leads_search" ON "public"."leads" USING "btree" ("tenant_id", "company_name", "contact_name", "phone") WHERE (("phone" IS NOT NULL) OR ("contact_name" IS NOT NULL));



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_tenant_agency" ON "public"."leads" USING "btree" ("tenant_id", "agency_id");



CREATE INDEX "idx_leads_tenant_archived" ON "public"."leads" USING "btree" ("tenant_id", "archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_leads_tenant_created" ON "public"."leads" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_leads_tenant_status" ON "public"."leads" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_leads_whatsapp_avatar" ON "public"."leads" USING "btree" ("whatsapp_avatar_url") WHERE ("whatsapp_avatar_url" IS NOT NULL);



CREATE INDEX "idx_manually_read_contacts_client" ON "public"."manually_read_contacts" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_manually_read_contacts_group" ON "public"."manually_read_contacts" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "idx_manually_read_contacts_lead" ON "public"."manually_read_contacts" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_manually_read_contacts_sender_phone" ON "public"."manually_read_contacts" USING "btree" ("sender_phone") WHERE ("sender_phone" IS NOT NULL);



CREATE INDEX "idx_manually_read_contacts_user_tenant" ON "public"."manually_read_contacts" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_manus_tasks_task_id" ON "public"."manus_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_manus_tasks_tenant_id" ON "public"."manus_tasks" USING "btree" ("tenant_id");



CREATE INDEX "idx_manychat_destination_send_locks_expires" ON "public"."manychat_destination_send_locks" USING "btree" ("expires_at");



CREATE INDEX "idx_marketing_ab_variants_work_item" ON "public"."marketing_ab_variants" USING "btree" ("work_item_id");



CREATE INDEX "idx_marketing_assets_item" ON "public"."marketing_assets" USING "btree" ("item_id", "created_at" DESC);



CREATE INDEX "idx_marketing_runs_item" ON "public"."marketing_runs" USING "btree" ("item_id", "created_at" DESC);



CREATE INDEX "idx_marketing_runs_tenant_created" ON "public"."marketing_runs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_marketing_triggers_active" ON "public"."marketing_triggers" USING "btree" ("is_active", "next_run_at");



CREATE INDEX "idx_maskyoo_numbers_client" ON "public"."maskyoo_numbers" USING "btree" ("client_id");



CREATE INDEX "idx_maskyoo_numbers_tenant" ON "public"."maskyoo_numbers" USING "btree" ("tenant_id");



CREATE INDEX "idx_maskyoo_overrides_lookup" ON "public"."maskyoo_manual_overrides" USING "btree" ("tenant_id", "maskyoo_last9", "period_days");



CREATE INDEX "idx_mcp_conn_agent" ON "public"."agent_mcp_connections" USING "btree" ("agent_id");



CREATE INDEX "idx_mcp_conn_tenant" ON "public"."agent_mcp_connections" USING "btree" ("tenant_id");



CREATE INDEX "idx_meeting_bot_sessions_agency" ON "public"."meeting_bot_sessions" USING "btree" ("tenant_id", "agency_id") WHERE ("agency_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_meeting_bot_sessions_external_bot" ON "public"."meeting_bot_sessions" USING "btree" ("external_bot_id") WHERE ("external_bot_id" IS NOT NULL);



CREATE INDEX "idx_meeting_bot_sessions_status" ON "public"."meeting_bot_sessions" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_meeting_bot_sessions_tenant" ON "public"."meeting_bot_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_items_pipeline" ON "public"."marketing_work_items" USING "btree" ("pipeline_id");



CREATE INDEX "idx_mkt_items_stage" ON "public"."marketing_work_items" USING "btree" ("current_stage_id");



CREATE INDEX "idx_mkt_stages_pipeline" ON "public"."marketing_pipeline_stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_mkt_transitions_item" ON "public"."marketing_item_transitions" USING "btree" ("item_id");



CREATE INDEX "idx_mml_client" ON "public"."marketing_media_library" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_mml_lead" ON "public"."marketing_media_library" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_mml_tags" ON "public"."marketing_media_library" USING "gin" ("tags");



CREATE INDEX "idx_mml_tenant" ON "public"."marketing_media_library" USING "btree" ("tenant_id");



CREATE INDEX "idx_one_time_incomes_tenant_month" ON "public"."one_time_incomes" USING "btree" ("tenant_id", "payment_month");



CREATE INDEX "idx_optout_tenant" ON "public"."broadcast_opt_outs" USING "btree" ("tenant_id");



CREATE INDEX "idx_payment_links_client_id" ON "public"."payment_links" USING "btree" ("client_id");



CREATE INDEX "idx_payment_links_status" ON "public"."payment_links" USING "btree" ("status");



CREATE INDEX "idx_payment_links_tenant_id" ON "public"."payment_links" USING "btree" ("tenant_id");



CREATE INDEX "idx_processed_events_cleanup" ON "public"."processed_events" USING "btree" ("processed_at");



CREATE INDEX "idx_processed_webhook_messages_processed_at" ON "public"."processed_webhook_messages" USING "btree" ("processed_at");



CREATE INDEX "idx_products_agency_id" ON "public"."products" USING "btree" ("agency_id");



CREATE INDEX "idx_profiles_campaigner" ON "public"."profiles" USING "btree" ("campaigner_id") WHERE ("campaigner_id" IS NOT NULL);



CREATE INDEX "idx_profiles_sales_person" ON "public"."profiles" USING "btree" ("sales_person_id") WHERE ("sales_person_id" IS NOT NULL);



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "idx_pulse_instant_alert_log_campaign_dedupe" ON "public"."pulse_instant_alert_log" USING "btree" ("tenant_id", "client_id", "campaign_key", "rule_type", "sent_at" DESC);



CREATE INDEX "idx_pulse_instant_alert_log_dedupe" ON "public"."pulse_instant_alert_log" USING "btree" ("tenant_id", "client_id", "rule_type", "sent_at" DESC);



CREATE INDEX "idx_rank_alerts_project" ON "public"."rank_tracking_alerts" USING "btree" ("project_id");



CREATE INDEX "idx_rank_competitors_project" ON "public"."rank_tracking_competitors" USING "btree" ("project_id");



CREATE INDEX "idx_rank_history_checked_at" ON "public"."rank_tracking_history" USING "btree" ("checked_at" DESC);



CREATE INDEX "idx_rank_history_keyword" ON "public"."rank_tracking_history" USING "btree" ("keyword_id");



CREATE INDEX "idx_rank_keywords_project" ON "public"."rank_tracking_keywords" USING "btree" ("project_id");



CREATE INDEX "idx_rank_projects_client" ON "public"."rank_tracking_projects" USING "btree" ("client_id");



CREATE INDEX "idx_rank_projects_tenant" ON "public"."rank_tracking_projects" USING "btree" ("tenant_id");



CREATE INDEX "idx_recording_folders_tenant" ON "public"."recording_folders" USING "btree" ("tenant_id");



CREATE INDEX "idx_report_alerts_tenant_table" ON "public"."report_alerts" USING "btree" ("tenant_id", "table_id");



CREATE INDEX "idx_sales_people_agency" ON "public"."sales_people" USING "btree" ("agency_id");



CREATE INDEX "idx_seo_call_snapshots_lookup" ON "public"."seo_call_snapshots" USING "btree" ("tenant_id", "client_id", "category");



CREATE INDEX "idx_seo_monthly_shares_client" ON "public"."seo_monthly_shares" USING "btree" ("client_id", "month" DESC);



CREATE INDEX "idx_seo_monthly_shares_token" ON "public"."seo_monthly_shares" USING "btree" ("share_token") WHERE ("is_active" = true);



CREATE INDEX "idx_seo_monthly_updates_client" ON "public"."seo_monthly_updates" USING "btree" ("client_id", "month" DESC);



CREATE INDEX "idx_service_health_checks_service_time" ON "public"."service_health_checks" USING "btree" ("service", "checked_at" DESC);



CREATE INDEX "idx_service_health_checks_tenant" ON "public"."service_health_checks" USING "btree" ("tenant_id", "checked_at" DESC);



CREATE INDEX "idx_signature_documents_client" ON "public"."signature_documents" USING "btree" ("tenant_id", "client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_signature_documents_lead" ON "public"."signature_documents" USING "btree" ("tenant_id", "lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_signature_documents_templates" ON "public"."signature_documents" USING "btree" ("tenant_id", "is_template") WHERE ("is_template" = true);



CREATE INDEX "idx_signature_events_created_at" ON "public"."signature_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_signature_events_document_id" ON "public"."signature_events" USING "btree" ("document_id");



CREATE INDEX "idx_site_events_name" ON "public"."site_events" USING "btree" ("event_name");



CREATE INDEX "idx_site_events_occurred_at" ON "public"."site_events" USING "btree" ("occurred_at");



CREATE INDEX "idx_site_events_session" ON "public"."site_events" USING "btree" ("session_id");



CREATE INDEX "idx_site_events_tenant" ON "public"."site_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_site_events_visitor" ON "public"."site_events" USING "btree" ("visitor_id");



CREATE INDEX "idx_site_pageviews_session" ON "public"."site_pageviews" USING "btree" ("session_id");



CREATE INDEX "idx_site_pageviews_tenant" ON "public"."site_pageviews" USING "btree" ("tenant_id");



CREATE INDEX "idx_site_pageviews_viewed_at" ON "public"."site_pageviews" USING "btree" ("viewed_at");



CREATE INDEX "idx_site_pageviews_visitor" ON "public"."site_pageviews" USING "btree" ("visitor_id");



CREATE INDEX "idx_site_sessions_started_at" ON "public"."site_sessions" USING "btree" ("started_at");



CREATE INDEX "idx_site_sessions_tenant" ON "public"."site_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_site_sessions_tracking_config" ON "public"."site_sessions" USING "btree" ("tracking_config_id");



CREATE INDEX "idx_site_sessions_visitor" ON "public"."site_sessions" USING "btree" ("visitor_id");



CREATE INDEX "idx_site_tracking_configs_client" ON "public"."site_tracking_configs" USING "btree" ("client_id");



CREATE INDEX "idx_site_tracking_configs_tenant" ON "public"."site_tracking_configs" USING "btree" ("tenant_id");



CREATE INDEX "idx_site_tracking_configs_tracking_id" ON "public"."site_tracking_configs" USING "btree" ("tracking_id");



CREATE INDEX "idx_site_visitors_fingerprint" ON "public"."site_visitors" USING "btree" ("visitor_fingerprint");



CREATE INDEX "idx_site_visitors_lead" ON "public"."site_visitors" USING "btree" ("lead_id");



CREATE INDEX "idx_site_visitors_tenant" ON "public"."site_visitors" USING "btree" ("tenant_id");



CREATE INDEX "idx_site_visitors_tracking_config" ON "public"."site_visitors" USING "btree" ("tracking_config_id");



CREATE INDEX "idx_smws_client_id" ON "public"."social_media_wordpress_sites" USING "btree" ("client_id");



CREATE INDEX "idx_smws_tenant_id" ON "public"."social_media_wordpress_sites" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_comments_tenant_open" ON "public"."social_comments" USING "btree" ("tenant_id", "replied_at", "created_at" DESC);



CREATE INDEX "idx_social_gantt_posts_date" ON "public"."social_gantt_posts" USING "btree" ("scheduled_date");



CREATE INDEX "idx_social_gantt_posts_status" ON "public"."social_gantt_posts" USING "btree" ("status");



CREATE INDEX "idx_social_gantt_posts_tenant" ON "public"."social_gantt_posts" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_media_channels_tenant" ON "public"."social_media_channels" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_media_post_channels_post" ON "public"."social_media_post_channels" USING "btree" ("post_id");



CREATE INDEX "idx_social_media_posts_scheduled" ON "public"."social_media_posts" USING "btree" ("scheduled_at") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_social_media_posts_status" ON "public"."social_media_posts" USING "btree" ("status");



CREATE INDEX "idx_social_media_posts_tenant" ON "public"."social_media_posts" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_media_wordpress_sites_agency_id" ON "public"."social_media_wordpress_sites" USING "btree" ("agency_id");



CREATE INDEX "idx_social_media_wordpress_sites_tenant" ON "public"."social_media_wordpress_sites" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_pages_client" ON "public"."social_pages" USING "btree" ("client_id");



CREATE INDEX "idx_social_pages_tenant" ON "public"."social_pages" USING "btree" ("tenant_id");



CREATE INDEX "idx_social_pub_tenant" ON "public"."social_publications" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_spst_page" ON "public"."social_pages_shared_tenants" USING "btree" ("social_page_id");



CREATE INDEX "idx_spst_tenant" ON "public"."social_pages_shared_tenants" USING "btree" ("tenant_id");



CREATE INDEX "idx_sync_jobs_created_at" ON "public"."sync_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sync_jobs_tenant_status" ON "public"."sync_jobs" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_task_checklist_items_task_id" ON "public"."task_checklist_items" USING "btree" ("task_id", "sort_order");



CREATE INDEX "idx_task_collaborators_campaigner_id" ON "public"."task_collaborators" USING "btree" ("campaigner_id");



CREATE INDEX "idx_task_collaborators_task_id" ON "public"."task_collaborators" USING "btree" ("task_id");



CREATE INDEX "idx_task_collaborators_tenant_id" ON "public"."task_collaborators" USING "btree" ("tenant_id");



CREATE INDEX "idx_task_notification_deliveries_delivered_at" ON "public"."task_notification_deliveries" USING "btree" ("delivered_at" DESC);



CREATE INDEX "idx_task_updates_created_at" ON "public"."task_updates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_task_updates_task_id" ON "public"."task_updates" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_campaigner" ON "public"."tasks" USING "btree" ("campaigner_id");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_google_calendar_event_id" ON "public"."tasks" USING "btree" ("google_calendar_event_id");



CREATE INDEX "idx_tasks_lead_id" ON "public"."tasks" USING "btree" ("lead_id");



CREATE INDEX "idx_tasks_pending_overdue_notifications" ON "public"."tasks" USING "btree" ("due_date") WHERE (("due_date" IS NOT NULL) AND ("overdue_notified_at" IS NULL) AND ("status" <> 'done'::"public"."task_status") AND ("campaigner_id" IS NOT NULL));



CREATE INDEX "idx_tasks_pending_self_reminders" ON "public"."tasks" USING "btree" ("self_reminder_at") WHERE (("self_reminder_at" IS NOT NULL) AND ("self_reminder_sent_at" IS NULL) AND ("status" <> 'done'::"public"."task_status"));



CREATE UNIQUE INDEX "idx_tasks_recurrence_previous_unique" ON "public"."tasks" USING "btree" ("recurrence_previous_task_id") WHERE ("recurrence_previous_task_id" IS NOT NULL);



CREATE INDEX "idx_tasks_recurrence_series" ON "public"."tasks" USING "btree" ("recurrence_series_id") WHERE ("recurrence_series_id" IS NOT NULL);



CREATE INDEX "idx_tasks_sales_person_id" ON "public"."tasks" USING "btree" ("sales_person_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_target_date" ON "public"."tasks" USING "btree" ("target_date");



CREATE INDEX "idx_tasks_tenant_status" ON "public"."tasks" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_telegram_bot_state_shared_from" ON "public"."telegram_bot_state" USING "btree" ("shared_from_state_id") WHERE ("shared_from_state_id" IS NOT NULL);



CREATE INDEX "idx_telegram_messages_created" ON "public"."telegram_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_telegram_messages_tenant_chat" ON "public"."telegram_messages" USING "btree" ("tenant_id", "chat_id");



CREATE INDEX "idx_telephony_settings_tenant" ON "public"."telephony_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_integrations_instance" ON "public"."tenant_integrations" USING "btree" ("instance_id") WHERE ("instance_id" IS NOT NULL);



CREATE INDEX "idx_tenant_integrations_instance_id" ON "public"."tenant_integrations" USING "btree" ("instance_id") WHERE ("integration_type" = 'green_api'::"text");



CREATE INDEX "idx_tenant_integrations_shared_from" ON "public"."tenant_integrations" USING "btree" ("shared_from_integration_id") WHERE ("shared_from_integration_id" IS NOT NULL);



CREATE INDEX "idx_tenant_integrations_tenant_type_active" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "integration_type", "is_active");



CREATE INDEX "idx_tenant_integrations_user_id" ON "public"."tenant_integrations" USING "btree" ("user_id");



CREATE INDEX "idx_tenant_integrations_visibility" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "integration_type", "connection_visibility") WHERE ("is_active" = true);



CREATE INDEX "idx_tenant_users_tenant" ON "public"."tenant_users" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_users_user_tenant" ON "public"."tenant_users" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_tenants_org_type" ON "public"."tenants" USING "btree" ("org_type");



CREATE INDEX "idx_tenants_parent_id" ON "public"."tenants" USING "btree" ("parent_tenant_id");



CREATE INDEX "idx_tenants_parent_tenant_id" ON "public"."tenants" USING "btree" ("parent_tenant_id");



CREATE INDEX "idx_terminology_presets_public" ON "public"."terminology_presets" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_terminology_presets_tenant" ON "public"."terminology_presets" USING "btree" ("created_by_tenant_id");



CREATE INDEX "idx_time_entry_breaks_tenant_id" ON "public"."time_entry_breaks" USING "btree" ("tenant_id");



CREATE INDEX "idx_time_entry_breaks_time_entry_id" ON "public"."time_entry_breaks" USING "btree" ("time_entry_id");



CREATE INDEX "idx_user_active_tenant_user" ON "public"."user_active_tenant" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_user_role" ON "public"."user_roles" USING "btree" ("user_id", "role");



CREATE INDEX "idx_user_roles_user_tenant" ON "public"."user_roles" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_wa_pending_activations_lookup" ON "public"."wa_pending_activations" USING "btree" ("tenant_id", "status", "created_at" DESC);



CREATE INDEX "idx_wa_warm_campaigns_running" ON "public"."wa_warm_campaigns" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'running'::"text"]));



CREATE INDEX "idx_wa_warm_campaigns_tenant" ON "public"."wa_warm_campaigns" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_wa_warm_opt_ins_integration" ON "public"."wa_warm_opt_ins" USING "btree" ("integration_id", "phone");



CREATE INDEX "idx_wa_warm_recipients_pending" ON "public"."wa_warm_recipients" USING "btree" ("campaign_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_whatsapp_groups_chat_id" ON "public"."whatsapp_groups" USING "btree" ("group_chat_id");



CREATE INDEX "idx_whatsapp_groups_search" ON "public"."whatsapp_groups" USING "btree" ("tenant_id", "group_name");



CREATE INDEX "idx_whatsapp_groups_tenant_id" ON "public"."whatsapp_groups" USING "btree" ("tenant_id");



CREATE INDEX "idx_whatsapp_sessions_lookup" ON "public"."whatsapp_sessions" USING "btree" ("tenant_id", "chat_id", "status");



CREATE INDEX "idx_woo_customers_site" ON "public"."woocommerce_customers" USING "btree" ("site_id");



CREATE INDEX "idx_woo_orders_attribution_label" ON "public"."woocommerce_orders" USING "btree" ((("attribution" ->> 'label'::"text"))) WHERE ("attribution" IS NOT NULL);



CREATE INDEX "idx_woo_orders_date" ON "public"."woocommerce_orders" USING "btree" ("date_created" DESC);



CREATE INDEX "idx_woo_orders_site" ON "public"."woocommerce_orders" USING "btree" ("site_id");



CREATE INDEX "idx_woo_orders_tenant" ON "public"."woocommerce_orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_woo_products_site" ON "public"."woocommerce_products" USING "btree" ("site_id");



CREATE INDEX "idx_woo_sync_log_site" ON "public"."woocommerce_sync_log" USING "btree" ("site_id", "started_at" DESC);



CREATE INDEX "idx_wsst_site" ON "public"."wordpress_sites_shared_tenants" USING "btree" ("site_id");



CREATE INDEX "idx_wsst_tenant" ON "public"."wordpress_sites_shared_tenants" USING "btree" ("tenant_id");



CREATE INDEX "idx_zoom_recordings_agency" ON "public"."zoom_recordings" USING "btree" ("tenant_id", "agency_id") WHERE ("agency_id" IS NOT NULL);



CREATE INDEX "idx_zoom_recordings_agency_id" ON "public"."zoom_recordings" USING "btree" ("agency_id") WHERE ("agency_id" IS NOT NULL);



CREATE INDEX "idx_zoom_recordings_calendar_event" ON "public"."zoom_recordings" USING "btree" ("tenant_id", "calendar_event_id") WHERE ("calendar_event_id" IS NOT NULL);



CREATE INDEX "idx_zoom_recordings_campaigners" ON "public"."zoom_recordings" USING "gin" ("campaigner_ids");



CREATE INDEX "idx_zoom_recordings_folder" ON "public"."zoom_recordings" USING "btree" ("folder_id") WHERE ("folder_id" IS NOT NULL);



CREATE INDEX "idx_zoom_recordings_meeting_id" ON "public"."zoom_recordings" USING "btree" ("meeting_id");



CREATE INDEX "idx_zoom_recordings_tenant_id" ON "public"."zoom_recordings" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "integration_health_tenant_provider_unique" ON "public"."integration_health" USING "btree" ("tenant_id", "provider");



CREATE INDEX "pbn_service_commands_active_idx" ON "public"."pbn_service_commands" USING "btree" ("token_hash", "tenant_id", "scope") WHERE ("used_at" IS NULL);



CREATE UNIQUE INDEX "processed_events_event_key_unique" ON "public"."processed_events" USING "btree" ("event_key");



CREATE INDEX "publishing_articles_site_status_idx" ON "public"."publishing_articles" USING "btree" ("site_id", "status", "published_at" DESC);



CREATE UNIQUE INDEX "publishing_articles_tenant_fingerprint_uidx" ON "public"."publishing_articles" USING "btree" ("tenant_id", "row_fingerprint") WHERE ("row_fingerprint" IS NOT NULL);



CREATE INDEX "publishing_articles_tenant_source_month_idx" ON "public"."publishing_articles" USING "btree" ("tenant_id", "source_month" DESC, "customer_name");



CREATE INDEX "publishing_articles_tenant_status_idx" ON "public"."publishing_articles" USING "btree" ("tenant_id", "status", "updated_at" DESC);



CREATE INDEX "publishing_imports_tenant_created_idx" ON "public"."publishing_imports" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "publishing_sites_tenant_status_idx" ON "public"."publishing_sites" USING "btree" ("tenant_id", "status");



CREATE INDEX "publishing_sites_tenant_visible_idx" ON "public"."publishing_sites" USING "btree" ("tenant_id", "is_hidden", "destination_type");



CREATE UNIQUE INDEX "seo_monthly_updates_client_month_key" ON "public"."seo_monthly_updates" USING "btree" ("client_id", "month");



CREATE UNIQUE INDEX "telegram_bot_state_tenant_primary_unique" ON "public"."telegram_bot_state" USING "btree" ("tenant_id") WHERE ("shared_from_state_id" IS NULL);



CREATE UNIQUE INDEX "telegram_bot_state_tenant_shared_unique" ON "public"."telegram_bot_state" USING "btree" ("tenant_id", "shared_from_state_id") WHERE ("shared_from_state_id" IS NOT NULL);



CREATE UNIQUE INDEX "tenant_integrations_ga_user_email_unique" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "integration_type", "user_id", (("settings" ->> 'google_email'::"text"))) WHERE (("user_id" IS NOT NULL) AND ("integration_type" = 'google_analytics'::"text"));



CREATE INDEX "tenant_integrations_meta_wa_phone_lookup" ON "public"."tenant_integrations" USING "btree" ((("settings" ->> 'phone_number_id'::"text"))) WHERE (("integration_type" = 'meta_whatsapp'::"text") AND ("is_active" = true));



CREATE UNIQUE INDEX "tenant_integrations_meta_wa_phone_unique" ON "public"."tenant_integrations" USING "btree" ("integration_type", (("settings" ->> 'phone_number_id'::"text"))) WHERE (("integration_type" = 'meta_whatsapp'::"text") AND (("settings" ->> 'phone_number_id'::"text") IS NOT NULL));



CREATE UNIQUE INDEX "tenant_integrations_org_level_unique" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "integration_type") WHERE ("user_id" IS NULL);



CREATE UNIQUE INDEX "tenant_integrations_user_level_unique" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "integration_type", "user_id") WHERE (("user_id" IS NOT NULL) AND ("integration_type" <> ALL (ARRAY['google_analytics'::"text", 'meta_whatsapp'::"text"])));



CREATE UNIQUE INDEX "tenants_slug_unique" ON "public"."tenants" USING "btree" ("slug");



CREATE UNIQUE INDEX "uq_bedomains_tenant_domain" ON "public"."broadcast_email_domains" USING "btree" ("tenant_id", "domain");



CREATE UNIQUE INDEX "uq_blmembers_email" ON "public"."broadcast_list_members" USING "btree" ("list_id", "email") WHERE (("email" IS NOT NULL) AND ("phone" IS NULL));



CREATE UNIQUE INDEX "uq_blmembers_phone" ON "public"."broadcast_list_members" USING "btree" ("list_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE UNIQUE INDEX "uq_br_broadcast_group" ON "public"."broadcast_recipients" USING "btree" ("broadcast_id", "group_chat_id") WHERE ("group_chat_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_br_broadcast_phone" ON "public"."broadcast_recipients" USING "btree" ("broadcast_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE UNIQUE INDEX "uq_optout_email" ON "public"."broadcast_opt_outs" USING "btree" ("tenant_id", "email", "channel") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "uq_optout_phone" ON "public"."broadcast_opt_outs" USING "btree" ("tenant_id", "phone", "channel") WHERE ("phone" IS NOT NULL);



CREATE UNIQUE INDEX "uq_wa_warm_recipients_campaign_phone" ON "public"."wa_warm_recipients" USING "btree" ("campaign_id", "phone");



CREATE INDEX "wa_group_members_tenant_group_phone" ON "public"."wa_group_members" USING "btree" ("tenant_id", "group_chat_id", "phone");



CREATE INDEX "wa_group_members_tenant_phone" ON "public"."wa_group_members" USING "btree" ("tenant_id", "phone");



CREATE UNIQUE INDEX "zoom_recordings_tenant_meeting_type_unique" ON "public"."zoom_recordings" USING "btree" ("tenant_id", "meeting_id", "recording_type");



CREATE OR REPLACE TRIGGER "ai_skills_search_vector_trg" BEFORE INSERT OR UPDATE ON "public"."ai_skills" FOR EACH ROW EXECUTE FUNCTION "public"."ai_skills_update_search_vector"();



CREATE OR REPLACE TRIGGER "auto_sync_new_lead_trigger" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_auto_sync_new_lead"();



CREATE OR REPLACE TRIGGER "bump_ai_skill_version_trg" BEFORE UPDATE ON "public"."ai_skills" FOR EACH ROW EXECUTE FUNCTION "public"."bump_ai_skill_version"();



CREATE OR REPLACE TRIGGER "campaign_alerts_set_updated_at" BEFORE UPDATE ON "public"."campaign_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "carmen_kb_ai_conversations_outbox" AFTER INSERT OR UPDATE ON "public"."ai_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_outbox_enqueue"('ai_conversation');



CREATE OR REPLACE TRIGGER "carmen_kb_campaigners_outbox" AFTER INSERT OR DELETE OR UPDATE ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_outbox_enqueue"('campaigner');



CREATE OR REPLACE TRIGGER "carmen_kb_chat_messages_outbox" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_outbox_enqueue"('chat_message');



CREATE OR REPLACE TRIGGER "carmen_kb_clients_outbox" AFTER INSERT OR DELETE OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_outbox_enqueue"('client');



CREATE OR REPLACE TRIGGER "carmen_kb_tasks_outbox" AFTER INSERT OR DELETE OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_outbox_enqueue"('task');



CREATE OR REPLACE TRIGGER "carmen_memory_episodes_updated_at" BEFORE UPDATE ON "public"."carmen_memory_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "carmen_memory_pointers_updated_at" BEFORE UPDATE ON "public"."carmen_memory_pointers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "carmen_session_close_learn" AFTER UPDATE ON "public"."carmen_whatsapp_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_carmen_learn_from_session"();



CREATE OR REPLACE TRIGGER "clients_onboarding_insert" AFTER INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_client_onboarding_status"();



CREATE OR REPLACE TRIGGER "clients_onboarding_status" AFTER UPDATE OF "status" ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_client_onboarding_status"();



CREATE OR REPLACE TRIGGER "crm_tables_fill_agency" BEFORE INSERT OR UPDATE OF "client_id", "agency_id" ON "public"."crm_tables" FOR EACH ROW EXECUTE FUNCTION "public"."crm_tables_fill_agency_from_client"();



CREATE OR REPLACE TRIGGER "crm_tables_sync_client_card" AFTER INSERT OR UPDATE OF "client_id", "integration_type", "integration_settings" ON "public"."crm_tables" FOR EACH ROW EXECUTE FUNCTION "public"."sync_client_card_from_crm_table"();



CREATE OR REPLACE TRIGGER "leads_assign_home_agency" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW WHEN (("new"."agency_id" IS NULL)) EXECUTE FUNCTION "public"."leads_assign_home_agency"();



CREATE OR REPLACE TRIGGER "leads_set_first_origin" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."leads_set_first_origin"();



CREATE OR REPLACE TRIGGER "maskyoo_numbers_updated_at" BEFORE UPDATE ON "public"."maskyoo_numbers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "on_ad_account_blocked" BEFORE UPDATE ON "public"."crm_tables" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_ad_account_blocked"();



CREATE OR REPLACE TRIGGER "on_campaigner_assignment" AFTER UPDATE OF "campaigner_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_campaigner_assignment"();



CREATE OR REPLACE TRIGGER "on_client_onboarding_status_change" AFTER INSERT OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_client_onboarding_status"();



CREATE OR REPLACE TRIGGER "on_integration_disconnected" BEFORE UPDATE ON "public"."tenant_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_integration_disconnected"();



CREATE OR REPLACE TRIGGER "on_lead_delete_track_facebook" BEFORE DELETE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."track_deleted_facebook_lead"();



CREATE OR REPLACE TRIGGER "on_lead_transferred_to_onboarding" AFTER UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_lead_to_onboarding"();



CREATE OR REPLACE TRIGGER "on_lead_won_date_update" AFTER UPDATE OF "won_date" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_lead_to_onboarding"();



CREATE OR REPLACE TRIGGER "on_onboarding_completion" AFTER INSERT OR UPDATE ON "public"."client_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."handle_onboarding_completion"();



CREATE OR REPLACE TRIGGER "on_sales_person_assignment" AFTER UPDATE OF "sales_person_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sales_person_assignment"();



CREATE OR REPLACE TRIGGER "on_tenant_created_init_lead_statuses" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_tenant_lead_statuses"();



CREATE OR REPLACE TRIGGER "on_tenant_created_pipeline_stages" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_tenant_pipeline_stages"();



CREATE OR REPLACE TRIGGER "seo_call_snapshots_updated_at" BEFORE UPDATE ON "public"."seo_call_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_agency_tenant_id_before_insert" BEFORE INSERT ON "public"."agencies" FOR EACH ROW EXECUTE FUNCTION "public"."set_agency_tenant_id"();



CREATE OR REPLACE TRIGGER "set_agency_tenant_id_before_update" BEFORE UPDATE ON "public"."agencies" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_agency_tenant_id"();



CREATE OR REPLACE TRIGGER "set_agency_tenant_id_trigger" BEFORE INSERT ON "public"."agencies" FOR EACH ROW EXECUTE FUNCTION "public"."set_agency_tenant_id"();



CREATE OR REPLACE TRIGGER "set_campaigner_tenant_id_before_insert" BEFORE INSERT ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."set_campaigner_tenant_id"();



CREATE OR REPLACE TRIGGER "set_campaigner_tenant_id_before_update" BEFORE UPDATE ON "public"."campaigners" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_campaigner_tenant_id"();



CREATE OR REPLACE TRIGGER "set_campaigner_tenant_id_trigger" BEFORE INSERT ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."set_campaigner_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_onboarding_tenant_id" BEFORE INSERT ON "public"."client_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_onboarding_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_onboarding_tenant_id_before_insert" BEFORE INSERT ON "public"."client_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_onboarding_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_onboarding_tenant_id_before_update" BEFORE UPDATE ON "public"."client_onboarding" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_client_onboarding_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_tenant_id_before_insert" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_tenant_id_before_update" BEFORE UPDATE ON "public"."clients" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_client_tenant_id"();



CREATE OR REPLACE TRIGGER "set_client_tenant_id_trigger" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_tenant_id"();



CREATE OR REPLACE TRIGGER "set_invoice_uploads_updated_at" BEFORE UPDATE ON "public"."invoice_uploads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_lead_tenant_id_before_insert" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_lead_tenant_id"();



CREATE OR REPLACE TRIGGER "set_lead_tenant_id_before_update" BEFORE UPDATE ON "public"."leads" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_lead_tenant_id"();



CREATE OR REPLACE TRIGGER "set_lead_tenant_id_trigger" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_lead_tenant_id"();



CREATE OR REPLACE TRIGGER "set_product_tenant_id_before_insert" BEFORE INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_tenant_id"();



CREATE OR REPLACE TRIGGER "set_product_tenant_id_before_update" BEFORE UPDATE ON "public"."products" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_product_tenant_id"();



CREATE OR REPLACE TRIGGER "set_product_tenant_id_trigger" BEFORE INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_tenant_id"();



CREATE OR REPLACE TRIGGER "set_task_tenant_id_before_insert" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_tenant_id"();



CREATE OR REPLACE TRIGGER "set_task_tenant_id_before_update" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW WHEN (("new"."tenant_id" IS NULL)) EXECUTE FUNCTION "public"."set_task_tenant_id"();



CREATE OR REPLACE TRIGGER "set_tracking_id_trigger" BEFORE INSERT ON "public"."site_tracking_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_tracking_id"();



CREATE OR REPLACE TRIGGER "set_user_workspace_layout_updated_at" BEFORE UPDATE ON "public"."user_workspace_layout" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "social_comments_set_updated_at" BEFORE UPDATE ON "public"."social_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "social_pages_set_updated_at" BEFORE UPDATE ON "public"."social_pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "social_pub_set_updated_at" BEFORE UPDATE ON "public"."social_publications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "sync_published_article_monthly_work" AFTER INSERT OR UPDATE ON "public"."publishing_articles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_published_article_to_seo_monthly_work"();



CREATE OR REPLACE TRIGGER "trg_agent_brain_routes_updated_at" BEFORE UPDATE ON "public"."agent_brain_routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_agent_channel_sessions_updated_at" BEFORE UPDATE ON "public"."agent_channel_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_agent_evals_updated" BEFORE UPDATE ON "public"."agent_evals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_agent_goals_updated" BEFORE UPDATE ON "public"."agent_goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_agent_memory_fts" BEFORE INSERT OR UPDATE OF "title", "summary" ON "public"."agent_memory" FOR EACH ROW EXECUTE FUNCTION "public"."agent_memory_fts_update"();



CREATE OR REPLACE TRIGGER "trg_agent_runs_updated_at" BEFORE UPDATE ON "public"."agent_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_aki_updated" BEFORE UPDATE ON "public"."agent_knowledge_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_am_updated" BEFORE UPDATE ON "public"."agent_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_aup_updated_at" BEFORE UPDATE ON "public"."agent_user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_blists_updated_at" BEFORE UPDATE ON "public"."broadcast_lists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_br_updated_at" BEFORE UPDATE ON "public"."broadcast_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_broadcast_apply_list_rules" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_apply_list_rules"();



CREATE OR REPLACE TRIGGER "trg_broadcasts_updated_at" BEFORE UPDATE ON "public"."broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_carmen_allowed_phones_activation" AFTER INSERT OR UPDATE OF "configuration" ON "public"."automation_flow_steps" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_allowed_phones_trigger"();



CREATE OR REPLACE TRIGGER "trg_carmen_identity_activation" BEFORE INSERT OR UPDATE ON "public"."carmen_whatsapp_identities" FOR EACH ROW EXECUTE FUNCTION "public"."carmen_identity_activation_trigger"();



CREATE OR REPLACE TRIGGER "trg_create_next_recurring_task" AFTER UPDATE OF "status" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."create_next_recurring_task"();



CREATE OR REPLACE TRIGGER "trg_cs_updated_at" BEFORE UPDATE ON "public"."campaign_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_goal_brain_requests_updated_at" BEFORE UPDATE ON "public"."goal_brain_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_goal_orchestrator_brain_updated_at" BEFORE UPDATE ON "public"."goal_orchestrator_brain" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_handle_new_tenant_menu_items" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_tenant_menu_items"();



CREATE OR REPLACE TRIGGER "trg_log_client_mood_status_change" AFTER UPDATE OF "mood_status" ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."log_client_mood_status_change"();



CREATE OR REPLACE TRIGGER "trg_marketing_pipeline_stages_updated" BEFORE UPDATE ON "public"."marketing_pipeline_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_marketing_pipelines_updated" BEFORE UPDATE ON "public"."marketing_pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_marketing_work_items_updated" BEFORE UPDATE ON "public"."marketing_work_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_maskyoo_overrides_updated_at" BEFORE UPDATE ON "public"."maskyoo_manual_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mcp_conn_updated" BEFORE UPDATE ON "public"."agent_mcp_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mml_updated_at" BEFORE UPDATE ON "public"."marketing_media_library" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mruns_updated" BEFORE UPDATE ON "public"."marketing_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mst_updated" BEFORE UPDATE ON "public"."marketing_stage_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mtrig_updated" BEFORE UPDATE ON "public"."marketing_triggers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_notify_task_notification_worker" BEFORE INSERT OR UPDATE OF "campaigner_id", "sales_person_id", "status", "priority", "due_date", "due_time", "self_reminder_at" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."notify_task_notification_worker"();



CREATE OR REPLACE TRIGGER "trg_propagate_whatsapp_group_invite_link" AFTER INSERT OR UPDATE OF "invite_link" ON "public"."whatsapp_groups" FOR EACH ROW WHEN ((("new"."invite_link" IS NOT NULL) AND ("btrim"("new"."invite_link") <> ''::"text"))) EXECUTE FUNCTION "public"."propagate_whatsapp_group_invite_link"();



CREATE OR REPLACE TRIGGER "trg_set_campaigner_tenant_id" BEFORE INSERT ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."set_campaigner_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_task_tenant_id" BEFORE INSERT OR UPDATE OF "client_id", "agency_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_single_default_agency" BEFORE INSERT OR UPDATE ON "public"."agencies" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_agency"();



CREATE OR REPLACE TRIGGER "trg_sync_campaigner_carmen_identity" AFTER INSERT OR UPDATE OF "phone", "full_name", "active", "tenant_id" ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."sync_campaigner_carmen_identity"();



CREATE OR REPLACE TRIGGER "trg_sync_lead_origin_tags" AFTER INSERT OR UPDATE OF "campaign_name", "source" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_lead_origin_tags"();



CREATE OR REPLACE TRIGGER "trg_tools_updated_at" BEFORE UPDATE ON "public"."agent_tools" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_user_active_tenant_updated_at" BEFORE UPDATE ON "public"."user_active_tenant" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_wa_lid_map_touch" BEFORE UPDATE ON "public"."wa_lid_map" FOR EACH ROW EXECUTE FUNCTION "public"."wa_lid_map_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wa_warm_campaigns_updated" BEFORE UPDATE ON "public"."wa_warm_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."touch_wa_warm_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wa_warm_opt_ins_updated" BEFORE UPDATE ON "public"."wa_warm_opt_ins" FOR EACH ROW EXECUTE FUNCTION "public"."touch_wa_warm_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wa_warm_recipients_updated" BEFORE UPDATE ON "public"."wa_warm_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."touch_wa_warm_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_cleanup_user_active_tenant" AFTER DELETE ON "public"."tenant_users" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_user_active_tenant"();



CREATE OR REPLACE TRIGGER "trigger_new_tenant_menu_items" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_tenant_menu_items"();



CREATE OR REPLACE TRIGGER "trigger_sync_client_status_to_onboarding" AFTER UPDATE OF "status" ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."sync_client_status_to_onboarding"();



CREATE OR REPLACE TRIGGER "update_agencies_updated_at" BEFORE UPDATE ON "public"."agencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_tasks_updated_at" BEFORE UPDATE ON "public"."agent_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ai_conversations_updated_at" BEFORE UPDATE ON "public"."ai_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ai_skills_updated_at" BEFORE UPDATE ON "public"."ai_skills" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automations_updated_at" BEFORE UPDATE ON "public"."automations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_tokens_updated_at" BEFORE UPDATE ON "public"."calendar_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_call_logs_updated_at" BEFORE UPDATE ON "public"."call_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_campaigners_updated_at" BEFORE UPDATE ON "public"."campaigners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_messages_updated_at" BEFORE UPDATE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_messages_updated_at"();



CREATE OR REPLACE TRIGGER "update_client_onboarding_updated_at" BEFORE UPDATE ON "public"."client_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_tenant_financial_data_updated_at" BEFORE UPDATE ON "public"."client_tenant_financial_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crm_dashboards_updated_at" BEFORE UPDATE ON "public"."crm_dashboards" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crm_fields_updated_at" BEFORE UPDATE ON "public"."crm_fields" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crm_tables_updated_at" BEFORE UPDATE ON "public"."crm_tables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_fields_updated_at" BEFORE UPDATE ON "public"."custom_fields" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_finance_updated_at" BEFORE UPDATE ON "public"."finance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_global_settings_updated_at" BEFORE UPDATE ON "public"."global_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_goals_updated_at" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_integration_user_permissions_updated_at" BEFORE UPDATE ON "public"."integration_user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invitation_tokens_updated_at" BEFORE UPDATE ON "public"."invitation_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lead_filter_presets_updated_at" BEFORE UPDATE ON "public"."lead_filter_presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lead_updates_updated_at" BEFORE UPDATE ON "public"."lead_updates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_manus_tasks_updated_at" BEFORE UPDATE ON "public"."manus_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_maskyoo_settings_updated_at" BEFORE UPDATE ON "public"."maskyoo_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_menu_items_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rank_keywords_updated_at" BEFORE UPDATE ON "public"."rank_tracking_keywords" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rank_projects_updated_at" BEFORE UPDATE ON "public"."rank_tracking_projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_alerts_updated_at" BEFORE UPDATE ON "public"."report_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sales_people_updated_at" BEFORE UPDATE ON "public"."sales_people" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_tracking_configs_updated_at" BEFORE UPDATE ON "public"."site_tracking_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sync_jobs_updated_at" BEFORE UPDATE ON "public"."sync_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_messages_updated_at"();



CREATE OR REPLACE TRIGGER "update_task_updates_updated_at" BEFORE UPDATE ON "public"."task_updates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_telephony_settings_updated_at" BEFORE UPDATE ON "public"."telephony_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_integrations_updated_at" BEFORE UPDATE ON "public"."tenant_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_terminology_updated_at" BEFORE UPDATE ON "public"."tenant_terminology" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entries_updated_at" BEFORE UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entry_breaks_updated_at" BEFORE UPDATE ON "public"."time_entry_breaks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_groups_updated_at" BEFORE UPDATE ON "public"."whatsapp_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_crm_record_trigger" BEFORE INSERT OR UPDATE ON "public"."crm_records" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_validate_crm_record"();



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_accessing_tenant_id_fkey" FOREIGN KEY ("accessing_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agency_tenant_access"
    ADD CONSTRAINT "agency_tenant_access_source_tenant_id_fkey" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_channel_sessions"
    ADD CONSTRAINT "agent_channel_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_brain_route_id_fkey" FOREIGN KEY ("brain_route_id") REFERENCES "public"."agent_brain_routes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversation_messages"
    ADD CONSTRAINT "ai_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_brain_route_id_fkey" FOREIGN KEY ("brain_route_id") REFERENCES "public"."agent_brain_routes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_brands"
    ADD CONSTRAINT "ai_detection_brands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_detection_brands"
    ADD CONSTRAINT "ai_detection_brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_competitor_results"
    ADD CONSTRAINT "ai_detection_competitor_results_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."ai_detection_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_competitor_results"
    ADD CONSTRAINT "ai_detection_competitor_results_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_detection_prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_competitor_results"
    ADD CONSTRAINT "ai_detection_competitor_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_prompts"
    ADD CONSTRAINT "ai_detection_prompts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."ai_detection_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_prompts"
    ADD CONSTRAINT "ai_detection_prompts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_detection_prompts"
    ADD CONSTRAINT "ai_detection_prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_results"
    ADD CONSTRAINT "ai_detection_results_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."ai_detection_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_results"
    ADD CONSTRAINT "ai_detection_results_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_detection_prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_results"
    ADD CONSTRAINT "ai_detection_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_scores"
    ADD CONSTRAINT "ai_detection_scores_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."ai_detection_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_detection_scores"
    ADD CONSTRAINT "ai_detection_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_memory"
    ADD CONSTRAINT "ai_memory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_memory"
    ADD CONSTRAINT "ai_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aios_graph_edges"
    ADD CONSTRAINT "aios_graph_edges_version_fkey" FOREIGN KEY ("version") REFERENCES "public"."aios_graph_versions"("version") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aios_graph_edges"
    ADD CONSTRAINT "aios_graph_edges_version_source_id_fkey" FOREIGN KEY ("version", "source_id") REFERENCES "public"."aios_graph_nodes"("version", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aios_graph_edges"
    ADD CONSTRAINT "aios_graph_edges_version_target_id_fkey" FOREIGN KEY ("version", "target_id") REFERENCES "public"."aios_graph_nodes"("version", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aios_graph_nodes"
    ADD CONSTRAINT "aios_graph_nodes_version_fkey" FOREIGN KEY ("version") REFERENCES "public"."aios_graph_versions"("version") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_flow_steps"
    ADD CONSTRAINT "automation_flow_steps_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_flow_steps"
    ADD CONSTRAINT "automation_flow_steps_parent_step_id_fkey" FOREIGN KEY ("parent_step_id") REFERENCES "public"."automation_flow_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_flow_steps"
    ADD CONSTRAINT "automation_flow_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_list_members"
    ADD CONSTRAINT "broadcast_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."broadcast_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_list_rules"
    ADD CONSTRAINT "broadcast_list_rules_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."broadcast_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_recipients"
    ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_shares"
    ADD CONSTRAINT "calendar_shares_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_shares"
    ADD CONSTRAINT "calendar_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_shares"
    ADD CONSTRAINT "calendar_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_tokens"
    ADD CONSTRAINT "calendar_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_pulse_overrides"
    ADD CONSTRAINT "campaign_pulse_overrides_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_pulse_overrides"
    ADD CONSTRAINT "campaign_pulse_overrides_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_pulse_overrides"
    ADD CONSTRAINT "campaign_pulse_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_pulse_overrides"
    ADD CONSTRAINT "campaign_pulse_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_pulse_snapshots"
    ADD CONSTRAINT "campaign_pulse_snapshots_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_pulse_snapshots"
    ADD CONSTRAINT "campaign_pulse_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_pulse_snapshots"
    ADD CONSTRAINT "campaign_pulse_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigner_agencies"
    ADD CONSTRAINT "campaigner_agencies_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigner_agencies"
    ADD CONSTRAINT "campaigner_agencies_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigners"
    ADD CONSTRAINT "campaigners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_access_policies"
    ADD CONSTRAINT "carmen_access_policies_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_access_policies"
    ADD CONSTRAINT "carmen_access_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_client_group_access"
    ADD CONSTRAINT "carmen_client_group_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_client_group_access"
    ADD CONSTRAINT "carmen_client_group_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_client_group_access"
    ADD CONSTRAINT "carmen_client_group_access_whatsapp_group_id_fkey" FOREIGN KEY ("whatsapp_group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_command_center_access"
    ADD CONSTRAINT "carmen_command_center_access_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_command_center_access"
    ADD CONSTRAINT "carmen_command_center_access_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_command_center_access"
    ADD CONSTRAINT "carmen_command_center_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_command_center_access"
    ADD CONSTRAINT "carmen_command_center_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_whatsapp_identities"
    ADD CONSTRAINT "carmen_whatsapp_identities_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carmen_whatsapp_identities"
    ADD CONSTRAINT "carmen_whatsapp_identities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_whatsapp_identities"
    ADD CONSTRAINT "carmen_whatsapp_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_whatsapp_identity_candidates"
    ADD CONSTRAINT "carmen_whatsapp_identity_candidates_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carmen_whatsapp_identity_candidates"
    ADD CONSTRAINT "carmen_whatsapp_identity_candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."chat_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contact_tags"
    ADD CONSTRAINT "chat_contact_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_blocked_by_user_id_fkey" FOREIGN KEY ("blocked_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_connection_user_id_fkey" FOREIGN KEY ("connection_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_tags"
    ADD CONSTRAINT "chat_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."client_credentials"
    ADD CONSTRAINT "client_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_credentials"
    ADD CONSTRAINT "client_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id");



ALTER TABLE ONLY "public"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_suppliers"
    ADD CONSTRAINT "client_suppliers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_suppliers"
    ADD CONSTRAINT "client_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_team"
    ADD CONSTRAINT "client_team_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_team"
    ADD CONSTRAINT "client_team_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_tenant_financial_data"
    ADD CONSTRAINT "client_tenant_financial_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_tenant_financial_data"
    ADD CONSTRAINT "client_tenant_financial_data_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_updates"
    ADD CONSTRAINT "client_updates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_updates"
    ADD CONSTRAINT "client_updates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_updates"
    ADD CONSTRAINT "client_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_whatsapp_group_id_fkey" FOREIGN KEY ("whatsapp_group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_dashboards"
    ADD CONSTRAINT "crm_dashboards_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_dashboards"
    ADD CONSTRAINT "crm_dashboards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_fields"
    ADD CONSTRAINT "crm_fields_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."crm_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_records"
    ADD CONSTRAINT "crm_records_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_records"
    ADD CONSTRAINT "crm_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_records"
    ADD CONSTRAINT "crm_records_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."crm_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_records"
    ADD CONSTRAINT "crm_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_tables"
    ADD CONSTRAINT "crm_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursor_dispatches"
    ADD CONSTRAINT "cursor_dispatches_human_task_id_fkey" FOREIGN KEY ("human_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dashboard_shares"
    ADD CONSTRAINT "dashboard_shares_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "public"."crm_dashboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_shares"
    ADD CONSTRAINT "dashboard_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deleted_facebook_leads"
    ADD CONSTRAINT "deleted_facebook_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_task_events"
    ADD CONSTRAINT "dev_task_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_task_events"
    ADD CONSTRAINT "dev_task_events_dev_task_id_fkey" FOREIGN KEY ("dev_task_id") REFERENCES "public"."dev_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_task_events"
    ADD CONSTRAINT "dev_task_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_dedup_of_fkey" FOREIGN KEY ("dedup_of") REFERENCES "public"."dev_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_human_task_id_fkey" FOREIGN KEY ("human_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_tasks"
    ADD CONSTRAINT "dev_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_payments"
    ADD CONSTRAINT "expense_payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expense_payments"
    ADD CONSTRAINT "expense_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance"
    ADD CONSTRAINT "finance_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance"
    ADD CONSTRAINT "finance_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance"
    ADD CONSTRAINT "finance_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance"
    ADD CONSTRAINT "finance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_processed_leads"
    ADD CONSTRAINT "flow_processed_leads_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_processed_leads"
    ADD CONSTRAINT "flow_processed_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_allowed_labels"
    ADD CONSTRAINT "gmail_allowed_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_allowed_labels"
    ADD CONSTRAINT "gmail_allowed_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_blocked_senders"
    ADD CONSTRAINT "gmail_blocked_senders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_blocked_senders"
    ADD CONSTRAINT "gmail_blocked_senders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_categories"
    ADD CONSTRAINT "gmail_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_category_rules"
    ADD CONSTRAINT "gmail_category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."gmail_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_category_rules"
    ADD CONSTRAINT "gmail_category_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_message_categories"
    ADD CONSTRAINT "gmail_message_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."gmail_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_message_categories"
    ADD CONSTRAINT "gmail_message_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_message_categories"
    ADD CONSTRAINT "gmail_message_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_actions"
    ADD CONSTRAINT "goal_actions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_actions"
    ADD CONSTRAINT "goal_actions_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "public"."goal_loop_iterations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_actions"
    ADD CONSTRAINT "goal_actions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."goal_plan_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_actions"
    ADD CONSTRAINT "goal_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_blockers"
    ADD CONSTRAINT "goal_blockers_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_blockers"
    ADD CONSTRAINT "goal_blockers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."goal_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "public"."goal_loop_iterations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."goal_plan_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_brain_requests"
    ADD CONSTRAINT "goal_brain_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_engine_tools"
    ADD CONSTRAINT "goal_engine_tools_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_engine_tools"
    ADD CONSTRAINT "goal_engine_tools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_events"
    ADD CONSTRAINT "goal_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_events"
    ADD CONSTRAINT "goal_events_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_events"
    ADD CONSTRAINT "goal_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_evidence"
    ADD CONSTRAINT "goal_evidence_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "public"."goal_success_criteria"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_evidence"
    ADD CONSTRAINT "goal_evidence_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_evidence"
    ADD CONSTRAINT "goal_evidence_source_action_id_fkey" FOREIGN KEY ("source_action_id") REFERENCES "public"."goal_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_evidence"
    ADD CONSTRAINT "goal_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_loop_iterations"
    ADD CONSTRAINT "goal_loop_iterations_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_loop_iterations"
    ADD CONSTRAINT "goal_loop_iterations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_milestones"
    ADD CONSTRAINT "goal_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_milestones"
    ADD CONSTRAINT "goal_milestones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_model_events"
    ADD CONSTRAINT "goal_model_events_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_model_events"
    ADD CONSTRAINT "goal_model_events_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "public"."goal_loop_iterations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_model_events"
    ADD CONSTRAINT "goal_model_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_orchestrator_brain"
    ADD CONSTRAINT "goal_orchestrator_brain_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_plan_steps"
    ADD CONSTRAINT "goal_plan_steps_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_plan_steps"
    ADD CONSTRAINT "goal_plan_steps_parent_step_id_fkey" FOREIGN KEY ("parent_step_id") REFERENCES "public"."goal_plan_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_plan_steps"
    ADD CONSTRAINT "goal_plan_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_success_criteria"
    ADD CONSTRAINT "goal_success_criteria_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_success_criteria"
    ADD CONSTRAINT "goal_success_criteria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hidden_chats"
    ADD CONSTRAINT "hidden_chats_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hidden_chats"
    ADD CONSTRAINT "hidden_chats_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hidden_chats"
    ADD CONSTRAINT "hidden_chats_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hidden_chats"
    ADD CONSTRAINT "hidden_chats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_history"
    ADD CONSTRAINT "import_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."income_payments"
    ADD CONSTRAINT "income_payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_payments"
    ADD CONSTRAINT "income_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."income_payments"
    ADD CONSTRAINT "income_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_tenant_access"
    ADD CONSTRAINT "integration_tenant_access_accessing_tenant_id_fkey" FOREIGN KEY ("accessing_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_tenant_access"
    ADD CONSTRAINT "integration_tenant_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."integration_tenant_access"
    ADD CONSTRAINT "integration_tenant_access_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_user_permissions"
    ADD CONSTRAINT "integration_user_permissions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lead_alert_failure_notifications"
    ADD CONSTRAINT "lead_alert_failure_notifications_automation_log_id_fkey" FOREIGN KEY ("automation_log_id") REFERENCES "public"."automation_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_alert_failure_notifications"
    ADD CONSTRAINT "lead_alert_failure_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_filter_presets"
    ADD CONSTRAINT "lead_filter_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_notification_events"
    ADD CONSTRAINT "lead_notification_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_notification_events"
    ADD CONSTRAINT "lead_notification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_pipeline_stages"
    ADD CONSTRAINT "lead_pipeline_stages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_sales_people"
    ADD CONSTRAINT "lead_sales_people_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_sales_people"
    ADD CONSTRAINT "lead_sales_people_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "public"."sales_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_sales_people"
    ADD CONSTRAINT "lead_sales_people_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_statuses"
    ADD CONSTRAINT "lead_statuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "public"."sales_people"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manually_read_contacts"
    ADD CONSTRAINT "manually_read_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manually_read_contacts"
    ADD CONSTRAINT "manually_read_contacts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manually_read_contacts"
    ADD CONSTRAINT "manually_read_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manually_read_contacts"
    ADD CONSTRAINT "manually_read_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manus_tasks"
    ADD CONSTRAINT "manus_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_pipeline_stages"
    ADD CONSTRAINT "marketing_pipeline_stages_agent_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_pipeline_stages"
    ADD CONSTRAINT "marketing_pipeline_stages_pipeline_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."marketing_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_bot_sessions"
    ADD CONSTRAINT "meeting_bot_sessions_zoom_recording_id_fkey" FOREIGN KEY ("zoom_recording_id") REFERENCES "public"."zoom_recordings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meta_whatsapp_tenant_credentials"
    ADD CONSTRAINT "meta_whatsapp_tenant_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_whatsapp_tenant_credentials"
    ADD CONSTRAINT "meta_whatsapp_tenant_credentials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meta_whatsapp_tokens"
    ADD CONSTRAINT "meta_whatsapp_tokens_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."one_time_incomes"
    ADD CONSTRAINT "one_time_incomes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."one_time_incomes"
    ADD CONSTRAINT "one_time_incomes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."one_time_incomes"
    ADD CONSTRAINT "one_time_incomes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."one_time_incomes"
    ADD CONSTRAINT "one_time_incomes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "public"."sales_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."publishing_imports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."publishing_sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_articles"
    ADD CONSTRAINT "publishing_articles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publishing_imports"
    ADD CONSTRAINT "publishing_imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_imports"
    ADD CONSTRAINT "publishing_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publishing_sites"
    ADD CONSTRAINT "publishing_sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_sites"
    ADD CONSTRAINT "publishing_sites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_sites"
    ADD CONSTRAINT "publishing_sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_instant_alert_log"
    ADD CONSTRAINT "pulse_instant_alert_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_instant_alert_log"
    ADD CONSTRAINT "pulse_instant_alert_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_alert_logs"
    ADD CONSTRAINT "rank_tracking_alert_logs_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."rank_tracking_alerts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_alert_logs"
    ADD CONSTRAINT "rank_tracking_alert_logs_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "public"."rank_tracking_keywords"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rank_tracking_alerts"
    ADD CONSTRAINT "rank_tracking_alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rank_tracking_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_competitors"
    ADD CONSTRAINT "rank_tracking_competitors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rank_tracking_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_history"
    ADD CONSTRAINT "rank_tracking_history_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "public"."rank_tracking_keywords"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_keywords"
    ADD CONSTRAINT "rank_tracking_keywords_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rank_tracking_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rank_tracking_projects"
    ADD CONSTRAINT "rank_tracking_projects_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rank_tracking_projects"
    ADD CONSTRAINT "rank_tracking_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rank_tracking_projects"
    ADD CONSTRAINT "rank_tracking_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recording_folders"
    ADD CONSTRAINT "recording_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_alerts"
    ADD CONSTRAINT "report_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_alerts"
    ADD CONSTRAINT "report_alerts_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."crm_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_alerts"
    ADD CONSTRAINT "report_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_people"
    ADD CONSTRAINT "sales_people_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_people"
    ADD CONSTRAINT "sales_people_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_person_agencies"
    ADD CONSTRAINT "sales_person_agencies_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_person_agencies"
    ADD CONSTRAINT "sales_person_agencies_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "public"."sales_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seo_monthly_shares"
    ADD CONSTRAINT "seo_monthly_shares_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seo_monthly_shares"
    ADD CONSTRAINT "seo_monthly_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signature_documents"
    ADD CONSTRAINT "signature_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signature_documents"
    ADD CONSTRAINT "signature_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signature_documents"
    ADD CONSTRAINT "signature_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."signature_events"
    ADD CONSTRAINT "signature_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signature_events"
    ADD CONSTRAINT "signature_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."signature_recipients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signature_events"
    ADD CONSTRAINT "signature_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."signature_recipients"
    ADD CONSTRAINT "signature_recipients_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signature_recipients"
    ADD CONSTRAINT "signature_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."site_events"
    ADD CONSTRAINT "site_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."site_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_events"
    ADD CONSTRAINT "site_events_tracking_config_id_fkey" FOREIGN KEY ("tracking_config_id") REFERENCES "public"."site_tracking_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_events"
    ADD CONSTRAINT "site_events_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."site_visitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_pageviews"
    ADD CONSTRAINT "site_pageviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."site_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_pageviews"
    ADD CONSTRAINT "site_pageviews_tracking_config_id_fkey" FOREIGN KEY ("tracking_config_id") REFERENCES "public"."site_tracking_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_pageviews"
    ADD CONSTRAINT "site_pageviews_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."site_visitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_sessions"
    ADD CONSTRAINT "site_sessions_tracking_config_id_fkey" FOREIGN KEY ("tracking_config_id") REFERENCES "public"."site_tracking_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_sessions"
    ADD CONSTRAINT "site_sessions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."site_visitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_tracking_configs"
    ADD CONSTRAINT "site_tracking_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_client_id_ref_fkey" FOREIGN KEY ("client_id_ref") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_tracking_config_id_fkey" FOREIGN KEY ("tracking_config_id") REFERENCES "public"."site_tracking_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_gantt_posts"
    ADD CONSTRAINT "social_gantt_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_media_channels"
    ADD CONSTRAINT "social_media_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_media_post_channels"
    ADD CONSTRAINT "social_media_post_channels_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."social_media_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_media_post_channels"
    ADD CONSTRAINT "social_media_post_channels_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."social_media_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_media_posts"
    ADD CONSTRAINT "social_media_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."social_media_posts"
    ADD CONSTRAINT "social_media_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_media_wordpress_sites"
    ADD CONSTRAINT "social_media_wordpress_sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_pages_shared_tenants"
    ADD CONSTRAINT "social_pages_shared_tenants_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."social_pages_shared_tenants"
    ADD CONSTRAINT "social_pages_shared_tenants_social_page_id_fkey" FOREIGN KEY ("social_page_id") REFERENCES "public"."social_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_pages_shared_tenants"
    ADD CONSTRAINT "social_pages_shared_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_agency_id_1_fkey" FOREIGN KEY ("agency_id_1") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_agency_id_2_fkey" FOREIGN KEY ("agency_id_2") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_agency_id_3_fkey" FOREIGN KEY ("agency_id_3") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_related_campaigner_id_fkey" FOREIGN KEY ("related_campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sync_jobs"
    ADD CONSTRAINT "sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_shares"
    ADD CONSTRAINT "table_shares_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."crm_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_shares"
    ADD CONSTRAINT "table_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_collaborators"
    ADD CONSTRAINT "task_collaborators_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_notification_deliveries"
    ADD CONSTRAINT "task_notification_deliveries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_updates"
    ADD CONSTRAINT "task_updates_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_updates"
    ADD CONSTRAINT "task_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_impersonated_by_fkey" FOREIGN KEY ("impersonated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_recurrence_previous_task_id_fkey" FOREIGN KEY ("recurrence_previous_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "public"."sales_people"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_categories"
    ADD CONSTRAINT "team_channel_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_invites"
    ADD CONSTRAINT "team_channel_invites_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_invites"
    ADD CONSTRAINT "team_channel_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_members"
    ADD CONSTRAINT "team_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_members"
    ADD CONSTRAINT "team_channel_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channel_whatsapp_links"
    ADD CONSTRAINT "team_channel_whatsapp_links_whatsapp_group_id_fkey" FOREIGN KEY ("whatsapp_group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."team_channel_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_linked_client_id_fkey" FOREIGN KEY ("linked_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_linked_lead_id_fkey" FOREIGN KEY ("linked_lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_channels"
    ADD CONSTRAINT "team_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."team_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_chat_files"
    ADD CONSTRAINT "team_chat_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_message_attachments"
    ADD CONSTRAINT "team_message_attachments_linked_client_id_fkey" FOREIGN KEY ("linked_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_message_attachments"
    ADD CONSTRAINT "team_message_attachments_linked_lead_id_fkey" FOREIGN KEY ("linked_lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_message_attachments"
    ADD CONSTRAINT "team_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."team_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_message_reactions"
    ADD CONSTRAINT "team_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."team_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_message_read_status"
    ADD CONSTRAINT "team_message_read_status_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_message_read_status"
    ADD CONSTRAINT "team_message_read_status_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."team_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."team_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telephony_settings"
    ADD CONSTRAINT "telephony_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_shared_from_integration_id_fkey" FOREIGN KEY ("shared_from_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_templates"
    ADD CONSTRAINT "tenant_templates_source_tenant_id_fkey" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_terminology"
    ADD CONSTRAINT "tenant_terminology_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY ("parent_tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."terminology_presets"
    ADD CONSTRAINT "terminology_presets_created_by_tenant_id_fkey" FOREIGN KEY ("created_by_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."terminology_presets"
    ADD CONSTRAINT "terminology_presets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_campaigner_id_fkey" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entry_breaks"
    ADD CONSTRAINT "time_entry_breaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entry_breaks"
    ADD CONSTRAINT "time_entry_breaks_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_active_tenant"
    ADD CONSTRAINT "user_active_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_managed_agencies"
    ADD CONSTRAINT "user_managed_agencies_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_managed_agencies"
    ADD CONSTRAINT "user_managed_agencies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_campaigns"
    ADD CONSTRAINT "wa_warm_campaigns_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_campaigns"
    ADD CONSTRAINT "wa_warm_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_opt_ins"
    ADD CONSTRAINT "wa_warm_opt_ins_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."wa_warm_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wa_warm_opt_ins"
    ADD CONSTRAINT "wa_warm_opt_ins_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_opt_ins"
    ADD CONSTRAINT "wa_warm_opt_ins_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_recipients"
    ADD CONSTRAINT "wa_warm_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."wa_warm_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_warm_recipients"
    ADD CONSTRAINT "wa_warm_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wordpress_sites_shared_tenants"
    ADD CONSTRAINT "wordpress_sites_shared_tenants_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wordpress_sites_shared_tenants"
    ADD CONSTRAINT "wordpress_sites_shared_tenants_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."social_media_wordpress_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wordpress_sites_shared_tenants"
    ADD CONSTRAINT "wordpress_sites_shared_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."recording_folders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_suggested_client_id_fkey" FOREIGN KEY ("suggested_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoom_recordings"
    ADD CONSTRAINT "zoom_recordings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view global_settings" ON "public"."global_settings" FOR SELECT USING (true);



CREATE POLICY "Campaigners can manage tables for assigned clients" ON "public"."crm_tables" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id")));



CREATE POLICY "Campaigners can view their tables" ON "public"."crm_tables" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ((("agency_id" IS NULL) AND ("client_id" IS NULL)) OR (("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))))));



CREATE POLICY "Campaigners view assigned agencies" ON "public"."agencies" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("id" = ANY ("public"."get_user_agency_ids"("auth"."uid"())))));



CREATE POLICY "Campaigners view assigned clients" ON "public"."clients" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))));



CREATE POLICY "Campaigners view maskyoo_numbers" ON "public"."maskyoo_numbers" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "maskyoo_numbers"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))) OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role"))));



CREATE POLICY "Campaigners view seo_call_snapshots for their clients" ON "public"."seo_call_snapshots" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "seo_call_snapshots"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))) OR (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role")) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))));



CREATE POLICY "Cross-tenant agency access to wp sites" ON "public"."social_media_wordpress_sites" FOR SELECT TO "authenticated" USING ((("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")));



CREATE POLICY "Integration owners can manage permissions" ON "public"."integration_user_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE (("ti"."id" = "integration_user_permissions"."integration_id") AND (("ti"."user_id" = "auth"."uid"()) OR ("ti"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE (("ti"."id" = "integration_user_permissions"."integration_id") AND (("ti"."user_id" = "auth"."uid"()) OR ("ti"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))));



CREATE POLICY "Managers manage carmen access policies" ON "public"."carmen_access_policies" TO "authenticated" USING (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))) WITH CHECK (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))));



CREATE POLICY "Managers manage carmen client group access" ON "public"."carmen_client_group_access" TO "authenticated" USING (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))) WITH CHECK (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))));



CREATE POLICY "Managers manage carmen command center access" ON "public"."carmen_command_center_access" TO "authenticated" USING (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))) WITH CHECK (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))));



CREATE POLICY "Managers view carmen access policies" ON "public"."carmen_access_policies" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Managers view carmen client group access" ON "public"."carmen_client_group_access" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Managers view carmen command center access" ON "public"."carmen_command_center_access" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners and super admins can create invitation tokens" ON "public"."invitation_tokens" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owners and super admins can update profiles in their tenants" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."tenant_users" "tu" ON (("tu"."tenant_id" = "ur"."tenant_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner'::"public"."app_role") AND ("tu"."user_id" = "profiles"."id"))))));



CREATE POLICY "Owners can create agencies in their tenants" ON "public"."agencies" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can delete agencies in their tenants" ON "public"."agencies" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "agencies"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can delete archived leads in their tenants" ON "public"."leads" FOR DELETE TO "authenticated" USING ((("archived_at" IS NOT NULL) AND "public"."can_manage_lead_archive"("tenant_id")));



CREATE POLICY "Owners can delete managed agencies" ON "public"."user_managed_agencies" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can delete permissions" ON "public"."user_permissions" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can delete roles with restrictions" ON "public"."user_roles" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ((("role" = 'owner'::"public"."app_role") AND ("user_id" = "auth"."uid"())) OR (("role" = 'super_admin'::"public"."app_role") AND ("user_id" = "auth"."uid"())) OR ("role" <> ALL (ARRAY['owner'::"public"."app_role", 'super_admin'::"public"."app_role"])))));



CREATE POLICY "Owners can delete tenant_users in their tenant" ON "public"."tenant_users" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "Owners can insert agencies" ON "public"."agencies" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can insert managed agencies" ON "public"."user_managed_agencies" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can insert permissions" ON "public"."user_permissions" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can insert tenant_users in their tenant" ON "public"."tenant_users" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Owners can manage agencies in their tenant" ON "public"."agencies" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "Owners can manage all tables in tenant" ON "public"."crm_tables" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage automations" ON "public"."automations" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage custom_fields" ON "public"."custom_fields" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage fields" ON "public"."crm_fields" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_tables"
  WHERE (("crm_tables"."id" = "crm_fields"."table_id") AND ("crm_tables"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."is_super_admin"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_tables"
  WHERE (("crm_tables"."id" = "crm_fields"."table_id") AND ("crm_tables"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."is_super_admin"("auth"."uid"()))))));



CREATE POLICY "Owners can manage integration sharing" ON "public"."integration_tenant_access" TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE (("ti"."id" = "integration_tenant_access"."integration_id") AND ("ti"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE (("ti"."id" = "integration_tenant_access"."integration_id") AND ("ti"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"))))));



CREATE POLICY "Owners can manage menu_items" ON "public"."menu_items" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage pipeline stages" ON "public"."lead_pipeline_stages" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage sales_person_agencies" ON "public"."sales_person_agencies" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can manage statuses" ON "public"."lead_statuses" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner'::"public"."app_role") AND ("ur"."tenant_id" = "lead_statuses"."tenant_id"))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner'::"public"."app_role") AND ("ur"."tenant_id" = "lead_statuses"."tenant_id")))))));



CREATE POLICY "Owners can manage terminology" ON "public"."tenant_terminology" TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "Owners can manage their tenant agency access" ON "public"."agency_tenant_access" USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND (("source_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND (("source_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));



CREATE POLICY "Owners can update agencies" ON "public"."agencies" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "agencies"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can update agencies in their tenants" ON "public"."agencies" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "agencies"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = 'owner'::"public"."app_role")))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Owners can update blocked status" ON "public"."chat_messages" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "Owners can update managed agencies" ON "public"."user_managed_agencies" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can update menu_items" ON "public"."menu_items" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "Owners can update permissions" ON "public"."user_permissions" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can update roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can update tenant_users in their tenant" ON "public"."tenant_users" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Owners can view all managed agencies" ON "public"."user_managed_agencies" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can view all permissions" ON "public"."user_permissions" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role"));



CREATE POLICY "Owners can view tenant_users in their tenant" ON "public"."tenant_users" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Owners view all agencies in tenant" ON "public"."agencies" FOR SELECT USING ((("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role")) AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "id"))));



CREATE POLICY "Owners view all clients in tenant" ON "public"."clients" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "Owners view all leads in tenant" ON "public"."leads" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



CREATE POLICY "SEO users can manage tables for SEO clients" ON "public"."crm_tables" TO "authenticated" USING (("public"."user_has_seo_scope"("auth"."uid"()) AND ("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id"))) WITH CHECK (("public"."user_has_seo_scope"("auth"."uid"()) AND ("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id")));



CREATE POLICY "SEO users view SEO-tagged clients" ON "public"."clients" FOR SELECT TO "authenticated" USING (("public"."user_has_seo_scope"("auth"."uid"()) AND (("is_seo_client" = true) OR ("services" @> '["seo"]'::"jsonb")) AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id"))));



CREATE POLICY "SEO users view tenant and shared agencies" ON "public"."agencies" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role") AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "id"))));



CREATE POLICY "Sales people can view clients from their agencies" ON "public"."clients" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("agency_id" = ANY ("public"."get_user_sales_person_agency_ids"("auth"."uid"()))))));



CREATE POLICY "Sales people view assigned agencies" ON "public"."agencies" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") AND ("id" = ANY ("public"."get_user_sales_person_agency_ids"("auth"."uid"())))));



CREATE POLICY "Sales people view assigned leads" ON "public"."leads" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") AND ("sales_person_id" = "public"."get_user_sales_person_id"("auth"."uid"()))));



CREATE POLICY "Service role can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert tenant_users" ON "public"."tenant_users" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can read invitation tokens" ON "public"."invitation_tokens" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can update invitation tokens" ON "public"."invitation_tokens" FOR UPDATE USING (true);



CREATE POLICY "Shared-agency cross-tenant client view" ON "public"."clients" FOR SELECT USING (((NOT "public"."user_is_restricted_client_viewer"("auth"."uid"())) AND ("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")));



CREATE POLICY "Shared-agency cross-tenant client_team view" ON "public"."client_team" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_team"."client_id") AND ("c"."agency_id" IS NOT NULL) AND (NOT "public"."user_is_restricted_client_viewer"("auth"."uid"())) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "c"."agency_id")))));



CREATE POLICY "Shared-agency cross-tenant task view" ON "public"."tasks" FOR SELECT USING (((NOT "public"."user_is_restricted_client_viewer"("auth"."uid"())) AND ("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")));



CREATE POLICY "Super admins and owners can insert tenants" ON "public"."tenants" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")));



COMMENT ON POLICY "Super admins and owners can insert tenants" ON "public"."tenants" IS 'Allows both super admins and tenant owners to create new tenants (sub-organizations)';



CREATE POLICY "Super admins can delete roles" ON "public"."user_roles" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) AND ((("role" = 'owner'::"public"."app_role") AND ("user_id" <> "auth"."uid"())) OR (("role" = 'super_admin'::"public"."app_role") AND ("user_id" = "auth"."uid"())) OR ("role" <> ALL (ARRAY['owner'::"public"."app_role", 'super_admin'::"public"."app_role"])))));



CREATE POLICY "Super admins can delete tenant_users" ON "public"."tenant_users" FOR DELETE USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can delete tenants" ON "public"."tenants" FOR DELETE USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can insert tenant_users" ON "public"."tenant_users" FOR INSERT WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage agencies with permission" ON "public"."agencies" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "agencies"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "agencies"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage all agency_tenant_access" ON "public"."agency_tenant_access" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all integrations" ON "public"."tenant_integrations" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all menu_items" ON "public"."menu_items" USING ("public"."is_super_admin"("auth"."uid"())) WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all permissions" ON "public"."integration_user_permissions" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all tenant_settings" ON "public"."tenant_settings" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all terminology" ON "public"."tenant_terminology" TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage automations with permission" ON "public"."automations" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "automations"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "automations"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage campaigners with permission" ON "public"."campaigners" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "campaigners"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "campaigners"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage client_onboarding with permission" ON "public"."client_onboarding" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "client_onboarding"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "client_onboarding"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage clients with permission" ON "public"."clients" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "clients"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "clients"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage global_settings" ON "public"."global_settings" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can manage leads with permission" ON "public"."leads" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "leads"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "leads"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage products with permission" ON "public"."products" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "products"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "products"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage sales_people with permission" ON "public"."sales_people" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "sales_people"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "sales_people"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage suppliers with permission" ON "public"."suppliers" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "suppliers"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "suppliers"."tenant_id")) = true)));



CREATE POLICY "Super admins can manage time_entries with permission" ON "public"."time_entries" USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "time_entries"."tenant_id")) = true))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "time_entries"."tenant_id")) = true)));



CREATE POLICY "Super admins can update tenant_users" ON "public"."tenant_users" FOR UPDATE USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can update tenants" ON "public"."tenants" FOR UPDATE USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can view agencies with permission" ON "public"."agencies" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "agencies"."tenant_id")) = true)));



CREATE POLICY "Super admins can view all permissions" ON "public"."user_permissions" FOR SELECT USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins can view automations with permission" ON "public"."automations" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "automations"."tenant_id")) = true)));



CREATE POLICY "Super admins can view campaigners with permission" ON "public"."campaigners" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "campaigners"."tenant_id")) = true)));



CREATE POLICY "Super admins can view client_onboarding with permission" ON "public"."client_onboarding" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "client_onboarding"."tenant_id")) = true)));



CREATE POLICY "Super admins can view clients with permission" ON "public"."clients" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "clients"."tenant_id")) = true)));



CREATE POLICY "Super admins can view leads with permission" ON "public"."leads" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "leads"."tenant_id")) = true)));



CREATE POLICY "Super admins can view products with permission" ON "public"."products" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "products"."tenant_id")) = true)));



CREATE POLICY "Super admins can view sales_people with permission" ON "public"."sales_people" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "sales_people"."tenant_id")) = true)));



CREATE POLICY "Super admins can view suppliers with permission" ON "public"."suppliers" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "suppliers"."tenant_id")) = true)));



CREATE POLICY "Super admins can view time_entries with permission" ON "public"."time_entries" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "time_entries"."tenant_id")) = true)));



CREATE POLICY "Super admins see all active_tenant" ON "public"."user_active_tenant" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins see all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins see all tenant_users" ON "public"."tenant_users" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins see all tenants" ON "public"."tenants" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Super admins view agencies with permission" ON "public"."agencies" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "agencies"."tenant_id")) = true)));



CREATE POLICY "Super admins view clients with permission" ON "public"."clients" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "clients"."tenant_id")) = true)));



CREATE POLICY "Super admins view leads with permission" ON "public"."leads" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) AND (( SELECT "tenants"."allow_super_admin_access"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "leads"."tenant_id")) = true)));



CREATE POLICY "System can insert automation logs" ON "public"."automation_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Team managers and owners can insert campaigners" ON "public"."campaigners" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."user_can_manage_campaigners_for_tenant"("tenant_id"))));



CREATE POLICY "Team managers and owners can view cross-tenant campaigners on t" ON "public"."campaigners" FOR SELECT TO "authenticated" USING ((("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'team_manager'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'owner'::"public"."app_role")) AND ("id" = ANY (COALESCE("public"."get_cross_tenant_campaigner_ids"(( SELECT "auth"."uid"() AS "uid")), ARRAY[]::"uuid"[])))));



CREATE POLICY "Team managers can manage client_onboarding from managed agencie" ON "public"."client_onboarding" TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ("public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_onboarding"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id"))))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ("public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_onboarding"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id")))))))));



CREATE POLICY "Team managers can manage their tables" ON "public"."crm_tables" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ((("agency_id" IS NULL) AND ("client_id" IS NULL)) OR "public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "crm_tables"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id")))))))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ((("agency_id" IS NULL) AND ("client_id" IS NULL)) OR "public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "crm_tables"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id"))))))));



CREATE POLICY "Team managers can view client_onboarding from managed agencies" ON "public"."client_onboarding" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ("public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_onboarding"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id"))))))) OR ("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ("public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_onboarding"."client_id") AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "c"."agency_id")))))))));



CREATE POLICY "Team managers can view managed tables" ON "public"."crm_tables" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ((("agency_id" IS NULL) AND ("client_id" IS NULL)) OR "public"."user_manages_agency"("auth"."uid"(), "agency_id") OR (("client_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "crm_tables"."client_id") AND "public"."user_manages_agency"("auth"."uid"(), "c"."agency_id"))))))));



CREATE POLICY "Team managers view clients from managed agencies" ON "public"."clients" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND "public"."user_manages_agency"("auth"."uid"(), "agency_id") AND (("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id"))));



CREATE POLICY "Team managers view leads from managed agencies" ON "public"."leads" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND ("agency_id" IS NOT NULL) AND "public"."user_manages_agency"("auth"."uid"(), "agency_id") AND (("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id"))));



CREATE POLICY "Team managers view managed agencies" ON "public"."agencies" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND "public"."user_manages_agency"("auth"."uid"(), "id") AND (("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "id"))));



CREATE POLICY "Tenant isolation for social_media_channels" ON "public"."social_media_channels" USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tenant isolation for social_media_post_channels" ON "public"."social_media_post_channels" USING (("post_id" IN ( SELECT "social_media_posts"."id"
   FROM "public"."social_media_posts"
  WHERE ("social_media_posts"."tenant_id" IN ( SELECT "tenant_users"."tenant_id"
           FROM "public"."tenant_users"
          WHERE ("tenant_users"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Tenant isolation for social_media_posts" ON "public"."social_media_posts" USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tenant isolation for social_media_wordpress_sites" ON "public"."social_media_wordpress_sites" USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tenant managers can manage Carmen identities" ON "public"."carmen_whatsapp_identities" TO "authenticated" USING (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))) WITH CHECK (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))));



CREATE POLICY "Tenant managers can manage Carmen identity candidates" ON "public"."carmen_whatsapp_identity_candidates" TO "authenticated" USING (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))) WITH CHECK (((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'agency_owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))));



CREATE POLICY "Tenant managers can view Carmen identities" ON "public"."carmen_whatsapp_identities" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant managers can view Carmen identity candidates" ON "public"."carmen_whatsapp_identity_candidates" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant managers manage ahrefs_reports" ON "public"."ahrefs_reports" TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ahrefs_reports"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ahrefs_reports"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"])))))));



CREATE POLICY "Tenant managers manage maskyoo_numbers" ON "public"."maskyoo_numbers" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "maskyoo_numbers"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "maskyoo_numbers"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"])))))));



CREATE POLICY "Tenant managers manage maskyoo_settings" ON "public"."maskyoo_settings" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "maskyoo_settings"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "maskyoo_settings"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"])))))));



CREATE POLICY "Tenant managers manage seo_call_snapshots" ON "public"."seo_call_snapshots" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "seo_call_snapshots"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"]))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "seo_call_snapshots"."tenant_id") AND (("ur"."role")::"text" = ANY (ARRAY['owner'::"text", 'team_manager'::"text"])))))));



CREATE POLICY "Tenant members can insert brain routes" ON "public"."agent_brain_routes" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can insert channel sessions" ON "public"."agent_channel_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can insert conversation messages" ON "public"."ai_conversation_messages" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can update brain routes" ON "public"."agent_brain_routes" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can update channel sessions" ON "public"."agent_channel_sessions" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can view brain routes" ON "public"."agent_brain_routes" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can view channel sessions" ON "public"."agent_channel_sessions" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can view conversation messages" ON "public"."ai_conversation_messages" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Tenant members can view explicitly shared integrations" ON "public"."tenant_integrations" FOR SELECT TO "authenticated" USING ("public"."tenant_can_use_integration"("public"."get_user_tenant_id"("auth"."uid"()), "id"));



CREATE POLICY "Tenant members can view messages from explicitly shared integra" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (COALESCE("is_blocked", false) = false) AND ("integration_id" IS NOT NULL) AND "public"."tenant_can_use_integration"("tenant_id", "integration_id")));



CREATE POLICY "Tenant members read call_logs" ON "public"."call_logs" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_users" "tu"
  WHERE (("tu"."user_id" = "auth"."uid"()) AND ("tu"."tenant_id" = "call_logs"."tenant_id"))))));



CREATE POLICY "Tenant members view ahrefs_reports" ON "public"."ahrefs_reports" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ahrefs_reports"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role"]))))) OR (("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) OR (("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role")) AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))));



CREATE POLICY "Tenant owners and super admins can insert tenant_settings" ON "public"."tenant_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_users" "tu"
  WHERE (("tu"."user_id" = "auth"."uid"()) AND ("tu"."tenant_id" = "tenant_settings"."tenant_id") AND ("tu"."role" = 'owner'::"text")))))));



CREATE POLICY "Tenant owners and super admins can update menu_items" ON "public"."menu_items" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_users" "tu"
  WHERE (("tu"."user_id" = "auth"."uid"()) AND ("tu"."tenant_id" = "menu_items"."tenant_id") AND ("tu"."role" = 'owner'::"text")))))));



CREATE POLICY "Tenant owners and super admins can update tenant_settings" ON "public"."tenant_settings" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."user_id" = "auth"."uid"()) AND ("tenant_users"."tenant_id" = "tenant_settings"."tenant_id") AND ("tenant_users"."role" = 'owner'::"text")))))));



CREATE POLICY "Tenant owners can insert their tenant_settings" ON "public"."tenant_settings" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_users" "tu"
  WHERE (("tu"."user_id" = "auth"."uid"()) AND ("tu"."tenant_id" = "tenant_settings"."tenant_id") AND ("tu"."role" = 'owner'::"text"))))));



CREATE POLICY "Tenant owners can update their tenant_settings" ON "public"."tenant_settings" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."user_id" = "auth"."uid"()) AND ("tenant_users"."tenant_id" = "tenant_settings"."tenant_id") AND ("tenant_users"."role" = 'owner'::"text"))))));



CREATE POLICY "Tenant owners can view their tenant_settings" ON "public"."tenant_settings" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "Users and admins can manage contact tags" ON "public"."chat_contact_tags" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "chat_contact_tags"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'agency_owner'::"public"."app_role", 'team_manager'::"public"."app_role"])))))))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can assign campaigners to accessible agencies" ON "public"."campaigner_agencies" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ("public"."user_can_manage_campaigners_for_tenant"("public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."campaigners" "c"
  WHERE (("c"."id" = "campaigner_agencies"."campaigner_id") AND ("c"."tenant_id" = "public"."get_effective_tenant_id"())))) AND (("agency_id" IN ( SELECT "a"."id"
   FROM "public"."agencies" "a"
  WHERE ("a"."tenant_id" = "public"."get_effective_tenant_id"()))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE (("ata"."accessing_tenant_id" = "public"."get_effective_tenant_id"()) AND ("ata"."access_level" = 'read_write'::"text"))))))));



CREATE POLICY "Users can create client updates in their tenant" ON "public"."client_updates" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can create clients in their tenants" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'sales_person'::"public"."app_role"]))))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can create dashboards in their tenant" ON "public"."crm_dashboards" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id") AND ("tenant_id" = COALESCE(( SELECT "a"."tenant_id"
   FROM "public"."agencies" "a"
  WHERE ("a"."id" = "crm_dashboards"."agency_id")), ( SELECT "c"."tenant_id"
   FROM "public"."clients" "c"
  WHERE ("c"."id" = "crm_dashboards"."client_id"))))) OR ((NOT "public"."user_is_restricted_client_viewer"("auth"."uid"())) AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR (("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id") AND ("tenant_id" = ( SELECT "a"."tenant_id"
   FROM "public"."agencies" "a"
  WHERE ("a"."id" = "crm_dashboards"."agency_id"))))))));



CREATE POLICY "Users can create documents in their tenant" ON "public"."signature_documents" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can create lead updates" ON "public"."lead_updates" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."user_can_annotate_lead"("lead_id")));



CREATE POLICY "Users can create leads in their tenants" ON "public"."leads" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'campaigner'::"public"."app_role", 'sales_person'::"public"."app_role"]))))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can create task updates" ON "public"."task_updates" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("task_id" IN ( SELECT "t"."id"
   FROM "public"."tasks" "t"
  WHERE (("t"."agency_id" = ANY ("public"."get_user_agency_ids"("auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR ("t"."agency_id" = ANY ("public"."get_user_sales_person_agency_ids"("auth"."uid"()))) OR "public"."user_manages_agency"("auth"."uid"(), "t"."agency_id"))))));



CREATE POLICY "Users can create tasks in accessible agencies" ON "public"."tasks" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "tasks"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'campaigner'::"public"."app_role"]))))) AND (("agency_id" IN ( SELECT "agencies"."id"
   FROM "public"."agencies"
  WHERE ("agencies"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE ("ata"."accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))));



CREATE POLICY "Users can delete campaigner_agencies" ON "public"."campaigner_agencies" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR ("public"."user_can_manage_campaigners_for_tenant"("public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."campaigners" "c"
  WHERE (("c"."id" = "campaigner_agencies"."campaigner_id") AND ("c"."tenant_id" = "public"."get_effective_tenant_id"())))) AND (("agency_id" IN ( SELECT "a"."id"
   FROM "public"."agencies" "a"
  WHERE ("a"."tenant_id" = "public"."get_effective_tenant_id"()))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE (("ata"."accessing_tenant_id" = "public"."get_effective_tenant_id"()) AND ("ata"."access_level" = 'read_write'::"text"))))))));



CREATE POLICY "Users can delete campaigners in their tenant" ON "public"."campaigners" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."user_can_manage_campaigners_for_tenant"("tenant_id"))));



CREATE POLICY "Users can delete checklist items in their tenant" ON "public"."task_checklist_items" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete client contacts in their tenant" ON "public"."client_contacts" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id")));



CREATE POLICY "Users can delete client_suppliers in their tenant" ON "public"."client_suppliers" FOR DELETE TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete client_team in their tenant" ON "public"."client_team" FOR DELETE TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete clients in their or shared tenants" ON "public"."clients" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND "public"."user_manages_agency"("auth"."uid"(), "agency_id")) OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))))));



CREATE POLICY "Users can delete dashboards in their tenant" ON "public"."crm_dashboards" FOR DELETE TO "authenticated" USING ("public"."user_can_manage_crm_dashboard"("auth"."uid"(), "tenant_id", "agency_id", "client_id"));



CREATE POLICY "Users can delete documents in their tenant" ON "public"."signature_documents" FOR DELETE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete financial data in their tenant" ON "public"."client_tenant_financial_data" FOR DELETE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete flow steps in their tenant" ON "public"."automation_flow_steps" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete own client updates" ON "public"."client_updates" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own conversations" ON "public"."ai_conversations" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Users can delete own lead updates" ON "public"."lead_updates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own task updates" ON "public"."task_updates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete permissions they can manage" ON "public"."user_permissions" FOR DELETE USING ("public"."can_manage_user_permissions"("user_id"));



CREATE POLICY "Users can delete products in their tenant" ON "public"."products" FOR DELETE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete recipients in their tenant" ON "public"."signature_recipients" FOR DELETE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete sales_people in their tenant" ON "public"."sales_people" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete suppliers in their tenant" ON "public"."suppliers" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete tasks in accessible agencies" ON "public"."tasks" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "tasks"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role"]))))) AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE ("ata"."accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))));



CREATE POLICY "Users can delete their connection messages" ON "public"."chat_messages" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR ("connection_user_id" = "auth"."uid"()) OR ("sent_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can delete their own blocked contacts" ON "public"."blocked_contacts" FOR DELETE USING ((("connection_user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can delete their own calendar token" ON "public"."calendar_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own calendar tokens" ON "public"."calendar_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own marked read contacts" ON "public"."manually_read_contacts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own presets" ON "public"."lead_filter_presets" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete zoom recordings in their tenant" ON "public"."zoom_recordings" FOR DELETE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert checklist items in their tenant" ON "public"."task_checklist_items" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert client contacts in their tenant" ON "public"."client_contacts" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_client_tenant_id"("client_id")) AND ("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can insert client_suppliers in their tenant" ON "public"."client_suppliers" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert client_team in their tenant" ON "public"."client_team" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert clients in their tenants" ON "public"."clients" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'sales_person'::"public"."app_role", 'campaigner'::"public"."app_role"]))))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert credentials in their tenant" ON "public"."client_credentials" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_client_tenant_id"("client_id")) AND ("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can insert financial data in their tenant" ON "public"."client_tenant_financial_data" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert flow steps in their tenant" ON "public"."automation_flow_steps" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert import_history in their tenant" ON "public"."import_history" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert meeting bot sessions in their tenant" ON "public"."meeting_bot_sessions" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own conversations" ON "public"."ai_conversations" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Users can insert permissions they can manage" ON "public"."user_permissions" FOR INSERT WITH CHECK ("public"."can_manage_user_permissions"("user_id"));



CREATE POLICY "Users can insert products in their tenant" ON "public"."products" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert sales_people in their tenant" ON "public"."sales_people" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert suppliers in their tenant" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert their own blocked contacts" ON "public"."blocked_contacts" FOR INSERT WITH CHECK ((("connection_user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can insert their own calendar token" ON "public"."calendar_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own calendar tokens" ON "public"."calendar_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own integrations" ON "public"."tenant_integrations" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."tenant_users" "tu"
  WHERE (("tu"."user_id" = "auth"."uid"()) AND ("tu"."tenant_id" = "tenant_integrations"."tenant_id")))) OR "public"."is_super_admin"("auth"."uid"()))));



CREATE POLICY "Users can insert their own marked read contacts" ON "public"."manually_read_contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own presets" ON "public"."lead_filter_presets" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"()))));



CREATE POLICY "Users can insert zoom recordings in their tenant" ON "public"."zoom_recordings" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage client_onboarding in their tenant" ON "public"."client_onboarding" TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage groups in their tenant" ON "public"."whatsapp_groups" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage recipients in their tenant" ON "public"."signature_recipients" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage records in their tenant" ON "public"."crm_records" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage tags in their tenant" ON "public"."chat_tags" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage their own integrations" ON "public"."tenant_integrations" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can manage their own shares" ON "public"."dashboard_shares" TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR (EXISTS ( SELECT 1
   FROM "public"."crm_dashboards" "d"
  WHERE (("d"."id" = "dashboard_shares"."dashboard_id") AND "public"."user_can_manage_crm_dashboard"("auth"."uid"(), "d"."tenant_id", "d"."agency_id", "d"."client_id")))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR (EXISTS ( SELECT 1
   FROM "public"."crm_dashboards" "d"
  WHERE (("d"."id" = "dashboard_shares"."dashboard_id") AND ("d"."tenant_id" = "dashboard_shares"."tenant_id") AND "public"."user_can_manage_crm_dashboard"("auth"."uid"(), "d"."tenant_id", "d"."agency_id", "d"."client_id"))))));



CREATE POLICY "Users can manage their tenant table shares" ON "public"."table_shares" TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_effective_tenant_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."crm_tables" "t"
  WHERE (("t"."id" = "table_shares"."table_id") AND "public"."user_can_access_crm_table"("auth"."uid"(), "t"."id")))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_effective_tenant_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."crm_tables" "t"
  WHERE (("t"."id" = "table_shares"."table_id") AND ("t"."tenant_id" = "table_shares"."tenant_id") AND "public"."user_can_access_crm_table"("auth"."uid"(), "t"."id"))))));



CREATE POLICY "Users can manage time_entries in their tenant" ON "public"."time_entries" TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can read their own calendar token" ON "public"."calendar_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update campaigner_agencies" ON "public"."campaigner_agencies" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR ("public"."user_can_manage_campaigners_for_tenant"("public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."campaigners" "c"
  WHERE (("c"."id" = "campaigner_agencies"."campaigner_id") AND ("c"."tenant_id" = "public"."get_effective_tenant_id"())))) AND (("agency_id" IN ( SELECT "a"."id"
   FROM "public"."agencies" "a"
  WHERE ("a"."tenant_id" = "public"."get_effective_tenant_id"()))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE (("ata"."accessing_tenant_id" = "public"."get_effective_tenant_id"()) AND ("ata"."access_level" = 'read_write'::"text")))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ("public"."user_can_manage_campaigners_for_tenant"("public"."get_effective_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."campaigners" "c"
  WHERE (("c"."id" = "campaigner_agencies"."campaigner_id") AND ("c"."tenant_id" = "public"."get_effective_tenant_id"())))) AND (("agency_id" IN ( SELECT "a"."id"
   FROM "public"."agencies" "a"
  WHERE ("a"."tenant_id" = "public"."get_effective_tenant_id"()))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE (("ata"."accessing_tenant_id" = "public"."get_effective_tenant_id"()) AND ("ata"."access_level" = 'read_write'::"text"))))))));



CREATE POLICY "Users can update campaigners in their tenant" ON "public"."campaigners" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."user_can_manage_campaigners_for_tenant"("tenant_id")))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."user_can_manage_campaigners_for_tenant"("tenant_id"))));



CREATE POLICY "Users can update chat_messages in their tenant" ON "public"."chat_messages" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update checklist items in their tenant" ON "public"."task_checklist_items" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update client contacts in their tenant" ON "public"."client_contacts" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id"))) WITH CHECK ((("tenant_id" = "public"."get_client_tenant_id"("client_id")) AND ("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can update client_suppliers in their tenant" ON "public"."client_suppliers" FOR UPDATE TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update client_team in their tenant" ON "public"."client_team" FOR UPDATE TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update clients in their or shared tenants" ON "public"."clients" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))) OR ("public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role") AND (("is_seo_client" = true) OR ("services" @> '["seo"]'::"jsonb"))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))) OR ("public"."has_role"("auth"."uid"(), 'seo'::"public"."app_role") AND (("is_seo_client" = true) OR ("services" @> '["seo"]'::"jsonb")))))));



CREATE POLICY "Users can update dashboards in their tenant" ON "public"."crm_dashboards" FOR UPDATE TO "authenticated" USING ("public"."user_can_manage_crm_dashboard"("auth"."uid"(), "tenant_id", "agency_id", "client_id")) WITH CHECK ("public"."user_can_manage_crm_dashboard"("auth"."uid"(), "tenant_id", "agency_id", "client_id"));



CREATE POLICY "Users can update documents in their tenant" ON "public"."signature_documents" FOR UPDATE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update financial data in their tenant" ON "public"."client_tenant_financial_data" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update flow steps in their tenant" ON "public"."automation_flow_steps" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update leads in their tenants" ON "public"."leads" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "leads"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'campaigner'::"public"."app_role", 'sales_person'::"public"."app_role"]))))) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" = "ur"."tenant_id") AND ("ur"."role" = ANY (ARRAY['owner'::"public"."app_role", 'team_manager'::"public"."app_role", 'campaigner'::"public"."app_role", 'sales_person'::"public"."app_role"]))))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update meeting bot sessions in their tenant" ON "public"."meeting_bot_sessions" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own client updates" ON "public"."client_updates" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own conversations" ON "public"."ai_conversations" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Users can update own lead updates" ON "public"."lead_updates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own task updates" ON "public"."task_updates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update permissions they can manage" ON "public"."user_permissions" FOR UPDATE USING ("public"."can_manage_user_permissions"("user_id")) WITH CHECK ("public"."can_manage_user_permissions"("user_id"));



CREATE POLICY "Users can update products in their tenant" ON "public"."products" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update recipients in their tenant" ON "public"."signature_recipients" FOR UPDATE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update sales_people in their tenant" ON "public"."sales_people" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update suppliers in their tenant" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can update tasks in accessible agencies" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("campaigner_id" = "public"."get_user_campaigner_id"("auth"."uid"()))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'sales_person'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("campaigner_id" = "public"."get_user_campaigner_id"("auth"."uid"())))))));



CREATE POLICY "Users can update their connection messages" ON "public"."chat_messages" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR ("connection_user_id" = "auth"."uid"()) OR ("sent_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can update their own calendar token" ON "public"."calendar_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own calendar tokens" ON "public"."calendar_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own presets" ON "public"."lead_filter_presets" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"()))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update zoom recordings in their tenant" ON "public"."zoom_recordings" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view automation logs in their tenant" ON "public"."automation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."automations"
  WHERE (("automations"."id" = "automation_logs"."automation_id") AND (("automations"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))))));



CREATE POLICY "Users can view automations in their tenant" ON "public"."automations" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view campaigner_agencies" ON "public"."campaigner_agencies" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."campaigners" "c"
  WHERE (("c"."id" = "campaigner_agencies"."campaigner_id") AND ("c"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))) OR ("agency_id" IN ( SELECT "ata"."agency_id"
   FROM "public"."agency_tenant_access" "ata"
  WHERE ("ata"."accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));



CREATE POLICY "Users can view campaigners in their active tenant" ON "public"."campaigners" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Users can view checklist items in their tenant" ON "public"."task_checklist_items" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view client contacts in their tenant" ON "public"."client_contacts" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR "public"."user_can_access_client"("auth"."uid"(), "client_id")));



CREATE POLICY "Users can view client updates in their tenant" ON "public"."client_updates" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view client_onboarding from shared agencies" ON "public"."client_onboarding" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id") OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_onboarding"."client_id") AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "c"."agency_id"))))));



CREATE POLICY "Users can view client_onboarding in their tenant" ON "public"."client_onboarding" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view client_suppliers in their tenant" ON "public"."client_suppliers" FOR SELECT TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view client_team for accessible clients" ON "public"."client_team" FOR SELECT TO "authenticated" USING ("public"."user_can_access_client"("auth"."uid"(), "client_id"));



CREATE POLICY "Users can view client_team in their tenant" ON "public"."client_team" FOR SELECT TO "authenticated" USING ((("public"."get_client_tenant_id"("client_id") = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view contact tags in their tenant" ON "public"."chat_contact_tags" FOR SELECT USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view custom_fields in their tenant" ON "public"."custom_fields" FOR SELECT USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view dashboards by role scope" ON "public"."crm_dashboards" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id")) OR ((NOT "public"."user_is_restricted_client_viewer"("auth"."uid"())) AND ("client_id" IS NULL) AND (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")))));



CREATE POLICY "Users can view documents in their tenant" ON "public"."signature_documents" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view fields" ON "public"."crm_fields" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."crm_tables"
  WHERE (("crm_tables"."id" = "crm_fields"."table_id") AND (("crm_tables"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))))));



CREATE POLICY "Users can view financial data in their tenant" ON "public"."client_tenant_financial_data" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view flow steps in their tenant" ON "public"."automation_flow_steps" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view groups in their tenant" ON "public"."whatsapp_groups" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view import_history in their tenant" ON "public"."import_history" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view invitations in their tenant" ON "public"."invitation_tokens" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view lead updates" ON "public"."lead_updates" FOR SELECT USING ("public"."user_can_annotate_lead"("lead_id"));



CREATE POLICY "Users can view meeting bot sessions in their tenant" ON "public"."meeting_bot_sessions" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view menu_items in their tenant" ON "public"."menu_items" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view own conversations in their tenant" ON "public"."ai_conversations" FOR SELECT USING (((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view permissions they can manage" ON "public"."user_permissions" FOR SELECT USING ("public"."can_manage_user_permissions"("user_id"));



CREATE POLICY "Users can view pipeline stages in their tenant" ON "public"."lead_pipeline_stages" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view products in their tenant" ON "public"."products" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()) OR (("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id"))));



CREATE POLICY "Users can view profiles in their tenant" ON "public"."profiles" FOR SELECT USING (("id" IN ( SELECT "tu1"."user_id"
   FROM "public"."tenant_users" "tu1"
  WHERE ("tu1"."tenant_id" IN ( SELECT "tu2"."tenant_id"
           FROM "public"."tenant_users" "tu2"
          WHERE ("tu2"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view recipients in their tenant" ON "public"."signature_recipients" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view records from shared agencies" ON "public"."crm_records" FOR SELECT USING ((("agency_id" IS NOT NULL) AND ("public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id") OR "public"."is_super_admin"("auth"."uid"()))));



CREATE POLICY "Users can view records in their tenant" ON "public"."crm_records" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view sales_people in their tenant" ON "public"."sales_people" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view sales_person_agencies in their tenant" ON "public"."sales_person_agencies" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_people"
  WHERE (("sales_people"."id" = "sales_person_agencies"."sales_person_id") AND (("sales_people"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))))));



CREATE POLICY "Users can view shared mirror flow steps" ON "public"."automation_flow_steps" FOR SELECT TO "authenticated" USING ("public"."is_automation_shared_to_tenant"("automation_id", "public"."get_effective_tenant_id"()));



CREATE POLICY "Users can view signature events in their tenant" ON "public"."signature_events" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view statuses in their tenant" ON "public"."lead_statuses" FOR SELECT USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view suppliers in their tenant" ON "public"."suppliers" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view tables in accessible scope" ON "public"."crm_tables" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("agency_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."agencies" "a"
  WHERE (("a"."id" = "crm_tables"."agency_id") AND ("a"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))) OR (("agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id"))));



CREATE POLICY "Users can view tables in their tenant scope" ON "public"."crm_tables" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("agency_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."agencies" "a"
  WHERE (("a"."id" = "crm_tables"."agency_id") AND ("a"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))))));



CREATE POLICY "Users can view tags in their tenant" ON "public"."chat_tags" FOR SELECT USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view task updates" ON "public"."task_updates" FOR SELECT USING (("task_id" IN ( SELECT "t"."id"
   FROM "public"."tasks" "t"
  WHERE (("t"."agency_id" = ANY ("public"."get_user_agency_ids"("auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR ("t"."agency_id" = ANY ("public"."get_user_sales_person_agency_ids"("auth"."uid"()))) OR "public"."user_manages_agency"("auth"."uid"(), "t"."agency_id")))));



CREATE POLICY "Users can view tasks for their leads" ON "public"."tasks" FOR SELECT USING ((("lead_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "tasks"."lead_id") AND (("l"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())))))));



CREATE POLICY "Users can view tasks from accessible agencies" ON "public"."tasks" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND "public"."user_manages_agency"("auth"."uid"(), "agency_id")) OR ("public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") AND "public"."user_manages_agency"("auth"."uid"(), "agency_id") AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "agency_id")) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND "public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("campaigner_id" = "public"."get_user_campaigner_id"("auth"."uid"())))));



CREATE POLICY "Users can view tenant presets" ON "public"."lead_filter_presets" FOR SELECT USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."user_is_tenant_member"("tenant_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view tenant terminology" ON "public"."tenant_terminology" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view their own blocked contacts" ON "public"."blocked_contacts" FOR SELECT USING ((("connection_user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view their own calendar tokens" ON "public"."calendar_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own integrations" ON "public"."tenant_integrations" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view their own managed agencies" ON "public"."user_managed_agencies" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own marked read contacts" ON "public"."manually_read_contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own permissions" ON "public"."user_permissions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their permissions" ON "public"."integration_user_permissions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE (("ti"."id" = "integration_user_permissions"."integration_id") AND ("ti"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their tenant agency access" ON "public"."agency_tenant_access" FOR SELECT USING ((("source_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("accessing_tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



CREATE POLICY "Users can view time_entries from shared agencies" ON "public"."time_entries" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."campaigner_agencies" "ca"
  WHERE (("ca"."campaigner_id" = "time_entries"."campaigner_id") AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "ca"."agency_id"))))));



CREATE POLICY "Users can view time_entries in their tenant" ON "public"."time_entries" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users can view zoom recordings in their tenant" ON "public"."zoom_recordings" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users insert chat messages with connection access" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("connection_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE ((("ti"."id" = "chat_messages"."integration_id") OR (("chat_messages"."integration_id" IS NULL) AND ("ti"."user_id" = "chat_messages"."connection_user_id") AND ("ti"."integration_type" = ANY (ARRAY['green_api'::"text", 'manus_wa'::"text"])))) AND ("ti"."tenant_id" = "chat_messages"."tenant_id") AND ("ti"."is_active" = true) AND ("ti"."connection_visibility" = 'org'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."tenant_integrations" "ti"
     JOIN "public"."integration_user_permissions" "iup" ON (("iup"."integration_id" = "ti"."id")))
  WHERE ((("ti"."id" = "chat_messages"."integration_id") OR (("chat_messages"."integration_id" IS NULL) AND ("ti"."user_id" = "chat_messages"."connection_user_id") AND ("ti"."integration_type" = ANY (ARRAY['green_api'::"text", 'manus_wa'::"text"])))) AND ("ti"."tenant_id" = "chat_messages"."tenant_id") AND ("ti"."is_active" = true) AND ("iup"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users manage own active tenant" ON "public"."user_active_tenant" USING ((("auth"."uid"() = "user_id") OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users manage own active_tenant" ON "public"."user_active_tenant" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own active tenant" ON "public"."user_active_tenant" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users see member tenants" ON "public"."tenants" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users see own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own tenant_users" ON "public"."tenant_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users view chat messages with connection access" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role")) OR (("connection_user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("is_blocked" IS NULL) OR ("is_blocked" = false))) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("is_blocked" IS NULL) OR ("is_blocked" = false)) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_integrations" "ti"
  WHERE ((("ti"."id" = "chat_messages"."integration_id") OR (("chat_messages"."integration_id" IS NULL) AND ("ti"."user_id" = "chat_messages"."connection_user_id") AND ("ti"."integration_type" = ANY (ARRAY['green_api'::"text", 'manus_wa'::"text"])))) AND ("ti"."tenant_id" = "chat_messages"."tenant_id") AND ("ti"."is_active" = true) AND ("ti"."connection_visibility" = 'org'::"text"))))) OR (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("is_blocked" IS NULL) OR ("is_blocked" = false)) AND (EXISTS ( SELECT 1
   FROM ("public"."tenant_integrations" "ti"
     JOIN "public"."integration_user_permissions" "iup" ON (("iup"."integration_id" = "ti"."id")))
  WHERE ((("ti"."id" = "chat_messages"."integration_id") OR (("chat_messages"."integration_id" IS NULL) AND ("ti"."user_id" = "chat_messages"."connection_user_id") AND ("ti"."integration_type" = ANY (ARRAY['green_api'::"text", 'manus_wa'::"text"])))) AND ("ti"."tenant_id" = "chat_messages"."tenant_id") AND ("ti"."is_active" = true) AND ("iup"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users with finance permission can delete finance" ON "public"."finance" FOR DELETE TO "authenticated" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_finance_permission"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users with finance permission can insert finance" ON "public"."finance" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_finance_permission"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users with finance permission can update finance" ON "public"."finance" FOR UPDATE TO "authenticated" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_finance_permission"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "Users with finance permission can view finance" ON "public"."finance" FOR SELECT TO "authenticated" USING (((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_finance_permission"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."_d_campag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_d_prof" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_d_spag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_d_tu" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_d_uma" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_d_ur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_pol_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_pol_stage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_sqlbuf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_tenant_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_action_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_approval_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_batch_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_brain_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_channel_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_eval_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_evals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_knowledge_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_knowledge_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_mcp_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_mcp_connections_tenant_read" ON "public"."agent_mcp_connections" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."agent_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_supervisors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ahrefs_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agents_tenant_rw" ON "public"."ai_agents" TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."ai_conversation_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_detection_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_detection_competitor_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_detection_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_detection_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_detection_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_skills_select" ON "public"."ai_skills" FOR SELECT TO "authenticated" USING ((("scope" = 'global'::"text") OR ("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "ai_skills_superadmin" ON "public"."ai_skills" TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"())) WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "ai_skills_tenant_write" ON "public"."ai_skills" TO "authenticated" USING ((("scope" = 'tenant'::"text") AND ("tenant_id" = "public"."get_effective_tenant_id"()))) WITH CHECK ((("scope" = 'tenant'::"text") AND ("tenant_id" = "public"."get_effective_tenant_id"())));



ALTER TABLE "public"."ai_usage_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_usage_log_read" ON "public"."ai_usage_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."aios_graph_edges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aios_graph_nodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aios_graph_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_flow_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_shared_tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bedomains_tenant_delete" ON "public"."broadcast_email_domains" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "bedomains_tenant_insert" ON "public"."broadcast_email_domains" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "bedomains_tenant_select" ON "public"."broadcast_email_domains" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "bedomains_tenant_update" ON "public"."broadcast_email_domains" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blists_tenant_delete" ON "public"."broadcast_lists" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blists_tenant_insert" ON "public"."broadcast_lists" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blists_tenant_select" ON "public"."broadcast_lists" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blists_tenant_update" ON "public"."broadcast_lists" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blmembers_tenant_delete" ON "public"."broadcast_list_members" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blmembers_tenant_insert" ON "public"."broadcast_list_members" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blmembers_tenant_select" ON "public"."broadcast_list_members" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blmembers_tenant_update" ON "public"."broadcast_list_members" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."blocked_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blrules_tenant_delete" ON "public"."broadcast_list_rules" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blrules_tenant_insert" ON "public"."broadcast_list_rules" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blrules_tenant_select" ON "public"."broadcast_list_rules" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "blrules_tenant_update" ON "public"."broadcast_list_rules" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "br_tenant_delete" ON "public"."broadcast_recipients" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "br_tenant_insert" ON "public"."broadcast_recipients" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "br_tenant_select" ON "public"."broadcast_recipients" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "br_tenant_update" ON "public"."broadcast_recipients" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."broadcast_email_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_list_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_opt_outs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "broadcasts_tenant_delete" ON "public"."broadcasts" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "broadcasts_tenant_insert" ON "public"."broadcasts" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "broadcasts_tenant_select" ON "public"."broadcasts" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "broadcasts_tenant_update" ON "public"."broadcasts" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."calendar_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_alerts_delete" ON "public"."campaign_alerts" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))));



CREATE POLICY "campaign_alerts_select" ON "public"."campaign_alerts" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))))));



CREATE POLICY "campaign_alerts_update" ON "public"."campaign_alerts" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))))));



CREATE POLICY "campaign_alerts_write" ON "public"."campaign_alerts" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role")))));



ALTER TABLE "public"."campaign_pulse_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_pulse_overrides_insert" ON "public"."campaign_pulse_overrides" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'owner'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'team_manager'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'campaigner'::"public"."app_role")))));



CREATE POLICY "campaign_pulse_overrides_select" ON "public"."campaign_pulse_overrides" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")) OR ("tenant_id" = "public"."get_effective_tenant_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "campaign_pulse_overrides"."client_id") AND ("c"."agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"(( SELECT "auth"."uid"() AS "uid"), "c"."agency_id"))))));



CREATE POLICY "campaign_pulse_overrides_update" ON "public"."campaign_pulse_overrides" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'owner'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'team_manager'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'campaigner'::"public"."app_role"))))) WITH CHECK (("public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")) OR ("tenant_id" = "public"."get_effective_tenant_id"())));



ALTER TABLE "public"."campaign_pulse_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_pulse_snapshots_read" ON "public"."campaign_pulse_snapshots" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")) OR "public"."user_can_access_client"(( SELECT "auth"."uid"() AS "uid"), "client_id")));



ALTER TABLE "public"."campaign_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_schedules_delete" ON "public"."campaign_schedules" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))));



CREATE POLICY "campaign_schedules_select" ON "public"."campaign_schedules" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))))));



CREATE POLICY "campaign_schedules_update" ON "public"."campaign_schedules" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"())))))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role") AND ("client_id" IS NOT NULL) AND ("client_id" = ANY ("public"."get_user_client_ids"("auth"."uid"()))))))));



CREATE POLICY "campaign_schedules_write" ON "public"."campaign_schedules" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'campaigner'::"public"."app_role")))));



ALTER TABLE "public"."campaigner_agencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_access_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_batch_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_client_group_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_command_center_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_memory_episodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_memory_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_memory_pointers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_whatsapp_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_whatsapp_identity_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carmen_whatsapp_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_contact_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_carmen_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_dispatches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_onboarding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_team" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_tenant_financial_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cme_select_tenant" ON "public"."carmen_memory_episodes" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"(( SELECT "auth"."uid"() AS "uid"))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "cmp_select_tenant" ON "public"."carmen_memory_pointers" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"(( SELECT "auth"."uid"() AS "uid"))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."communication_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_dashboards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursor_dispatches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursor_sticky_agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_social_gantt" ON "public"."social_gantt_posts" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."deleted_facebook_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_task_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev_task_events_tenant_read" ON "public"."dev_task_events" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."dev_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev_tasks_tenant_rw" ON "public"."dev_tasks" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_processed_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_allowed_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_blocked_senders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_category_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_message_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_actions_tenant_read" ON "public"."goal_actions" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_blockers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_blockers_tenant_rw" ON "public"."goal_blockers" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_brain_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_brain_requests_tenant_read" ON "public"."goal_brain_requests" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_engine_tools" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_engine_tools_tenant_rw" ON "public"."goal_engine_tools" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_events_tenant_read" ON "public"."goal_events" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_evidence_tenant_read" ON "public"."goal_evidence" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_loop_iterations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_loop_iterations_tenant_read" ON "public"."goal_loop_iterations" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_milestones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_milestones_tenant_rw" ON "public"."goal_milestones" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_model_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_model_events_tenant_read" ON "public"."goal_model_events" FOR SELECT USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_orchestrator_brain" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_orchestrator_brain_tenant_read" ON "public"."goal_orchestrator_brain" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_plan_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_plan_steps_tenant_rw" ON "public"."goal_plan_steps" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_success_criteria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_success_criteria_tenant_rw" ON "public"."goal_success_criteria" USING (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."heartbeat_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hidden_chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_social_gantt" ON "public"."social_gantt_posts" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."integration_alerts_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_tenant_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_alert_failure_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_alert_failure_notifications_read" ON "public"."lead_alert_failure_notifications" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."lead_filter_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_notification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_pipeline_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_sales_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manually_read_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manus_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manychat_destination_send_locks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_ab_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_ab_variants_delete" ON "public"."marketing_ab_variants" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_ab_variants_select" ON "public"."marketing_ab_variants" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_ab_variants_update" ON "public"."marketing_ab_variants" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_ab_variants_write" ON "public"."marketing_ab_variants" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_assets_delete" ON "public"."marketing_assets" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_assets_select" ON "public"."marketing_assets" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_assets_update" ON "public"."marketing_assets" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_assets_write" ON "public"."marketing_assets" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_item_transitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_item_transitions_delete" ON "public"."marketing_item_transitions" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_item_transitions_select" ON "public"."marketing_item_transitions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_item_transitions_update" ON "public"."marketing_item_transitions" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_item_transitions_write" ON "public"."marketing_item_transitions" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_media_library" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_media_library_delete" ON "public"."marketing_media_library" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_media_library_select" ON "public"."marketing_media_library" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_media_library_update" ON "public"."marketing_media_library" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_media_library_write" ON "public"."marketing_media_library" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_pipeline_stages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_pipeline_stages_delete" ON "public"."marketing_pipeline_stages" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_pipeline_stages_select" ON "public"."marketing_pipeline_stages" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_pipeline_stages_update" ON "public"."marketing_pipeline_stages" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_pipeline_stages_write" ON "public"."marketing_pipeline_stages" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_pipelines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_pipelines_delete" ON "public"."marketing_pipelines" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_pipelines_select" ON "public"."marketing_pipelines" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_pipelines_update" ON "public"."marketing_pipelines" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_pipelines_write" ON "public"."marketing_pipelines" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_runs_delete" ON "public"."marketing_runs" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_runs_select" ON "public"."marketing_runs" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_runs_update" ON "public"."marketing_runs" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_runs_write" ON "public"."marketing_runs" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_stage_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_stage_templates_delete" ON "public"."marketing_stage_templates" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_stage_templates_select" ON "public"."marketing_stage_templates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_stage_templates_update" ON "public"."marketing_stage_templates" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_stage_templates_write" ON "public"."marketing_stage_templates" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_triggers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_triggers_delete" ON "public"."marketing_triggers" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_triggers_select" ON "public"."marketing_triggers" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_triggers_update" ON "public"."marketing_triggers" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_triggers_write" ON "public"."marketing_triggers" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."marketing_work_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_work_items_delete" ON "public"."marketing_work_items" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_work_items_select" ON "public"."marketing_work_items" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



CREATE POLICY "marketing_work_items_update" ON "public"."marketing_work_items" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "marketing_work_items_write" ON "public"."marketing_work_items" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));



ALTER TABLE "public"."maskyoo_manual_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maskyoo_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maskyoo_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_bot_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_whatsapp_tenant_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_whatsapp_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."one_time_incomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "optout_tenant_delete" ON "public"."broadcast_opt_outs" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "optout_tenant_insert" ON "public"."broadcast_opt_outs" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "optout_tenant_select" ON "public"."broadcast_opt_outs" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."payment_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pbn_service_commands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_webhook_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publishing_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "publishing_articles_delete" ON "public"."publishing_articles" FOR DELETE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_articles_insert" ON "public"."publishing_articles" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_articles_select" ON "public"."publishing_articles" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_articles_update" ON "public"."publishing_articles" FOR UPDATE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."publishing_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "publishing_imports_delete" ON "public"."publishing_imports" FOR DELETE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_imports_insert" ON "public"."publishing_imports" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_imports_select" ON "public"."publishing_imports" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_imports_update" ON "public"."publishing_imports" FOR UPDATE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."publishing_sites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "publishing_sites_delete" ON "public"."publishing_sites" FOR DELETE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_sites_insert" ON "public"."publishing_sites" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_sites_select" ON "public"."publishing_sites" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "publishing_sites_update" ON "public"."publishing_sites" FOR UPDATE TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."is_super_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."pulse_instant_alert_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pulse_instant_alert_log_read" ON "public"."pulse_instant_alert_log" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));



ALTER TABLE "public"."rank_tracking_alert_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rank_tracking_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rank_tracking_competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rank_tracking_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rank_tracking_keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rank_tracking_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recording_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_alerts_delete" ON "public"."report_alerts" FOR DELETE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))));



CREATE POLICY "report_alerts_select" ON "public"."report_alerts" FOR SELECT USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))));



CREATE POLICY "report_alerts_update" ON "public"."report_alerts" FOR UPDATE USING (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role"))))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))));



CREATE POLICY "report_alerts_write" ON "public"."report_alerts" FOR INSERT WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR (("tenant_id" = "public"."get_effective_tenant_id"()) AND ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'team_manager'::"public"."app_role")))));



ALTER TABLE "public"."sales_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_person_agencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_social_gantt" ON "public"."social_gantt_posts" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."seo_call_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seo_call_snapshots_tenant_access" ON "public"."seo_call_snapshots" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id"))) WITH CHECK ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id")));



ALTER TABLE "public"."seo_monthly_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seo_monthly_shares_tenant_access" ON "public"."seo_monthly_shares" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id"))) WITH CHECK ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id")));



ALTER TABLE "public"."seo_monthly_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seo_monthly_updates_tenant_access" ON "public"."seo_monthly_updates" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id"))) WITH CHECK ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR "public"."user_has_cross_tenant_client_access"("auth"."uid"(), "client_id")));



ALTER TABLE "public"."service_health_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_health_checks_read" ON "public"."service_health_checks" FOR SELECT TO "authenticated" USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."signature_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signature_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signature_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_pageviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_tracking_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_gantt_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_media_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_media_post_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_media_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_media_wordpress_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_pages_shared_tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "social_pages_tenant_select" ON "public"."social_pages" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."social_pages_shared_tenants" "sp"
  WHERE (("sp"."social_page_id" = "social_pages"."id") AND ("sp"."tenant_id" IN ( SELECT "tenant_users"."tenant_id"
           FROM "public"."tenant_users"
          WHERE ("tenant_users"."user_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."social_publications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_channel_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_channel_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_channel_whatsapp_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_chat_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_message_read_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_bot_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telephony_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant access recording_folders" ON "public"."recording_folders" TO "authenticated" USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."tenant_heartbeat_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."woocommerce_customers" USING (("tenant_id" = "public"."get_effective_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."woocommerce_orders" USING (("tenant_id" = "public"."get_effective_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."woocommerce_products" USING (("tenant_id" = "public"."get_effective_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."woocommerce_sync_log" USING (("tenant_id" = "public"."get_effective_tenant_id"()));



CREATE POLICY "tenant_members_manage_spst" ON "public"."social_pages_shared_tenants" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "tenant_members_manage_wsst" ON "public"."wordpress_sites_shared_tenants" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "tenant_members_view_integrations" ON "public"."tenant_integrations" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tu"."tenant_id"
   FROM "public"."tenant_users" "tu"
  WHERE ("tu"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."tenant_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_terminology" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terminology_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entry_breaks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_social_gantt" ON "public"."social_gantt_posts" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_active_tenant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_api_keys_delete_own" ON "public"."user_api_keys" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_api_keys_insert_own" ON "public"."user_api_keys" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_api_keys_select_own" ON "public"."user_api_keys" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_api_keys_update_own" ON "public"."user_api_keys" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_managed_agencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_workspace_layout" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_group_members_service" ON "public"."wa_group_members" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "wa_group_members_tenant" ON "public"."wa_group_members" USING (("tenant_id" = ( SELECT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."wa_lid_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_pending_activations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_warm_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_warm_campaigns_insert" ON "public"."wa_warm_campaigns" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "wa_warm_campaigns_select" ON "public"."wa_warm_campaigns" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "wa_warm_campaigns_update" ON "public"."wa_warm_campaigns" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"()))) WITH CHECK ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."wa_warm_opt_ins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_warm_opt_ins_select" ON "public"."wa_warm_opt_ins" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."wa_warm_recipients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_warm_recipients_select" ON "public"."wa_warm_recipients" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."get_effective_tenant_id"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."whatsapp_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "woo_customers_client_select" ON "public"."woocommerce_customers" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."social_media_wordpress_sites" "s"
  WHERE (("s"."id" = "woocommerce_customers"."site_id") AND ("s"."client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "s"."client_id"))))));



CREATE POLICY "woo_orders_agency_cross_tenant_select" ON "public"."woocommerce_orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."social_media_wordpress_sites" "s"
  WHERE (("s"."id" = "woocommerce_orders"."site_id") AND ("s"."agency_id" IS NOT NULL) AND "public"."user_has_cross_tenant_agency_access"("auth"."uid"(), "s"."agency_id")))));



CREATE POLICY "woo_orders_client_select" ON "public"."woocommerce_orders" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."social_media_wordpress_sites" "s"
  WHERE (("s"."id" = "woocommerce_orders"."site_id") AND ("s"."client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "s"."client_id"))))));



CREATE POLICY "woo_products_client_select" ON "public"."woocommerce_products" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."social_media_wordpress_sites" "s"
  WHERE (("s"."id" = "woocommerce_products"."site_id") AND ("s"."client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "s"."client_id"))))));



CREATE POLICY "woo_sync_log_client_select" ON "public"."woocommerce_sync_log" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."social_media_wordpress_sites" "s"
  WHERE (("s"."id" = "woocommerce_sync_log"."site_id") AND ("s"."client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "s"."client_id"))))));



ALTER TABLE "public"."woocommerce_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."woocommerce_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."woocommerce_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."woocommerce_sync_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wordpress_sites_client_select" ON "public"."social_media_wordpress_sites" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR (("client_id" IS NOT NULL) AND "public"."user_can_access_client"("auth"."uid"(), "client_id"))));



CREATE POLICY "wordpress_sites_shared_select" ON "public"."social_media_wordpress_sites" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) OR ("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."wordpress_sites_shared_tenants" "ws"
  WHERE (("ws"."site_id" = "social_media_wordpress_sites"."id") AND ("ws"."tenant_id" IN ( SELECT "tenant_users"."tenant_id"
           FROM "public"."tenant_users"
          WHERE ("tenant_users"."user_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."wordpress_sites_shared_tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoom_recordings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."agencies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."agent_channel_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ai_conversation_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ai_conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."call_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."campaigner_agencies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."campaigners";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."client_team";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."finance";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."leads";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sync_jobs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_collaborators";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."team_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_permissions";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."agent_memory_fts_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."agent_memory_fts_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."agent_memory_fts_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_skills_update_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."ai_skills_update_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_skills_update_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_leads"("p_lead_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_leads"("p_lead_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_leads"("p_lead_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_role_by_email"("_email" "text", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_role_by_email"("_email" "text", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_role_by_email"("_email" "text", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_apply_list_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_apply_list_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_apply_list_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_ai_skill_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_ai_skill_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_ai_skill_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_skill_usage_by_slug"("p_slugs" "text"[], "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_lead_archive"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_lead_archive"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_lead_archive"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_user_permissions"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_user_permissions"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_user_permissions"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_cross_tenant_campaigner"("_campaigner_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_cross_tenant_campaigner"("_campaigner_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_cross_tenant_campaigner"("_campaigner_id" "uuid", "_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."carmen_activate_system_graph"("p_version" "text", "p_expected_nodes" integer, "p_expected_edges" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carmen_activate_system_graph"("p_version" "text", "p_expected_nodes" integer, "p_expected_edges" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_allowed_phones_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_allowed_phones_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_allowed_phones_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_fix_campaigner_access"("p_campaigner_id" "uuid", "p_client_id" "uuid", "p_tenant" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_fix_campaigner_access"("p_campaigner_id" "uuid", "p_client_id" "uuid", "p_tenant" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_fix_campaigner_access"("p_campaigner_id" "uuid", "p_client_id" "uuid", "p_tenant" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_identity_activation_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_identity_activation_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_identity_activation_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_memory_decay_episodes"("p_lambda" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_memory_decay_episodes"("p_lambda" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_memory_decay_episodes"("p_lambda" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_normalize_staff_phone"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_outbox_enqueue"() TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_outbox_enqueue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_outbox_enqueue"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."carmen_query_system_graph"("p_query" "text", "p_depth" integer, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carmen_query_system_graph"("p_query" "text", "p_depth" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."carmen_send_activation"("p_tenant" "uuid", "p_integration" "uuid", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."carmen_send_activation"("p_tenant" "uuid", "p_integration" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."carmen_send_activation"("p_tenant" "uuid", "p_integration" "uuid", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_tenant_id" "uuid", "p_provider" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_tenant_id" "uuid", "p_provider" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_tenant_id" "uuid", "p_provider" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_idempotency"("p_tenant_id" "uuid", "p_event_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_idempotency"("p_tenant_id" "uuid", "p_event_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_idempotency"("p_tenant_id" "uuid", "p_event_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text", "p_default_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text", "p_default_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_tenant_id" "uuid", "p_resource_type" "text", "p_default_max" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_campaign_pulse_delivery"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_campaign_pulse_delivery"("p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_client_retention_delivery"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_client_retention_delivery"("p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_health_digest_delivery"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_health_digest_delivery"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_next_job"("p_job_types" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_next_job"("p_job_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_next_job"("p_job_types" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."claude_notify_david"("p_message" "text", "p_tenant" "uuid", "p_chat_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claude_notify_david"("p_message" "text", "p_tenant" "uuid", "p_chat_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claude_notify_david"("p_message" "text", "p_tenant" "uuid", "p_chat_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_user_active_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_user_active_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_user_active_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."client_update_documents_phone_call"("p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."client_update_documents_phone_call"("p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_success" boolean, "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_success" boolean, "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_job"("p_job_id" "uuid", "p_success" boolean, "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."copy_custom_fields_to_tenant"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_custom_fields_to_tenant"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_custom_fields_to_tenant"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."copy_tenant_template"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_tenant_template"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_tenant_template"("_source_tenant_id" "uuid", "_target_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."count_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_client_with_assignment"("p_tenant_id" "uuid", "p_agency_id" "uuid", "p_name" "text", "p_contact_name" "text", "p_phone" "text", "p_email" "text", "p_folder_link" "text", "p_retainer" numeric, "p_monthly_budget" numeric, "p_website" "text", "p_notes" "text", "p_is_seo_client" boolean, "p_services" "text"[], "p_meta_ads_account_id" "text", "p_google_ads_account_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_client_with_assignment"("p_tenant_id" "uuid", "p_agency_id" "uuid", "p_name" "text", "p_contact_name" "text", "p_phone" "text", "p_email" "text", "p_folder_link" "text", "p_retainer" numeric, "p_monthly_budget" numeric, "p_website" "text", "p_notes" "text", "p_is_seo_client" boolean, "p_services" "text"[], "p_meta_ads_account_id" "text", "p_google_ads_account_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_client_with_assignment"("p_tenant_id" "uuid", "p_agency_id" "uuid", "p_name" "text", "p_contact_name" "text", "p_phone" "text", "p_email" "text", "p_folder_link" "text", "p_retainer" numeric, "p_monthly_budget" numeric, "p_website" "text", "p_notes" "text", "p_is_seo_client" boolean, "p_services" "text"[], "p_meta_ads_account_id" "text", "p_google_ads_account_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_next_recurring_task"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_next_recurring_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_tables_fill_agency_from_client"() TO "anon";
GRANT ALL ON FUNCTION "public"."crm_tables_fill_agency_from_client"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_tables_fill_agency_from_client"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_signature_by_token"("_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_signature_by_token"("_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_signature_by_token"("_token" "uuid", "_ip" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_signature_by_token"("_token" "uuid", "_ip" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_job"("p_tenant_id" "uuid", "p_job_type" "text", "p_priority" integer, "p_payload" "jsonb", "p_max_attempts" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_job"("p_tenant_id" "uuid", "p_job_type" "text", "p_priority" integer, "p_payload" "jsonb", "p_max_attempts" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_job"("p_tenant_id" "uuid", "p_job_type" "text", "p_priority" integer, "p_payload" "jsonb", "p_max_attempts" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_agency"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_agency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_agency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_report_table_account_id"("p_integration_type" "text", "p_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_report_table_account_id"("p_integration_type" "text", "p_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_report_table_account_id"("p_integration_type" "text", "p_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_campaign_tables"("p_client_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."format_client_mood_status_label"("status" "public"."client_mood_status") TO "anon";
GRANT ALL ON FUNCTION "public"."format_client_mood_status_label"("status" "public"."client_mood_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_client_mood_status_label"("status" "public"."client_mood_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_tracking_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_tracking_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_tracking_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_carmen_memory_counts"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_carmen_memory_counts"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_carmen_memory_counts"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_invite_by_token"("_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_channel_invite_by_token"("_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_channel_invite_by_token"("_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid", "p_connection_user_ids" "uuid"[], "p_provider" "public"."chat_provider") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid", "p_connection_user_ids" "uuid"[], "p_provider" "public"."chat_provider") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_contacts"("p_tenant_id" "uuid", "p_connection_user_ids" "uuid"[], "p_provider" "public"."chat_provider") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_tenant_id"("_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_tenant_id"("_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_tenant_id"("_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cron_job_history"("p_jobid" bigint, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_cron_job_history"("p_jobid" bigint, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cron_job_history"("p_jobid" bigint, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cross_tenant_campaigner_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cross_tenant_campaigner_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cross_tenant_campaigner_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_effective_setting"("_tenant_id" "uuid", "_setting_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_setting"("_tenant_id" "uuid", "_setting_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_setting"("_tenant_id" "uuid", "_setting_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_effective_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_tenant_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_latest_client_call_updates"("p_client_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_latest_client_call_updates"("p_client_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_lead_visitor_journey"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_lead_visitor_journey"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lead_visitor_journey"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leads_by_stages"("p_tenant_id" "uuid", "p_agency_ids" "uuid"[], "p_stages" "text"[], "p_limit_per_stage" integer, "p_search_query" "text", "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone, "p_sales_person_ids" "uuid"[], "p_response_statuses" "text"[], "p_follow_up_today" boolean, "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_tag_ids" "uuid"[], "p_offset_per_stage" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_leads_by_stages"("p_tenant_id" "uuid", "p_agency_ids" "uuid"[], "p_stages" "text"[], "p_limit_per_stage" integer, "p_search_query" "text", "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone, "p_sales_person_ids" "uuid"[], "p_response_statuses" "text"[], "p_follow_up_today" boolean, "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_tag_ids" "uuid"[], "p_offset_per_stage" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leads_by_stages"("p_tenant_id" "uuid", "p_agency_ids" "uuid"[], "p_stages" "text"[], "p_limit_per_stage" integer, "p_search_query" "text", "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone, "p_sales_person_ids" "uuid"[], "p_response_statuses" "text"[], "p_follow_up_today" boolean, "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_tag_ids" "uuid"[], "p_offset_per_stage" integer) TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leads_by_tags"("p_tenant_id" "uuid", "p_tag_ids" "uuid"[], "p_agency_ids" "uuid"[], "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_signature_by_token"("_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_signature_by_token"("_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_signature_by_token"("_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_signature_by_token"("_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_home_agency_id"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unknown_chat_contacts"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_agency_ids"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_agency_ids"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_agency_ids"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_campaigner_id"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_campaigner_id"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_campaigner_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_client_ids"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_client_ids"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_client_ids"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_sales_person_agency_ids"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_sales_person_agency_ids"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_sales_person_agency_ids"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_sales_person_id"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_sales_person_id"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_sales_person_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_campaigner_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_campaigner_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_campaigner_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_client_onboarding_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_client_onboarding_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_client_onboarding_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_lead_to_onboarding"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_lead_to_onboarding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_lead_to_onboarding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_tenant_lead_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_lead_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_lead_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_tenant_menu_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_menu_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_menu_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_tenant_pipeline_stages"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_pipeline_stages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_pipeline_stages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_onboarding_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_onboarding_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_onboarding_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sales_person_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sales_person_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sales_person_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_finance_permission"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_finance_permission"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_finance_permission"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_skill_usage"("skill_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_skill_usage"("skill_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_skill_usage"("skill_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_all_tenants_menu_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_all_tenants_menu_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_all_tenants_menu_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_default_custom_fields"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_default_custom_fields"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_default_custom_fields"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_default_pipeline_stages"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_default_pipeline_stages"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_default_pipeline_stages"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_lead_statuses"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_lead_statuses"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_lead_statuses"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_menu_items"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_menu_items"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_menu_items"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_pipeline_stages"("_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_pipeline_stages"("_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_pipeline_stages"("_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology"("_tenant_id" "uuid", "_business_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology"("_tenant_id" "uuid", "_business_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology"("_tenant_id" "uuid", "_business_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology_from_preset"("_tenant_id" "uuid", "_preset_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology_from_preset"("_tenant_id" "uuid", "_preset_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_terminology_from_preset"("_tenant_id" "uuid", "_preset_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_automation_shared_to_tenant"("_automation_id" "uuid", "_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_automation_shared_to_tenant"("_automation_id" "uuid", "_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_automation_shared_to_tenant"("_automation_id" "uuid", "_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_channel_member"("p_channel_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_channel_member"("p_channel_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_channel_member"("p_channel_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_root_tenant"("tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_root_tenant"("tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_root_tenant"("tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_seo_staff"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_seo_staff"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_seo_staff"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_admin_of_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_admin_of_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin_of_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_in_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_automation_source_tenant"("_automation_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."kb_match_pointers"("p_tenant_id" "uuid", "p_query_embedding" "public"."vector", "p_category" "text", "p_since_days" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."kb_match_pointers"("p_tenant_id" "uuid", "p_query_embedding" "public"."vector", "p_category" "text", "p_since_days" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."kb_match_pointers"("p_tenant_id" "uuid", "p_query_embedding" "public"."vector", "p_category" "text", "p_since_days" integer, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."kick_internal_function"("p_function" "text", "p_body" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kick_internal_function"("p_function" "text", "p_body" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."lead_origin_tag_names"("p_campaign_name" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lead_origin_tag_names"("p_campaign_name" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lead_origin_tag_names"("p_campaign_name" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lead_source_tag_name"("p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lead_source_tag_name"("p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lead_source_tag_name"("p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_assign_home_agency"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_assign_home_agency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_assign_home_agency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_set_first_origin"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_set_first_origin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_set_first_origin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_visitor_to_lead"("p_visitor_fingerprint" "text", "p_tracking_id" "text", "p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_visitor_to_lead"("p_visitor_fingerprint" "text", "p_tracking_id" "text", "p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_visitor_to_lead"("p_visitor_fingerprint" "text", "p_tracking_id" "text", "p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_system_cron_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_system_cron_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_system_cron_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_client_mood_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_client_mood_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_client_mood_status_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_signature_event"("_document_id" "uuid", "_recipient_id" "uuid", "_event_type" "text", "_ip" "text", "_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_signature_event"("_document_id" "uuid", "_recipient_id" "uuid", "_event_type" "text", "_ip" "text", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_chats_read"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_chats_read"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_chats_read"("p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_automation_log_delivery_failure"("p_provider_message_id" "text", "p_error" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_agent_memory"("p_agent_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_agent_memory"("p_agent_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_agent_memory"("p_agent_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_agent_tools"("query_embedding" "public"."vector", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_agent_tools"("query_embedding" "public"."vector", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_agent_tools"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_assigned_campaigner_duplicate"("p_canonical" "uuid", "p_duplicate" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_duplicate_campaigner_pair"("p_left" "uuid", "p_right" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_orphan_profile_by_email"("_auth_user_id" "uuid", "_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_orphan_profile_by_email"("_auth_user_id" "uuid", "_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_orphan_profile_by_email"("_auth_user_id" "uuid", "_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_task_recurrence_date"("base_date" "date", "frequency" "text", "frequency_interval" integer, "as_of_date" "date", "weekday" integer, "monthday" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_task_recurrence_date"("base_date" "date", "frequency" "text", "frequency_interval" integer, "as_of_date" "date", "weekday" integer, "monthday" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_google_customer_id"("raw" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_google_customer_id"("raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_google_customer_id"("raw" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_meta_ad_account_id"("raw" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_meta_ad_account_id"("raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_meta_ad_account_id"("raw" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_task_notification_worker"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_task_notification_worker"() TO "service_role";



GRANT ALL ON FUNCTION "public"."permanently_delete_archived_leads"("p_lead_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."permanently_delete_archived_leads"("p_lead_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."permanently_delete_archived_leads"("p_lead_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_whatsapp_group_invite_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_whatsapp_group_invite_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_whatsapp_group_invite_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_integration_failure"("p_tenant_id" "uuid", "p_provider" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_integration_failure"("p_tenant_id" "uuid", "p_provider" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_integration_failure"("p_tenant_id" "uuid", "p_provider" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_integration_result"("p_tenant_id" "uuid", "p_provider" "text", "p_success" boolean, "p_failure_threshold" integer, "p_cooldown_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_integration_result"("p_tenant_id" "uuid", "p_provider" "text", "p_success" boolean, "p_failure_threshold" integer, "p_cooldown_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_integration_result"("p_tenant_id" "uuid", "p_provider" "text", "p_success" boolean, "p_failure_threshold" integer, "p_cooldown_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_integration_success"("p_tenant_id" "uuid", "p_provider" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_integration_success"("p_tenant_id" "uuid", "p_provider" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_integration_success"("p_tenant_id" "uuid", "p_provider" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_manychat_destination_lock"("p_destination_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_archived_leads"("p_lead_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."restore_archived_leads"("p_lead_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_archived_leads"("p_lead_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_ddl_once"("sql" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_ddl_once"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."run_ddl_once"("sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_system_cron_job_now"("p_jobid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."run_system_cron_job_now"("p_jobid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_system_cron_job_now"("p_jobid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_contacts_for_chat"("p_search_term" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_agency_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_agency_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_agency_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_campaigner_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_campaigner_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_campaigner_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_client_onboarding_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_client_onboarding_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_client_onboarding_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_client_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_client_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_client_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_lead_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_lead_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_lead_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_product_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_product_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_product_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tracking_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tracking_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tracking_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."signature_png_is_valid"("_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."signature_png_is_valid"("_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text", "_field_values" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_signature_by_token"("_token" "uuid", "_signature_data" "text", "_ip" "text", "_field_values" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_campaigner_carmen_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_campaigner_carmen_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_campaigner_carmen_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_campaigner_carmen_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_client_card_from_crm_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_client_card_from_crm_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_client_card_from_crm_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_client_status_to_onboarding"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_client_status_to_onboarding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_client_status_to_onboarding"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_lead_origin_tags_for_lead"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_published_article_to_seo_monthly_work"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_published_article_to_seo_monthly_work"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_published_article_to_seo_monthly_work"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tenant_can_use_integration"("p_tenant_id" "uuid", "p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_wa_warm_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_wa_warm_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_wa_warm_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_deleted_facebook_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_deleted_facebook_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_deleted_facebook_lead"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_sync_lead_origin_tags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_sync_lead_origin_tags"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_lead_origin_tags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_lead_origin_tags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_ad_account_blocked"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_ad_account_blocked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_ad_account_blocked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_sync_new_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_sync_new_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_sync_new_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_carmen_learn_from_session"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_carmen_learn_from_session"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_carmen_learn_from_session"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_integration_disconnected"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_integration_disconnected"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_integration_disconnected"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_validate_crm_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_validate_crm_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_validate_crm_record"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_acquire_manychat_destination_lock"("p_destination_key" "text", "p_ttl_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_cron_job"("p_jobid" bigint, "p_schedule" "text", "p_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_cron_job"("p_jobid" bigint, "p_schedule" "text", "p_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_cron_job"("p_jobid" bigint, "p_schedule" "text", "p_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_client"("_user_id" "uuid", "_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_client"("_user_id" "uuid", "_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_client"("_user_id" "uuid", "_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_crm_table"("_user_id" "uuid", "_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_crm_table"("_user_id" "uuid", "_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_crm_table"("_user_id" "uuid", "_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_annotate_lead"("_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_delete_users_for_tenant"("check_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_delete_users_for_tenant"("check_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_delete_users_for_tenant"("check_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_campaigners_for_tenant"("check_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_campaigners_for_tenant"("check_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_campaigners_for_tenant"("check_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_crm_dashboard"("_user_id" "uuid", "_tenant_id" "uuid", "_agency_id" "uuid", "_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_crm_dashboard"("_user_id" "uuid", "_tenant_id" "uuid", "_agency_id" "uuid", "_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_crm_dashboard"("_user_id" "uuid", "_tenant_id" "uuid", "_agency_id" "uuid", "_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_view_campaigner"("_user_id" "uuid", "_campaigner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_view_campaigner"("_user_id" "uuid", "_campaigner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_view_campaigner"("_user_id" "uuid", "_campaigner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_calendar_access"("_accessor_user_id" "uuid", "_owner_user_id" "uuid", "_required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_calendar_access"("_accessor_user_id" "uuid", "_owner_user_id" "uuid", "_required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_calendar_access"("_accessor_user_id" "uuid", "_owner_user_id" "uuid", "_required_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_agency_access"("_user_id" "uuid", "_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_client_access"("p_user_id" "uuid", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_client_access"("p_user_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_client_access"("p_user_id" "uuid", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_integration_access"("_user_id" "uuid", "_integration_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_integration_access"("_user_id" "uuid", "_integration_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_cross_tenant_integration_access"("_user_id" "uuid", "_integration_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_integration_access"("p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_integration_access"("p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_integration_access"("p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_integration_permission"("p_user_id" "uuid", "p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_integration_permission"("p_user_id" "uuid", "p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_integration_permission"("p_user_id" "uuid", "p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_seo_scope"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_restricted_client_viewer"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_restricted_client_viewer"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_restricted_client_viewer"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_tenant_member"("check_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_tenant_member"("check_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_tenant_member"("check_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_manages_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_manages_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_manages_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_owns_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_agency"("_user_id" "uuid", "_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_owns_integration"("p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_integration"("p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_integration"("p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_crm_record"("p_table_id" "uuid", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_crm_record"("p_table_id" "uuid", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_crm_record"("p_table_id" "uuid", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."wa_lid_map_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."wa_lid_map_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wa_lid_map_touch_updated_at"() TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."_d_campag" TO "anon";
GRANT ALL ON TABLE "public"."_d_campag" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_campag" TO "service_role";



GRANT ALL ON TABLE "public"."_d_prof" TO "anon";
GRANT ALL ON TABLE "public"."_d_prof" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_prof" TO "service_role";



GRANT ALL ON TABLE "public"."_d_spag" TO "anon";
GRANT ALL ON TABLE "public"."_d_spag" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_spag" TO "service_role";



GRANT ALL ON TABLE "public"."_d_tu" TO "anon";
GRANT ALL ON TABLE "public"."_d_tu" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_tu" TO "service_role";



GRANT ALL ON TABLE "public"."_d_uma" TO "anon";
GRANT ALL ON TABLE "public"."_d_uma" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_uma" TO "service_role";



GRANT ALL ON TABLE "public"."_d_ur" TO "anon";
GRANT ALL ON TABLE "public"."_d_ur" TO "authenticated";
GRANT ALL ON TABLE "public"."_d_ur" TO "service_role";



GRANT ALL ON TABLE "public"."_pol_log" TO "anon";
GRANT ALL ON TABLE "public"."_pol_log" TO "authenticated";
GRANT ALL ON TABLE "public"."_pol_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_pol_log_seq_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_pol_log_seq_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_pol_log_seq_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_pol_stage" TO "anon";
GRANT ALL ON TABLE "public"."_pol_stage" TO "authenticated";
GRANT ALL ON TABLE "public"."_pol_stage" TO "service_role";



GRANT ALL ON TABLE "public"."_sqlbuf" TO "anon";
GRANT ALL ON TABLE "public"."_sqlbuf" TO "authenticated";
GRANT ALL ON TABLE "public"."_sqlbuf" TO "service_role";



GRANT ALL ON TABLE "public"."agencies" TO "anon";
GRANT ALL ON TABLE "public"."agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."agencies" TO "service_role";



GRANT ALL ON TABLE "public"."agency_tenant_access" TO "anon";
GRANT ALL ON TABLE "public"."agency_tenant_access" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_tenant_access" TO "service_role";



GRANT ALL ON TABLE "public"."agent_action_log" TO "anon";
GRANT ALL ON TABLE "public"."agent_action_log" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_action_log" TO "service_role";



GRANT ALL ON TABLE "public"."agent_approval_queue" TO "anon";
GRANT ALL ON TABLE "public"."agent_approval_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_approval_queue" TO "service_role";



GRANT ALL ON TABLE "public"."agent_batch_reports" TO "anon";
GRANT ALL ON TABLE "public"."agent_batch_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_batch_reports" TO "service_role";



GRANT ALL ON TABLE "public"."agent_brain_routes" TO "anon";
GRANT ALL ON TABLE "public"."agent_brain_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_brain_routes" TO "service_role";



GRANT ALL ON TABLE "public"."agent_channel_sessions" TO "anon";
GRANT ALL ON TABLE "public"."agent_channel_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_channel_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_eval_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_eval_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_eval_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_evals" TO "anon";
GRANT ALL ON TABLE "public"."agent_evals" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_evals" TO "service_role";



GRANT ALL ON TABLE "public"."agent_goals" TO "anon";
GRANT ALL ON TABLE "public"."agent_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_goals" TO "service_role";



GRANT ALL ON TABLE "public"."agent_knowledge_folders" TO "anon";
GRANT ALL ON TABLE "public"."agent_knowledge_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_knowledge_folders" TO "service_role";



GRANT ALL ON TABLE "public"."agent_knowledge_items" TO "anon";
GRANT ALL ON TABLE "public"."agent_knowledge_items" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_knowledge_items" TO "service_role";



GRANT ALL ON TABLE "public"."agent_mcp_connections" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."agent_mcp_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_mcp_connections" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("tenant_id") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("agent_id") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("url") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("transport") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("state") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("available_tools") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("last_error") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."agent_mcp_connections" TO "authenticated";



GRANT ALL ON TABLE "public"."agent_memory" TO "anon";
GRANT ALL ON TABLE "public"."agent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memory" TO "service_role";



GRANT ALL ON TABLE "public"."agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_supervisors" TO "anon";
GRANT ALL ON TABLE "public"."agent_supervisors" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_supervisors" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tasks" TO "anon";
GRANT ALL ON TABLE "public"."agent_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tool_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."agent_tool_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tool_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tools" TO "anon";
GRANT ALL ON TABLE "public"."agent_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tools" TO "service_role";



GRANT ALL ON TABLE "public"."agent_user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."agent_user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."ahrefs_reports" TO "anon";
GRANT ALL ON TABLE "public"."ahrefs_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ahrefs_reports" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversation_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_detection_brands" TO "anon";
GRANT ALL ON TABLE "public"."ai_detection_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_detection_brands" TO "service_role";



GRANT ALL ON TABLE "public"."ai_detection_competitor_results" TO "anon";
GRANT ALL ON TABLE "public"."ai_detection_competitor_results" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_detection_competitor_results" TO "service_role";



GRANT ALL ON TABLE "public"."ai_detection_prompts" TO "anon";
GRANT ALL ON TABLE "public"."ai_detection_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_detection_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_detection_results" TO "anon";
GRANT ALL ON TABLE "public"."ai_detection_results" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_detection_results" TO "service_role";



GRANT ALL ON TABLE "public"."ai_detection_scores" TO "anon";
GRANT ALL ON TABLE "public"."ai_detection_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_detection_scores" TO "service_role";



GRANT ALL ON TABLE "public"."ai_memory" TO "anon";
GRANT ALL ON TABLE "public"."ai_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_memory" TO "service_role";



GRANT ALL ON TABLE "public"."ai_skills" TO "anon";
GRANT ALL ON TABLE "public"."ai_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_skills" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."aios_graph_edges" TO "service_role";



GRANT ALL ON TABLE "public"."aios_graph_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."aios_graph_versions" TO "service_role";



GRANT ALL ON TABLE "public"."automation_executions" TO "anon";
GRANT ALL ON TABLE "public"."automation_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_executions" TO "service_role";



GRANT ALL ON TABLE "public"."automation_flow_steps" TO "anon";
GRANT ALL ON TABLE "public"."automation_flow_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_flow_steps" TO "service_role";



GRANT ALL ON TABLE "public"."automation_logs" TO "anon";
GRANT ALL ON TABLE "public"."automation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_shared_tenants" TO "anon";
GRANT ALL ON TABLE "public"."automation_shared_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_shared_tenants" TO "service_role";



GRANT ALL ON TABLE "public"."automations" TO "anon";
GRANT ALL ON TABLE "public"."automations" TO "authenticated";
GRANT ALL ON TABLE "public"."automations" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_contacts" TO "anon";
GRANT ALL ON TABLE "public"."blocked_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_email_domains" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_email_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_email_domains" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_list_members" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_list_members" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_list_rules" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_list_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_list_rules" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_lists" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_lists" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_opt_outs" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_opt_outs" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_opt_outs" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_recipients" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_shares" TO "anon";
GRANT ALL ON TABLE "public"."calendar_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_shares" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_tokens" TO "anon";
GRANT ALL ON TABLE "public"."calendar_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."call_logs" TO "anon";
GRANT ALL ON TABLE "public"."call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_alerts" TO "anon";
GRANT ALL ON TABLE "public"."campaign_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_pulse_overrides" TO "anon";
GRANT ALL ON TABLE "public"."campaign_pulse_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_pulse_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_pulse_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."campaign_pulse_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_pulse_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_schedules" TO "anon";
GRANT ALL ON TABLE "public"."campaign_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."campaigner_agencies" TO "anon";
GRANT ALL ON TABLE "public"."campaigner_agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigner_agencies" TO "service_role";



GRANT ALL ON TABLE "public"."campaigners" TO "anon";
GRANT ALL ON TABLE "public"."campaigners" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigners" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_access_policies" TO "anon";
GRANT ALL ON TABLE "public"."carmen_access_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_access_policies" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_batch_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."carmen_batch_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_batch_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_client_group_access" TO "anon";
GRANT ALL ON TABLE "public"."carmen_client_group_access" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_client_group_access" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_command_center_access" TO "anon";
GRANT ALL ON TABLE "public"."carmen_command_center_access" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_command_center_access" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_memory_episodes" TO "anon";
GRANT ALL ON TABLE "public"."carmen_memory_episodes" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_memory_episodes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."carmen_memory_outbox_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."carmen_memory_outbox_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."carmen_memory_outbox_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_memory_outbox" TO "anon";
GRANT ALL ON TABLE "public"."carmen_memory_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_memory_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_memory_pointers" TO "anon";
GRANT ALL ON TABLE "public"."carmen_memory_pointers" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_memory_pointers" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_whatsapp_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_whatsapp_identities" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_whatsapp_identity_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_whatsapp_identity_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."carmen_whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."carmen_whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."carmen_whatsapp_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_contact_tags" TO "anon";
GRANT ALL ON TABLE "public"."chat_contact_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_contact_tags" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_tags" TO "anon";
GRANT ALL ON TABLE "public"."chat_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_tags" TO "service_role";



GRANT ALL ON TABLE "public"."claude_carmen_audit" TO "anon";
GRANT ALL ON TABLE "public"."claude_carmen_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_carmen_audit" TO "service_role";



GRANT ALL ON TABLE "public"."claude_dispatches" TO "anon";
GRANT ALL ON TABLE "public"."claude_dispatches" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_dispatches" TO "service_role";



GRANT ALL ON TABLE "public"."client_contacts" TO "anon";
GRANT ALL ON TABLE "public"."client_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."client_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."client_credentials" TO "anon";
GRANT ALL ON TABLE "public"."client_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."client_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."client_onboarding" TO "anon";
GRANT ALL ON TABLE "public"."client_onboarding" TO "authenticated";
GRANT ALL ON TABLE "public"."client_onboarding" TO "service_role";



GRANT ALL ON TABLE "public"."client_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."client_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."client_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."client_team" TO "anon";
GRANT ALL ON TABLE "public"."client_team" TO "authenticated";
GRANT ALL ON TABLE "public"."client_team" TO "service_role";



GRANT ALL ON TABLE "public"."client_tenant_financial_data" TO "anon";
GRANT ALL ON TABLE "public"."client_tenant_financial_data" TO "authenticated";
GRANT ALL ON TABLE "public"."client_tenant_financial_data" TO "service_role";



GRANT ALL ON TABLE "public"."client_updates" TO "anon";
GRANT ALL ON TABLE "public"."client_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."client_updates" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."communication_logs" TO "anon";
GRANT ALL ON TABLE "public"."communication_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_logs" TO "service_role";



GRANT ALL ON TABLE "public"."crm_dashboards" TO "anon";
GRANT ALL ON TABLE "public"."crm_dashboards" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_dashboards" TO "service_role";



GRANT ALL ON TABLE "public"."crm_fields" TO "anon";
GRANT ALL ON TABLE "public"."crm_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_fields" TO "service_role";



GRANT ALL ON TABLE "public"."crm_records" TO "anon";
GRANT ALL ON TABLE "public"."crm_records" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_records" TO "service_role";



GRANT ALL ON TABLE "public"."crm_tables" TO "anon";
GRANT ALL ON TABLE "public"."crm_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_tables" TO "service_role";



GRANT ALL ON TABLE "public"."cursor_dispatches" TO "anon";
GRANT ALL ON TABLE "public"."cursor_dispatches" TO "authenticated";
GRANT ALL ON TABLE "public"."cursor_dispatches" TO "service_role";



GRANT ALL ON TABLE "public"."cursor_sticky_agents" TO "anon";
GRANT ALL ON TABLE "public"."cursor_sticky_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."cursor_sticky_agents" TO "service_role";



GRANT ALL ON TABLE "public"."custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_shares" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_shares" TO "service_role";



GRANT ALL ON TABLE "public"."deleted_facebook_leads" TO "anon";
GRANT ALL ON TABLE "public"."deleted_facebook_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."deleted_facebook_leads" TO "service_role";



GRANT ALL ON TABLE "public"."dev_task_events" TO "anon";
GRANT ALL ON TABLE "public"."dev_task_events" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_task_events" TO "service_role";



GRANT ALL ON TABLE "public"."dev_tasks" TO "anon";
GRANT ALL ON TABLE "public"."dev_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."expense_payments" TO "anon";
GRANT ALL ON TABLE "public"."expense_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_payments" TO "service_role";



GRANT ALL ON TABLE "public"."finance" TO "anon";
GRANT ALL ON TABLE "public"."finance" TO "authenticated";
GRANT ALL ON TABLE "public"."finance" TO "service_role";



GRANT ALL ON TABLE "public"."flow_processed_leads" TO "anon";
GRANT ALL ON TABLE "public"."flow_processed_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_processed_leads" TO "service_role";



GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_allowed_labels" TO "anon";
GRANT ALL ON TABLE "public"."gmail_allowed_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_allowed_labels" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_blocked_senders" TO "anon";
GRANT ALL ON TABLE "public"."gmail_blocked_senders" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_blocked_senders" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_categories" TO "anon";
GRANT ALL ON TABLE "public"."gmail_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_categories" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_category_rules" TO "anon";
GRANT ALL ON TABLE "public"."gmail_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_message_categories" TO "anon";
GRANT ALL ON TABLE "public"."gmail_message_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_message_categories" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_tokens" TO "anon";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."goal_actions" TO "anon";
GRANT ALL ON TABLE "public"."goal_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_actions" TO "service_role";



GRANT ALL ON TABLE "public"."goal_blockers" TO "anon";
GRANT ALL ON TABLE "public"."goal_blockers" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_blockers" TO "service_role";



GRANT ALL ON TABLE "public"."goal_brain_requests" TO "anon";
GRANT ALL ON TABLE "public"."goal_brain_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_brain_requests" TO "service_role";



GRANT ALL ON TABLE "public"."goal_engine_tools" TO "anon";
GRANT ALL ON TABLE "public"."goal_engine_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_engine_tools" TO "service_role";



GRANT ALL ON TABLE "public"."goal_events" TO "anon";
GRANT ALL ON TABLE "public"."goal_events" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_events" TO "service_role";



GRANT ALL ON TABLE "public"."goal_evidence" TO "anon";
GRANT ALL ON TABLE "public"."goal_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."goal_loop_iterations" TO "anon";
GRANT ALL ON TABLE "public"."goal_loop_iterations" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_loop_iterations" TO "service_role";



GRANT ALL ON TABLE "public"."goal_milestones" TO "anon";
GRANT ALL ON TABLE "public"."goal_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."goal_model_events" TO "anon";
GRANT ALL ON TABLE "public"."goal_model_events" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_model_events" TO "service_role";



GRANT ALL ON TABLE "public"."goal_orchestrator_brain" TO "anon";
GRANT ALL ON TABLE "public"."goal_orchestrator_brain" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_orchestrator_brain" TO "service_role";



GRANT ALL ON TABLE "public"."goal_plan_steps" TO "anon";
GRANT ALL ON TABLE "public"."goal_plan_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_plan_steps" TO "service_role";



GRANT ALL ON TABLE "public"."goal_success_criteria" TO "anon";
GRANT ALL ON TABLE "public"."goal_success_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_success_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."heartbeat_logs" TO "anon";
GRANT ALL ON TABLE "public"."heartbeat_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."heartbeat_logs" TO "service_role";



GRANT ALL ON TABLE "public"."hidden_chats" TO "anon";
GRANT ALL ON TABLE "public"."hidden_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."hidden_chats" TO "service_role";



GRANT ALL ON TABLE "public"."import_history" TO "anon";
GRANT ALL ON TABLE "public"."import_history" TO "authenticated";
GRANT ALL ON TABLE "public"."import_history" TO "service_role";



GRANT ALL ON TABLE "public"."income_payments" TO "anon";
GRANT ALL ON TABLE "public"."income_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."income_payments" TO "service_role";



GRANT ALL ON TABLE "public"."integration_alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."integration_alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_alerts_log" TO "service_role";



GRANT ALL ON TABLE "public"."integration_health" TO "anon";
GRANT ALL ON TABLE "public"."integration_health" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_health" TO "service_role";



GRANT ALL ON TABLE "public"."integration_tenant_access" TO "anon";
GRANT ALL ON TABLE "public"."integration_tenant_access" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_tenant_access" TO "service_role";



GRANT ALL ON TABLE "public"."integration_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."integration_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_tokens" TO "anon";
GRANT ALL ON TABLE "public"."invitation_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_uploads" TO "anon";
GRANT ALL ON TABLE "public"."invoice_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."job_queue" TO "anon";
GRANT ALL ON TABLE "public"."job_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."job_queue" TO "service_role";



GRANT ALL ON TABLE "public"."lead_alert_failure_notifications" TO "anon";
GRANT ALL ON TABLE "public"."lead_alert_failure_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_alert_failure_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."lead_filter_presets" TO "anon";
GRANT ALL ON TABLE "public"."lead_filter_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_filter_presets" TO "service_role";



GRANT ALL ON TABLE "public"."lead_notification_events" TO "anon";
GRANT ALL ON TABLE "public"."lead_notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_notification_events" TO "service_role";



GRANT ALL ON TABLE "public"."lead_pipeline_stages" TO "anon";
GRANT ALL ON TABLE "public"."lead_pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_pipeline_stages" TO "service_role";



GRANT ALL ON TABLE "public"."lead_sales_people" TO "anon";
GRANT ALL ON TABLE "public"."lead_sales_people" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_sales_people" TO "service_role";



GRANT ALL ON TABLE "public"."lead_statuses" TO "anon";
GRANT ALL ON TABLE "public"."lead_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."lead_updates" TO "anon";
GRANT ALL ON TABLE "public"."lead_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_updates" TO "service_role";



GRANT ALL ON TABLE "public"."manually_read_contacts" TO "anon";
GRANT ALL ON TABLE "public"."manually_read_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."manually_read_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."manus_tasks" TO "anon";
GRANT ALL ON TABLE "public"."manus_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."manus_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."manychat_destination_send_locks" TO "anon";
GRANT ALL ON TABLE "public"."manychat_destination_send_locks" TO "authenticated";
GRANT ALL ON TABLE "public"."manychat_destination_send_locks" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_ab_variants" TO "anon";
GRANT ALL ON TABLE "public"."marketing_ab_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_ab_variants" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_assets" TO "anon";
GRANT ALL ON TABLE "public"."marketing_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_assets" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_item_transitions" TO "anon";
GRANT ALL ON TABLE "public"."marketing_item_transitions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_item_transitions" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_media_library" TO "anon";
GRANT ALL ON TABLE "public"."marketing_media_library" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_media_library" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_pipeline_stages" TO "anon";
GRANT ALL ON TABLE "public"."marketing_pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_pipeline_stages" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."marketing_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_runs" TO "anon";
GRANT ALL ON TABLE "public"."marketing_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_runs" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_stage_templates" TO "anon";
GRANT ALL ON TABLE "public"."marketing_stage_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_stage_templates" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_triggers" TO "anon";
GRANT ALL ON TABLE "public"."marketing_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_work_items" TO "anon";
GRANT ALL ON TABLE "public"."marketing_work_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_work_items" TO "service_role";



GRANT ALL ON TABLE "public"."maskyoo_manual_overrides" TO "anon";
GRANT ALL ON TABLE "public"."maskyoo_manual_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."maskyoo_manual_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."maskyoo_numbers" TO "anon";
GRANT ALL ON TABLE "public"."maskyoo_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."maskyoo_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."maskyoo_settings" TO "anon";
GRANT ALL ON TABLE "public"."maskyoo_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."maskyoo_settings" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_bot_sessions" TO "anon";
GRANT ALL ON TABLE "public"."meeting_bot_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_bot_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."meta_whatsapp_tenant_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."meta_whatsapp_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."one_time_incomes" TO "anon";
GRANT ALL ON TABLE "public"."one_time_incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."one_time_incomes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_links" TO "anon";
GRANT ALL ON TABLE "public"."payment_links" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_links" TO "service_role";



GRANT ALL ON TABLE "public"."pbn_service_commands" TO "service_role";



GRANT ALL ON TABLE "public"."processed_events" TO "anon";
GRANT ALL ON TABLE "public"."processed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_events" TO "service_role";



GRANT ALL ON TABLE "public"."processed_webhook_messages" TO "anon";
GRANT ALL ON TABLE "public"."processed_webhook_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_webhook_messages" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."publishing_articles" TO "anon";
GRANT ALL ON TABLE "public"."publishing_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."publishing_articles" TO "service_role";



GRANT ALL ON TABLE "public"."publishing_imports" TO "anon";
GRANT ALL ON TABLE "public"."publishing_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."publishing_imports" TO "service_role";



GRANT ALL ON TABLE "public"."publishing_sites" TO "anon";
GRANT ALL ON TABLE "public"."publishing_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."publishing_sites" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_instant_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."pulse_instant_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_instant_alert_log" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_alert_logs" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_alert_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_alert_logs" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_alerts" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_competitors" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_competitors" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_history" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_history" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_history" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_keywords" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_keywords" TO "service_role";



GRANT ALL ON TABLE "public"."rank_tracking_projects" TO "anon";
GRANT ALL ON TABLE "public"."rank_tracking_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."rank_tracking_projects" TO "service_role";



GRANT ALL ON TABLE "public"."recording_folders" TO "anon";
GRANT ALL ON TABLE "public"."recording_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."recording_folders" TO "service_role";



GRANT ALL ON TABLE "public"."report_alerts" TO "anon";
GRANT ALL ON TABLE "public"."report_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."report_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."sales_people" TO "anon";
GRANT ALL ON TABLE "public"."sales_people" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_people" TO "service_role";



GRANT ALL ON TABLE "public"."sales_person_agencies" TO "anon";
GRANT ALL ON TABLE "public"."sales_person_agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_person_agencies" TO "service_role";



GRANT ALL ON TABLE "public"."seo_call_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."seo_call_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_call_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."seo_monthly_shares" TO "anon";
GRANT ALL ON TABLE "public"."seo_monthly_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_monthly_shares" TO "service_role";



GRANT ALL ON TABLE "public"."seo_monthly_updates" TO "anon";
GRANT ALL ON TABLE "public"."seo_monthly_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_monthly_updates" TO "service_role";



GRANT ALL ON TABLE "public"."service_health_checks" TO "anon";
GRANT ALL ON TABLE "public"."service_health_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."service_health_checks" TO "service_role";



GRANT ALL ON TABLE "public"."signature_documents" TO "anon";
GRANT ALL ON TABLE "public"."signature_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."signature_documents" TO "service_role";



GRANT ALL ON TABLE "public"."signature_events" TO "anon";
GRANT ALL ON TABLE "public"."signature_events" TO "authenticated";
GRANT ALL ON TABLE "public"."signature_events" TO "service_role";



GRANT ALL ON TABLE "public"."signature_recipients" TO "anon";
GRANT ALL ON TABLE "public"."signature_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."signature_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."site_events" TO "anon";
GRANT ALL ON TABLE "public"."site_events" TO "authenticated";
GRANT ALL ON TABLE "public"."site_events" TO "service_role";



GRANT ALL ON TABLE "public"."site_pageviews" TO "anon";
GRANT ALL ON TABLE "public"."site_pageviews" TO "authenticated";
GRANT ALL ON TABLE "public"."site_pageviews" TO "service_role";



GRANT ALL ON TABLE "public"."site_sessions" TO "anon";
GRANT ALL ON TABLE "public"."site_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."site_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."site_tracking_configs" TO "anon";
GRANT ALL ON TABLE "public"."site_tracking_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."site_tracking_configs" TO "service_role";



GRANT ALL ON TABLE "public"."site_visitors" TO "anon";
GRANT ALL ON TABLE "public"."site_visitors" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visitors" TO "service_role";



GRANT ALL ON TABLE "public"."social_comments" TO "anon";
GRANT ALL ON TABLE "public"."social_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."social_comments" TO "service_role";



GRANT ALL ON TABLE "public"."social_gantt_posts" TO "anon";
GRANT ALL ON TABLE "public"."social_gantt_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_gantt_posts" TO "service_role";



GRANT ALL ON TABLE "public"."social_media_channels" TO "anon";
GRANT ALL ON TABLE "public"."social_media_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."social_media_channels" TO "service_role";



GRANT ALL ON TABLE "public"."social_media_post_channels" TO "anon";
GRANT ALL ON TABLE "public"."social_media_post_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."social_media_post_channels" TO "service_role";



GRANT ALL ON TABLE "public"."social_media_posts" TO "anon";
GRANT ALL ON TABLE "public"."social_media_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_media_posts" TO "service_role";



GRANT ALL ON TABLE "public"."social_media_wordpress_sites" TO "anon";
GRANT ALL ON TABLE "public"."social_media_wordpress_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."social_media_wordpress_sites" TO "service_role";



GRANT ALL ON TABLE "public"."social_pages" TO "anon";
GRANT ALL ON TABLE "public"."social_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."social_pages" TO "service_role";



GRANT ALL ON TABLE "public"."social_pages_shared_tenants" TO "anon";
GRANT ALL ON TABLE "public"."social_pages_shared_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."social_pages_shared_tenants" TO "service_role";



GRANT ALL ON TABLE "public"."social_publications" TO "anon";
GRANT ALL ON TABLE "public"."social_publications" TO "authenticated";
GRANT ALL ON TABLE "public"."social_publications" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_invoices" TO "anon";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."table_shares" TO "anon";
GRANT ALL ON TABLE "public"."table_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."table_shares" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."task_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."task_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."task_notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."task_notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."task_notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."task_updates" TO "anon";
GRANT ALL ON TABLE "public"."task_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_updates" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_channel_categories" TO "anon";
GRANT ALL ON TABLE "public"."team_channel_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."team_channel_categories" TO "service_role";



GRANT ALL ON TABLE "public"."team_channel_invites" TO "anon";
GRANT ALL ON TABLE "public"."team_channel_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."team_channel_invites" TO "service_role";



GRANT ALL ON TABLE "public"."team_channel_members" TO "anon";
GRANT ALL ON TABLE "public"."team_channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."team_channel_whatsapp_links" TO "anon";
GRANT ALL ON TABLE "public"."team_channel_whatsapp_links" TO "authenticated";
GRANT ALL ON TABLE "public"."team_channel_whatsapp_links" TO "service_role";



GRANT ALL ON TABLE "public"."team_channels" TO "anon";
GRANT ALL ON TABLE "public"."team_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."team_channels" TO "service_role";



GRANT ALL ON TABLE "public"."team_chat_files" TO "anon";
GRANT ALL ON TABLE "public"."team_chat_files" TO "authenticated";
GRANT ALL ON TABLE "public"."team_chat_files" TO "service_role";



GRANT ALL ON TABLE "public"."team_message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."team_message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."team_message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."team_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."team_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."team_message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."team_message_read_status" TO "anon";
GRANT ALL ON TABLE "public"."team_message_read_status" TO "authenticated";
GRANT ALL ON TABLE "public"."team_message_read_status" TO "service_role";



GRANT ALL ON TABLE "public"."team_messages" TO "anon";
GRANT ALL ON TABLE "public"."team_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."team_messages" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_bot_state" TO "anon";
GRANT ALL ON TABLE "public"."telegram_bot_state" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_bot_state" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_messages" TO "anon";
GRANT ALL ON TABLE "public"."telegram_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_messages" TO "service_role";



GRANT ALL ON TABLE "public"."telephony_settings" TO "anon";
GRANT ALL ON TABLE "public"."telephony_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."telephony_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_heartbeat_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_heartbeat_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_heartbeat_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_integrations" TO "anon";
GRANT ALL ON TABLE "public"."tenant_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."tenant_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_templates" TO "anon";
GRANT ALL ON TABLE "public"."tenant_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_templates" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_terminology" TO "anon";
GRANT ALL ON TABLE "public"."tenant_terminology" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_terminology" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."terminology_presets" TO "anon";
GRANT ALL ON TABLE "public"."terminology_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."terminology_presets" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."time_entry_breaks" TO "anon";
GRANT ALL ON TABLE "public"."time_entry_breaks" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entry_breaks" TO "service_role";



GRANT ALL ON TABLE "public"."user_active_tenant" TO "anon";
GRANT ALL ON TABLE "public"."user_active_tenant" TO "authenticated";
GRANT ALL ON TABLE "public"."user_active_tenant" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_managed_agencies" TO "anon";
GRANT ALL ON TABLE "public"."user_managed_agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."user_managed_agencies" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_workspace_layout" TO "anon";
GRANT ALL ON TABLE "public"."user_workspace_layout" TO "authenticated";
GRANT ALL ON TABLE "public"."user_workspace_layout" TO "service_role";



GRANT ALL ON TABLE "public"."wa_group_members" TO "anon";
GRANT ALL ON TABLE "public"."wa_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."wa_lid_map" TO "anon";
GRANT ALL ON TABLE "public"."wa_lid_map" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_lid_map" TO "service_role";



GRANT ALL ON TABLE "public"."wa_pending_activations" TO "anon";
GRANT ALL ON TABLE "public"."wa_pending_activations" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_pending_activations" TO "service_role";



GRANT ALL ON TABLE "public"."wa_warm_campaigns" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."wa_warm_campaigns" TO "authenticated";



GRANT ALL ON TABLE "public"."wa_warm_opt_ins" TO "service_role";
GRANT SELECT ON TABLE "public"."wa_warm_opt_ins" TO "authenticated";



GRANT ALL ON TABLE "public"."wa_warm_recipients" TO "service_role";
GRANT SELECT ON TABLE "public"."wa_warm_recipients" TO "authenticated";



GRANT ALL ON TABLE "public"."whatsapp_groups" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_groups" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."woocommerce_customers" TO "anon";
GRANT ALL ON TABLE "public"."woocommerce_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."woocommerce_customers" TO "service_role";



GRANT ALL ON TABLE "public"."woocommerce_orders" TO "anon";
GRANT ALL ON TABLE "public"."woocommerce_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."woocommerce_orders" TO "service_role";



GRANT ALL ON TABLE "public"."woocommerce_products" TO "anon";
GRANT ALL ON TABLE "public"."woocommerce_products" TO "authenticated";
GRANT ALL ON TABLE "public"."woocommerce_products" TO "service_role";



GRANT ALL ON TABLE "public"."woocommerce_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."woocommerce_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."woocommerce_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."wordpress_sites_shared_tenants" TO "anon";
GRANT ALL ON TABLE "public"."wordpress_sites_shared_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."wordpress_sites_shared_tenants" TO "service_role";



GRANT ALL ON TABLE "public"."zoom_recordings" TO "anon";
GRANT ALL ON TABLE "public"."zoom_recordings" TO "authenticated";
GRANT ALL ON TABLE "public"."zoom_recordings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";





































-- Application-owned Auth trigger
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Production bucket configuration supplied by the user
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('broadcast-media', 'broadcast-media', true, NULL, NULL),
  ('entity-attachments', 'entity-attachments', false, NULL, NULL),
  ('recordings', 'recordings', true, NULL, NULL),
  ('signature-documents', 'signature-documents', false, NULL, NULL),
  ('social-media', 'social-media', true, NULL, NULL),
  ('supplier-invoices', 'supplier-invoices', true, NULL, NULL),
  ('task-attachments', 'task-attachments', false, NULL, NULL),
  ('team-attachments', 'team-attachments', true, NULL, NULL),
  ('team-chat-files', 'team-chat-files', true, NULL, NULL),
  ('tenant-logos', 'tenant-logos', true, NULL, NULL),
  ('wa-voice', 'wa-voice', true, NULL, NULL);

-- Application-owned Storage policies
CREATE POLICY "Anyone can read team chat files" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'team-chat-files'::"text"));

CREATE POLICY "Anyone can view supplier invoices" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'supplier-invoices'::"text"));

CREATE POLICY "Anyone can view team attachments" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'team-attachments'::"text"));

CREATE POLICY "Authenticated users can delete own recordings" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'recordings'::"text"));

CREATE POLICY "Authenticated users can delete supplier invoices" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'supplier-invoices'::"text"));

CREATE POLICY "Authenticated users can upload recordings" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'recordings'::"text"));

CREATE POLICY "Authenticated users can upload signature docs" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'signature-documents'::"text") AND ((("storage"."foldername"("name"))[1] IN ( SELECT ("tenant_users"."tenant_id")::"text" AS "tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()))));

CREATE POLICY "Authenticated users can upload supplier invoices" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'supplier-invoices'::"text"));

CREATE POLICY "Authenticated users can upload team attachments" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'team-attachments'::"text"));

CREATE POLICY "Authenticated users can upload team chat files" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'team-chat-files'::"text"));

CREATE POLICY "Authenticated users can view recordings" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'recordings'::"text"));

CREATE POLICY "Authenticated users can view signature docs" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'signature-documents'::"text") AND ((("storage"."foldername"("name"))[1] IN ( SELECT ("tenant_users"."tenant_id")::"text" AS "tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."user_id" = "auth"."uid"()))) OR "public"."is_super_admin"("auth"."uid"()))));

CREATE POLICY "Owners can delete tenant logo" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'tenant-logos'::"text") AND ("public"."is_super_admin"("auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")))));

CREATE POLICY "Owners can update tenant logo" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'tenant-logos'::"text") AND ("public"."is_super_admin"("auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")))));

CREATE POLICY "Owners can upload tenant logo" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'tenant-logos'::"text") AND ("public"."is_super_admin"("auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'owner'::"public"."app_role") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")))));

CREATE POLICY "Tenant members can view their tenant logo" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'tenant-logos'::"text") AND ("public"."is_super_admin"("auth"."uid"()) OR (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text"))));

CREATE POLICY "Users can delete attachments from their tenant" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'entity-attachments'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")));

CREATE POLICY "Users can delete own team chat files" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'team-chat-files'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

CREATE POLICY "Users can delete their own task attachments" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'task-attachments'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Users can upload attachments to their tenant folder" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'entity-attachments'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")));

CREATE POLICY "Users can upload task attachments" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'task-attachments'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Users can view attachments from their tenant" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'entity-attachments'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")));

CREATE POLICY "Users can view task attachments" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'task-attachments'::"text"));

CREATE POLICY "broadcast media public read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'broadcast-media'::"text"));

CREATE POLICY "broadcast media tenant delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'broadcast-media'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")));

CREATE POLICY "broadcast media tenant upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'broadcast-media'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (("storage"."foldername"("name"))[1] = ("public"."get_user_tenant_id"("auth"."uid"()))::"text")));
