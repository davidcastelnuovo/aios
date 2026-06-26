-- =====================================================================
-- Schema export for Marketing Captain CRM (public schema only)
-- Generated from live database via system catalog queries.
-- Run on a FRESH Supabase project. Data is NOT included (import via CSV).
-- Recommended: run inside a transaction. If anything fails, you can
-- re-run safely after dropping the public schema:
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- =====================================================================

-- ---------- EXTENSIONS ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------- ENUM TYPES ----------
DO $$ BEGIN CREATE TYPE public.agency_status AS ENUM ('active', 'paused', 'former'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.agent_memory_layer AS ENUM ('working', 'episodic', 'semantic', 'user_model'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('owner', 'agency_owner', 'team_manager', 'campaigner', 'sales_person', 'super_admin', 'seo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.automation_action AS ENUM ('webhook', 'email', 'notification', 'update_status', 'send_whatsapp', 'create_manychat_subscriber', 'send_greenapi_message', 'add_lead_update', 'add_client_update', 'send_greenapi_to_campaigner', 'create_task', 'create_lead', 'send_telegram'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.automation_trigger AS ENUM ('task_assigned', 'task_status_changed', 'lead_status_changed', 'lead_created', 'client_created', 'client_status_changed', 'onboarding_status_changed', 'meeting_created', 'task_calendar_created', 'task_overdue', 'meeting_day_after', 'meeting_same_day', 'inbound_webhook_task', 'inbound_webhook_lead', 'manual_command', 'whatsapp_message_received', 'carmen_whatsapp_session', 'telegram_message_received', 'account_stopped_spending', 'ad_account_billing_issue', 'ad_account_blocked', 'integration_disconnected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.chat_provider AS ENUM ('manychat', 'green_api', 'internal', 'manus_wa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.client_mood_status AS ENUM ('happy', 'wavering', 'churn_risk', 'not_progressing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'ended', 'onboarding'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.client_tier AS ENUM ('A', 'B', 'C'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.communication_status AS ENUM ('normal', 'sensitive', 'complaint'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.finance_type AS ENUM ('income', 'expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.interaction_type AS ENUM ('client_initiated', 'campaigner_initiated', 'call', 'whatsapp', 'meeting', 'other', 'system_alert'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_priority AS ENUM ('critical', 'high', 'medium', 'low'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'done', 'failed', 'dead_letter'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_type AS ENUM ('user_action', 'workflow', 'integration', 'heavy_job'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_response_status AS ENUM ('no_answer_1', 'no_answer_2', 'no_answer_3', 'no_answer_4', 'denies_contact', 'not_relevant', 'in_progress'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'social_media', 'paid_ads', 'cold_call', 'email_campaign', 'event', 'other', 'whatsapp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'follow_up', 'proposal_sent', 'closed', 'transferred_to_onboarding', 'meeting_scheduled', 'negotiation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.marketing_approval_mode AS ENUM ('manual', 'auto', 'hybrid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.marketing_item_status AS ENUM ('draft', 'in_progress', 'waiting_approval', 'approved', 'published', 'failed', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.marketing_stage_type AS ENUM ('strategy', 'copy', 'creative', 'target_paid', 'target_seo', 'target_organic', 'measurement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.onboarding_status AS ENUM ('research_meeting', 'receiving_access', 'setup_and_content', 'campaign_live'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.org_type AS ENUM ('root', 'organization', 'sub_organization'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'wire', 'check'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.priority_level AS ENUM ('high', 'medium', 'low'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.seo_monthly_status AS ENUM ('up', 'stable', 'down'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.supplier_type AS ENUM ('campaigner', 'media', 'design', 'creative', 'dev', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_type AS ENUM ('campaign', 'collection', 'creative', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tenant_status AS ENUM ('active', 'inactive', 'suspended', 'trial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- TABLES ----------
CREATE TABLE public.agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  status agency_status NOT NULL DEFAULT 'active'::agency_status,
  start_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  folder_link text,
  tenant_id uuid,
  is_default boolean DEFAULT false
);

CREATE TABLE public.agency_tenant_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_tenant_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  accessing_tenant_id uuid NOT NULL,
  access_level text DEFAULT 'read_write'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  notes text
);

CREATE TABLE public.agent_action_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  action_type text NOT NULL,
  action_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success'::text,
  error_message text,
  user_id uuid,
  conversation_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10,6),
  duration_ms integer,
  tool_calls integer,
  model text,
  run_id uuid,
  step_index integer,
  step_kind text,
  thought text,
  observation jsonb
);

CREATE TABLE public.agent_approval_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  requested_by uuid,
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  context jsonb,
  proposed_changes jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  executed_at timestamp with time zone,
  execution_result jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tool_name text,
  tool_input jsonb,
  run_id uuid,
  expires_at timestamp with time zone
);

CREATE TABLE public.agent_eval_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  eval_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running'::text,
  total_cases integer NOT NULL DEFAULT 0,
  passed_cases integer NOT NULL DEFAULT 0,
  avg_score numeric(5,2),
  results jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.agent_evals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  dataset jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_threshold integer NOT NULL DEFAULT 70,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium'::text,
  status text NOT NULL DEFAULT 'active'::text,
  target_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_knowledge_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  parent_folder_id uuid,
  name text NOT NULL,
  icon text,
  "position" integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_knowledge_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  folder_id uuid,
  title text NOT NULL,
  content text,
  kind text NOT NULL DEFAULT 'note'::text,
  url text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  embedding vector(1536),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_mcp_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  name text NOT NULL,
  url text NOT NULL,
  transport text NOT NULL DEFAULT 'http'::text,
  state text NOT NULL DEFAULT 'ready'::text,
  auth_url text,
  oauth_tokens jsonb,
  client_metadata jsonb,
  available_tools jsonb DEFAULT '[]'::jsonb,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'conversation'::text,
  subcategory text,
  path text,
  entity_type text,
  entity_id text,
  title text NOT NULL,
  summary text,
  summary_embedding vector(1536),
  importance integer NOT NULL DEFAULT 50,
  ref_date date,
  valid_until timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  memory_type agent_memory_layer NOT NULL DEFAULT 'semantic'::agent_memory_layer,
  contact_phone text,
  fts tsvector
);

CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  user_id uuid,
  goal text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running'::text,
  current_step integer NOT NULL DEFAULT 0,
  max_steps integer NOT NULL DEFAULT 12,
  final_answer text,
  error_message text,
  pending_approval_id uuid,
  model text,
  total_tokens_in integer NOT NULL DEFAULT 0,
  total_tokens_out integer NOT NULL DEFAULT 0,
  total_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  duration_ms integer,
  conversation_id uuid,
  trigger_source text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_run_id uuid,
  delegated_to_agent_id uuid,
  replay_of_run_id uuid
);

CREATE TABLE public.agent_supervisors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  supervisor_agent_id uuid NOT NULL,
  child_agent_id uuid NOT NULL,
  routing_hint text,
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'::text,
  priority integer NOT NULL DEFAULT 5,
  result jsonb,
  created_by uuid,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  schedule_type text DEFAULT 'once'::text,
  cron_expression text,
  task_skills jsonb,
  task_mode text,
  parallel_execution boolean DEFAULT false,
  parallel_subtasks jsonb,
  enabled boolean DEFAULT true,
  scheduled_at timestamp with time zone,
  last_run timestamp with time zone,
  run_count integer DEFAULT 0
);

CREATE TABLE public.agent_tools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  handler_kind text NOT NULL DEFAULT 'edge'::text,
  handler_ref text,
  requires_approval boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  contact_phone text NOT NULL,
  display_name text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ahrefs_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  client_id uuid,
  agency_id uuid,
  domain text NOT NULL,
  report_type text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  report_date date,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  comparison_data jsonb
);

CREATE TABLE public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  engine text NOT NULL DEFAULT 'google/gemini-2.5-flash'::text,
  personality text,
  soul text,
  talent text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  allowed_tools text[] NOT NULL DEFAULT '{}'::text[],
  system_prompt text,
  max_tool_rounds integer NOT NULL DEFAULT 25,
  writing_style text,
  response_length text,
  language text NOT NULL DEFAULT 'he'::text
);

CREATE TABLE public.ai_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_detection_brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  brand_name text NOT NULL,
  url text,
  description text,
  keywords text[] DEFAULT '{}'::text[],
  competitor_names text[] DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_detection_competitor_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  brand_id uuid,
  competitor_name text NOT NULL,
  prompt_id uuid,
  platform text NOT NULL,
  is_mentioned boolean DEFAULT false,
  "position" integer,
  scan_id text,
  scanned_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_detection_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  prompt text NOT NULL,
  category text DEFAULT 'general'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.ai_detection_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL,
  platform text NOT NULL,
  is_mentioned boolean DEFAULT false,
  "position" integer,
  sentiment text,
  response_snippet text,
  citations text[],
  scan_id text,
  scanned_at timestamp with time zone DEFAULT now(),
  tenant_id uuid,
  brand_id uuid
);

CREATE TABLE public.ai_detection_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  score numeric DEFAULT 0,
  chatgpt_score numeric,
  gemini_score numeric,
  perplexity_score numeric,
  total_prompts integer DEFAULT 0,
  mentioned_prompts integer DEFAULT 0,
  week_start date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.ai_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  key text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  tenant_id uuid,
  name text NOT NULL,
  description text NOT NULL,
  steps text NOT NULL,
  trigger_phrases text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  search_vector tsvector,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  success_rate numeric(4,3) DEFAULT 1.0,
  version integer NOT NULL DEFAULT 1,
  created_by_agent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  slug text,
  system_prompt text,
  output_template text,
  allowed_tools text[] DEFAULT '{}'::text[],
  scope text NOT NULL DEFAULT 'tenant'::text,
  model text,
  triggers text[] DEFAULT '{}'::text[]
);

CREATE TABLE public.automation_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  execution_id text NOT NULL,
  tenant_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  trigger_type text,
  entity_id text,
  depth integer NOT NULL DEFAULT 0,
  actions_count integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running'::text,
  error text
);

CREATE TABLE public.automation_flow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  step_type text NOT NULL DEFAULT 'action'::text,
  action_type text,
  label text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  parent_step_id uuid,
  condition_branch text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  triggered_at timestamp with time zone DEFAULT now(),
  success boolean NOT NULL,
  error_message text,
  payload jsonb,
  response jsonb,
  execution_time_ms integer
);

CREATE TABLE public.automation_shared_tenants (
  automation_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  shared_by uuid,
  shared_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type automation_trigger NOT NULL,
  conditions jsonb DEFAULT '{}'::jsonb,
  action_type automation_action NOT NULL,
  configuration jsonb NOT NULL,
  active boolean DEFAULT true,
  tenant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_flow boolean NOT NULL DEFAULT false,
  source_automation_id uuid,
  source_tenant_id uuid
);

CREATE TABLE public.blocked_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  connection_user_id uuid NOT NULL,
  sender_phone text,
  client_id uuid,
  lead_id uuid,
  group_id uuid,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_by_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.calendar_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  shared_with_user_id uuid NOT NULL,
  permission_level text NOT NULL DEFAULT 'full'::text,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.calendar_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  google_email text,
  watch_channel_id text,
  watch_resource_id text,
  watch_expires_at timestamp with time zone,
  next_sync_token text,
  last_sync_at timestamp with time zone,
  sync_status text,
  sync_error text,
  needs_reconnect boolean NOT NULL DEFAULT false
);

CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lead_id uuid,
  client_id uuid,
  caller_user_id uuid NOT NULL,
  from_number text,
  to_number text NOT NULL,
  duration integer DEFAULT 0,
  status text NOT NULL DEFAULT 'initiated'::text,
  recording_url text,
  recording_duration integer,
  provider_call_id text,
  provider text DEFAULT 'paycall'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  campaign_id text NOT NULL,
  campaign_name text,
  ad_account_id text,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning'::text,
  details jsonb DEFAULT '{}'::jsonb,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  resolved_at timestamp with time zone,
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  entity_id text NOT NULL,
  entity_type text NOT NULL,
  action text NOT NULL,
  cron_expression text,
  run_at timestamp with time zone,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem'::text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  last_run_status text,
  last_run_error text,
  next_run_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by uuid,
  created_by uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigner_agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaigner_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  role text[],
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  folder_link text,
  tenant_id uuid NOT NULL,
  whatsapp_group_id text
);

CREATE TABLE public.carmen_memory_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_ref text,
  topic text,
  topic_tags text[] DEFAULT '{}'::text[],
  summary text NOT NULL,
  summary_embedding vector(1536),
  source_table text,
  source_ids text[] DEFAULT '{}'::text[],
  participants jsonb DEFAULT '[]'::jsonb,
  importance smallint NOT NULL DEFAULT 50,
  retention_score real NOT NULL DEFAULT 1.0,
  ref_date timestamp with time zone NOT NULL DEFAULT now(),
  last_accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  access_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.carmen_memory_outbox (
  id bigint NOT NULL DEFAULT nextval('carmen_memory_outbox_id_seq'::regclass),
  tenant_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  op text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone,
  retry_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.carmen_memory_pointers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category text NOT NULL,
  subcategory text,
  path text NOT NULL,
  entity_type text,
  entity_id text,
  title text NOT NULL,
  summary text,
  summary_embedding vector(1536),
  ref_date timestamp with time zone,
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone,
  importance smallint NOT NULL DEFAULT 50,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.carmen_whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  chat_id text NOT NULL,
  phone text,
  sender_name text,
  agent_id uuid,
  connection_user_id text,
  conversation_history jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active'::text,
  started_by_keyword text DEFAULT 'כרמן'::text,
  end_keyword text DEFAULT 'סיימנו כרמן'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  ai_conversation_id uuid,
  automation_id uuid
);

CREATE TABLE public.chat_contact_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_id uuid,
  lead_id uuid,
  group_id uuid,
  sender_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  tenant_id uuid NOT NULL,
  direction text NOT NULL,
  message_text text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp'::text,
  sent_by_user_id uuid,
  raw_provider_data jsonb DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  lead_id uuid,
  provider chat_provider NOT NULL DEFAULT 'internal'::chat_provider,
  sender_phone text,
  sender_name text,
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamp with time zone,
  blocked_by_user_id uuid,
  group_id uuid,
  connection_user_id uuid
);

CREATE TABLE public.chat_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  contact_name text NOT NULL,
  phone text,
  email text,
  role text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.client_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  service_name text NOT NULL,
  username text,
  password text,
  url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.client_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  campaigner_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  status onboarding_status NOT NULL DEFAULT 'research_meeting'::onboarding_status,
  title text NOT NULL,
  notes text,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.client_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.client_team (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  campaigner_id uuid NOT NULL,
  role_on_account text,
  allocation_percent integer DEFAULT 100,
  start_date date,
  end_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  campaigner_payment numeric DEFAULT 0
);

CREATE TABLE public.client_tenant_financial_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  retainer numeric,
  monthly_budget numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.client_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  update_type text
);

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  industry text,
  monthly_budget numeric(12,2),
  start_date date,
  status client_status NOT NULL DEFAULT 'active'::client_status,
  website text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  folder_link text,
  phone text,
  email text,
  retainer numeric,
  tenant_id uuid,
  is_seo_client boolean DEFAULT false,
  manychat_subscriber_id text,
  active_chat_provider chat_provider,
  contact_name text,
  mood_status client_mood_status DEFAULT 'happy'::client_mood_status,
  whatsapp_avatar_url text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  folder_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_group_id uuid,
  end_date date,
  tier client_tier,
  services text[] DEFAULT '{}'::text[],
  health_score integer DEFAULT 100,
  overall_status text DEFAULT 'green'::text,
  active_flags jsonb DEFAULT '[]'::jsonb,
  meta_ads_account_id text,
  google_ads_account_id text,
  ga_property_id text,
  gsc_site_url text,
  ahrefs_domain text,
  monthly_fixed_expense numeric NOT NULL DEFAULT 0,
  is_ecommerce boolean NOT NULL DEFAULT false
);

CREATE TABLE public.communication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'normal'::text,
  interaction_type text DEFAULT 'other'::text,
  note text,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crm_dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  client_id uuid,
  agency_id uuid,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  dashboard_type text DEFAULT 'client'::text
);

CREATE TABLE public.crm_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  name text NOT NULL,
  key text NOT NULL,
  type text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  agency_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  icon text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  integration_type text,
  integration_settings jsonb DEFAULT '{}'::jsonb,
  agency_id uuid,
  client_id uuid,
  integrations jsonb DEFAULT '[]'::jsonb,
  last_sync_at timestamp with time zone
);

CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  options jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.dashboard_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL,
  share_token text NOT NULL DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 24),
  allowed_emails text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.deleted_facebook_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  leadgen_id text NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "timestamp" bigint,
  error_type character varying(255),
  filename character varying(255),
  lineno integer,
  colno integer,
  stack text,
  has_blank_screen boolean,
  source character varying(50),
  error_message text,
  url text,
  created_at timestamp with time zone DEFAULT now(),
  error_stack text
);

CREATE TABLE public.expense_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  expense_type text NOT NULL,
  expense_id uuid NOT NULL,
  expense_name text NOT NULL,
  amount numeric NOT NULL,
  payment_month text NOT NULL,
  paid_at timestamp with time zone DEFAULT now(),
  paid_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type finance_type NOT NULL,
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  supplier_id uuid,
  date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_method payment_method,
  category text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.flow_processed_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  leadgen_id text NOT NULL,
  facebook_form_id text,
  processed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.gmail_allowed_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  label_id text NOT NULL,
  label_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gmail_blocked_senders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.gmail_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  gmail_label_id text
);

CREATE TABLE public.gmail_category_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  subject_pattern text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.gmail_message_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.gmail_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  google_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  parent_goal_id uuid,
  status text NOT NULL DEFAULT 'active'::text,
  owner_type text NOT NULL DEFAULT 'campaigner'::text,
  owner_id text,
  progress_percent numeric(5,2) DEFAULT 0,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.heartbeat_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  tasks_reviewed integer DEFAULT 0,
  actions_taken jsonb DEFAULT '[]'::jsonb,
  summary text,
  duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.hidden_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_id uuid,
  lead_id uuid,
  group_id uuid,
  sender_phone text,
  hidden_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.import_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  import_type text NOT NULL,
  file_name text NOT NULL,
  file_content text NOT NULL,
  imported_by uuid,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  records_count integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.income_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  client_name text NOT NULL,
  amount numeric NOT NULL,
  payment_month text NOT NULL,
  received_at timestamp with time zone DEFAULT now(),
  received_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.integration_alerts_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  account_id text,
  alert_type text NOT NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fired_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_health (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_failure_at timestamp with time zone,
  last_success_at timestamp with time zone,
  is_circuit_open boolean NOT NULL DEFAULT false,
  cooldown_until timestamp with time zone,
  total_calls integer NOT NULL DEFAULT 0,
  total_failures integer NOT NULL DEFAULT 0
);

CREATE TABLE public.integration_tenant_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL,
  accessing_tenant_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.invitation_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  email text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.invoice_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  uploaded_by uuid,
  file_path text NOT NULL,
  mime_type text,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  total_amount numeric,
  currency text DEFAULT 'ILS'::text,
  vat_amount numeric,
  description text,
  raw_extraction jsonb,
  supplier_id uuid,
  client_id uuid,
  agency_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  error_message text,
  finance_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.job_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_type job_type NOT NULL DEFAULT 'workflow'::job_type,
  priority job_priority NOT NULL DEFAULT 'medium'::job_priority,
  status job_status NOT NULL DEFAULT 'queued'::job_status,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error text,
  idempotency_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  locked_until timestamp with time zone
);

CREATE TABLE public.lead_filter_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_pipeline_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stage_key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_sales_people (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  sales_person_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.lead_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status_key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#e5e7eb'::text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name text,
  contact_name text,
  email text,
  phone text,
  source lead_source NOT NULL DEFAULT 'other'::lead_source,
  estimated_deal_value numeric,
  industry text,
  notes text,
  sales_person_id uuid,
  agency_id uuid,
  folder_link text,
  lost_reason text,
  won_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  proposal_sent_date date,
  general_status text,
  monthly_budget numeric,
  three_month_budget numeric,
  proposal_date date,
  closing_date date,
  products text,
  sale_date date,
  tenant_id uuid,
  campaign_name text,
  itai_meeting_date date,
  manychat_subscriber_id text,
  active_chat_provider chat_provider,
  meeting_set_date timestamp with time zone,
  meeting_date date,
  meeting_time text,
  meeting_location text,
  meeting_reminder_day_after_sent_at timestamp with time zone,
  meeting_reminder_same_day_sent_at timestamp with time zone,
  response_status text,
  whatsapp_avatar_url text,
  status text NOT NULL DEFAULT 'new'::text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  folder_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_date date
);

CREATE TABLE public.manually_read_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_id uuid,
  lead_id uuid,
  group_id uuid,
  sender_phone text,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.manus_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id text NOT NULL,
  title text,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  task_url text,
  share_url text,
  output jsonb,
  credit_usage integer,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  run_id uuid,
  stage_id uuid,
  type text NOT NULL,
  url text,
  content text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_item_transitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  from_stage_id uuid,
  to_stage_id uuid,
  triggered_by uuid,
  trigger_type text NOT NULL DEFAULT 'manual'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_media_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  lead_id uuid,
  bucket_path text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  source text NOT NULL DEFAULT 'whatsapp'::text,
  source_message_id uuid,
  caption text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  ad_ready boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_pipeline_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  stage_type marketing_stage_type NOT NULL,
  name text NOT NULL,
  agent_id uuid,
  approval_mode marketing_approval_mode NOT NULL DEFAULT 'manual'::marketing_approval_mode,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  parent_stage_id uuid,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'מחלקת שיווק'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  track text NOT NULL DEFAULT 'campaigns'::text
);

CREATE TABLE public.marketing_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  model text,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_stage_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  track text NOT NULL,
  stage_type text NOT NULL,
  name text NOT NULL,
  default_agent_id uuid,
  default_approval_mode text NOT NULL DEFAULT 'manual'::text,
  default_instructions text,
  default_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_target jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_triggers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'schedule'::text,
  schedule_cron text,
  schedule_preset text,
  schedule_hour integer DEFAULT 9,
  schedule_dow integer,
  schedule_dom integer,
  event_type text,
  template_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_work_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  current_stage_id uuid,
  target_channel text,
  title text,
  status marketing_item_status NOT NULL DEFAULT 'draft'::marketing_item_status,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_date date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.maskyoo_manual_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  maskyoo_last9 text NOT NULL,
  period_days integer NOT NULL DEFAULT 30,
  incoming_count integer,
  unique_count integer,
  answered_count integer,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.maskyoo_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  phone_last9 text NOT NULL,
  display_number text NOT NULL,
  label text,
  client_id uuid,
  category text DEFAULT 'general'::text,
  is_ignored boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.maskyoo_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  base_url text NOT NULL,
  api_token text NOT NULL,
  default_user_phone text,
  click2call_service text NOT NULL DEFAULT 'onetouch'::text,
  webhook_secret text,
  last_cdr_sync_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_key text NOT NULL,
  custom_label text,
  original_label text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  icon text,
  route text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  badge text,
  parent_menu_key text,
  category text,
  hidden_from_child_tenants boolean DEFAULT false
);

CREATE TABLE public.one_time_incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  product_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_month text NOT NULL,
  notes text,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  supplier_id uuid,
  expense_amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.payment_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text,
  payment_url text NOT NULL,
  sumit_payment_id text,
  status text DEFAULT 'pending'::text,
  send_email boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_by uuid
);

CREATE TABLE public.processed_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_key text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.processed_webhook_messages (
  provider text NOT NULL,
  tenant_id uuid NOT NULL,
  external_message_id text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  agency_id uuid
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  campaigner_id uuid,
  sales_person_id uuid,
  calendar_iframe_code text,
  status text NOT NULL DEFAULT 'pending'::text,
  phone text,
  avatar_url text,
  notification_group_link text,
  ui_mode text NOT NULL DEFAULT 'classic'::text
);

CREATE TABLE public.rank_tracking_alert_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  keyword_id uuid,
  message text NOT NULL,
  old_position integer,
  new_position integer,
  triggered_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rank_tracking_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  alert_type text NOT NULL,
  threshold integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  last_triggered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rank_tracking_competitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  domain text NOT NULL,
  name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rank_tracking_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL,
  "position" integer,
  url_found text,
  serp_features jsonb DEFAULT '[]'::jsonb,
  competitors_data jsonb DEFAULT '[]'::jsonb,
  checked_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rank_tracking_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  keyword text NOT NULL,
  target_url text,
  current_position integer,
  previous_position integer,
  best_position integer,
  worst_position integer,
  position_change integer DEFAULT 0,
  found_url text,
  search_volume integer,
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rank_tracking_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  agency_id uuid,
  name text NOT NULL,
  domain text NOT NULL,
  country text NOT NULL DEFAULT 'il'::text,
  language text NOT NULL DEFAULT 'he'::text,
  device text NOT NULL DEFAULT 'desktop'::text,
  check_frequency text NOT NULL DEFAULT 'daily'::text,
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.report_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  table_id uuid NOT NULL,
  name text NOT NULL,
  metric text NOT NULL,
  comparison_type text NOT NULL,
  operator text NOT NULL,
  threshold numeric NOT NULL,
  is_percentage boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_triggered_at timestamp with time zone,
  last_triggered_data jsonb
);

CREATE TABLE public.sales_people (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  agency_id uuid NOT NULL,
  notes text,
  folder_link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.sales_person_agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_person_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_call_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  category text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  incoming_count integer NOT NULL DEFAULT 0,
  is_manual boolean NOT NULL DEFAULT false,
  note text,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_monthly_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  month date NOT NULL,
  status seo_monthly_status NOT NULL,
  notes text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.signature_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  file_url text,
  document_type text NOT NULL DEFAULT 'created'::text,
  status text NOT NULL DEFAULT 'draft'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.signature_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'signer'::text,
  sign_order integer DEFAULT 1,
  status text NOT NULL DEFAULT 'pending'::text,
  signature_data text,
  signed_at timestamp with time zone,
  sign_token uuid DEFAULT gen_random_uuid(),
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  signature_position jsonb
);

CREATE TABLE public.site_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  visitor_id uuid NOT NULL,
  tracking_config_id uuid NOT NULL,
  event_name text NOT NULL,
  event_category text,
  event_label text,
  event_value numeric,
  event_data jsonb,
  page_url text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL
);

CREATE TABLE public.site_pageviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  visitor_id uuid NOT NULL,
  tracking_config_id uuid NOT NULL,
  page_url text NOT NULL,
  page_path text,
  page_title text,
  time_on_page integer DEFAULT 0,
  scroll_depth integer DEFAULT 0,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  tenant_id uuid NOT NULL
);

CREATE TABLE public.site_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  tracking_config_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer DEFAULT 0,
  page_count integer DEFAULT 0,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  exit_page text,
  device_type text,
  browser text,
  os text,
  screen_resolution text,
  country text,
  city text,
  is_bounce boolean DEFAULT false,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.site_tracking_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  tenant_id uuid NOT NULL,
  tracking_id text DEFAULT ''::text,
  website_domain text,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{"track_forms": true, "track_clicks": true, "track_scroll": true, "track_outbound": true}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.site_visitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tracking_config_id uuid NOT NULL,
  visitor_fingerprint text NOT NULL,
  first_visit timestamp with time zone NOT NULL DEFAULT now(),
  last_visit timestamp with time zone NOT NULL DEFAULT now(),
  visit_count integer DEFAULT 1,
  lead_id uuid,
  client_id_ref uuid,
  first_utm jsonb,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  page_id uuid,
  platform text NOT NULL,
  external_comment_id text NOT NULL,
  external_post_id text,
  parent_comment_id text,
  author_id text,
  author_name text,
  message text,
  is_from_page boolean DEFAULT false,
  sentiment text,
  replied_at timestamp with time zone,
  reply_text text,
  hidden_at timestamp with time zone,
  created_at_external timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_gantt_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  topic text NOT NULL,
  scheduled_date date NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  copy_text text,
  creative_url text,
  creative_prompt text,
  copy_prompt text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_media_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  platform text NOT NULL,
  channel_name text NOT NULL,
  channel_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_media_post_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  platform_post_id text,
  status text NOT NULL DEFAULT 'pending'::text,
  error_message text,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_media_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_by uuid,
  title text,
  content text NOT NULL DEFAULT ''::text,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  post_type text NOT NULL DEFAULT 'text'::text,
  status text NOT NULL DEFAULT 'draft'::text,
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  wordpress_post_id text,
  wordpress_site_url text,
  publish_to_wordpress boolean NOT NULL DEFAULT false,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_media_wordpress_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_url text NOT NULL,
  username text NOT NULL,
  app_password text NOT NULL,
  site_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  client_id uuid,
  woocommerce_enabled boolean NOT NULL DEFAULT false,
  woocommerce_consumer_key text,
  woocommerce_consumer_secret text,
  last_woocommerce_sync_at timestamp with time zone,
  notes text,
  woo_sync_enabled boolean NOT NULL DEFAULT false,
  woo_last_sync_at timestamp with time zone,
  agency_id uuid,
  campaign_url_mapping jsonb DEFAULT '{}'::jsonb,
  campaign_form_mapping jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.social_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  platform text NOT NULL,
  page_id text NOT NULL,
  page_name text,
  page_access_token text,
  ig_business_id text,
  category text,
  picture_url text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_publications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  page_id uuid,
  platform text NOT NULL,
  post_type text NOT NULL,
  caption text,
  media_url text,
  external_id text,
  permalink text,
  status text NOT NULL DEFAULT 'pending'::text,
  error_message text,
  published_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.supplier_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  invoice_name text NOT NULL DEFAULT ''::text,
  invoice_amount numeric NOT NULL DEFAULT 0,
  invoice_date date,
  invoice_month text NOT NULL DEFAULT ''::text,
  file_url text,
  file_name text,
  ai_extracted boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type supplier_type NOT NULL,
  related_campaigner_id uuid,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  folder_link text,
  payment_1 numeric,
  agency_id_1 uuid,
  payment_2 numeric,
  agency_id_2 uuid,
  payment_3 numeric,
  agency_id_3 uuid,
  tenant_id uuid
);

CREATE TABLE public.sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_type text NOT NULL DEFAULT 'manychat_sync'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  progress jsonb NOT NULL DEFAULT '{"failed": 0, "results": [], "conflicts": 0, "processed": 0, "remaining": 0}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.table_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  is_active boolean NOT NULL DEFAULT true,
  allowed_emails text[],
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.task_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  campaigner_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  added_by uuid
);

CREATE TABLE public.task_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  attachments jsonb DEFAULT '[]'::jsonb,
  update_type text NOT NULL DEFAULT 'comment'::text
);

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  task_type task_type DEFAULT 'other'::task_type,
  agency_id uuid NOT NULL,
  client_id uuid,
  campaigner_id uuid,
  due_date date,
  status task_status NOT NULL DEFAULT 'open'::task_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 5,
  lead_id uuid,
  overdue_notified_at timestamp with time zone,
  sales_person_id uuid,
  due_time time without time zone,
  sort_order integer DEFAULT 0,
  duration_minutes integer DEFAULT 30,
  google_calendar_event_id text,
  created_by uuid DEFAULT auth.uid(),
  goal_id uuid,
  assigned_agent text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE public.team_channel_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📁'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.team_channel_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.team_channel_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  notify_enabled boolean DEFAULT true,
  notify_override_phone text,
  notify_override_group text
);

CREATE TABLE public.team_channel_whatsapp_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  whatsapp_group_id uuid,
  whatsapp_chat_id text,
  client_id uuid,
  lead_id uuid,
  display_name text,
  forward_files boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.team_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6'::text,
  avatar_url text,
  created_by uuid NOT NULL,
  is_private boolean DEFAULT false,
  linked_client_id uuid,
  linked_lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  agency_id uuid,
  category text NOT NULL DEFAULT 'team'::text,
  category_id uuid,
  notification_group_link text
);

CREATE TABLE public.team_chat_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  message_id uuid,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'file'::text,
  file_size bigint,
  client_id uuid,
  lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.team_message_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  linked_client_id uuid,
  linked_lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.team_message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.team_message_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.team_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  parent_message_id uuid,
  is_edited boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  attachments jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.telegram_bot_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  update_offset bigint NOT NULL DEFAULT 0,
  bot_username text,
  bot_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  shared_from_state_id uuid
);

CREATE TABLE public.telegram_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  update_id bigint,
  chat_id bigint NOT NULL,
  text text,
  direction text NOT NULL DEFAULT 'inbound'::text,
  sender_name text,
  sender_username text,
  raw_update jsonb,
  client_id uuid,
  lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.telephony_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  personal_phone text,
  virtual_number text,
  auto_record boolean DEFAULT true,
  provider text DEFAULT 'paycall'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_heartbeat_settings (
  tenant_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  interval_hours integer NOT NULL DEFAULT 8,
  active_hours_start integer NOT NULL DEFAULT 7,
  active_hours_end integer NOT NULL DEFAULT 22,
  allowed_actions jsonb NOT NULL DEFAULT '["reminders", "status_update", "daily_summary"]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_type text NOT NULL DEFAULT 'sumit'::text,
  api_key text,
  company_id text,
  is_active boolean NOT NULL DEFAULT false,
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  last_sync_at timestamp with time zone,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  instance_id text,
  api_token_last_4 text,
  user_id uuid,
  shared_from_integration_id uuid,
  display_name text
);

CREATE TABLE public.tenant_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  resource_type text NOT NULL,
  max_per_minute integer NOT NULL DEFAULT 300,
  current_count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.tenant_terminology (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  term_key text NOT NULL,
  singular text NOT NULL,
  plural text NOT NULL,
  original_singular text NOT NULL,
  original_plural text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text,
  status tenant_status NOT NULL DEFAULT 'active'::tenant_status,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  contact_email text,
  contact_name text,
  notes text,
  parent_tenant_id uuid,
  allow_super_admin_access boolean NOT NULL DEFAULT true,
  slug text NOT NULL,
  org_type org_type NOT NULL DEFAULT 'organization'::org_type,
  is_premium boolean DEFAULT false
);

CREATE TABLE public.terminology_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by_tenant_id uuid,
  created_by_user_id uuid,
  terms jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaigner_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.time_entry_breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_active_tenant (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_managed_agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE public.user_workspace_layout (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  module_id text NOT NULL,
  x_position integer NOT NULL DEFAULT 0,
  y_position integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 320,
  height integer NOT NULL DEFAULT 220,
  is_open boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agency_id uuid,
  group_chat_id text NOT NULL,
  group_name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  whatsapp_avatar_url text,
  invite_link text
);

CREATE TABLE public.whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  chat_id text NOT NULL,
  conversation_history jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.woocommerce_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  woo_customer_id bigint NOT NULL,
  email text,
  first_name text,
  last_name text,
  username text,
  role text,
  orders_count integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  avatar_url text,
  billing jsonb DEFAULT '{}'::jsonb,
  shipping jsonb DEFAULT '{}'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.woocommerce_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  woo_order_id bigint NOT NULL,
  order_number text,
  status text,
  currency text,
  total numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  shipping_total numeric DEFAULT 0,
  discount_total numeric DEFAULT 0,
  customer_id bigint,
  customer_email text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  billing jsonb DEFAULT '{}'::jsonb,
  shipping jsonb DEFAULT '{}'::jsonb,
  line_items jsonb DEFAULT '[]'::jsonb,
  payment_method text,
  payment_method_title text,
  date_created timestamp with time zone,
  date_modified timestamp with time zone,
  date_completed timestamp with time zone,
  date_paid timestamp with time zone,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.woocommerce_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  woo_product_id bigint NOT NULL,
  name text,
  slug text,
  status text,
  type text,
  sku text,
  price numeric,
  regular_price numeric,
  sale_price numeric,
  stock_quantity integer,
  stock_status text,
  total_sales integer DEFAULT 0,
  categories jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.woocommerce_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running'::text,
  orders_synced integer DEFAULT 0,
  products_synced integer DEFAULT 0,
  customers_synced integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone
);

CREATE TABLE public.zoom_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meeting_id text NOT NULL,
  meeting_topic text,
  host_email text,
  start_time timestamp with time zone,
  duration integer,
  recording_url text,
  recording_password text,
  recording_type text,
  file_size bigint,
  client_id uuid,
  lead_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'zoom'::text,
  file_path text,
  transcription text,
  transcription_status text,
  transcription_error text,
  summary_file_url text
);

-- ---------- PRIMARY KEYS / UNIQUE / CHECK CONSTRAINTS ----------
ALTER TABLE public.agencies ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_access_level_check CHECK ((access_level = ANY (ARRAY['read_only'::text, 'read_write'::text])));
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_pkey PRIMARY KEY (id);
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_source_tenant_id_agency_id_accessing_t_key UNIQUE (source_tenant_id, agency_id, accessing_tenant_id);
ALTER TABLE public.agent_action_log ADD CONSTRAINT agent_action_log_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_approval_queue ADD CONSTRAINT agent_approval_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_eval_runs ADD CONSTRAINT agent_eval_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_evals ADD CONSTRAINT agent_evals_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_goals ADD CONSTRAINT agent_goals_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_knowledge_folders ADD CONSTRAINT agent_knowledge_folders_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_knowledge_items ADD CONSTRAINT agent_knowledge_items_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_mcp_connections ADD CONSTRAINT agent_mcp_connections_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_memory ADD CONSTRAINT agent_memory_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'waiting_approval'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_supervisors ADD CONSTRAINT agent_supervisors_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_supervisors ADD CONSTRAINT agent_supervisors_supervisor_agent_id_child_agent_id_key UNIQUE (supervisor_agent_id, child_agent_id);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_tools ADD CONSTRAINT agent_tools_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_tools ADD CONSTRAINT agent_tools_tenant_id_name_key UNIQUE (tenant_id, name);
ALTER TABLE public.agent_user_profiles ADD CONSTRAINT agent_user_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_user_profiles ADD CONSTRAINT agent_user_profiles_agent_id_contact_phone_key UNIQUE (agent_id, contact_phone);
ALTER TABLE public.ahrefs_reports ADD CONSTRAINT ahrefs_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_brands ADD CONSTRAINT ai_detection_brands_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_competitor_results ADD CONSTRAINT ai_detection_competitor_results_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_prompts ADD CONSTRAINT ai_detection_prompts_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_results ADD CONSTRAINT ai_detection_results_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_scores ADD CONSTRAINT ai_detection_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_detection_scores ADD CONSTRAINT ai_detection_scores_brand_week_unique UNIQUE (brand_id, week_start);
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_user_id_tenant_id_category_key_key UNIQUE (user_id, tenant_id, category, key);
ALTER TABLE public.ai_skills ADD CONSTRAINT ai_skills_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_skills ADD CONSTRAINT ai_skills_user_id_tenant_id_name_key UNIQUE (user_id, tenant_id, name);
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_pkey PRIMARY KEY (id);
ALTER TABLE public.automation_executions ADD CONSTRAINT unique_execution UNIQUE (execution_id, automation_id);
ALTER TABLE public.automation_flow_steps ADD CONSTRAINT automation_flow_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.automation_logs ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.automation_shared_tenants ADD CONSTRAINT automation_shared_tenants_pkey PRIMARY KEY (automation_id, tenant_id);
ALTER TABLE public.automations ADD CONSTRAINT automations_pkey PRIMARY KEY (id);
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_at_least_one_identifier CHECK (((sender_phone IS NOT NULL) OR (client_id IS NOT NULL) OR (lead_id IS NOT NULL) OR (group_id IS NOT NULL)));
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_permission_level_check CHECK ((permission_level = ANY (ARRAY['view'::text, 'book'::text, 'full'::text])));
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_owner_user_id_shared_with_user_id_key UNIQUE (owner_user_id, shared_with_user_id);
ALTER TABLE public.calendar_tokens ADD CONSTRAINT calendar_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_tokens ADD CONSTRAINT calendar_tokens_user_id_key UNIQUE (user_id);
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'ringing'::text, 'in-progress'::text, 'completed'::text, 'failed'::text, 'no-answer'::text, 'busy'::text, 'cancelled'::text])));
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_alerts ADD CONSTRAINT campaign_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_schedules ADD CONSTRAINT campaign_schedules_action_check CHECK ((action = ANY (ARRAY['pause'::text, 'resume'::text])));
ALTER TABLE public.campaign_schedules ADD CONSTRAINT campaign_schedules_entity_type_check CHECK ((entity_type = ANY (ARRAY['fb_campaign'::text, 'fb_adset'::text, 'fb_ad'::text, 'google_campaign'::text, 'google_adgroup'::text, 'google_ad'::text])));
ALTER TABLE public.campaign_schedules ADD CONSTRAINT campaign_schedules_when_chk CHECK (((cron_expression IS NOT NULL) OR (run_at IS NOT NULL)));
ALTER TABLE public.campaign_schedules ADD CONSTRAINT campaign_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigner_agencies ADD CONSTRAINT campaigner_agencies_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigner_agencies ADD CONSTRAINT campaigner_agencies_campaigner_id_agency_id_key UNIQUE (campaigner_id, agency_id);
ALTER TABLE public.campaigners ADD CONSTRAINT campaigners_pkey PRIMARY KEY (id);
ALTER TABLE public.carmen_memory_episodes ADD CONSTRAINT carmen_memory_episodes_pkey PRIMARY KEY (id);
ALTER TABLE public.carmen_memory_outbox ADD CONSTRAINT carmen_memory_outbox_pkey PRIMARY KEY (id);
ALTER TABLE public.carmen_memory_pointers ADD CONSTRAINT carmen_memory_pointers_pkey PRIMARY KEY (id);
ALTER TABLE public.carmen_memory_pointers ADD CONSTRAINT carmen_memory_pointers_tenant_id_path_entity_type_entity_id_key UNIQUE (tenant_id, path, entity_type, entity_id, subcategory);
ALTER TABLE public.carmen_whatsapp_sessions ADD CONSTRAINT carmen_whatsapp_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text])));
ALTER TABLE public.carmen_whatsapp_sessions ADD CONSTRAINT carmen_whatsapp_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_contact_check CHECK (((((((client_id IS NOT NULL))::integer + ((lead_id IS NOT NULL))::integer) + ((group_id IS NOT NULL))::integer) + ((sender_phone IS NOT NULL))::integer) = 1));
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tag_id_client_id_key UNIQUE (tag_id, client_id);
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tag_id_group_id_key UNIQUE (tag_id, group_id);
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tag_id_lead_id_key UNIQUE (tag_id, lead_id);
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tag_id_sender_phone_key UNIQUE (tag_id, sender_phone);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_tags ADD CONSTRAINT chat_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_tags ADD CONSTRAINT chat_tags_tenant_id_name_key UNIQUE (tenant_id, name);
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.client_credentials ADD CONSTRAINT client_credentials_pkey PRIMARY KEY (id);
ALTER TABLE public.client_onboarding ADD CONSTRAINT client_onboarding_pkey PRIMARY KEY (id);
ALTER TABLE public.client_suppliers ADD CONSTRAINT client_suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.client_suppliers ADD CONSTRAINT client_suppliers_client_id_supplier_id_key UNIQUE (client_id, supplier_id);
ALTER TABLE public.client_team ADD CONSTRAINT client_team_allocation_percent_check CHECK (((allocation_percent >= 0) AND (allocation_percent <= 100)));
ALTER TABLE public.client_team ADD CONSTRAINT client_team_pkey PRIMARY KEY (id);
ALTER TABLE public.client_team ADD CONSTRAINT client_team_client_id_campaigner_id_start_date_key UNIQUE (client_id, campaigner_id, start_date);
ALTER TABLE public.client_tenant_financial_data ADD CONSTRAINT client_tenant_financial_data_pkey PRIMARY KEY (id);
ALTER TABLE public.client_tenant_financial_data ADD CONSTRAINT client_tenant_financial_data_client_id_tenant_id_key UNIQUE (client_id, tenant_id);
ALTER TABLE public.client_updates ADD CONSTRAINT client_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.communication_logs ADD CONSTRAINT communication_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_dashboards ADD CONSTRAINT crm_dashboards_type_check CHECK ((dashboard_type = ANY (ARRAY['client'::text, 'agency'::text, 'organization'::text])));
ALTER TABLE public.crm_dashboards ADD CONSTRAINT crm_dashboards_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_fields ADD CONSTRAINT crm_fields_type_check CHECK ((type = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'date'::text, 'datetime'::text, 'checkbox'::text, 'single_select'::text, 'multi_select'::text, 'reference'::text, 'email'::text, 'phone'::text, 'url'::text])));
ALTER TABLE public.crm_fields ADD CONSTRAINT crm_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_fields ADD CONSTRAINT crm_fields_table_id_key_key UNIQUE (table_id, key);
ALTER TABLE public.crm_records ADD CONSTRAINT crm_records_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_tenant_id_slug_key UNIQUE (tenant_id, slug);
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_entity_type_check CHECK ((entity_type = ANY (ARRAY['task'::text, 'client'::text, 'lead'::text])));
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'select'::text, 'textarea'::text, 'checkbox'::text, 'email'::text, 'phone'::text])));
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_tenant_id_entity_type_field_key_key UNIQUE (tenant_id, entity_type, field_key);
ALTER TABLE public.dashboard_shares ADD CONSTRAINT dashboard_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.dashboard_shares ADD CONSTRAINT dashboard_shares_share_token_key UNIQUE (share_token);
ALTER TABLE public.deleted_facebook_leads ADD CONSTRAINT deleted_facebook_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.deleted_facebook_leads ADD CONSTRAINT deleted_facebook_leads_tenant_id_leadgen_id_key UNIQUE (tenant_id, leadgen_id);
ALTER TABLE public.error_logs ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_payments ADD CONSTRAINT expense_payments_expense_type_check CHECK ((expense_type = ANY (ARRAY['supplier'::text, 'campaigner'::text])));
ALTER TABLE public.expense_payments ADD CONSTRAINT expense_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.finance ADD CONSTRAINT finance_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.finance ADD CONSTRAINT finance_pkey PRIMARY KEY (id);
ALTER TABLE public.flow_processed_leads ADD CONSTRAINT flow_processed_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.flow_processed_leads ADD CONSTRAINT flow_processed_leads_automation_id_leadgen_id_key UNIQUE (automation_id, leadgen_id);
ALTER TABLE public.global_settings ADD CONSTRAINT global_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.global_settings ADD CONSTRAINT global_settings_setting_key_key UNIQUE (setting_key);
ALTER TABLE public.gmail_allowed_labels ADD CONSTRAINT gmail_allowed_labels_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_allowed_labels ADD CONSTRAINT gmail_allowed_labels_user_id_label_id_key UNIQUE (user_id, label_id);
ALTER TABLE public.gmail_blocked_senders ADD CONSTRAINT gmail_blocked_senders_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_blocked_senders ADD CONSTRAINT gmail_blocked_senders_user_id_email_address_key UNIQUE (user_id, email_address);
ALTER TABLE public.gmail_categories ADD CONSTRAINT gmail_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_category_rules ADD CONSTRAINT gmail_category_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_category_rules ADD CONSTRAINT gmail_category_rules_user_id_subject_pattern_key UNIQUE (user_id, subject_pattern);
ALTER TABLE public.gmail_message_categories ADD CONSTRAINT gmail_message_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_message_categories ADD CONSTRAINT gmail_message_categories_user_id_message_id_category_id_key UNIQUE (user_id, message_id, category_id);
ALTER TABLE public.gmail_tokens ADD CONSTRAINT gmail_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_tokens ADD CONSTRAINT gmail_tokens_user_id_key UNIQUE (user_id);
ALTER TABLE public.goals ADD CONSTRAINT goals_owner_type_check CHECK ((owner_type = ANY (ARRAY['agent'::text, 'campaigner'::text])));
ALTER TABLE public.goals ADD CONSTRAINT goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'cancelled'::text])));
ALTER TABLE public.goals ADD CONSTRAINT goals_pkey PRIMARY KEY (id);
ALTER TABLE public.heartbeat_logs ADD CONSTRAINT heartbeat_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_contact_check CHECK (((((((client_id IS NOT NULL))::integer + ((lead_id IS NOT NULL))::integer) + ((group_id IS NOT NULL))::integer) + ((sender_phone IS NOT NULL))::integer) = 1));
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_pkey PRIMARY KEY (id);
ALTER TABLE public.import_history ADD CONSTRAINT import_history_import_type_check CHECK ((import_type = ANY (ARRAY['leads'::text, 'clients'::text])));
ALTER TABLE public.import_history ADD CONSTRAINT import_history_pkey PRIMARY KEY (id);
ALTER TABLE public.income_payments ADD CONSTRAINT income_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_alerts_log ADD CONSTRAINT integration_alerts_log_alert_type_check CHECK ((alert_type = ANY (ARRAY['disconnected'::text, 'blocked'::text, 'reconnected'::text])));
ALTER TABLE public.integration_alerts_log ADD CONSTRAINT integration_alerts_log_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_health ADD CONSTRAINT integration_health_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_health ADD CONSTRAINT unique_tenant_provider UNIQUE (tenant_id, provider);
ALTER TABLE public.integration_tenant_access ADD CONSTRAINT integration_tenant_access_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_tenant_access ADD CONSTRAINT integration_tenant_access_integration_id_accessing_tenant_i_key UNIQUE (integration_id, accessing_tenant_id);
ALTER TABLE public.integration_user_permissions ADD CONSTRAINT integration_user_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_user_permissions ADD CONSTRAINT integration_user_permissions_integration_id_user_id_key UNIQUE (integration_id, user_id);
ALTER TABLE public.invitation_tokens ADD CONSTRAINT invitation_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.invitation_tokens ADD CONSTRAINT invitation_tokens_token_key UNIQUE (token);
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_pkey PRIMARY KEY (id);
ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.job_queue ADD CONSTRAINT unique_idempotency_key UNIQUE (tenant_id, idempotency_key);
ALTER TABLE public.lead_filter_presets ADD CONSTRAINT lead_filter_presets_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_pipeline_stages ADD CONSTRAINT lead_pipeline_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_pipeline_stages ADD CONSTRAINT lead_pipeline_stages_tenant_id_stage_key_key UNIQUE (tenant_id, stage_key);
ALTER TABLE public.lead_sales_people ADD CONSTRAINT lead_sales_people_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_sales_people ADD CONSTRAINT lead_sales_people_lead_id_sales_person_id_key UNIQUE (lead_id, sales_person_id);
ALTER TABLE public.lead_statuses ADD CONSTRAINT lead_statuses_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_statuses ADD CONSTRAINT lead_statuses_tenant_id_status_key_key UNIQUE (tenant_id, status_key);
ALTER TABLE public.lead_updates ADD CONSTRAINT lead_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT at_least_one_contact CHECK (((client_id IS NOT NULL) OR (lead_id IS NOT NULL) OR (group_id IS NOT NULL) OR (sender_phone IS NOT NULL)));
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT manually_read_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.manus_tasks ADD CONSTRAINT manus_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_assets ADD CONSTRAINT marketing_assets_type_check CHECK ((type = ANY (ARRAY['copy'::text, 'image'::text, 'video'::text, 'brief'::text, 'data'::text])));
ALTER TABLE public.marketing_assets ADD CONSTRAINT marketing_assets_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_item_transitions ADD CONSTRAINT marketing_item_transitions_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_media_library ADD CONSTRAINT marketing_media_library_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_pipeline_stages ADD CONSTRAINT marketing_pipeline_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_pipelines ADD CONSTRAINT marketing_pipelines_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_pipelines ADD CONSTRAINT marketing_pipelines_client_track_unique UNIQUE (client_id, track);
ALTER TABLE public.marketing_runs ADD CONSTRAINT marketing_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'awaiting_approval'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.marketing_runs ADD CONSTRAINT marketing_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_stage_templates ADD CONSTRAINT marketing_stage_templates_default_approval_mode_check CHECK ((default_approval_mode = ANY (ARRAY['manual'::text, 'auto'::text, 'hybrid'::text])));
ALTER TABLE public.marketing_stage_templates ADD CONSTRAINT marketing_stage_templates_track_check CHECK ((track = ANY (ARRAY['campaigns'::text, 'seo_geo'::text, 'social_organic'::text])));
ALTER TABLE public.marketing_stage_templates ADD CONSTRAINT marketing_stage_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_stage_templates ADD CONSTRAINT marketing_stage_templates_tenant_id_track_stage_type_key UNIQUE (tenant_id, track, stage_type);
ALTER TABLE public.marketing_triggers ADD CONSTRAINT marketing_triggers_schedule_preset_check CHECK ((schedule_preset = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'hourly'::text])));
ALTER TABLE public.marketing_triggers ADD CONSTRAINT marketing_triggers_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['schedule'::text, 'event'::text, 'manual'::text])));
ALTER TABLE public.marketing_triggers ADD CONSTRAINT marketing_triggers_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_work_items ADD CONSTRAINT marketing_work_items_pkey PRIMARY KEY (id);
ALTER TABLE public.maskyoo_manual_overrides ADD CONSTRAINT maskyoo_manual_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.maskyoo_manual_overrides ADD CONSTRAINT maskyoo_manual_overrides_tenant_id_maskyoo_last9_period_day_key UNIQUE (tenant_id, maskyoo_last9, period_days);
ALTER TABLE public.maskyoo_numbers ADD CONSTRAINT maskyoo_numbers_category_check CHECK ((category = ANY (ARRAY['organic'::text, 'paid'::text, 'general'::text])));
ALTER TABLE public.maskyoo_numbers ADD CONSTRAINT maskyoo_numbers_pkey PRIMARY KEY (id);
ALTER TABLE public.maskyoo_numbers ADD CONSTRAINT maskyoo_numbers_tenant_id_phone_last9_key UNIQUE (tenant_id, phone_last9);
ALTER TABLE public.maskyoo_settings ADD CONSTRAINT maskyoo_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.maskyoo_settings ADD CONSTRAINT maskyoo_settings_tenant_id_key UNIQUE (tenant_id);
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_badge_check CHECK ((badge = ANY (ARRAY['coming_soon'::text, 'premium'::text, NULL::text])));
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_tenant_id_menu_key_key UNIQUE (tenant_id, menu_key);
ALTER TABLE public.one_time_incomes ADD CONSTRAINT one_time_incomes_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text])));
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_pkey PRIMARY KEY (id);
ALTER TABLE public.processed_events ADD CONSTRAINT processed_events_pkey PRIMARY KEY (id);
ALTER TABLE public.processed_events ADD CONSTRAINT unique_event_key UNIQUE (tenant_id, event_key);
ALTER TABLE public.processed_webhook_messages ADD CONSTRAINT processed_webhook_messages_pkey PRIMARY KEY (provider, tenant_id, external_message_id);
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_alert_logs ADD CONSTRAINT rank_tracking_alert_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_alerts ADD CONSTRAINT rank_tracking_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['position_drop'::text, 'position_gain'::text, 'left_top10'::text, 'entered_top10'::text, 'competitor_overtake'::text])));
ALTER TABLE public.rank_tracking_alerts ADD CONSTRAINT rank_tracking_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_competitors ADD CONSTRAINT rank_tracking_competitors_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_competitors ADD CONSTRAINT rank_tracking_competitors_project_id_domain_key UNIQUE (project_id, domain);
ALTER TABLE public.rank_tracking_history ADD CONSTRAINT rank_tracking_history_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_keywords ADD CONSTRAINT rank_tracking_keywords_pkey PRIMARY KEY (id);
ALTER TABLE public.rank_tracking_keywords ADD CONSTRAINT rank_tracking_keywords_project_id_keyword_key UNIQUE (project_id, keyword);
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_check_frequency_check CHECK ((check_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'manual'::text])));
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_device_check CHECK ((device = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text])));
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_pkey PRIMARY KEY (id);
ALTER TABLE public.report_alerts ADD CONSTRAINT report_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_people ADD CONSTRAINT sales_people_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_person_agencies ADD CONSTRAINT sales_person_agencies_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_person_agencies ADD CONSTRAINT sales_person_agencies_sales_person_id_agency_id_key UNIQUE (sales_person_id, agency_id);
ALTER TABLE public.seo_call_snapshots ADD CONSTRAINT seo_call_snapshots_category_check CHECK ((category = ANY (ARRAY['organic'::text, 'paid'::text])));
ALTER TABLE public.seo_call_snapshots ADD CONSTRAINT seo_call_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.seo_call_snapshots ADD CONSTRAINT seo_call_snapshots_tenant_id_client_id_category_period_star_key UNIQUE (tenant_id, client_id, category, period_start, period_end);
ALTER TABLE public.seo_monthly_updates ADD CONSTRAINT seo_monthly_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.seo_monthly_updates ADD CONSTRAINT seo_monthly_updates_client_id_month_key UNIQUE (client_id, month);
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_document_type_check CHECK ((document_type = ANY (ARRAY['created'::text, 'uploaded'::text])));
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'partially_signed'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.signature_recipients ADD CONSTRAINT signature_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'declined'::text])));
ALTER TABLE public.signature_recipients ADD CONSTRAINT signature_recipients_pkey PRIMARY KEY (id);
ALTER TABLE public.site_events ADD CONSTRAINT site_events_pkey PRIMARY KEY (id);
ALTER TABLE public.site_pageviews ADD CONSTRAINT site_pageviews_pkey PRIMARY KEY (id);
ALTER TABLE public.site_sessions ADD CONSTRAINT site_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.site_tracking_configs ADD CONSTRAINT site_tracking_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.site_tracking_configs ADD CONSTRAINT site_tracking_configs_tracking_id_key UNIQUE (tracking_id);
ALTER TABLE public.site_visitors ADD CONSTRAINT site_visitors_pkey PRIMARY KEY (id);
ALTER TABLE public.site_visitors ADD CONSTRAINT site_visitors_tracking_config_id_visitor_fingerprint_key UNIQUE (tracking_config_id, visitor_fingerprint);
ALTER TABLE public.social_comments ADD CONSTRAINT social_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.social_comments ADD CONSTRAINT social_comments_platform_external_comment_id_key UNIQUE (platform, external_comment_id);
ALTER TABLE public.social_gantt_posts ADD CONSTRAINT social_gantt_posts_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'tiktok'::text, 'linkedin'::text, 'twitter'::text])));
ALTER TABLE public.social_gantt_posts ADD CONSTRAINT social_gantt_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'published'::text, 'rejected'::text])));
ALTER TABLE public.social_gantt_posts ADD CONSTRAINT social_gantt_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.social_media_channels ADD CONSTRAINT social_media_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.social_media_post_channels ADD CONSTRAINT social_media_post_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.social_media_posts ADD CONSTRAINT social_media_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.social_media_wordpress_sites ADD CONSTRAINT social_media_wordpress_sites_pkey PRIMARY KEY (id);
ALTER TABLE public.social_pages ADD CONSTRAINT social_pages_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text])));
ALTER TABLE public.social_pages ADD CONSTRAINT social_pages_pkey PRIMARY KEY (id);
ALTER TABLE public.social_pages ADD CONSTRAINT social_pages_tenant_id_platform_page_id_key UNIQUE (tenant_id, platform, page_id);
ALTER TABLE public.social_publications ADD CONSTRAINT social_publications_post_type_check CHECK ((post_type = ANY (ARRAY['post'::text, 'photo'::text, 'video'::text, 'reel'::text, 'story'::text, 'link'::text])));
ALTER TABLE public.social_publications ADD CONSTRAINT social_publications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'published'::text, 'failed'::text])));
ALTER TABLE public.social_publications ADD CONSTRAINT social_publications_pkey PRIMARY KEY (id);
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_pkey PRIMARY KEY (id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.sync_jobs ADD CONSTRAINT sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'stopped'::text, 'failed'::text])));
ALTER TABLE public.sync_jobs ADD CONSTRAINT sync_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.table_shares ADD CONSTRAINT table_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.table_shares ADD CONSTRAINT table_shares_share_token_key UNIQUE (share_token);
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_pkey PRIMARY KEY (id);
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_task_id_campaigner_id_key UNIQUE (task_id, campaigner_id);
ALTER TABLE public.task_updates ADD CONSTRAINT task_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT priority_value_range CHECK (((priority >= 1) AND (priority <= 10)));
ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.team_channel_categories ADD CONSTRAINT team_channel_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.team_channel_invites ADD CONSTRAINT team_channel_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.team_channel_invites ADD CONSTRAINT team_channel_invites_token_key UNIQUE (token);
ALTER TABLE public.team_channel_members ADD CONSTRAINT team_channel_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])));
ALTER TABLE public.team_channel_members ADD CONSTRAINT team_channel_members_pkey PRIMARY KEY (id);
ALTER TABLE public.team_channel_members ADD CONSTRAINT team_channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_pkey PRIMARY KEY (id);
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_channel_id_whatsapp_chat_id_key UNIQUE (channel_id, whatsapp_chat_id);
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_channel_id_whatsapp_group_id_key UNIQUE (channel_id, whatsapp_group_id);
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_pkey PRIMARY KEY (id);
ALTER TABLE public.team_message_attachments ADD CONSTRAINT team_message_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.team_message_reactions ADD CONSTRAINT team_message_reactions_pkey PRIMARY KEY (id);
ALTER TABLE public.team_message_reactions ADD CONSTRAINT team_message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);
ALTER TABLE public.team_message_read_status ADD CONSTRAINT team_message_read_status_pkey PRIMARY KEY (id);
ALTER TABLE public.team_message_read_status ADD CONSTRAINT team_message_read_status_channel_id_user_id_key UNIQUE (channel_id, user_id);
ALTER TABLE public.team_messages ADD CONSTRAINT team_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.telegram_bot_state ADD CONSTRAINT telegram_bot_state_pkey PRIMARY KEY (id);
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_tenant_id_update_id_key UNIQUE (tenant_id, update_id);
ALTER TABLE public.telephony_settings ADD CONSTRAINT telephony_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.telephony_settings ADD CONSTRAINT telephony_settings_tenant_id_user_id_key UNIQUE (tenant_id, user_id);
ALTER TABLE public.tenant_heartbeat_settings ADD CONSTRAINT tenant_heartbeat_settings_pkey PRIMARY KEY (tenant_id);
ALTER TABLE public.tenant_integrations ADD CONSTRAINT tenant_integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_rate_limits ADD CONSTRAINT tenant_rate_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_rate_limits ADD CONSTRAINT unique_tenant_resource UNIQUE (tenant_id, resource_type);
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_tenant_id_setting_key_key UNIQUE (tenant_id, setting_key);
ALTER TABLE public.tenant_templates ADD CONSTRAINT tenant_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_terminology ADD CONSTRAINT tenant_terminology_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_terminology ADD CONSTRAINT tenant_terminology_tenant_id_term_key_key UNIQUE (tenant_id, term_key);
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_tenant_id_user_id_key UNIQUE (tenant_id, user_id);
ALTER TABLE public.tenants ADD CONSTRAINT sub_org_must_have_parent CHECK (((org_type <> 'sub_organization'::org_type) OR ((org_type = 'sub_organization'::org_type) AND (parent_tenant_id IS NOT NULL))));
ALTER TABLE public.tenants ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);
ALTER TABLE public.terminology_presets ADD CONSTRAINT terminology_presets_pkey PRIMARY KEY (id);
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.time_entry_breaks ADD CONSTRAINT time_entry_breaks_pkey PRIMARY KEY (id);
ALTER TABLE public.user_active_tenant ADD CONSTRAINT user_active_tenant_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_managed_agencies ADD CONSTRAINT user_managed_agencies_pkey PRIMARY KEY (id);
ALTER TABLE public.user_managed_agencies ADD CONSTRAINT user_managed_agencies_user_id_agency_id_key UNIQUE (user_id, agency_id);
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_user_id_module_key UNIQUE (user_id, module);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_tenant_unique UNIQUE (user_id, role, tenant_id);
ALTER TABLE public.user_workspace_layout ADD CONSTRAINT user_workspace_layout_pkey PRIMARY KEY (id);
ALTER TABLE public.user_workspace_layout ADD CONSTRAINT user_workspace_layout_user_id_tenant_id_module_id_key UNIQUE (user_id, tenant_id, module_id);
ALTER TABLE public.whatsapp_groups ADD CONSTRAINT whatsapp_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_groups ADD CONSTRAINT whatsapp_groups_tenant_id_group_chat_id_key UNIQUE (tenant_id, group_chat_id);
ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text])));
ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.woocommerce_customers ADD CONSTRAINT woocommerce_customers_pkey PRIMARY KEY (id);
ALTER TABLE public.woocommerce_customers ADD CONSTRAINT woocommerce_customers_site_id_woo_customer_id_key UNIQUE (site_id, woo_customer_id);
ALTER TABLE public.woocommerce_orders ADD CONSTRAINT woocommerce_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.woocommerce_orders ADD CONSTRAINT woocommerce_orders_site_id_woo_order_id_key UNIQUE (site_id, woo_order_id);
ALTER TABLE public.woocommerce_products ADD CONSTRAINT woocommerce_products_pkey PRIMARY KEY (id);
ALTER TABLE public.woocommerce_products ADD CONSTRAINT woocommerce_products_site_id_woo_product_id_key UNIQUE (site_id, woo_product_id);
ALTER TABLE public.woocommerce_sync_log ADD CONSTRAINT woocommerce_sync_log_pkey PRIMARY KEY (id);
ALTER TABLE public.zoom_recordings ADD CONSTRAINT zoom_recordings_pkey PRIMARY KEY (id);

-- ---------- FOREIGN KEYS ----------
ALTER TABLE public.agencies ADD CONSTRAINT agencies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_accessing_tenant_id_fkey FOREIGN KEY (accessing_tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.agency_tenant_access ADD CONSTRAINT agency_tenant_access_source_tenant_id_fkey FOREIGN KEY (source_tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.agent_action_log ADD CONSTRAINT agent_action_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.agent_approval_queue ADD CONSTRAINT agent_approval_queue_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.agent_eval_runs ADD CONSTRAINT agent_eval_runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_eval_runs ADD CONSTRAINT agent_eval_runs_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES agent_evals(id) ON DELETE CASCADE;
ALTER TABLE public.agent_evals ADD CONSTRAINT agent_evals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_goals ADD CONSTRAINT agent_goals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_knowledge_folders ADD CONSTRAINT agent_knowledge_folders_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_knowledge_folders ADD CONSTRAINT agent_knowledge_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES agent_knowledge_folders(id) ON DELETE CASCADE;
ALTER TABLE public.agent_knowledge_items ADD CONSTRAINT agent_knowledge_items_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_knowledge_items ADD CONSTRAINT agent_knowledge_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES agent_knowledge_folders(id) ON DELETE SET NULL;
ALTER TABLE public.agent_mcp_connections ADD CONSTRAINT agent_mcp_connections_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_memory ADD CONSTRAINT agent_memory_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_delegated_to_agent_id_fkey FOREIGN KEY (delegated_to_agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_parent_run_id_fkey FOREIGN KEY (parent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_replay_of_run_id_fkey FOREIGN KEY (replay_of_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;
ALTER TABLE public.agent_supervisors ADD CONSTRAINT agent_supervisors_child_agent_id_fkey FOREIGN KEY (child_agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_supervisors ADD CONSTRAINT agent_supervisors_supervisor_agent_id_fkey FOREIGN KEY (supervisor_agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.agent_user_profiles ADD CONSTRAINT agent_user_profiles_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.ahrefs_reports ADD CONSTRAINT ahrefs_reports_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.ahrefs_reports ADD CONSTRAINT ahrefs_reports_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.ahrefs_reports ADD CONSTRAINT ahrefs_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_brands ADD CONSTRAINT ai_detection_brands_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_competitor_results ADD CONSTRAINT ai_detection_competitor_results_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES ai_detection_brands(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_competitor_results ADD CONSTRAINT ai_detection_competitor_results_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES ai_detection_prompts(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_competitor_results ADD CONSTRAINT ai_detection_competitor_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_prompts ADD CONSTRAINT ai_detection_prompts_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES ai_detection_brands(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_prompts ADD CONSTRAINT ai_detection_prompts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_results ADD CONSTRAINT ai_detection_results_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES ai_detection_brands(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_results ADD CONSTRAINT ai_detection_results_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES ai_detection_prompts(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_results ADD CONSTRAINT ai_detection_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_scores ADD CONSTRAINT ai_detection_scores_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES ai_detection_brands(id) ON DELETE CASCADE;
ALTER TABLE public.ai_detection_scores ADD CONSTRAINT ai_detection_scores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_skills ADD CONSTRAINT ai_skills_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automation_flow_steps ADD CONSTRAINT automation_flow_steps_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_flow_steps ADD CONSTRAINT automation_flow_steps_parent_step_id_fkey FOREIGN KEY (parent_step_id) REFERENCES automation_flow_steps(id) ON DELETE SET NULL;
ALTER TABLE public.automation_flow_steps ADD CONSTRAINT automation_flow_steps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automation_logs ADD CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_shared_tenants ADD CONSTRAINT automation_shared_tenants_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_shared_tenants ADD CONSTRAINT automation_shared_tenants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automations ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_group_id_fkey FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_contacts ADD CONSTRAINT blocked_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_shared_with_user_id_fkey FOREIGN KEY (shared_with_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_shares ADD CONSTRAINT calendar_shares_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_tokens ADD CONSTRAINT calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.campaigner_agencies ADD CONSTRAINT campaigner_agencies_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.campaigner_agencies ADD CONSTRAINT campaigner_agencies_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE CASCADE;
ALTER TABLE public.campaigners ADD CONSTRAINT campaigners_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.carmen_whatsapp_sessions ADD CONSTRAINT carmen_whatsapp_sessions_ai_conversation_id_fkey FOREIGN KEY (ai_conversation_id) REFERENCES ai_conversations(id);
ALTER TABLE public.carmen_whatsapp_sessions ADD CONSTRAINT carmen_whatsapp_sessions_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL;
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_group_id_fkey FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES chat_tags(id) ON DELETE CASCADE;
ALTER TABLE public.chat_contact_tags ADD CONSTRAINT chat_contact_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_blocked_by_user_id_fkey FOREIGN KEY (blocked_by_user_id) REFERENCES auth.users(id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_connection_user_id_fkey FOREIGN KEY (connection_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES auth.users(id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.chat_tags ADD CONSTRAINT chat_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.client_credentials ADD CONSTRAINT client_credentials_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_credentials ADD CONSTRAINT client_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_onboarding ADD CONSTRAINT client_onboarding_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE public.client_onboarding ADD CONSTRAINT client_onboarding_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id);
ALTER TABLE public.client_onboarding ADD CONSTRAINT client_onboarding_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_onboarding ADD CONSTRAINT client_onboarding_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_suppliers ADD CONSTRAINT client_suppliers_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_suppliers ADD CONSTRAINT client_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
ALTER TABLE public.client_team ADD CONSTRAINT client_team_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE CASCADE;
ALTER TABLE public.client_team ADD CONSTRAINT client_team_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_tenant_financial_data ADD CONSTRAINT client_tenant_financial_data_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_tenant_financial_data ADD CONSTRAINT client_tenant_financial_data_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_updates ADD CONSTRAINT client_updates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_updates ADD CONSTRAINT client_updates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_updates ADD CONSTRAINT client_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_whatsapp_group_id_fkey FOREIGN KEY (whatsapp_group_id) REFERENCES whatsapp_groups(id) ON DELETE SET NULL;
ALTER TABLE public.communication_logs ADD CONSTRAINT communication_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.communication_logs ADD CONSTRAINT communication_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.crm_dashboards ADD CONSTRAINT crm_dashboards_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.crm_dashboards ADD CONSTRAINT crm_dashboards_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.crm_fields ADD CONSTRAINT crm_fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES crm_tables(id) ON DELETE CASCADE;
ALTER TABLE public.crm_records ADD CONSTRAINT crm_records_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.crm_records ADD CONSTRAINT crm_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.crm_records ADD CONSTRAINT crm_records_table_id_fkey FOREIGN KEY (table_id) REFERENCES crm_tables(id) ON DELETE CASCADE;
ALTER TABLE public.crm_records ADD CONSTRAINT crm_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.crm_tables ADD CONSTRAINT crm_tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.dashboard_shares ADD CONSTRAINT dashboard_shares_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES crm_dashboards(id) ON DELETE CASCADE;
ALTER TABLE public.dashboard_shares ADD CONSTRAINT dashboard_shares_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.deleted_facebook_leads ADD CONSTRAINT deleted_facebook_leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.expense_payments ADD CONSTRAINT expense_payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES auth.users(id);
ALTER TABLE public.expense_payments ADD CONSTRAINT expense_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.finance ADD CONSTRAINT finance_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.finance ADD CONSTRAINT finance_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.finance ADD CONSTRAINT finance_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.finance ADD CONSTRAINT finance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.flow_processed_leads ADD CONSTRAINT flow_processed_leads_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;
ALTER TABLE public.flow_processed_leads ADD CONSTRAINT flow_processed_leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_allowed_labels ADD CONSTRAINT gmail_allowed_labels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_allowed_labels ADD CONSTRAINT gmail_allowed_labels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_blocked_senders ADD CONSTRAINT gmail_blocked_senders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_blocked_senders ADD CONSTRAINT gmail_blocked_senders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_categories ADD CONSTRAINT gmail_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_category_rules ADD CONSTRAINT gmail_category_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES gmail_categories(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_category_rules ADD CONSTRAINT gmail_category_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_message_categories ADD CONSTRAINT gmail_message_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES gmail_categories(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_message_categories ADD CONSTRAINT gmail_message_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_message_categories ADD CONSTRAINT gmail_message_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_tokens ADD CONSTRAINT gmail_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.gmail_tokens ADD CONSTRAINT gmail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD CONSTRAINT goals_parent_goal_id_fkey FOREIGN KEY (parent_goal_id) REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD CONSTRAINT goals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.heartbeat_logs ADD CONSTRAINT heartbeat_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.heartbeat_logs ADD CONSTRAINT heartbeat_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_group_id_fkey FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.hidden_chats ADD CONSTRAINT hidden_chats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.import_history ADD CONSTRAINT import_history_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id);
ALTER TABLE public.import_history ADD CONSTRAINT import_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.income_payments ADD CONSTRAINT income_payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.income_payments ADD CONSTRAINT income_payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id);
ALTER TABLE public.income_payments ADD CONSTRAINT income_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integration_health ADD CONSTRAINT integration_health_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integration_tenant_access ADD CONSTRAINT integration_tenant_access_accessing_tenant_id_fkey FOREIGN KEY (accessing_tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integration_tenant_access ADD CONSTRAINT integration_tenant_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE public.integration_tenant_access ADD CONSTRAINT integration_tenant_access_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES tenant_integrations(id) ON DELETE CASCADE;
ALTER TABLE public.integration_user_permissions ADD CONSTRAINT integration_user_permissions_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES tenant_integrations(id) ON DELETE CASCADE;
ALTER TABLE public.invitation_tokens ADD CONSTRAINT invitation_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.invitation_tokens ADD CONSTRAINT invitation_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.invitation_tokens ADD CONSTRAINT invitation_tokens_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id);
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_finance_id_fkey FOREIGN KEY (finance_id) REFERENCES finance(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_uploads ADD CONSTRAINT invoice_uploads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_filter_presets ADD CONSTRAINT lead_filter_presets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_pipeline_stages ADD CONSTRAINT lead_pipeline_stages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_sales_people ADD CONSTRAINT lead_sales_people_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_sales_people ADD CONSTRAINT lead_sales_people_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES sales_people(id) ON DELETE CASCADE;
ALTER TABLE public.lead_sales_people ADD CONSTRAINT lead_sales_people_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_statuses ADD CONSTRAINT lead_statuses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_updates ADD CONSTRAINT lead_updates_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_updates ADD CONSTRAINT lead_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES sales_people(id) ON DELETE RESTRICT;
ALTER TABLE public.leads ADD CONSTRAINT leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT manually_read_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT manually_read_contacts_group_id_fkey FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT manually_read_contacts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.manually_read_contacts ADD CONSTRAINT manually_read_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.manus_tasks ADD CONSTRAINT manus_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_item_transitions ADD CONSTRAINT marketing_item_transitions_item_id_fkey FOREIGN KEY (item_id) REFERENCES marketing_work_items(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_pipeline_stages ADD CONSTRAINT marketing_pipeline_stages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_pipeline_stages ADD CONSTRAINT marketing_pipeline_stages_parent_stage_id_fkey FOREIGN KEY (parent_stage_id) REFERENCES marketing_pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_pipeline_stages ADD CONSTRAINT marketing_pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES marketing_pipelines(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_pipelines ADD CONSTRAINT marketing_pipelines_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_work_items ADD CONSTRAINT marketing_work_items_current_stage_id_fkey FOREIGN KEY (current_stage_id) REFERENCES marketing_pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_work_items ADD CONSTRAINT marketing_work_items_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES marketing_pipelines(id) ON DELETE CASCADE;
ALTER TABLE public.maskyoo_numbers ADD CONSTRAINT maskyoo_numbers_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.one_time_incomes ADD CONSTRAINT one_time_incomes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.one_time_incomes ADD CONSTRAINT one_time_incomes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.one_time_incomes ADD CONSTRAINT one_time_incomes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.one_time_incomes ADD CONSTRAINT one_time_incomes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.processed_events ADD CONSTRAINT processed_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD CONSTRAINT products_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES sales_people(id) ON DELETE SET NULL;
ALTER TABLE public.rank_tracking_alert_logs ADD CONSTRAINT rank_tracking_alert_logs_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES rank_tracking_alerts(id) ON DELETE CASCADE;
ALTER TABLE public.rank_tracking_alert_logs ADD CONSTRAINT rank_tracking_alert_logs_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES rank_tracking_keywords(id) ON DELETE SET NULL;
ALTER TABLE public.rank_tracking_alerts ADD CONSTRAINT rank_tracking_alerts_project_id_fkey FOREIGN KEY (project_id) REFERENCES rank_tracking_projects(id) ON DELETE CASCADE;
ALTER TABLE public.rank_tracking_competitors ADD CONSTRAINT rank_tracking_competitors_project_id_fkey FOREIGN KEY (project_id) REFERENCES rank_tracking_projects(id) ON DELETE CASCADE;
ALTER TABLE public.rank_tracking_history ADD CONSTRAINT rank_tracking_history_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES rank_tracking_keywords(id) ON DELETE CASCADE;
ALTER TABLE public.rank_tracking_keywords ADD CONSTRAINT rank_tracking_keywords_project_id_fkey FOREIGN KEY (project_id) REFERENCES rank_tracking_projects(id) ON DELETE CASCADE;
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.rank_tracking_projects ADD CONSTRAINT rank_tracking_projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.report_alerts ADD CONSTRAINT report_alerts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.report_alerts ADD CONSTRAINT report_alerts_table_id_fkey FOREIGN KEY (table_id) REFERENCES crm_tables(id) ON DELETE CASCADE;
ALTER TABLE public.report_alerts ADD CONSTRAINT report_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sales_people ADD CONSTRAINT sales_people_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.sales_people ADD CONSTRAINT sales_people_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sales_person_agencies ADD CONSTRAINT sales_person_agencies_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.sales_person_agencies ADD CONSTRAINT sales_person_agencies_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES sales_people(id) ON DELETE CASCADE;
ALTER TABLE public.seo_monthly_updates ADD CONSTRAINT seo_monthly_updates_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.seo_monthly_updates ADD CONSTRAINT seo_monthly_updates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.seo_monthly_updates ADD CONSTRAINT seo_monthly_updates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.signature_recipients ADD CONSTRAINT signature_recipients_document_id_fkey FOREIGN KEY (document_id) REFERENCES signature_documents(id) ON DELETE CASCADE;
ALTER TABLE public.signature_recipients ADD CONSTRAINT signature_recipients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.site_events ADD CONSTRAINT site_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES site_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.site_events ADD CONSTRAINT site_events_tracking_config_id_fkey FOREIGN KEY (tracking_config_id) REFERENCES site_tracking_configs(id) ON DELETE CASCADE;
ALTER TABLE public.site_events ADD CONSTRAINT site_events_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES site_visitors(id) ON DELETE CASCADE;
ALTER TABLE public.site_pageviews ADD CONSTRAINT site_pageviews_session_id_fkey FOREIGN KEY (session_id) REFERENCES site_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.site_pageviews ADD CONSTRAINT site_pageviews_tracking_config_id_fkey FOREIGN KEY (tracking_config_id) REFERENCES site_tracking_configs(id) ON DELETE CASCADE;
ALTER TABLE public.site_pageviews ADD CONSTRAINT site_pageviews_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES site_visitors(id) ON DELETE CASCADE;
ALTER TABLE public.site_sessions ADD CONSTRAINT site_sessions_tracking_config_id_fkey FOREIGN KEY (tracking_config_id) REFERENCES site_tracking_configs(id) ON DELETE CASCADE;
ALTER TABLE public.site_sessions ADD CONSTRAINT site_sessions_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES site_visitors(id) ON DELETE CASCADE;
ALTER TABLE public.site_tracking_configs ADD CONSTRAINT site_tracking_configs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.site_visitors ADD CONSTRAINT site_visitors_client_id_ref_fkey FOREIGN KEY (client_id_ref) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.site_visitors ADD CONSTRAINT site_visitors_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.site_visitors ADD CONSTRAINT site_visitors_tracking_config_id_fkey FOREIGN KEY (tracking_config_id) REFERENCES site_tracking_configs(id) ON DELETE CASCADE;
ALTER TABLE public.social_comments ADD CONSTRAINT social_comments_page_id_fkey FOREIGN KEY (page_id) REFERENCES social_pages(id) ON DELETE CASCADE;
ALTER TABLE public.social_gantt_posts ADD CONSTRAINT social_gantt_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.social_media_channels ADD CONSTRAINT social_media_channels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.social_media_post_channels ADD CONSTRAINT social_media_post_channels_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES social_media_channels(id) ON DELETE CASCADE;
ALTER TABLE public.social_media_post_channels ADD CONSTRAINT social_media_post_channels_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_media_posts(id) ON DELETE CASCADE;
ALTER TABLE public.social_media_posts ADD CONSTRAINT social_media_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.social_media_wordpress_sites ADD CONSTRAINT social_media_wordpress_sites_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.social_media_wordpress_sites ADD CONSTRAINT social_media_wordpress_sites_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.social_media_wordpress_sites ADD CONSTRAINT social_media_wordpress_sites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.social_publications ADD CONSTRAINT social_publications_page_id_fkey FOREIGN KEY (page_id) REFERENCES social_pages(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_agency_id_1_fkey FOREIGN KEY (agency_id_1) REFERENCES agencies(id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_agency_id_2_fkey FOREIGN KEY (agency_id_2) REFERENCES agencies(id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_agency_id_3_fkey FOREIGN KEY (agency_id_3) REFERENCES agencies(id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_related_campaigner_id_fkey FOREIGN KEY (related_campaigner_id) REFERENCES campaigners(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sync_jobs ADD CONSTRAINT sync_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.table_shares ADD CONSTRAINT table_shares_table_id_fkey FOREIGN KEY (table_id) REFERENCES crm_tables(id) ON DELETE CASCADE;
ALTER TABLE public.table_shares ADD CONSTRAINT table_shares_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE CASCADE;
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_collaborators ADD CONSTRAINT task_collaborators_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.task_updates ADD CONSTRAINT task_updates_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_updates ADD CONSTRAINT task_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES sales_people(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_categories ADD CONSTRAINT team_channel_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_invites ADD CONSTRAINT team_channel_invites_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_invites ADD CONSTRAINT team_channel_invites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_members ADD CONSTRAINT team_channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_members ADD CONSTRAINT team_channel_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_channel_whatsapp_links ADD CONSTRAINT team_channel_whatsapp_links_whatsapp_group_id_fkey FOREIGN KEY (whatsapp_group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_category_id_fkey FOREIGN KEY (category_id) REFERENCES team_channel_categories(id) ON DELETE SET NULL;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_linked_client_id_fkey FOREIGN KEY (linked_client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_linked_lead_id_fkey FOREIGN KEY (linked_lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_message_id_fkey FOREIGN KEY (message_id) REFERENCES team_messages(id) ON DELETE SET NULL;
ALTER TABLE public.team_chat_files ADD CONSTRAINT team_chat_files_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.team_message_attachments ADD CONSTRAINT team_message_attachments_linked_client_id_fkey FOREIGN KEY (linked_client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.team_message_attachments ADD CONSTRAINT team_message_attachments_linked_lead_id_fkey FOREIGN KEY (linked_lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.team_message_attachments ADD CONSTRAINT team_message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES team_messages(id) ON DELETE CASCADE;
ALTER TABLE public.team_message_reactions ADD CONSTRAINT team_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES team_messages(id) ON DELETE CASCADE;
ALTER TABLE public.team_message_read_status ADD CONSTRAINT team_message_read_status_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_message_read_status ADD CONSTRAINT team_message_read_status_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES team_messages(id) ON DELETE SET NULL;
ALTER TABLE public.team_messages ADD CONSTRAINT team_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES team_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_messages ADD CONSTRAINT team_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES team_messages(id) ON DELETE SET NULL;
ALTER TABLE public.team_messages ADD CONSTRAINT team_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_bot_state ADD CONSTRAINT telegram_bot_state_shared_from_state_id_fkey FOREIGN KEY (shared_from_state_id) REFERENCES telegram_bot_state(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_bot_state ADD CONSTRAINT telegram_bot_state_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);
ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.telephony_settings ADD CONSTRAINT telephony_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_heartbeat_settings ADD CONSTRAINT tenant_heartbeat_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_integrations ADD CONSTRAINT tenant_integrations_shared_from_integration_id_fkey FOREIGN KEY (shared_from_integration_id) REFERENCES tenant_integrations(id) ON DELETE SET NULL;
ALTER TABLE public.tenant_integrations ADD CONSTRAINT tenant_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_rate_limits ADD CONSTRAINT tenant_rate_limits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_templates ADD CONSTRAINT tenant_templates_source_tenant_id_fkey FOREIGN KEY (source_tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_terminology ADD CONSTRAINT tenant_terminology_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_parent_tenant_id_fkey FOREIGN KEY (parent_tenant_id) REFERENCES tenants(id);
ALTER TABLE public.terminology_presets ADD CONSTRAINT terminology_presets_created_by_tenant_id_fkey FOREIGN KEY (created_by_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE public.terminology_presets ADD CONSTRAINT terminology_presets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_campaigner_id_fkey FOREIGN KEY (campaigner_id) REFERENCES campaigners(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.time_entry_breaks ADD CONSTRAINT time_entry_breaks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.time_entry_breaks ADD CONSTRAINT time_entry_breaks_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE;
ALTER TABLE public.user_active_tenant ADD CONSTRAINT user_active_tenant_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_managed_agencies ADD CONSTRAINT user_managed_agencies_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE public.user_managed_agencies ADD CONSTRAINT user_managed_agencies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_groups ADD CONSTRAINT whatsapp_groups_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_groups ADD CONSTRAINT whatsapp_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_customers ADD CONSTRAINT woocommerce_customers_site_id_fkey FOREIGN KEY (site_id) REFERENCES social_media_wordpress_sites(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_customers ADD CONSTRAINT woocommerce_customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_orders ADD CONSTRAINT woocommerce_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES social_media_wordpress_sites(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_orders ADD CONSTRAINT woocommerce_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_products ADD CONSTRAINT woocommerce_products_site_id_fkey FOREIGN KEY (site_id) REFERENCES social_media_wordpress_sites(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_products ADD CONSTRAINT woocommerce_products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_sync_log ADD CONSTRAINT woocommerce_sync_log_site_id_fkey FOREIGN KEY (site_id) REFERENCES social_media_wordpress_sites(id) ON DELETE CASCADE;
ALTER TABLE public.woocommerce_sync_log ADD CONSTRAINT woocommerce_sync_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public.zoom_recordings ADD CONSTRAINT zoom_recordings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.zoom_recordings ADD CONSTRAINT zoom_recordings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.zoom_recordings ADD CONSTRAINT zoom_recordings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ---------- INDEXES ----------
CREATE INDEX idx_agencies_tenant ON public.agencies USING btree (tenant_id);
CREATE INDEX idx_agency_tenant_access_accessing ON public.agency_tenant_access USING btree (accessing_tenant_id, agency_id);
CREATE INDEX idx_agency_tenant_access_source ON public.agency_tenant_access USING btree (source_tenant_id, agency_id);
CREATE INDEX idx_action_log_run ON public.agent_action_log USING btree (run_id);
CREATE INDEX idx_action_log_tenant_time ON public.agent_action_log USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_agent_action_log_run_step ON public.agent_action_log USING btree (run_id, step_index) WHERE (run_id IS NOT NULL);
CREATE INDEX idx_approval_pending ON public.agent_approval_queue USING btree (tenant_id, status, created_at DESC);
CREATE INDEX idx_eval_runs_eval ON public.agent_eval_runs USING btree (eval_id);
CREATE INDEX idx_evals_agent ON public.agent_evals USING btree (agent_id);
CREATE INDEX idx_agent_goals_agent ON public.agent_goals USING btree (agent_id);
CREATE INDEX idx_agent_goals_tenant ON public.agent_goals USING btree (tenant_id);
CREATE INDEX idx_akf_agent ON public.agent_knowledge_folders USING btree (agent_id);
CREATE INDEX idx_akf_parent ON public.agent_knowledge_folders USING btree (parent_folder_id);
CREATE INDEX idx_aki_agent ON public.agent_knowledge_items USING btree (agent_id);
CREATE INDEX idx_aki_embedding ON public.agent_knowledge_items USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_aki_folder ON public.agent_knowledge_items USING btree (folder_id);
CREATE INDEX idx_mcp_conn_agent ON public.agent_mcp_connections USING btree (agent_id);
CREATE INDEX idx_mcp_conn_tenant ON public.agent_mcp_connections USING btree (tenant_id);
CREATE INDEX idx_agent_memory_contact ON public.agent_memory USING btree (agent_id, contact_phone) WHERE (contact_phone IS NOT NULL);
CREATE INDEX idx_agent_memory_fts ON public.agent_memory USING gin (fts);
CREATE INDEX idx_agent_memory_type ON public.agent_memory USING btree (agent_id, memory_type);
CREATE INDEX idx_am_agent ON public.agent_memory USING btree (agent_id);
CREATE INDEX idx_am_embedding ON public.agent_memory USING hnsw (summary_embedding vector_cosine_ops);
CREATE INDEX idx_am_tenant_agent_category ON public.agent_memory USING btree (tenant_id, agent_id, category);
CREATE INDEX idx_agent_runs_agent ON public.agent_runs USING btree (agent_id, started_at DESC);
CREATE INDEX idx_agent_runs_approval ON public.agent_runs USING btree (pending_approval_id) WHERE (pending_approval_id IS NOT NULL);
CREATE INDEX idx_agent_runs_parent ON public.agent_runs USING btree (parent_run_id);
CREATE INDEX idx_agent_runs_tenant_status ON public.agent_runs USING btree (tenant_id, status, started_at DESC);
CREATE INDEX idx_agent_supervisors_supervisor ON public.agent_supervisors USING btree (supervisor_agent_id);
CREATE INDEX idx_agent_supervisors_tenant ON public.agent_supervisors USING btree (tenant_id);
CREATE INDEX idx_ahrefs_reports_client_id ON public.ahrefs_reports USING btree (client_id);
CREATE INDEX idx_ahrefs_reports_domain ON public.ahrefs_reports USING btree (domain);
CREATE INDEX idx_ahrefs_reports_report_type ON public.ahrefs_reports USING btree (report_type);
CREATE INDEX idx_ahrefs_reports_tenant_id ON public.ahrefs_reports USING btree (tenant_id);
CREATE UNIQUE INDEX idx_ahrefs_reports_unique_domain_date_type ON public.ahrefs_reports USING btree (domain, report_date, report_type) WHERE (report_date IS NOT NULL);
CREATE INDEX ai_skills_active_lookup_idx ON public.ai_skills USING btree (slug, scope, tenant_id, version) WHERE (is_active = true);
CREATE INDEX ai_skills_search_vector_idx ON public.ai_skills USING gin (search_vector);
CREATE UNIQUE INDEX ai_skills_slug_global_uniq ON public.ai_skills USING btree (slug) WHERE (scope = 'global'::text);
CREATE INDEX ai_skills_tenant_active_idx ON public.ai_skills USING btree (tenant_id, is_active);
CREATE INDEX idx_automation_executions_lookup ON public.automation_executions USING btree (execution_id, entity_id, trigger_type);
CREATE INDEX idx_automation_executions_tenant ON public.automation_executions USING btree (tenant_id, started_at);
CREATE INDEX idx_automation_flow_steps_automation_id ON public.automation_flow_steps USING btree (automation_id);
CREATE INDEX idx_automation_flow_steps_tenant_id ON public.automation_flow_steps USING btree (tenant_id);
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs USING btree (automation_id);
CREATE INDEX idx_automation_logs_triggered_at ON public.automation_logs USING btree (triggered_at DESC);
CREATE INDEX idx_ast_automation ON public.automation_shared_tenants USING btree (automation_id);
CREATE INDEX idx_ast_tenant ON public.automation_shared_tenants USING btree (tenant_id);
CREATE INDEX idx_automations_active ON public.automations USING btree (active);
CREATE INDEX idx_automations_source_automation_id ON public.automations USING btree (source_automation_id);
CREATE INDEX idx_automations_tenant_id ON public.automations USING btree (tenant_id);
CREATE INDEX idx_automations_trigger_type ON public.automations USING btree (trigger_type);
CREATE UNIQUE INDEX blocked_contacts_client_unique ON public.blocked_contacts USING btree (tenant_id, connection_user_id, client_id) WHERE (client_id IS NOT NULL);
CREATE UNIQUE INDEX blocked_contacts_group_unique ON public.blocked_contacts USING btree (tenant_id, connection_user_id, group_id) WHERE (group_id IS NOT NULL);
CREATE UNIQUE INDEX blocked_contacts_lead_unique ON public.blocked_contacts USING btree (tenant_id, connection_user_id, lead_id) WHERE (lead_id IS NOT NULL);
CREATE UNIQUE INDEX blocked_contacts_phone_unique ON public.blocked_contacts USING btree (tenant_id, connection_user_id, sender_phone) WHERE (sender_phone IS NOT NULL);
CREATE INDEX idx_calendar_shares_owner ON public.calendar_shares USING btree (owner_user_id);
CREATE INDEX idx_calendar_shares_shared_with ON public.calendar_shares USING btree (shared_with_user_id);
CREATE INDEX idx_calendar_shares_tenant ON public.calendar_shares USING btree (tenant_id);
CREATE INDEX idx_calendar_tokens_channel_id ON public.calendar_tokens USING btree (watch_channel_id);
CREATE INDEX idx_calendar_tokens_watch_expires ON public.calendar_tokens USING btree (watch_expires_at);
CREATE INDEX idx_call_logs_client ON public.call_logs USING btree (client_id);
CREATE INDEX idx_call_logs_lead ON public.call_logs USING btree (lead_id);
CREATE INDEX idx_call_logs_provider_call_id ON public.call_logs USING btree (provider_call_id) WHERE (provider_call_id IS NOT NULL);
CREATE INDEX idx_call_logs_tenant ON public.call_logs USING btree (tenant_id);
CREATE INDEX idx_call_logs_user ON public.call_logs USING btree (caller_user_id);
CREATE INDEX idx_campaign_alerts_open ON public.campaign_alerts USING btree (tenant_id, campaign_id, alert_type) WHERE ((acknowledged_at IS NULL) AND (resolved_at IS NULL));
CREATE INDEX idx_campaign_alerts_tenant ON public.campaign_alerts USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_cs_next_run ON public.campaign_schedules USING btree (next_run_at) WHERE (enabled = true);
CREATE INDEX idx_cs_tenant ON public.campaign_schedules USING btree (tenant_id);
CREATE INDEX idx_campaigner_agencies_agency ON public.campaigner_agencies USING btree (agency_id);
CREATE INDEX idx_campaigner_agencies_campaigner ON public.campaigner_agencies USING btree (campaigner_id);
CREATE INDEX carmen_memory_episodes_embedding_idx ON public.carmen_memory_episodes USING hnsw (summary_embedding vector_cosine_ops);
CREATE INDEX idx_carmen_episodes_session_ref ON public.carmen_memory_episodes USING btree (tenant_id, session_ref) WHERE (session_ref IS NOT NULL);
CREATE INDEX idx_cme_retention ON public.carmen_memory_episodes USING btree (tenant_id, retention_score);
CREATE INDEX idx_cme_session ON public.carmen_memory_episodes USING btree (tenant_id, session_ref);
CREATE INDEX idx_cme_tenant_date ON public.carmen_memory_episodes USING btree (tenant_id, ref_date DESC);
CREATE INDEX idx_cme_topic ON public.carmen_memory_episodes USING gin (topic_tags);
CREATE INDEX idx_cmo_tenant ON public.carmen_memory_outbox USING btree (tenant_id);
CREATE INDEX idx_cmo_unprocessed ON public.carmen_memory_outbox USING btree (created_at) WHERE (processed_at IS NULL);
CREATE INDEX carmen_memory_pointers_embedding_idx ON public.carmen_memory_pointers USING hnsw (summary_embedding vector_cosine_ops);
CREATE INDEX idx_cmp_active ON public.carmen_memory_pointers USING btree (tenant_id, path) WHERE (valid_until IS NULL);
CREATE INDEX idx_cmp_entity ON public.carmen_memory_pointers USING btree (entity_type, entity_id);
CREATE INDEX idx_cmp_metadata ON public.carmen_memory_pointers USING gin (metadata);
CREATE INDEX idx_cmp_refdate ON public.carmen_memory_pointers USING btree (tenant_id, ref_date DESC);
CREATE INDEX idx_cmp_tenant_cat ON public.carmen_memory_pointers USING btree (tenant_id, category, subcategory);
CREATE INDEX idx_cmp_tenant_path ON public.carmen_memory_pointers USING btree (tenant_id, path);
CREATE INDEX idx_carmen_sessions_last_message ON public.carmen_whatsapp_sessions USING btree (last_message_at);
CREATE INDEX idx_carmen_sessions_lookup ON public.carmen_whatsapp_sessions USING btree (tenant_id, chat_id, status);
CREATE INDEX idx_chat_contact_tags_lead_id ON public.chat_contact_tags USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_chat_contact_tags_tag ON public.chat_contact_tags USING btree (tag_id);
CREATE INDEX idx_chat_contact_tags_tenant_lead ON public.chat_contact_tags USING btree (tenant_id, lead_id);
CREATE INDEX idx_chat_contact_tags_user ON public.chat_contact_tags USING btree (user_id, tenant_id);
CREATE INDEX idx_chat_messages_client ON public.chat_messages USING btree (client_id);
CREATE INDEX idx_chat_messages_client_direction_read ON public.chat_messages USING btree (client_id, direction, read_at) WHERE (direction = 'inbound'::text);
CREATE INDEX idx_chat_messages_connection_user ON public.chat_messages USING btree (connection_user_id, tenant_id);
CREATE INDEX idx_chat_messages_connection_user_id ON public.chat_messages USING btree (connection_user_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages USING btree (created_at DESC);
CREATE INDEX idx_chat_messages_group ON public.chat_messages USING btree (group_id) WHERE (group_id IS NOT NULL);
CREATE INDEX idx_chat_messages_group_id ON public.chat_messages USING btree (group_id);
CREATE INDEX idx_chat_messages_is_blocked ON public.chat_messages USING btree (is_blocked);
CREATE INDEX idx_chat_messages_lead ON public.chat_messages USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_chat_messages_lead_direction_read ON public.chat_messages USING btree (lead_id, direction, read_at) WHERE ((direction = 'inbound'::text) AND (lead_id IS NOT NULL));
CREATE INDEX idx_chat_messages_lead_id ON public.chat_messages USING btree (lead_id);
CREATE INDEX idx_chat_messages_provider ON public.chat_messages USING btree (tenant_id, provider, created_at DESC);
CREATE INDEX idx_chat_messages_sender_phone ON public.chat_messages USING btree (sender_phone);
CREATE INDEX idx_chat_messages_tenant ON public.chat_messages USING btree (tenant_id);
CREATE INDEX idx_chat_messages_tenant_lead ON public.chat_messages USING btree (tenant_id, lead_id);
CREATE INDEX idx_chat_messages_tenant_sender ON public.chat_messages USING btree (tenant_id, sender_phone);
CREATE INDEX idx_chat_messages_unread ON public.chat_messages USING btree (read_at) WHERE (read_at IS NULL);
CREATE INDEX idx_chat_tags_tenant ON public.chat_tags USING btree (tenant_id);
CREATE INDEX idx_client_team_campaigner_client ON public.client_team USING btree (campaigner_id, client_id);
CREATE INDEX idx_client_tenant_financial_data_client_tenant ON public.client_tenant_financial_data USING btree (client_id, tenant_id);
CREATE INDEX idx_client_updates_client_id ON public.client_updates USING btree (client_id);
CREATE INDEX idx_client_updates_client_type ON public.client_updates USING btree (client_id, update_type);
CREATE INDEX idx_client_updates_tenant_id ON public.client_updates USING btree (tenant_id);
CREATE INDEX idx_client_updates_update_type ON public.client_updates USING btree (update_type);
CREATE INDEX idx_clients_agency_name ON public.clients USING btree (agency_id, name);
CREATE INDEX idx_clients_is_ecommerce ON public.clients USING btree (tenant_id, is_ecommerce) WHERE (is_ecommerce = true);
CREATE INDEX idx_clients_manychat_subscriber ON public.clients USING btree (manychat_subscriber_id);
CREATE INDEX idx_clients_phone ON public.clients USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX idx_clients_search ON public.clients USING btree (tenant_id, name, contact_name, phone) WHERE ((phone IS NOT NULL) OR (contact_name IS NOT NULL));
CREATE INDEX idx_clients_tenant ON public.clients USING btree (tenant_id);
CREATE INDEX idx_clients_tenant_agency ON public.clients USING btree (tenant_id, agency_id);
CREATE INDEX idx_clients_whatsapp_avatar ON public.clients USING btree (whatsapp_avatar_url) WHERE (whatsapp_avatar_url IS NOT NULL);
CREATE INDEX idx_communication_logs_client_tenant ON public.communication_logs USING btree (client_id, tenant_id, created_at DESC);
CREATE INDEX idx_crm_dashboards_client_id ON public.crm_dashboards USING btree (client_id);
CREATE INDEX idx_crm_dashboards_tenant_id ON public.crm_dashboards USING btree (tenant_id);
CREATE INDEX idx_crm_fields_table ON public.crm_fields USING btree (table_id);
CREATE INDEX idx_crm_records_agency ON public.crm_records USING btree (agency_id);
CREATE INDEX idx_crm_records_data ON public.crm_records USING gin (data);
CREATE INDEX idx_crm_records_table ON public.crm_records USING btree (table_id);
CREATE INDEX idx_crm_records_table_id ON public.crm_records USING btree (table_id);
CREATE INDEX idx_crm_records_tenant ON public.crm_records USING btree (tenant_id);
CREATE INDEX idx_crm_tables_agency_id ON public.crm_tables USING btree (agency_id);
CREATE INDEX idx_crm_tables_client_id ON public.crm_tables USING btree (client_id);
CREATE INDEX idx_crm_tables_tenant ON public.crm_tables USING btree (tenant_id);
CREATE INDEX idx_dashboard_shares_dashboard ON public.dashboard_shares USING btree (dashboard_id);
CREATE INDEX idx_dashboard_shares_token ON public.dashboard_shares USING btree (share_token);
CREATE INDEX idx_expense_payments_expense ON public.expense_payments USING btree (expense_type, expense_id);
CREATE INDEX idx_expense_payments_tenant_month ON public.expense_payments USING btree (tenant_id, payment_month);
CREATE INDEX idx_finance_agency_date ON public.finance USING btree (agency_id, date);
CREATE INDEX idx_finance_client_date ON public.finance USING btree (client_id, date);
CREATE INDEX idx_finance_date ON public.finance USING btree (date);
CREATE INDEX idx_finance_supplier_date ON public.finance USING btree (supplier_id, date);
CREATE INDEX idx_flow_processed_leads_automation ON public.flow_processed_leads USING btree (automation_id, leadgen_id);
CREATE INDEX idx_hidden_chats_client ON public.hidden_chats USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX idx_hidden_chats_group ON public.hidden_chats USING btree (group_id) WHERE (group_id IS NOT NULL);
CREATE INDEX idx_hidden_chats_lead ON public.hidden_chats USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_hidden_chats_phone ON public.hidden_chats USING btree (sender_phone) WHERE (sender_phone IS NOT NULL);
CREATE INDEX idx_hidden_chats_user_tenant ON public.hidden_chats USING btree (user_id, tenant_id);
CREATE INDEX idx_import_history_imported_at ON public.import_history USING btree (imported_at DESC);
CREATE INDEX idx_import_history_tenant_id ON public.import_history USING btree (tenant_id);
CREATE INDEX idx_income_payments_client ON public.income_payments USING btree (client_id);
CREATE INDEX idx_income_payments_tenant_month ON public.income_payments USING btree (tenant_id, payment_month);
CREATE INDEX idx_integration_alerts_log_lookup ON public.integration_alerts_log USING btree (tenant_id, provider, account_id, alert_type, fired_at DESC);
CREATE INDEX idx_integration_tenant_access_integration ON public.integration_tenant_access USING btree (integration_id);
CREATE INDEX idx_integration_tenant_access_tenant ON public.integration_tenant_access USING btree (accessing_tenant_id);
CREATE INDEX idx_integration_user_permissions_integration_id ON public.integration_user_permissions USING btree (integration_id);
CREATE INDEX idx_integration_user_permissions_user_id ON public.integration_user_permissions USING btree (user_id);
CREATE INDEX idx_invoice_uploads_status ON public.invoice_uploads USING btree (tenant_id, status);
CREATE INDEX idx_invoice_uploads_tenant ON public.invoice_uploads USING btree (tenant_id);
CREATE INDEX idx_job_queue_locked ON public.job_queue USING btree (locked_until) WHERE (status = 'running'::job_status);
CREATE INDEX idx_job_queue_status_priority ON public.job_queue USING btree (status, priority, created_at) WHERE (status = 'queued'::job_status);
CREATE INDEX idx_job_queue_tenant ON public.job_queue USING btree (tenant_id, status);
CREATE INDEX idx_lead_filter_presets_user_tenant ON public.lead_filter_presets USING btree (user_id, tenant_id);
CREATE INDEX idx_lead_sales_people_lead_id ON public.lead_sales_people USING btree (lead_id);
CREATE INDEX idx_lead_sales_people_sales_person_id ON public.lead_sales_people USING btree (sales_person_id);
CREATE INDEX idx_lead_sales_people_tenant_id ON public.lead_sales_people USING btree (tenant_id);
CREATE INDEX idx_lead_updates_lead_id ON public.lead_updates USING btree (lead_id);
CREATE INDEX idx_lead_updates_user_id ON public.lead_updates USING btree (user_id);
CREATE INDEX idx_leads_agency ON public.leads USING btree (agency_id);
CREATE INDEX idx_leads_agency_company ON public.leads USING btree (agency_id, company_name);
CREATE INDEX idx_leads_agency_id ON public.leads USING btree (agency_id);
CREATE INDEX idx_leads_follow_up_date ON public.leads USING btree (follow_up_date);
CREATE INDEX idx_leads_manychat_subscriber ON public.leads USING btree (manychat_subscriber_id);
CREATE INDEX idx_leads_meeting_date ON public.leads USING btree (meeting_date) WHERE (meeting_date IS NOT NULL);
CREATE INDEX idx_leads_meeting_set_date ON public.leads USING btree (meeting_set_date) WHERE (meeting_set_date IS NOT NULL);
CREATE INDEX idx_leads_phone ON public.leads USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX idx_leads_response_status ON public.leads USING btree (response_status);
CREATE INDEX idx_leads_sales_person ON public.leads USING btree (sales_person_id);
CREATE INDEX idx_leads_sales_person_id ON public.leads USING btree (sales_person_id);
CREATE INDEX idx_leads_search ON public.leads USING btree (tenant_id, company_name, contact_name, phone) WHERE ((phone IS NOT NULL) OR (contact_name IS NOT NULL));
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_leads_tenant_agency ON public.leads USING btree (tenant_id, agency_id);
CREATE INDEX idx_leads_tenant_created ON public.leads USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_leads_tenant_status ON public.leads USING btree (tenant_id, status);
CREATE INDEX idx_leads_whatsapp_avatar ON public.leads USING btree (whatsapp_avatar_url) WHERE (whatsapp_avatar_url IS NOT NULL);
CREATE INDEX idx_manually_read_contacts_client ON public.manually_read_contacts USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX idx_manually_read_contacts_group ON public.manually_read_contacts USING btree (group_id) WHERE (group_id IS NOT NULL);
CREATE INDEX idx_manually_read_contacts_lead ON public.manually_read_contacts USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_manually_read_contacts_sender_phone ON public.manually_read_contacts USING btree (sender_phone) WHERE (sender_phone IS NOT NULL);
CREATE INDEX idx_manually_read_contacts_user_tenant ON public.manually_read_contacts USING btree (user_id, tenant_id);
CREATE INDEX idx_manus_tasks_task_id ON public.manus_tasks USING btree (task_id);
CREATE INDEX idx_manus_tasks_tenant_id ON public.manus_tasks USING btree (tenant_id);
CREATE INDEX idx_marketing_assets_item ON public.marketing_assets USING btree (item_id, created_at DESC);
CREATE INDEX idx_mkt_transitions_item ON public.marketing_item_transitions USING btree (item_id);
CREATE INDEX idx_mml_client ON public.marketing_media_library USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX idx_mml_lead ON public.marketing_media_library USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_mml_tags ON public.marketing_media_library USING gin (tags);
CREATE INDEX idx_mml_tenant ON public.marketing_media_library USING btree (tenant_id);
CREATE INDEX idx_mkt_stages_pipeline ON public.marketing_pipeline_stages USING btree (pipeline_id);
CREATE INDEX idx_marketing_runs_item ON public.marketing_runs USING btree (item_id, created_at DESC);
CREATE INDEX idx_marketing_runs_tenant_created ON public.marketing_runs USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_marketing_triggers_active ON public.marketing_triggers USING btree (is_active, next_run_at);
CREATE INDEX idx_mkt_items_pipeline ON public.marketing_work_items USING btree (pipeline_id);
CREATE INDEX idx_mkt_items_stage ON public.marketing_work_items USING btree (current_stage_id);
CREATE INDEX idx_maskyoo_overrides_lookup ON public.maskyoo_manual_overrides USING btree (tenant_id, maskyoo_last9, period_days);
CREATE INDEX idx_maskyoo_numbers_client ON public.maskyoo_numbers USING btree (client_id);
CREATE INDEX idx_maskyoo_numbers_tenant ON public.maskyoo_numbers USING btree (tenant_id);
CREATE INDEX idx_one_time_incomes_tenant_month ON public.one_time_incomes USING btree (tenant_id, payment_month);
CREATE INDEX idx_payment_links_client_id ON public.payment_links USING btree (client_id);
CREATE INDEX idx_payment_links_status ON public.payment_links USING btree (status);
CREATE INDEX idx_payment_links_tenant_id ON public.payment_links USING btree (tenant_id);
CREATE INDEX idx_processed_events_cleanup ON public.processed_events USING btree (processed_at);
CREATE INDEX idx_processed_webhook_messages_processed_at ON public.processed_webhook_messages USING btree (processed_at);
CREATE INDEX idx_products_agency_id ON public.products USING btree (agency_id);
CREATE INDEX idx_profiles_campaigner ON public.profiles USING btree (campaigner_id) WHERE (campaigner_id IS NOT NULL);
CREATE INDEX idx_profiles_sales_person ON public.profiles USING btree (sales_person_id) WHERE (sales_person_id IS NOT NULL);
CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);
CREATE INDEX idx_rank_alerts_project ON public.rank_tracking_alerts USING btree (project_id);
CREATE INDEX idx_rank_competitors_project ON public.rank_tracking_competitors USING btree (project_id);
CREATE INDEX idx_rank_history_checked_at ON public.rank_tracking_history USING btree (checked_at DESC);
CREATE INDEX idx_rank_history_keyword ON public.rank_tracking_history USING btree (keyword_id);
CREATE INDEX idx_rank_keywords_project ON public.rank_tracking_keywords USING btree (project_id);
CREATE INDEX idx_rank_projects_client ON public.rank_tracking_projects USING btree (client_id);
CREATE INDEX idx_rank_projects_tenant ON public.rank_tracking_projects USING btree (tenant_id);
CREATE INDEX idx_report_alerts_tenant_table ON public.report_alerts USING btree (tenant_id, table_id);
CREATE INDEX idx_sales_people_agency ON public.sales_people USING btree (agency_id);
CREATE INDEX idx_seo_call_snapshots_lookup ON public.seo_call_snapshots USING btree (tenant_id, client_id, category);
CREATE INDEX idx_seo_monthly_updates_client ON public.seo_monthly_updates USING btree (client_id, month DESC);
CREATE INDEX idx_site_events_name ON public.site_events USING btree (event_name);
CREATE INDEX idx_site_events_occurred_at ON public.site_events USING btree (occurred_at);
CREATE INDEX idx_site_events_session ON public.site_events USING btree (session_id);
CREATE INDEX idx_site_events_tenant ON public.site_events USING btree (tenant_id);
CREATE INDEX idx_site_events_visitor ON public.site_events USING btree (visitor_id);
CREATE INDEX idx_site_pageviews_session ON public.site_pageviews USING btree (session_id);
CREATE INDEX idx_site_pageviews_tenant ON public.site_pageviews USING btree (tenant_id);
CREATE INDEX idx_site_pageviews_viewed_at ON public.site_pageviews USING btree (viewed_at);
CREATE INDEX idx_site_pageviews_visitor ON public.site_pageviews USING btree (visitor_id);
CREATE INDEX idx_site_sessions_started_at ON public.site_sessions USING btree (started_at);
CREATE INDEX idx_site_sessions_tenant ON public.site_sessions USING btree (tenant_id);
CREATE INDEX idx_site_sessions_tracking_config ON public.site_sessions USING btree (tracking_config_id);
CREATE INDEX idx_site_sessions_visitor ON public.site_sessions USING btree (visitor_id);
CREATE INDEX idx_site_tracking_configs_client ON public.site_tracking_configs USING btree (client_id);
CREATE INDEX idx_site_tracking_configs_tenant ON public.site_tracking_configs USING btree (tenant_id);
CREATE INDEX idx_site_tracking_configs_tracking_id ON public.site_tracking_configs USING btree (tracking_id);
CREATE INDEX idx_site_visitors_fingerprint ON public.site_visitors USING btree (visitor_fingerprint);
CREATE INDEX idx_site_visitors_lead ON public.site_visitors USING btree (lead_id);
CREATE INDEX idx_site_visitors_tenant ON public.site_visitors USING btree (tenant_id);
CREATE INDEX idx_site_visitors_tracking_config ON public.site_visitors USING btree (tracking_config_id);
CREATE INDEX idx_social_comments_tenant_open ON public.social_comments USING btree (tenant_id, replied_at, created_at DESC);
CREATE INDEX idx_social_gantt_posts_date ON public.social_gantt_posts USING btree (scheduled_date);
CREATE INDEX idx_social_gantt_posts_status ON public.social_gantt_posts USING btree (status);
CREATE INDEX idx_social_gantt_posts_tenant ON public.social_gantt_posts USING btree (tenant_id);
CREATE INDEX idx_smws_client_id ON public.social_media_wordpress_sites USING btree (client_id);
CREATE INDEX idx_smws_tenant_id ON public.social_media_wordpress_sites USING btree (tenant_id);
CREATE INDEX idx_social_media_wordpress_sites_agency_id ON public.social_media_wordpress_sites USING btree (agency_id);
CREATE INDEX idx_social_pages_client ON public.social_pages USING btree (client_id);
CREATE INDEX idx_social_pages_tenant ON public.social_pages USING btree (tenant_id);
CREATE INDEX idx_social_pub_tenant ON public.social_publications USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_sync_jobs_created_at ON public.sync_jobs USING btree (created_at DESC);
CREATE INDEX idx_sync_jobs_tenant_status ON public.sync_jobs USING btree (tenant_id, status);
CREATE INDEX idx_task_collaborators_campaigner_id ON public.task_collaborators USING btree (campaigner_id);
CREATE INDEX idx_task_collaborators_task_id ON public.task_collaborators USING btree (task_id);
CREATE INDEX idx_task_collaborators_tenant_id ON public.task_collaborators USING btree (tenant_id);
CREATE INDEX idx_task_updates_created_at ON public.task_updates USING btree (created_at DESC);
CREATE INDEX idx_task_updates_task_id ON public.task_updates USING btree (task_id);
CREATE INDEX idx_tasks_campaigner ON public.tasks USING btree (campaigner_id);
CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date);
CREATE INDEX idx_tasks_google_calendar_event_id ON public.tasks USING btree (google_calendar_event_id);
CREATE INDEX idx_tasks_lead_id ON public.tasks USING btree (lead_id);
CREATE INDEX idx_tasks_sales_person_id ON public.tasks USING btree (sales_person_id);
CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX idx_tasks_tenant_status ON public.tasks USING btree (tenant_id, status);
CREATE INDEX idx_telegram_bot_state_shared_from ON public.telegram_bot_state USING btree (shared_from_state_id) WHERE (shared_from_state_id IS NOT NULL);
CREATE UNIQUE INDEX telegram_bot_state_tenant_primary_unique ON public.telegram_bot_state USING btree (tenant_id) WHERE (shared_from_state_id IS NULL);
CREATE UNIQUE INDEX telegram_bot_state_tenant_shared_unique ON public.telegram_bot_state USING btree (tenant_id, shared_from_state_id) WHERE (shared_from_state_id IS NOT NULL);
CREATE INDEX idx_telegram_messages_created ON public.telegram_messages USING btree (created_at DESC);
CREATE INDEX idx_telegram_messages_tenant_chat ON public.telegram_messages USING btree (tenant_id, chat_id);
CREATE INDEX idx_telephony_settings_tenant ON public.telephony_settings USING btree (tenant_id);
CREATE INDEX idx_tenant_integrations_instance ON public.tenant_integrations USING btree (instance_id) WHERE (instance_id IS NOT NULL);
CREATE INDEX idx_tenant_integrations_instance_id ON public.tenant_integrations USING btree (instance_id) WHERE (integration_type = 'green_api'::text);
CREATE INDEX idx_tenant_integrations_shared_from ON public.tenant_integrations USING btree (shared_from_integration_id) WHERE (shared_from_integration_id IS NOT NULL);
CREATE INDEX idx_tenant_integrations_tenant_type_active ON public.tenant_integrations USING btree (tenant_id, integration_type, is_active);
CREATE INDEX idx_tenant_integrations_user_id ON public.tenant_integrations USING btree (user_id);
CREATE UNIQUE INDEX tenant_integrations_org_level_unique ON public.tenant_integrations USING btree (tenant_id, integration_type) WHERE (user_id IS NULL);
CREATE UNIQUE INDEX tenant_integrations_user_level_unique ON public.tenant_integrations USING btree (tenant_id, integration_type, user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_tenant_users_tenant ON public.tenant_users USING btree (tenant_id);
CREATE INDEX idx_tenant_users_user_tenant ON public.tenant_users USING btree (user_id, tenant_id);
CREATE INDEX idx_tenants_org_type ON public.tenants USING btree (org_type);
CREATE INDEX idx_tenants_parent_id ON public.tenants USING btree (parent_tenant_id);
CREATE INDEX idx_tenants_parent_tenant_id ON public.tenants USING btree (parent_tenant_id);
CREATE UNIQUE INDEX tenants_slug_unique ON public.tenants USING btree (slug);
CREATE INDEX idx_terminology_presets_public ON public.terminology_presets USING btree (is_public) WHERE (is_public = true);
CREATE INDEX idx_terminology_presets_tenant ON public.terminology_presets USING btree (created_by_tenant_id);
CREATE INDEX idx_time_entry_breaks_tenant_id ON public.time_entry_breaks USING btree (tenant_id);
CREATE INDEX idx_time_entry_breaks_time_entry_id ON public.time_entry_breaks USING btree (time_entry_id);
CREATE INDEX idx_user_active_tenant_user ON public.user_active_tenant USING btree (user_id);
CREATE INDEX idx_user_roles_user_role ON public.user_roles USING btree (user_id, role);
CREATE INDEX idx_user_roles_user_tenant ON public.user_roles USING btree (user_id, tenant_id);
CREATE INDEX idx_whatsapp_groups_chat_id ON public.whatsapp_groups USING btree (group_chat_id);
CREATE INDEX idx_whatsapp_groups_search ON public.whatsapp_groups USING btree (tenant_id, group_name);
CREATE INDEX idx_whatsapp_groups_tenant_id ON public.whatsapp_groups USING btree (tenant_id);
CREATE INDEX idx_whatsapp_sessions_lookup ON public.whatsapp_sessions USING btree (tenant_id, chat_id, status);
CREATE INDEX idx_woo_customers_site ON public.woocommerce_customers USING btree (site_id);
CREATE INDEX idx_woo_orders_date ON public.woocommerce_orders USING btree (date_created DESC);
CREATE INDEX idx_woo_orders_site ON public.woocommerce_orders USING btree (site_id);
CREATE INDEX idx_woo_orders_tenant ON public.woocommerce_orders USING btree (tenant_id);
CREATE INDEX idx_woo_products_site ON public.woocommerce_products USING btree (site_id);
CREATE INDEX idx_woo_sync_log_site ON public.woocommerce_sync_log USING btree (site_id, started_at DESC);
CREATE INDEX idx_zoom_recordings_meeting_id ON public.zoom_recordings USING btree (meeting_id);
CREATE INDEX idx_zoom_recordings_tenant_id ON public.zoom_recordings USING btree (tenant_id);
CREATE UNIQUE INDEX zoom_recordings_tenant_meeting_type_unique ON public.zoom_recordings USING btree (tenant_id, meeting_id, recording_type);

-- ---------- FUNCTIONS ----------
CREATE OR REPLACE FUNCTION public.agent_memory_fts_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.fts := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,''));
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.ai_skills_update_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.search_vector :=
    to_tsvector('simple',
      coalesce(NEW.name,'') || ' ' ||
      coalesce(NEW.description,'') || ' ' ||
      coalesce(array_to_string(NEW.trigger_phrases, ' '), '')
    );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_role_by_email(_email text, _role app_role)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bump_ai_skill_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.system_prompt IS DISTINCT FROM OLD.system_prompt
    OR NEW.output_template IS DISTINCT FROM OLD.output_template
    OR NEW.allowed_tools IS DISTINCT FROM OLD.allowed_tools
    OR NEW.triggers IS DISTINCT FROM OLD.triggers
    OR NEW.steps IS DISTINCT FROM OLD.steps
  ) THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_agency(_user_id uuid, _agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- Super admin
    is_super_admin(_user_id)
    OR
    -- Agency is in user's tenant
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = _agency_id
      AND a.tenant_id = get_user_tenant_id(_user_id)
    )
    OR
    -- Agency is shared with user's tenant
    EXISTS (
      SELECT 1 FROM agency_tenant_access ata
      WHERE ata.agency_id = _agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(_user_id)
    )
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_user_permissions(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Super admins can manage anyone's permissions
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- Owners can manage permissions within their tenants
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
  -- Users can manage their own permissions
  target_user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_cross_tenant_campaigner(_campaigner_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigner_agencies ca
    JOIN public.agency_tenant_access ata ON ata.agency_id = ca.agency_id
    WHERE ca.campaigner_id = _campaigner_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.carmen_memory_decay_episodes(p_lambda double precision DEFAULT 0.02)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.carmen_outbox_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_circuit_breaker(p_tenant_id uuid, p_provider text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.check_idempotency(p_tenant_id uuid, p_event_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO processed_events (tenant_id, event_key)
  VALUES (p_tenant_id, p_event_key) ON CONFLICT (event_key) DO NOTHING;
  RETURN FOUND;
END; $function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_tenant_id uuid, p_resource_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_tenant_id uuid, p_resource_type text, p_default_max integer DEFAULT 300)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.claim_next_job(p_job_types text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, tenant_id uuid, job_type text, priority integer, payload jsonb, attempts integer, max_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_events()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM processed_events WHERE processed_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM job_queue WHERE status IN ('done', 'dead_letter') AND finished_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_user_active_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If user was removed from their active tenant, clean it up
  IF EXISTS (
    SELECT 1 FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id
  ) THEN
    -- Delete the active tenant record
    DELETE FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id;
  END IF;
  
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid, p_success boolean, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.copy_custom_fields_to_tenant(_source_tenant_id uuid, _target_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Copy all custom fields from source tenant to target tenant
  -- Only insert if they don't already exist
  INSERT INTO public.custom_fields (
    tenant_id,
    entity_type,
    field_key,
    field_label,
    field_type,
    is_required,
    is_visible,
    options,
    sort_order
  )
  SELECT
    _target_tenant_id,
    entity_type,
    field_key,
    field_label,
    field_type,
    is_required,
    is_visible,
    options,
    sort_order
  FROM public.custom_fields
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, entity_type, field_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.copy_tenant_template(_source_tenant_id uuid, _target_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Copy custom_fields
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

  -- Copy menu_items
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

  -- Copy tenant_terminology
  INSERT INTO public.tenant_terminology (
    tenant_id, term_key, custom_value
  )
  SELECT
    _target_tenant_id, term_key, custom_value
  FROM public.tenant_terminology
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, term_key) DO NOTHING;

  -- Copy lead_pipeline_stages
  INSERT INTO public.lead_pipeline_stages (
    tenant_id, stage_key, label, color, sort_order, is_active
  )
  SELECT
    _target_tenant_id, stage_key, label, color, sort_order, is_active
  FROM public.lead_pipeline_stages
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;

  -- Copy lead_statuses
  INSERT INTO public.lead_statuses (
    tenant_id, status_key, label, color, sort_order, is_active
  )
  SELECT
    _target_tenant_id, status_key, label, color, sort_order, is_active
  FROM public.lead_statuses
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, status_key) DO NOTHING;

  -- Copy tenant_settings
  INSERT INTO public.tenant_settings (
    tenant_id, setting_key, setting_value
  )
  SELECT
    _target_tenant_id, setting_key, setting_value
  FROM public.tenant_settings
  WHERE tenant_id = _source_tenant_id
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- Copy automations (without tenant-specific references)
  INSERT INTO public.automations (
    tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  )
  SELECT
    _target_tenant_id, name, description, trigger_type, action_type,
    configuration, conditions, active
  FROM public.automations
  WHERE tenant_id = _source_tenant_id;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.count_leads_by_tags(p_tenant_id uuid, p_tag_ids uuid[], p_agency_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT l.id)::INTEGER
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND (
      l.tenant_id = p_tenant_id 
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.create_client_with_assignment(p_tenant_id uuid, p_agency_id uuid, p_name text, p_contact_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_folder_link text DEFAULT NULL::text, p_retainer numeric DEFAULT NULL::numeric, p_monthly_budget numeric DEFAULT NULL::numeric, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_is_seo_client boolean DEFAULT false, p_services text[] DEFAULT ARRAY[]::text[], p_meta_ads_account_id text DEFAULT NULL::text, p_google_ads_account_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_campaigner_id uuid;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization: super_admin OR (tenant match AND has one of the allowed roles)
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

  -- Verify the agency belongs to the tenant (or is shared into it)
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
    p_retainer, p_monthly_budget, p_website, p_notes, p_is_seo_client, p_services,
    p_meta_ads_account_id, p_google_ads_account_id
  ) RETURNING id INTO v_client_id;

  -- Auto-assign creator as a team member if they are a campaigner.
  -- Owners/team_managers don't need this — their SELECT policy already covers all
  -- clients in the tenant / managed agencies.
  v_campaigner_id := public.get_user_campaigner_id(v_user_id);
  IF v_campaigner_id IS NOT NULL THEN
    INSERT INTO public.client_team (client_id, campaigner_id)
    VALUES (v_client_id, v_campaigner_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_client_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decline_signature_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF _token IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  UPDATE public.signature_recipients
  SET status = 'declined'
  WHERE sign_token = _token AND status = 'pending'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not_found_or_already_processed'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_job(p_tenant_id uuid, p_job_type text, p_priority integer DEFAULT 5, p_payload jsonb DEFAULT '{}'::jsonb, p_max_attempts integer DEFAULT 3)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_agency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE agencies SET is_default = false 
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_campaign_tables(p_client_ids uuid[])
 RETURNS TABLE(table_id uuid, client_id uuid, slug text, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ct.id, ct.client_id, ct.slug, ct.name
  FROM public.crm_tables ct
  WHERE ct.client_id = ANY(p_client_ids)
    AND EXISTS (
      SELECT 1 FROM public.crm_records r
      WHERE r.table_id = ct.id
        AND r.data ? 'spend'
        AND (r.data ? 'campaign_name' OR r.data ? 'campaign_id')
      LIMIT 1
    );
$function$
;

CREATE OR REPLACE FUNCTION public.generate_tracking_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_channel_invite_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_contacts(p_tenant_id uuid, p_connection_user_ids uuid[], p_provider chat_provider)
 RETURNS TABLE(contact_id uuid, contact_type text, name text, contact_name text, phone text, email text, agency_id uuid, agency_name text, unread_count bigint, last_message_at timestamp with time zone, is_blocked boolean, manychat_subscriber_id text, active_chat_provider chat_provider, whatsapp_avatar_url text, sender_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  user_ids uuid[];
BEGIN
  current_tenant_id := COALESCE(p_tenant_id, public.get_user_tenant_id(auth.uid()));
  current_user_id := auth.uid();

  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  user_ids := COALESCE(p_connection_user_ids, ARRAY[current_user_id]);

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
$function$
;

CREATE OR REPLACE FUNCTION public.get_client_tenant_id(_client_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.clients
  WHERE id = _client_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_cron_job_history(p_jobid bigint, p_limit integer DEFAULT 50)
 RETURNS TABLE(runid bigint, start_time timestamp with time zone, end_time timestamp with time zone, status text, return_message text, duration_ms bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY SELECT d.runid, d.start_time, d.end_time, d.status, d.return_message,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000
  FROM cron.job_run_details d WHERE d.jobid = p_jobid ORDER BY d.start_time DESC LIMIT p_limit;
END; $function$
;

CREATE OR REPLACE FUNCTION public.get_cross_tenant_campaigner_ids(p_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY_AGG(DISTINCT campaigner_id) FROM (
    -- Campaigners associated with clients in agencies the user manages
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
    
    -- Campaigners directly associated with agencies the user manages
    SELECT ca.campaigner_id
    FROM campaigner_agencies ca
    WHERE user_manages_agency(p_user_id, ca.agency_id)
  ) AS all_campaigners
$function$
;

CREATE OR REPLACE FUNCTION public.get_effective_setting(_tenant_id uuid, _setting_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT setting_value FROM public.tenant_settings 
     WHERE tenant_id = _tenant_id AND setting_key = _setting_key),
    (SELECT setting_value FROM public.global_settings 
     WHERE setting_key = _setting_key)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.get_effective_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_active_tenant WHERE user_id = auth.uid() LIMIT 1),
    (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_lead_visitor_journey(p_lead_id uuid)
 RETURNS TABLE(session_id uuid, started_at timestamp with time zone, duration_seconds integer, page_count integer, utm_source text, utm_medium text, utm_campaign text, referrer text, landing_page text, device_type text, pages jsonb, events jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.started_at,
    s.duration_seconds,
    s.page_count,
    s.utm_source,
    s.utm_medium,
    s.utm_campaign,
    s.referrer,
    s.landing_page,
    s.device_type,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'url', pv.page_url,
        'title', pv.page_title,
        'time_on_page', pv.time_on_page,
        'scroll_depth', pv.scroll_depth,
        'viewed_at', pv.viewed_at
      ) ORDER BY pv.viewed_at)
      FROM site_pageviews pv WHERE pv.session_id = s.id),
      '[]'::jsonb
    ) as pages,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'name', e.event_name,
        'category', e.event_category,
        'label', e.event_label,
        'data', e.event_data,
        'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at)
      FROM site_events e WHERE e.session_id = s.id),
      '[]'::jsonb
    ) as events
  FROM site_sessions s
  JOIN site_visitors v ON s.visitor_id = v.id
  WHERE v.lead_id = p_lead_id
  ORDER BY s.started_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_leads_by_stages(p_tenant_id uuid, p_agency_ids uuid[] DEFAULT NULL::uuid[], p_stages text[] DEFAULT NULL::text[], p_limit_per_stage integer DEFAULT 50, p_search_query text DEFAULT NULL::text, p_from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sales_person_ids uuid[] DEFAULT NULL::uuid[], p_response_statuses text[] DEFAULT NULL::text[], p_follow_up_today boolean DEFAULT false, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_offset_per_stage integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB := '{}'::JSONB;
  stage_record RECORD;
  stage_leads JSONB;
  stage_count BIGINT;
  search_pattern TEXT;
  effective_start_date timestamp with time zone;
  effective_end_date timestamp with time zone;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    search_pattern := '%' || lower(p_search_query) || '%';
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
          COALESCE(l.phone, '') LIKE search_pattern
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
          'status', l.status,
          'response_status', l.response_status,
          'notes', l.notes,
          'agency_id', l.agency_id,
          'sales_person_id', l.sales_person_id,
          'created_at', l.created_at,
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
            COALESCE(l.phone, '') LIKE search_pattern
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_leads_by_tags(p_tenant_id uuid, p_tag_ids uuid[], p_agency_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS SETOF leads
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT l.*
  FROM leads l
  INNER JOIN chat_contact_tags cct ON cct.lead_id = l.id
  WHERE cct.tag_id = ANY(p_tag_ids)
    AND cct.tenant_id = p_tenant_id
    AND (
      l.tenant_id = p_tenant_id 
      OR (p_agency_ids IS NOT NULL AND l.agency_id = ANY(p_agency_ids))
    )
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$function$
;

CREATE OR REPLACE FUNCTION public.get_signature_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', r.id,
    'document_id', r.document_id,
    'name', r.name,
    'email', r.email,
    'status', r.status,
    'sign_order', r.sign_order,
    'sign_token', r.sign_token,
    'signature_position', r.signature_position,
    'signed_at', r.signed_at,
    'signature_documents', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'file_url', d.file_url,
      'document_type', d.document_type,
      'status', d.status
    )
  ) INTO result
  FROM public.signature_recipients r
  JOIN public.signature_documents d ON d.id = r.document_id
  WHERE r.sign_token = _token
  LIMIT 1;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts(p_tenant_id uuid)
 RETURNS TABLE(id text, name text, sender_phone text, contact_type text, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean, agency_id uuid, agency_name text, wid text, whatsapp_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
 RETURNS TABLE(id text, name text, sender_phone text, contact_type text, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean, agency_id uuid, agency_name text, wid text, whatsapp_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_agency_ids(_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY_AGG(ca.agency_id)
  FROM public.profiles p
  JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
  WHERE p.id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_campaigner_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT campaigner_id
  FROM public.profiles
  WHERE id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_client_ids(_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    ARRAY_AGG(ct.client_id),
    ARRAY[]::uuid[]
  )
  FROM public.profiles p
  JOIN public.client_team ct ON ct.campaigner_id = p.campaigner_id
  WHERE p.id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_sales_person_agency_ids(_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY_AGG(spa.agency_id)
  FROM public.profiles p
  JOIN public.sales_person_agencies spa ON spa.sales_person_id = p.sales_person_id
  WHERE p.id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_sales_person_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sales_person_id
  FROM public.profiles
  WHERE id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM (
    SELECT tenant_id FROM public.user_active_tenant WHERE user_id = _user_id
    UNION ALL
    SELECT tenant_id FROM public.tenant_users WHERE user_id = _user_id LIMIT 1
  ) sub
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_campaigner_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- If campaigner_id was just set (and wasn't set before or was NULL)
  IF NEW.campaigner_id IS NOT NULL AND (OLD.campaigner_id IS NULL OR OLD.campaigner_id != NEW.campaigner_id) THEN
    -- Add campaigner role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'campaigner', v_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  
  -- If campaigner_id was removed
  IF NEW.campaigner_id IS NULL AND OLD.campaigner_id IS NOT NULL THEN
    -- Remove campaigner role (but only if user has no client_team assignments)
    IF NOT EXISTS (
      SELECT 1 FROM public.client_team 
      WHERE campaigner_id = OLD.campaigner_id
    ) THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.id 
        AND role = 'campaigner' 
        AND tenant_id = v_tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_client_onboarding_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_campaigner_id uuid;
BEGIN
  -- When status changes to onboarding, create an onboarding entry if it doesn't exist
  IF NEW.status = 'onboarding' AND (OLD.status IS NULL OR OLD.status != 'onboarding') THEN
    -- Check if onboarding entry already exists for this client (non-campaign_live)
    IF NOT EXISTS (
      SELECT 1 FROM public.client_onboarding 
      WHERE client_id = NEW.id 
      AND status != 'campaign_live'
    ) THEN
      -- Try to get דוד as default campaigner
      SELECT id INTO default_campaigner_id
      FROM public.campaigners
      WHERE full_name = 'דוד'
      AND active = true
      LIMIT 1;
      
      -- If דוד not found, try client_team
      IF default_campaigner_id IS NULL THEN
        SELECT campaigner_id INTO default_campaigner_id
        FROM public.client_team
        WHERE client_id = NEW.id
        LIMIT 1;
      END IF;
      
      -- If still no campaigner, get first active one
      IF default_campaigner_id IS NULL THEN
        SELECT id INTO default_campaigner_id
        FROM public.campaigners
        WHERE active = true
        LIMIT 1;
      END IF;
      
      -- Create onboarding entry with tenant_id
      IF default_campaigner_id IS NOT NULL THEN
        INSERT INTO public.client_onboarding (
          client_id,
          agency_id,
          campaigner_id,
          title,
          status,
          notes,
          tenant_id
        ) VALUES (
          NEW.id,
          NEW.agency_id,
          default_campaigner_id,
          'קליטת לקוח: ' || NEW.name,
          'research_meeting',
          'נוצר אוטומטית מעדכון סטטוס לקוח',
          NEW.tenant_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_lead_to_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
BEGIN
  -- Only proceed if won_date was just set on a closed lead
  -- AND we haven't already created a client
  IF NEW.status = 'closed' 
     AND NEW.won_date IS NOT NULL 
     AND (OLD.won_date IS NULL OR OLD.won_date != NEW.won_date)
     AND NOT EXISTS (
       SELECT 1 FROM public.clients 
       WHERE name = NEW.company_name 
       AND agency_id = NEW.agency_id 
       AND notes LIKE 'נוצר מליד:%'
       AND created_at > NOW() - INTERVAL '5 minutes'
     ) THEN
    
    -- Create new client with lead details
    INSERT INTO public.clients (
      name,
      agency_id,
      email,
      phone,
      industry,
      notes,
      status,
      folder_link,
      tenant_id
    ) VALUES (
      NEW.company_name,
      NEW.agency_id,
      NEW.email,
      NEW.phone,
      NEW.industry,
      'נוצר מליד: ' || COALESCE(NEW.notes, ''),
      'onboarding',
      NEW.folder_link,
      NEW.tenant_id
    ) RETURNING id INTO new_client_id;
    
    -- Create empty client_onboarding record without campaigner
    -- User will assign campaigner manually
    INSERT INTO public.client_onboarding (
      client_id,
      agency_id,
      campaigner_id,
      title,
      status,
      notes,
      tenant_id
    ) SELECT
      new_client_id,
      NEW.agency_id,
      (SELECT id FROM public.campaigners WHERE full_name = 'דוד' AND active = true LIMIT 1),
      'קליטת לקוח: ' || NEW.company_name,
      'research_meeting',
      'נוצר אוטומטית מליד - נא לבחור קמפיינר',
      NEW.tenant_id
    WHERE EXISTS (SELECT 1 FROM public.campaigners WHERE full_name = 'דוד' AND active = true);
    
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_tenant_lead_statuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM initialize_tenant_lead_statuses(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_tenant_menu_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Initialize menu items for the new tenant
  PERFORM initialize_tenant_menu_items(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_tenant_pipeline_stages()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM initialize_tenant_pipeline_stages(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a profile with 'active' status (will be set to 'pending' by invitation system if needed)
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'active'  -- Default to active
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_onboarding_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When status changes to campaign_live, update client status to active
  IF NEW.status = 'campaign_live' AND (OLD.status IS NULL OR OLD.status != 'campaign_live') THEN
    UPDATE public.clients
    SET status = 'active'
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_sales_person_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- If sales_person_id was just set (and wasn't set before or was different)
  IF NEW.sales_person_id IS NOT NULL AND 
     (OLD.sales_person_id IS NULL OR OLD.sales_person_id != NEW.sales_person_id) THEN
    -- Add sales_person role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'sales_person', v_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  
  -- If sales_person_id was removed
  IF NEW.sales_person_id IS NULL AND OLD.sales_person_id IS NOT NULL THEN
    -- Remove sales_person role
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id 
      AND role = 'sales_person' 
      AND tenant_id = v_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_finance_permission(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND module = 'finance_view'
      AND can_access = true
  ) OR has_role(_user_id, 'owner'::app_role) OR is_super_admin(_user_id)
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        -- Super admin is global (tenant_id IS NULL)
        (_role = 'super_admin' AND tenant_id IS NULL)
        OR
        -- Other roles are tenant-specific
        (_role != 'super_admin' AND tenant_id = get_user_tenant_id(_user_id))
      )
  )
$function$
;

CREATE OR REPLACE FUNCTION public.increment_skill_usage(skill_ids uuid[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.ai_skills
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = ANY(skill_ids);
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_all_tenants_menu_items()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.initialize_tenant_menu_items(t.id);
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_default_custom_fields(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  source_tenant_id uuid;
BEGIN
  -- Get the marketingcaptain tenant ID as the source
  SELECT id INTO source_tenant_id
  FROM public.tenants
  WHERE slug = 'marketingcaptain'
  LIMIT 1;
  
  -- If source tenant exists, copy fields
  IF source_tenant_id IS NOT NULL THEN
    PERFORM copy_custom_fields_to_tenant(source_tenant_id, _tenant_id);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_default_pipeline_stages(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order)
  VALUES
    (p_tenant_id, 'new', 'חדש', '#3B82F6', 1),
    (p_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2),
    (p_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3),
    (p_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4),
    (p_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5),
    (p_tenant_id, 'won', 'נסגר בהצלחה', '#22C55E', 6),
    (p_tenant_id, 'lost', 'אבוד', '#EF4444', 7)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_tenant_lead_statuses(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.lead_statuses (tenant_id, status_key, label, color, sort_order)
  VALUES
    (_tenant_id, 'no_status', 'ללא סטטוס', '#9ca3af', 0),
    (_tenant_id, 'no_answer_1', 'אין מענה 1', '#fbbf24', 1),
    (_tenant_id, 'no_answer_2', 'אין מענה 2', '#f97316', 2),
    (_tenant_id, 'no_answer_3', 'אין מענה 3', '#ef4444', 3),
    (_tenant_id, 'no_answer_4', 'אין מענה 4', '#dc2626', 4),
    (_tenant_id, 'in_progress', 'בעבודה', '#3b82f6', 5),
    (_tenant_id, 'denies_contact', 'מכחיש פניה', '#8b5cf6', 6),
    (_tenant_id, 'not_relevant', 'לא רלוונטי', '#6b7280', 7)
  ON CONFLICT (tenant_id, status_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_tenant_menu_items(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.menu_items (tenant_id, menu_key, original_label, route, icon, sort_order, is_visible, category, parent_menu_key)
  VALUES
    (_tenant_id, 'agencies', 'סוכנויות', '/agencies', 'Building2', 1, true, 'main', NULL),
    (_tenant_id, 'clients', 'לקוחות', '/clients', 'Users', 2, true, 'main', NULL),
    (_tenant_id, 'tasks', 'משימות', '/tasks', 'CheckSquare', 3, true, 'main', NULL),
    (_tenant_id, 'client-onboarding', 'לקוחות בקליטה', '/client-onboarding', 'UserPlus', 4, true, 'main', NULL),
    (_tenant_id, 'time-tracking', 'שעון נוכחות', '/time-tracking', 'Clock', 5, true, 'main', NULL),
    (_tenant_id, 'campaigners', 'צוות', '/campaigners', 'Megaphone', 6, true, 'main', NULL),
    (_tenant_id, 'users', 'ניהול משתמשים', '/users', 'ShieldCheck', 7, true, 'main', NULL),
    (_tenant_id, 'my-profile', 'אזור אישי', '/my-profile', 'User', 8, true, 'main', NULL),
    (_tenant_id, 'chat', 'צ''אט', '/chat', 'MessageCircle', 9, true, 'main', NULL),
    (_tenant_id, 'signatures', 'חתימות דיגיטליות', '/signatures', 'FileSignature', 10, true, 'main', NULL),
    
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
    
    (_tenant_id, 'sales', 'ניהול מכירות', '#', 'TrendingUp', 200, true, 'group', NULL),
    (_tenant_id, 'sales-dashboard', 'דשבורד מכירות', '/sales-dashboard', 'TrendingUp', 201, true, 'sales', 'sales'),
    (_tenant_id, 'leads', 'לידים', '/leads', 'Target', 202, true, 'sales', 'sales'),
    (_tenant_id, 'products', 'מוצרים ושירותים', '/products', 'Package', 203, true, 'sales', 'sales'),
    (_tenant_id, 'sales-people', 'אנשי מכירות', '/sales-people', 'UserCheck', 204, true, 'sales', 'sales'),
    (_tenant_id, 'integrations', 'אינטגרציות', '/integrations', 'Plug', 206, true, 'sales', 'sales')
  ON CONFLICT (tenant_id, menu_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_tenant_pipeline_stages(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order, is_active)
  VALUES
    (_tenant_id, 'new', 'חדש', '#3B82F6', 1, true),
    (_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2, true),
    (_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3, true),
    (_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4, true),
    (_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5, true),
    (_tenant_id, 'closed', 'נסגר', '#22C55E', 6, true)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_tenant_terminology(_tenant_id uuid, _business_type text DEFAULT 'marketing_agency'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _terms JSONB;
BEGIN
  -- Define terms based on business type
  IF _business_type = 'general_business' THEN
    _terms := '[
      {"key": "agency", "singular": "מחלקה", "plural": "מחלקות", "orig_s": "סוכנות", "orig_p": "סוכנויות"},
      {"key": "client", "singular": "לקוח", "plural": "לקוחות", "orig_s": "לקוח", "orig_p": "לקוחות"},
      {"key": "lead", "singular": "ליד", "plural": "לידים", "orig_s": "ליד", "orig_p": "לידים"},
      {"key": "task", "singular": "משימה", "plural": "משימות", "orig_s": "משימה", "orig_p": "משימות"},
      {"key": "campaigner", "singular": "עובד", "plural": "עובדים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "supplier", "singular": "ספק", "plural": "ספקים", "orig_s": "ספק", "orig_p": "ספקים"},
      {"key": "product", "singular": "מוצר", "plural": "מוצרים", "orig_s": "מוצר", "orig_p": "מוצרים"},
      {"key": "onboarding", "singular": "קליטה", "plural": "קליטות", "orig_s": "קליטה", "orig_p": "קליטות"},
      {"key": "role_owner", "singular": "בעלים", "plural": "בעלים", "orig_s": "בעלים", "orig_p": "בעלים"},
      {"key": "role_team_manager", "singular": "מנהל", "plural": "מנהלים", "orig_s": "מנהל צוות", "orig_p": "מנהלי צוות"},
      {"key": "role_campaigner", "singular": "עובד", "plural": "עובדים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "role_sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "role_seo", "singular": "מנהל פרויקט", "plural": "מנהלי פרויקטים", "orig_s": "SEO", "orig_p": "SEO"},
      {"key": "role_super_admin", "singular": "מנהל מערכת", "plural": "מנהלי מערכת", "orig_s": "סופר אדמין", "orig_p": "סופר אדמינים"},
      {"key": "task_tab_all", "singular": "כל המשימות", "plural": "כל המשימות", "orig_s": "כל המשימות", "orig_p": "כל המשימות"},
      {"key": "task_tab_seo", "singular": "משימות פרויקט", "plural": "משימות פרויקט", "orig_s": "משימות ללקוחות", "orig_p": "משימות ללקוחות"},
      {"key": "task_tab_campaign", "singular": "משימות כלליות", "plural": "משימות כלליות", "orig_s": "משימות ללידים", "orig_p": "משימות ללידים"}
    ]'::JSONB;
  ELSE
    -- Default marketing agency terminology
    _terms := '[
      {"key": "agency", "singular": "סוכנות", "plural": "סוכנויות", "orig_s": "סוכנות", "orig_p": "סוכנויות"},
      {"key": "client", "singular": "לקוח", "plural": "לקוחות", "orig_s": "לקוח", "orig_p": "לקוחות"},
      {"key": "lead", "singular": "ליד", "plural": "לידים", "orig_s": "ליד", "orig_p": "לידים"},
      {"key": "task", "singular": "משימה", "plural": "משימות", "orig_s": "משימה", "orig_p": "משימות"},
      {"key": "campaigner", "singular": "קמפיינר", "plural": "קמפיינרים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "supplier", "singular": "ספק", "plural": "ספקים", "orig_s": "ספק", "orig_p": "ספקים"},
      {"key": "product", "singular": "מוצר", "plural": "מוצרים", "orig_s": "מוצר", "orig_p": "מוצרים"},
      {"key": "onboarding", "singular": "קליטה", "plural": "קליטות", "orig_s": "קליטה", "orig_p": "קליטות"},
      {"key": "role_owner", "singular": "בעלים", "plural": "בעלים", "orig_s": "בעלים", "orig_p": "בעלים"},
      {"key": "role_team_manager", "singular": "מנהל צוות", "plural": "מנהלי צוות", "orig_s": "מנהל צוות", "orig_p": "מנהלי צוות"},
      {"key": "role_campaigner", "singular": "קמפיינר", "plural": "קמפיינרים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "role_sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "role_seo", "singular": "SEO", "plural": "SEO", "orig_s": "SEO", "orig_p": "SEO"},
      {"key": "role_super_admin", "singular": "סופר אדמין", "plural": "סופר אדמינים", "orig_s": "סופר אדמין", "orig_p": "סופר אדמינים"},
      {"key": "task_tab_all", "singular": "כל המשימות", "plural": "כל המשימות", "orig_s": "כל המשימות", "orig_p": "כל המשימות"},
      {"key": "task_tab_seo", "singular": "משימות ללקוחות", "plural": "משימות ללקוחות", "orig_s": "משימות ללקוחות", "orig_p": "משימות ללקוחות"},
      {"key": "task_tab_campaign", "singular": "משימות ללידים", "plural": "משימות ללידים", "orig_s": "משימות ללידים", "orig_p": "משימות ללידים"}
    ]'::JSONB;
  END IF;

  -- Insert terminology
  INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
  SELECT 
    _tenant_id,
    term->>'key',
    term->>'singular',
    term->>'plural',
    term->>'orig_s',
    term->>'orig_p'
  FROM jsonb_array_elements(_terms) AS term
  ON CONFLICT (tenant_id, term_key) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_tenant_terminology_from_preset(_tenant_id uuid, _preset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _preset RECORD;
  _term JSONB;
BEGIN
  SELECT * INTO _preset FROM terminology_presets WHERE id = _preset_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preset not found';
  END IF;

  FOR _term IN SELECT * FROM jsonb_array_elements(_preset.terms)
  LOOP
    INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
    VALUES (
      _tenant_id,
      _term->>'key',
      _term->>'singular',
      _term->>'plural',
      _term->>'singular',
      _term->>'plural'
    )
    ON CONFLICT (tenant_id, term_key) DO NOTHING;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_automation_shared_to_tenant(_automation_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.automation_shared_tenants
    WHERE automation_id = _automation_id AND tenant_id = _tenant_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_channel_members
    WHERE channel_id = p_channel_id 
      AND user_id = p_user_id
      AND tenant_id = get_user_tenant_id(p_user_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_root_tenant(tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = tenant_id 
    AND parent_tenant_id IS NOT NULL
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_seo_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.campaigners c ON c.id = p.campaigner_id
    WHERE p.id = _user_id
      AND c.role @> ARRAY['SEO']::text[]
      AND NOT (c.role @> ARRAY['קמפיינר']::text[] OR c.role @> ARRAY['מנהל צוות']::text[])
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND tenant_id IS NULL  -- Super admin must be global
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_admin_of_automation_source_tenant(_automation_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.automations a
    JOIN public.user_roles ur ON ur.tenant_id = a.tenant_id AND ur.user_id = _user_id
    WHERE a.id = _automation_id
      AND ur.role IN ('owner'::app_role, 'team_manager'::app_role, 'agency_owner'::app_role)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_in_automation_source_tenant(_automation_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.automations a
    JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE a.id = _automation_id AND tu.user_id = _user_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.kb_match_pointers(p_tenant_id uuid, p_query_embedding vector, p_category text DEFAULT NULL::text, p_since_days integer DEFAULT NULL::integer, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, category text, subcategory text, path text, entity_type text, entity_id text, title text, summary text, ref_date timestamp with time zone, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.category, p.subcategory, p.path, p.entity_type, p.entity_id,
         p.title, p.summary, p.ref_date,
         1 - (p.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.carmen_memory_pointers p
  WHERE p.tenant_id = p_tenant_id
    AND p.summary_embedding IS NOT NULL
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_since_days IS NULL OR p.ref_date >= now() - (p_since_days || ' days')::interval)
  ORDER BY p.summary_embedding <=> p_query_embedding
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.link_visitor_to_lead(p_visitor_fingerprint text, p_tracking_id text, p_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_visitor_id UUID;
  v_tracking_config_id UUID;
BEGIN
  -- Get tracking config
  SELECT id INTO v_tracking_config_id
  FROM site_tracking_configs
  WHERE tracking_id = p_tracking_id;
  
  IF v_tracking_config_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Find and update visitor
  UPDATE site_visitors
  SET lead_id = p_lead_id
  WHERE tracking_config_id = v_tracking_config_id
    AND visitor_fingerprint = p_visitor_fingerprint
  RETURNING id INTO v_visitor_id;
  
  RETURN v_visitor_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.list_system_cron_jobs()
 RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean, command text, last_run_at timestamp with time zone, last_status text, last_duration_ms bigint, last_return_message text, success_count_7d bigint, fail_count_7d bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY
  WITH last_run AS (
    SELECT DISTINCT ON (d.jobid) d.jobid, d.start_time AS last_run_at, d.status AS last_status,
      EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000 AS last_duration_ms, d.return_message AS last_return_message
    FROM cron.job_run_details d ORDER BY d.jobid, d.start_time DESC
  ),
  stats AS (
    SELECT d.jobid, COUNT(*) FILTER (WHERE d.status='succeeded') AS success_count_7d, COUNT(*) FILTER (WHERE d.status='failed') AS fail_count_7d
    FROM cron.job_run_details d WHERE d.start_time > now() - interval '7 days' GROUP BY d.jobid
  )
  SELECT j.jobid, j.jobname, j.schedule, j.active, j.command, lr.last_run_at, lr.last_status, lr.last_duration_ms, lr.last_return_message,
    COALESCE(s.success_count_7d, 0), COALESCE(s.fail_count_7d, 0)
  FROM cron.job j LEFT JOIN last_run lr ON lr.jobid=j.jobid LEFT JOIN stats s ON s.jobid=j.jobid ORDER BY j.jobname;
END; $function$
;

CREATE OR REPLACE FUNCTION public.mark_all_chats_read(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  UPDATE chat_messages
  SET read_at = now()
  WHERE tenant_id = p_tenant_id
    AND direction = 'inbound'
    AND read_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_agent_memory(p_agent_id uuid, p_query_embedding vector, p_limit integer DEFAULT 8)
 RETURNS TABLE(id uuid, title text, summary text, category text, importance integer, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.title, m.summary, m.category, m.importance,
         1 - (m.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.agent_id = p_agent_id
    AND m.summary_embedding IS NOT NULL
  ORDER BY m.summary_embedding <=> p_query_embedding
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_campaigner record;
  v_client_name text;
  v_payload jsonb;
  v_actor_user_id uuid;
  v_actor_campaigner_id uuid;
BEGIN
  IF NEW.campaigner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.campaigner_id IS NOT DISTINCT FROM NEW.campaigner_id THEN
    RETURN NEW;
  END IF;

  -- Skip self-assignment: if the actor (auth.uid or created_by) maps to the same campaigner
  v_actor_user_id := COALESCE(auth.uid(), NEW.created_by);
  IF v_actor_user_id IS NOT NULL THEN
    v_actor_campaigner_id := public.get_user_campaigner_id(v_actor_user_id);
    IF v_actor_campaigner_id IS NOT NULL
       AND v_actor_campaigner_id = NEW.campaigner_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT full_name, phone, whatsapp_group_id
    INTO v_campaigner
    FROM public.campaigners
    WHERE id = NEW.campaigner_id;

  IF NEW.client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  END IF;

  v_url := 'https://jnzguisakdtcollxmgzd.supabase.co';

  v_payload := jsonb_build_object(
    'trigger_type', 'task_assigned',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'task_id', NEW.id,
      'task_title', NEW.title,
      'task_notes', COALESCE(NEW.notes, ''),
      'campaigner_id', NEW.campaigner_id,
      'campaigner_name', COALESCE(v_campaigner.full_name, ''),
      'campaigner_phone', COALESCE(v_campaigner.phone, ''),
      'campaigner_whatsapp_group_id', COALESCE(v_campaigner.whatsapp_group_id, ''),
      'client_name', COALESCE(v_client_name, ''),
      'priority', NEW.priority,
      'status', NEW.status,
      'due_date', COALESCE(NEW.due_date::text, ''),
      'tasks_link', 'https://after-lead.com/tasks'
    )
  );

  PERFORM net.http_post(
    url := v_url || '/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_assigned failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_integration_failure(p_tenant_id uuid, p_provider text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_failures integer;
BEGIN
  INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, total_calls, total_failures)
  VALUES (p_tenant_id, p_provider, 1, now(), 1, 1)
  ON CONFLICT (tenant_id, provider) DO UPDATE
  SET consecutive_failures = integration_health.consecutive_failures + 1, last_failure_at = now(), total_calls = integration_health.total_calls + 1, total_failures = integration_health.total_failures + 1
  RETURNING consecutive_failures INTO v_failures;
  IF v_failures >= 5 THEN
    UPDATE integration_health SET is_circuit_open = true, cooldown_until = now() + interval '5 minutes' WHERE tenant_id = p_tenant_id AND provider = p_provider;
  END IF;
END; $function$
;

CREATE OR REPLACE FUNCTION public.record_integration_result(p_tenant_id uuid, p_provider text, p_success boolean, p_failure_threshold integer DEFAULT 5, p_cooldown_minutes integer DEFAULT 5)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_success THEN
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 0, NULL, false, NULL)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET consecutive_failures = 0, is_circuit_open = false, cooldown_until = NULL;
  ELSE
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 1, now(), false, NULL)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET
      consecutive_failures = integration_health.consecutive_failures + 1,
      last_failure_at = now(),
      is_circuit_open = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold THEN true ELSE false END,
      cooldown_until = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold
        THEN now() + (p_cooldown_minutes || ' minutes')::interval
        ELSE integration_health.cooldown_until END;
  END IF;
END; $function$
;

CREATE OR REPLACE FUNCTION public.record_integration_success(p_tenant_id uuid, p_provider text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_success_at, is_circuit_open, total_calls)
  VALUES (p_tenant_id, p_provider, 0, now(), false, 1)
  ON CONFLICT (tenant_id, provider) DO UPDATE
  SET consecutive_failures = 0, last_success_at = now(), is_circuit_open = false, cooldown_until = NULL, total_calls = integration_health.total_calls + 1;
END; $function$
;

CREATE OR REPLACE FUNCTION public.run_system_cron_job_now(p_jobid bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE v_command text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  SELECT command INTO v_command FROM cron.job WHERE jobid = p_jobid;
  IF v_command IS NULL THEN RAISE EXCEPTION 'job not found'; END IF;
  EXECUTE v_command;
  RETURN 'ok';
END; $function$
;

CREATE OR REPLACE FUNCTION public.search_contacts_for_chat(p_search_term text)
 RETURNS TABLE(contact_id uuid, contact_type text, name text, contact_name text, phone text, email text, agency_id uuid, agency_name text, manychat_subscriber_id text, active_chat_provider chat_provider, has_messages boolean, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_contacts_for_chat(p_search_term text, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(contact_id text, contact_type text, name text, contact_name text, phone text, email text, agency_id uuid, agency_name text, unread_count bigint, last_message_at timestamp with time zone, is_blocked boolean, manychat_subscriber_id text, active_chat_provider chat_provider, sender_phone text, has_messages boolean, whatsapp_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  search_pattern text;
BEGIN
  current_tenant_id := COALESCE(p_tenant_id, get_user_tenant_id(auth.uid()));
  current_user_id := auth.uid();
  search_pattern := '%' || lower(p_search_term) || '%';
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
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
    'green_api'::chat_provider as active_chat_provider,
    uc.sender_phone as sender_phone,
    true as has_messages,
    uc.avatar_url as whatsapp_avatar_url
  FROM (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name,
      MAX(cm.created_at) OVER (PARTITION BY cm.sender_phone) as last_message_at,
      (cm.raw_provider_data->>'senderProfileImage')::text as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = current_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_agency_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_campaigner_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Try to get tenant_id from the current user
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_client_onboarding_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    ELSE
      -- Fallback to current user's tenant if available
      SELECT public.get_user_tenant_id(auth.uid()) INTO NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_client_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.agencies 
    WHERE id = NEW.agency_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_lead_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id 
      FROM public.agencies 
      WHERE id = NEW.agency_id;
    ELSE
      -- Fallback: get user's tenant
      SELECT tenant_id INTO NEW.tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_product_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_task_tenant_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_tracking_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := generate_tracking_id();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_signature_by_token(_token uuid, _signature_data text, _ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec public.signature_recipients%ROWTYPE;
  v_unsigned int;
  v_new_status text;
BEGIN
  IF _token IS NULL OR _signature_data IS NULL OR length(_signature_data) > 5000000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  UPDATE public.signature_recipients
  SET status = 'signed',
      signature_data = _signature_data,
      signed_at = now(),
      ip_address = COALESCE(_ip, 'client-side')
  WHERE sign_token = _token AND status = 'pending'
  RETURNING * INTO v_rec;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'not_found_or_already_signed';
  END IF;

  SELECT count(*) INTO v_unsigned
  FROM public.signature_recipients
  WHERE document_id = v_rec.document_id AND status = 'pending';

  v_new_status := CASE WHEN v_unsigned = 0 THEN 'completed' ELSE 'partially_signed' END;

  UPDATE public.signature_documents
  SET status = v_new_status,
      completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = v_rec.document_id;

  RETURN jsonb_build_object('ok', true, 'document_status', v_new_status);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_client_status_to_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When client becomes active, set all non-campaign_live onboarding entries to campaign_live
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  -- When client goes back to onboarding from active/paused/ended, 
  -- reset campaign_live onboarding entries to receiving_access
  IF NEW.status = 'onboarding' AND OLD.status != 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'receiving_access', updated_at = now()
    WHERE client_id = NEW.id
      AND status = 'campaign_live';
  END IF;

  -- When client is paused or ended, also mark onboarding as campaign_live
  -- (they completed onboarding even if paused/ended)
  IF NEW.status IN ('paused', 'ended') AND OLD.status = 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_deleted_facebook_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_ad_account_blocked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_status text;
  new_status text;
  last_trigger_at timestamptz;
  payload_body jsonb;
  blocked_statuses text[] := ARRAY['disabled','unsettled','pending_risk_review','pending_settlement','closed'];
BEGIN
  old_status := OLD.integration_settings->>'account_status';
  new_status := NEW.integration_settings->>'account_status';

  -- Only fire when new status is a blocked one AND it changed
  IF new_status IS NULL OR NOT (new_status = ANY(blocked_statuses)) THEN
    RETURN NEW;
  END IF;

  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: 24h cooldown per table
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_auto_sync_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if manychat_subscriber_id is NULL and phone is present
  IF NEW.manychat_subscriber_id IS NULL AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Call the edge function asynchronously using pg_net
    -- Using the project's Supabase URL and anon key directly
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_carmen_learn_from_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_integration_disconnected()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_needs_reauth boolean;
  new_needs_reauth boolean;
  last_trigger_at timestamptz;
  integration_label text;
  payload_body jsonb;
BEGIN
  -- Extract needs_reauth flags from old + new settings
  old_needs_reauth := COALESCE((OLD.settings->>'needs_reauth')::boolean, false);
  new_needs_reauth := COALESCE((NEW.settings->>'needs_reauth')::boolean, false);

  -- Only fire on transition false -> true
  IF NOT (new_needs_reauth = true AND old_needs_reauth = false) THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: skip if a disconnect was already announced in the last 24h
  last_trigger_at := (NEW.settings->>'last_disconnect_trigger_at')::timestamptz;
  IF last_trigger_at IS NOT NULL AND last_trigger_at > now() - interval '24 hours' THEN
    RETURN NEW;
  END IF;

  -- Friendly label per integration type
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
    ELSE COALESCE(NEW.integration_type, 'אינטגרציה')
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

  -- Fire trigger-automation edge function asynchronously
  PERFORM net.http_post(
    url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := payload_body
  );

  -- Stamp the trigger time to prevent spam
  NEW.settings := COALESCE(NEW.settings, '{}'::jsonb)
    || jsonb_build_object('last_disconnect_trigger_at', now());

  RAISE LOG 'Integration disconnect trigger fired: tenant=% integration=%', NEW.tenant_id, NEW.integration_type;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_validate_crm_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.validate_crm_record(NEW.table_id, NEW.data);
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_chat_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_system_cron_job(p_jobid bigint, p_schedule text DEFAULT NULL::text, p_active boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF p_schedule IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, schedule := p_schedule); END IF;
  IF p_active IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, active := p_active); END IF;
END; $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_can_access_client(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH client_scope AS (
    SELECT id, tenant_id, agency_id
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
        public.has_role(_user_id, 'team_manager'::app_role)
        AND public.user_manages_agency(_user_id, c.agency_id)
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        public.has_role(_user_id, 'sales_person'::app_role)
        AND c.agency_id = ANY(COALESCE(public.get_user_sales_person_agency_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        (
          public.has_role(_user_id, 'campaigner'::app_role)
          OR public.has_role(_user_id, 'seo'::app_role)
        )
        AND c.id = ANY(COALESCE(public.get_user_client_ids(_user_id), ARRAY[]::uuid[]))
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_can_access_crm_table(_user_id uuid, _table_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.user_can_view_campaigner(_user_id uuid, _campaigner_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Super admin
  SELECT is_super_admin(_user_id)
  OR
  -- Owner in same tenant
  EXISTS (
    SELECT 1 FROM campaigners c
    WHERE c.id = _campaigner_id
    AND c.tenant_id = get_user_tenant_id(_user_id)
    AND has_role(_user_id, 'owner'::app_role)
  )
  OR
  -- Team manager managing campaigner's agencies
  EXISTS (
    SELECT 1 FROM campaigners c
    JOIN campaigner_agencies ca ON ca.campaigner_id = c.id
    WHERE c.id = _campaigner_id
    AND has_role(_user_id, 'team_manager'::app_role)
    AND user_manages_agency(_user_id, ca.agency_id)
  )
  OR
  -- Campaigner viewing themselves
  (get_user_campaigner_id(_user_id) = _campaigner_id)
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_agency_access(_user_id uuid, _agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
    WHERE p.id = _user_id AND ca.agency_id = _agency_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_calendar_access(_accessor_user_id uuid, _owner_user_id uuid, _required_permission text DEFAULT 'view'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- User is accessing their own calendar
    _accessor_user_id = _owner_user_id
    OR
    -- User has been granted access
    EXISTS (
      SELECT 1 FROM public.calendar_shares
      WHERE owner_user_id = _owner_user_id
        AND shared_with_user_id = _accessor_user_id
        AND (
          -- Full access grants everything
          permission_level = 'full'
          OR
          -- Book permission grants view and book
          (permission_level = 'book' AND _required_permission IN ('view', 'book'))
          OR
          -- View permission only grants view
          (permission_level = 'view' AND _required_permission = 'view')
        )
    )
    OR
    -- Super admin has access to everything
    is_super_admin(_accessor_user_id)
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_agency_access(_user_id uuid, _agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.agency_id = _agency_id AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_client_access(p_user_id uuid, p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM clients c
    JOIN agency_tenant_access ata ON ata.agency_id = c.agency_id
    WHERE c.id = p_client_id
      AND ata.accessing_tenant_id = get_user_tenant_id(p_user_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_integration_access(_user_id uuid, _integration_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = _integration_tenant_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.integration_user_permissions 
    WHERE integration_id = p_integration_id 
    AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_integration RECORD;
BEGIN
  -- Get integration details
  SELECT * INTO v_integration
  FROM tenant_integrations
  WHERE id = p_integration_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Super admin always has access
  IF is_super_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Owner of the integration always has access
  IF v_integration.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- For tenant-level integrations (user_id IS NULL), all tenant members have access
  IF v_integration.user_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM tenant_users
      WHERE tenant_id = v_integration.tenant_id
      AND user_id = p_user_id
    );
  END IF;
  
  -- Check explicit permission
  RETURN EXISTS (
    SELECT 1
    FROM integration_user_permissions
    WHERE integration_id = p_integration_id
    AND user_id = p_user_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_restricted_client_viewer(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND NOT public.is_super_admin(_user_id)
    AND NOT public.has_role(_user_id, 'owner'::app_role)
    AND NOT public.has_role(_user_id, 'team_manager'::app_role)
    AND (
      public.has_role(_user_id, 'campaigner'::app_role)
      OR public.has_role(_user_id, 'seo'::app_role)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_tenant_member(check_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    AND tenant_id = check_tenant_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_manages_agency(_user_id uuid, _agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_managed_agencies
    WHERE user_id = _user_id AND agency_id = _agency_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.user_owns_agency(_user_id uuid, _agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = _agency_id AND a.tenant_id = public.get_user_tenant_id(_user_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.user_owns_integration(p_integration_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_integrations 
    WHERE id = p_integration_id 
    AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.validate_crm_record(p_table_id uuid, p_data jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  field RECORD;
  value TEXT;
BEGIN
  -- Check all required fields are present and valid
  FOR field IN 
    SELECT * FROM public.crm_fields 
    WHERE table_id = p_table_id AND is_required = true
  LOOP
    IF NOT p_data ? field.key THEN
      RAISE EXCEPTION 'Required field % is missing', field.key;
    END IF;
    
    -- Basic type validation
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
          -- Other types: basic presence check already done
          NULL;
      END CASE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$function$
;

-- ---------- TRIGGERS ----------
CREATE TRIGGER set_agency_tenant_id_before_insert BEFORE INSERT ON public.agencies FOR EACH ROW EXECUTE FUNCTION set_agency_tenant_id();
CREATE TRIGGER set_agency_tenant_id_before_update BEFORE UPDATE ON public.agencies FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_agency_tenant_id();
CREATE TRIGGER set_agency_tenant_id_trigger BEFORE INSERT ON public.agencies FOR EACH ROW EXECUTE FUNCTION set_agency_tenant_id();
CREATE TRIGGER trg_single_default_agency BEFORE INSERT OR UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION ensure_single_default_agency();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_agent_evals_updated BEFORE UPDATE ON public.agent_evals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_agent_goals_updated BEFORE UPDATE ON public.agent_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_aki_updated BEFORE UPDATE ON public.agent_knowledge_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mcp_conn_updated BEFORE UPDATE ON public.agent_mcp_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_agent_memory_fts BEFORE INSERT OR UPDATE OF title, summary ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION agent_memory_fts_update();
CREATE TRIGGER trg_am_updated BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_agent_runs_updated_at BEFORE UPDATE ON public.agent_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tools_updated_at BEFORE UPDATE ON public.agent_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_aup_updated_at BEFORE UPDATE ON public.agent_user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_kb_ai_conversations_outbox AFTER INSERT OR UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('ai_conversation');
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER ai_skills_search_vector_trg BEFORE INSERT OR UPDATE ON public.ai_skills FOR EACH ROW EXECUTE FUNCTION ai_skills_update_search_vector();
CREATE TRIGGER bump_ai_skill_version_trg BEFORE UPDATE ON public.ai_skills FOR EACH ROW EXECUTE FUNCTION bump_ai_skill_version();
CREATE TRIGGER update_ai_skills_updated_at BEFORE UPDATE ON public.ai_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_tokens_updated_at BEFORE UPDATE ON public.calendar_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_logs_updated_at BEFORE UPDATE ON public.call_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER campaign_alerts_set_updated_at BEFORE UPDATE ON public.campaign_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cs_updated_at BEFORE UPDATE ON public.campaign_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_kb_campaigners_outbox AFTER INSERT OR DELETE OR UPDATE ON public.campaigners FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('campaigner');
CREATE TRIGGER set_campaigner_tenant_id_before_insert BEFORE INSERT ON public.campaigners FOR EACH ROW EXECUTE FUNCTION set_campaigner_tenant_id();
CREATE TRIGGER set_campaigner_tenant_id_before_update BEFORE UPDATE ON public.campaigners FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_campaigner_tenant_id();
CREATE TRIGGER set_campaigner_tenant_id_trigger BEFORE INSERT ON public.campaigners FOR EACH ROW EXECUTE FUNCTION set_campaigner_tenant_id();
CREATE TRIGGER trg_set_campaigner_tenant_id BEFORE INSERT ON public.campaigners FOR EACH ROW EXECUTE FUNCTION set_campaigner_tenant_id();
CREATE TRIGGER update_campaigners_updated_at BEFORE UPDATE ON public.campaigners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_memory_episodes_updated_at BEFORE UPDATE ON public.carmen_memory_episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_memory_pointers_updated_at BEFORE UPDATE ON public.carmen_memory_pointers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_session_close_learn AFTER UPDATE ON public.carmen_whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION trigger_carmen_learn_from_session();
CREATE TRIGGER carmen_kb_chat_messages_outbox AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('chat_message');
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION update_chat_messages_updated_at();
CREATE TRIGGER on_onboarding_completion AFTER INSERT OR UPDATE ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION handle_onboarding_completion();
CREATE TRIGGER set_client_onboarding_tenant_id BEFORE INSERT ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION set_client_onboarding_tenant_id();
CREATE TRIGGER set_client_onboarding_tenant_id_before_insert BEFORE INSERT ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION set_client_onboarding_tenant_id();
CREATE TRIGGER set_client_onboarding_tenant_id_before_update BEFORE UPDATE ON public.client_onboarding FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_client_onboarding_tenant_id();
CREATE TRIGGER update_client_onboarding_updated_at BEFORE UPDATE ON public.client_onboarding FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_tenant_financial_data_updated_at BEFORE UPDATE ON public.client_tenant_financial_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_kb_clients_outbox AFTER INSERT OR DELETE OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('client');
CREATE TRIGGER clients_onboarding_insert AFTER INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION handle_client_onboarding_status();
CREATE TRIGGER clients_onboarding_status AFTER UPDATE OF status ON public.clients FOR EACH ROW EXECUTE FUNCTION handle_client_onboarding_status();
CREATE TRIGGER on_client_onboarding_status_change AFTER INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION handle_client_onboarding_status();
CREATE TRIGGER set_client_tenant_id_before_insert BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION set_client_tenant_id();
CREATE TRIGGER set_client_tenant_id_before_update BEFORE UPDATE ON public.clients FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_client_tenant_id();
CREATE TRIGGER set_client_tenant_id_trigger BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION set_client_tenant_id();
CREATE TRIGGER trigger_sync_client_status_to_onboarding AFTER UPDATE OF status ON public.clients FOR EACH ROW EXECUTE FUNCTION sync_client_status_to_onboarding();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_dashboards_updated_at BEFORE UPDATE ON public.crm_dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_fields_updated_at BEFORE UPDATE ON public.crm_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER validate_crm_record_trigger BEFORE INSERT OR UPDATE ON public.crm_records FOR EACH ROW EXECUTE FUNCTION trigger_validate_crm_record();
CREATE TRIGGER on_ad_account_blocked BEFORE UPDATE ON public.crm_tables FOR EACH ROW EXECUTE FUNCTION trigger_ad_account_blocked();
CREATE TRIGGER update_crm_tables_updated_at BEFORE UPDATE ON public.crm_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON public.custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_finance_updated_at BEFORE UPDATE ON public.finance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_user_permissions_updated_at BEFORE UPDATE ON public.integration_user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invitation_tokens_updated_at BEFORE UPDATE ON public.invitation_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_invoice_uploads_updated_at BEFORE UPDATE ON public.invoice_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_filter_presets_updated_at BEFORE UPDATE ON public.lead_filter_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_updates_updated_at BEFORE UPDATE ON public.lead_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER auto_sync_new_lead_trigger AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION trigger_auto_sync_new_lead();
CREATE TRIGGER on_lead_delete_track_facebook BEFORE DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION track_deleted_facebook_lead();
CREATE TRIGGER on_lead_transferred_to_onboarding AFTER UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION handle_lead_to_onboarding();
CREATE TRIGGER on_lead_won_date_update AFTER UPDATE OF won_date ON public.leads FOR EACH ROW EXECUTE FUNCTION handle_lead_to_onboarding();
CREATE TRIGGER set_lead_tenant_id_before_insert BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION set_lead_tenant_id();
CREATE TRIGGER set_lead_tenant_id_before_update BEFORE UPDATE ON public.leads FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_lead_tenant_id();
CREATE TRIGGER set_lead_tenant_id_trigger BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION set_lead_tenant_id();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manus_tasks_updated_at BEFORE UPDATE ON public.manus_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mml_updated_at BEFORE UPDATE ON public.marketing_media_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_marketing_pipeline_stages_updated BEFORE UPDATE ON public.marketing_pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_marketing_pipelines_updated BEFORE UPDATE ON public.marketing_pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mruns_updated BEFORE UPDATE ON public.marketing_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mst_updated BEFORE UPDATE ON public.marketing_stage_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mtrig_updated BEFORE UPDATE ON public.marketing_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_marketing_work_items_updated BEFORE UPDATE ON public.marketing_work_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_maskyoo_overrides_updated_at BEFORE UPDATE ON public.maskyoo_manual_overrides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER maskyoo_numbers_updated_at BEFORE UPDATE ON public.maskyoo_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maskyoo_settings_updated_at BEFORE UPDATE ON public.maskyoo_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_product_tenant_id_before_insert BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION set_product_tenant_id();
CREATE TRIGGER set_product_tenant_id_before_update BEFORE UPDATE ON public.products FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_product_tenant_id();
CREATE TRIGGER set_product_tenant_id_trigger BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION set_product_tenant_id();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_campaigner_assignment AFTER UPDATE OF campaigner_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_campaigner_assignment();
CREATE TRIGGER on_sales_person_assignment AFTER UPDATE OF sales_person_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_sales_person_assignment();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rank_keywords_updated_at BEFORE UPDATE ON public.rank_tracking_keywords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rank_projects_updated_at BEFORE UPDATE ON public.rank_tracking_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_alerts_updated_at BEFORE UPDATE ON public.report_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_people_updated_at BEFORE UPDATE ON public.sales_people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER seo_call_snapshots_updated_at BEFORE UPDATE ON public.seo_call_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_tracking_id_trigger BEFORE INSERT ON public.site_tracking_configs FOR EACH ROW EXECUTE FUNCTION set_tracking_id();
CREATE TRIGGER update_site_tracking_configs_updated_at BEFORE UPDATE ON public.site_tracking_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER social_comments_set_updated_at BEFORE UPDATE ON public.social_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER social_pages_set_updated_at BEFORE UPDATE ON public.social_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER social_pub_set_updated_at BEFORE UPDATE ON public.social_publications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sync_jobs_updated_at BEFORE UPDATE ON public.sync_jobs FOR EACH ROW EXECUTE FUNCTION update_chat_messages_updated_at();
CREATE TRIGGER update_task_updates_updated_at BEFORE UPDATE ON public.task_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER carmen_kb_tasks_outbox AFTER INSERT OR DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('task');
CREATE TRIGGER set_task_tenant_id_before_insert BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_task_tenant_id();
CREATE TRIGGER set_task_tenant_id_before_update BEFORE UPDATE ON public.tasks FOR EACH ROW WHEN ((new.tenant_id IS NULL)) EXECUTE FUNCTION set_task_tenant_id();
CREATE TRIGGER trg_notify_task_assigned AFTER INSERT OR UPDATE OF campaigner_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();
CREATE TRIGGER trg_set_task_tenant_id BEFORE INSERT OR UPDATE OF client_id, agency_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_task_tenant_id();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_telephony_settings_updated_at BEFORE UPDATE ON public.telephony_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_integration_disconnected BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION trigger_integration_disconnected();
CREATE TRIGGER update_tenant_integrations_updated_at BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_terminology_updated_at BEFORE UPDATE ON public.tenant_terminology FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_cleanup_user_active_tenant AFTER DELETE ON public.tenant_users FOR EACH ROW EXECUTE FUNCTION cleanup_user_active_tenant();
CREATE TRIGGER on_tenant_created_init_lead_statuses AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION handle_new_tenant_lead_statuses();
CREATE TRIGGER on_tenant_created_pipeline_stages AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION handle_new_tenant_pipeline_stages();
CREATE TRIGGER trg_handle_new_tenant_menu_items AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION handle_new_tenant_menu_items();
CREATE TRIGGER trigger_new_tenant_menu_items AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION handle_new_tenant_menu_items();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entry_breaks_updated_at BEFORE UPDATE ON public.time_entry_breaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_active_tenant_updated_at BEFORE UPDATE ON public.user_active_tenant FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_user_workspace_layout_updated_at BEFORE UPDATE ON public.user_workspace_layout FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_groups_updated_at BEFORE UPDATE ON public.whatsapp_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------- GRANTS (public schema) ----------
GRANT ALL ON TABLE public.agencies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agency_tenant_access TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_action_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_approval_queue TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_eval_runs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_evals TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_goals TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_knowledge_folders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_knowledge_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_mcp_connections TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_memory TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_runs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_supervisors TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_tasks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_tools TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.agent_user_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ahrefs_reports TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_agents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_conversations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_detection_brands TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_detection_competitor_results TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_detection_prompts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_detection_results TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_detection_scores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_memory TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_skills TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.automation_executions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.automation_flow_steps TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.automation_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.automation_shared_tenants TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.automations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.blocked_contacts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.calendar_shares TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.calendar_tokens TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.call_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaign_alerts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaign_schedules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaigner_agencies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaigners TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.carmen_memory_episodes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.carmen_memory_outbox TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.carmen_memory_pointers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.carmen_whatsapp_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.chat_contact_tags TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.chat_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.chat_tags TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_contacts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_credentials TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_onboarding TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_team TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_tenant_financial_data TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_updates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.communication_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.crm_dashboards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.crm_fields TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.crm_records TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.crm_tables TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.custom_fields TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dashboard_shares TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.deleted_facebook_leads TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.error_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expense_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.flow_processed_leads TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.global_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_allowed_labels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_blocked_senders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_category_rules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_message_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_tokens TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.goals TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.heartbeat_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hidden_chats TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.import_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.income_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.integration_alerts_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.integration_health TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.integration_tenant_access TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.integration_user_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.invitation_tokens TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.invoice_uploads TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_queue TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lead_filter_presets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lead_pipeline_stages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lead_sales_people TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lead_statuses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lead_updates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.leads TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.manually_read_contacts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.manus_tasks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_assets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_item_transitions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_media_library TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_pipeline_stages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_pipelines TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_runs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_stage_templates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_triggers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.marketing_work_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.maskyoo_manual_overrides TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.maskyoo_numbers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.maskyoo_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.menu_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.one_time_incomes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payment_links TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.processed_events TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.processed_webhook_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_alert_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_alerts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_competitors TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_keywords TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rank_tracking_projects TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.report_alerts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sales_people TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sales_person_agencies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.seo_call_snapshots TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.seo_monthly_updates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.signature_documents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.signature_recipients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.site_events TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.site_pageviews TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.site_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.site_tracking_configs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.site_visitors TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_comments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_gantt_posts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_media_channels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_media_post_channels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_media_posts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_media_wordpress_sites TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_pages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.social_publications TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.supplier_invoices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sync_jobs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.table_shares TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_collaborators TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_updates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tasks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_channel_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_channel_invites TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_channel_members TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_channel_whatsapp_links TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_channels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_chat_files TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_message_attachments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_message_reactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_message_read_status TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.telegram_bot_state TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.telegram_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.telephony_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_heartbeat_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_integrations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_rate_limits TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_templates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_terminology TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenant_users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tenants TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.terminology_presets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.time_entries TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.time_entry_breaks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_active_tenant TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_managed_agencies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_roles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_workspace_layout TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_groups TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.woocommerce_customers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.woocommerce_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.woocommerce_products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.woocommerce_sync_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.zoom_recordings TO anon, authenticated, service_role;

-- ---------- ENABLE ROW LEVEL SECURITY ----------
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_mcp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahrefs_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_detection_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_detection_competitor_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_detection_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_detection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_detection_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_shared_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigner_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carmen_memory_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carmen_memory_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carmen_memory_pointers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carmen_whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tenant_financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_facebook_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_processed_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_allowed_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_blocked_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sales_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manually_read_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manus_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_item_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maskyoo_manual_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maskyoo_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maskyoo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_time_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_person_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_call_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_monthly_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_tracking_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_gantt_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_post_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_wordpress_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_message_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_heartbeat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_terminology ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminology_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_managed_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspace_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_recordings ENABLE ROW LEVEL SECURITY;

-- ---------- RLS POLICIES ----------
CREATE POLICY "Authenticated users can delete agencies" ON public.agencies AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Authenticated users can insert agencies" ON public.agencies AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Authenticated users can update agencies" ON public.agencies AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Campaigners view assigned agencies" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'campaigner'::app_role) AND (id = ANY (get_user_agency_ids(auth.uid())))));
CREATE POLICY "Owners can create agencies in their tenants" ON public.agencies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can delete agencies in their tenants" ON public.agencies AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = agencies.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can insert agencies" ON public.agencies AS PERMISSIVE FOR INSERT TO public WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can manage agencies in their tenant" ON public.agencies AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Owners can update agencies" ON public.agencies AS PERMISSIVE FOR UPDATE TO public USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = agencies.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can update agencies in their tenants" ON public.agencies AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = agencies.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners view all agencies in tenant" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Sales people view assigned agencies" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'sales_person'::app_role) AND (id = ANY (get_user_sales_person_agency_ids(auth.uid())))));
CREATE POLICY "Super admins can manage agencies with permission" ON public.agencies AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = agencies.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = agencies.tenant_id)) = true)));
CREATE POLICY "Super admins can view agencies with permission" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = agencies.tenant_id)) = true)));
CREATE POLICY "Super admins view agencies with permission" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = agencies.tenant_id)) = true)));
CREATE POLICY "Team managers view managed agencies" ON public.agencies AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), id) AND ((tenant_id = get_effective_tenant_id()) OR user_has_cross_tenant_agency_access(auth.uid(), id))));
CREATE POLICY "Users can view cross-tenant shared agencies" ON public.agencies AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.agency_id = agencies.id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Owners can manage their tenant agency access" ON public.agency_tenant_access AS PERMISSIVE FOR ALL TO public USING ((has_role(auth.uid(), 'owner'::app_role) AND ((source_tenant_id = get_user_tenant_id(auth.uid())) OR (accessing_tenant_id = get_user_tenant_id(auth.uid()))))) WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) AND ((source_tenant_id = get_user_tenant_id(auth.uid())) OR (accessing_tenant_id = get_user_tenant_id(auth.uid())))));
CREATE POLICY "Super admins can manage all agency_tenant_access" ON public.agency_tenant_access AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view their tenant agency access" ON public.agency_tenant_access AS PERMISSIVE FOR SELECT TO public USING (((source_tenant_id = get_user_tenant_id(auth.uid())) OR (accessing_tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY action_log_insert ON public.agent_action_log AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY action_log_select ON public.agent_action_log AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY approval_insert ON public.agent_approval_queue AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY approval_select ON public.agent_approval_queue AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY approval_update ON public.agent_approval_queue AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "tenant manage eval_runs" ON public.agent_eval_runs AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant read eval_runs" ON public.agent_eval_runs AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant manage evals" ON public.agent_evals AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant read evals" ON public.agent_evals AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant access agent_goals" ON public.agent_goals AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant access agent_knowledge_folders" ON public.agent_knowledge_folders AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant access agent_knowledge_items" ON public.agent_knowledge_items AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant manage mcp" ON public.agent_mcp_connections AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant read mcp" ON public.agent_mcp_connections AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant access agent_memory" ON public.agent_memory AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant members can insert runs" ON public.agent_runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Tenant members can update their runs" ON public.agent_runs AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Tenant members can view runs" ON public.agent_runs AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant manage supervisors" ON public.agent_supervisors AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant read supervisors" ON public.agent_supervisors AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role full access on agent_tasks" ON public.agent_tasks AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete agent tasks in their tenant" ON public.agent_tasks AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can insert agent tasks in their tenant" ON public.agent_tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update agent tasks in their tenant" ON public.agent_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view agent tasks in their tenant" ON public.agent_tasks AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY tools_read ON public.agent_tools AS PERMISSIVE FOR SELECT TO public USING (((tenant_id IS NULL) OR (tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))));
CREATE POLICY tools_write ON public.agent_tools AS PERMISSIVE FOR ALL TO public USING (((tenant_id IS NOT NULL) AND (tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))))) WITH CHECK (((tenant_id IS NOT NULL) AND (tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))));
CREATE POLICY aup_tenant_modify ON public.agent_user_profiles AS PERMISSIVE FOR ALL TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))) WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY aup_tenant_select ON public.agent_user_profiles AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Restrict campaigner ahrefs reports to assigned clients" ON public.ahrefs_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT user_is_restricted_client_viewer(auth.uid())) OR ((client_id IS NOT NULL) AND user_can_access_client(auth.uid(), client_id))));
CREATE POLICY "Service role can manage ahrefs_reports" ON public.ahrefs_reports AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete ahrefs_reports in their tenant" ON public.ahrefs_reports AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert ahrefs_reports in their tenant" ON public.ahrefs_reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update ahrefs_reports in their tenant" ON public.ahrefs_reports AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view ahrefs_reports in their tenant" ON public.ahrefs_reports AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.agency_id = ahrefs_reports.agency_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY "Users can delete agents in their tenant" ON public.ai_agents AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can insert agents in their tenant" ON public.ai_agents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update agents in their tenant" ON public.ai_agents AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view agents in their tenant" ON public.ai_agents AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete own conversations" ON public.ai_conversations AS PERMISSIVE FOR DELETE TO public USING (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can insert own conversations" ON public.ai_conversations AS PERMISSIVE FOR INSERT TO public WITH CHECK (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update own conversations" ON public.ai_conversations AS PERMISSIVE FOR UPDATE TO public USING (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can view own conversations in their tenant" ON public.ai_conversations AS PERMISSIVE FOR SELECT TO public USING ((((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant isolation for ai_detection_brands" ON public.ai_detection_brands AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))) WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Tenant isolation for ai_detection_competitor_results" ON public.ai_detection_competitor_results AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))) WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Tenant isolation for ai_detection_prompts" ON public.ai_detection_prompts AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))) WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Tenant isolation for ai_detection_results" ON public.ai_detection_results AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))) WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Tenant isolation for ai_detection_scores" ON public.ai_detection_scores AS PERMISSIVE FOR ALL TO authenticated USING ((brand_id IN ( SELECT ai_detection_brands.id
   FROM ai_detection_brands
  WHERE (ai_detection_brands.tenant_id IN ( SELECT tenant_users.tenant_id
           FROM tenant_users
          WHERE (tenant_users.user_id = auth.uid())))))) WITH CHECK ((brand_id IN ( SELECT ai_detection_brands.id
   FROM ai_detection_brands
  WHERE (ai_detection_brands.tenant_id IN ( SELECT tenant_users.tenant_id
           FROM tenant_users
          WHERE (tenant_users.user_id = auth.uid()))))));
CREATE POLICY "Users can delete own memory" ON public.ai_memory AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own memory" ON public.ai_memory AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own memory" ON public.ai_memory AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own memory" ON public.ai_memory AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "All authenticated can read global skills" ON public.ai_skills AS PERMISSIVE FOR SELECT TO authenticated USING ((scope = 'global'::text));
CREATE POLICY "Super admin manages global skills" ON public.ai_skills AS PERMISSIVE FOR ALL TO authenticated USING (((scope = 'global'::text) AND is_super_admin(auth.uid()))) WITH CHECK (((scope = 'global'::text) AND is_super_admin(auth.uid())));
CREATE POLICY "Users can create their own skills" ON public.ai_skills AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (tenant_id = ( SELECT get_effective_tenant_id() AS get_effective_tenant_id))));
CREATE POLICY "Users can delete their own skills" ON public.ai_skills AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND (tenant_id = ( SELECT get_effective_tenant_id() AS get_effective_tenant_id))));
CREATE POLICY "Users can update their own skills" ON public.ai_skills AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (tenant_id = ( SELECT get_effective_tenant_id() AS get_effective_tenant_id))));
CREATE POLICY "Users can view their own skills" ON public.ai_skills AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND (tenant_id = ( SELECT get_effective_tenant_id() AS get_effective_tenant_id))));
CREATE POLICY "Tenant isolation for automation_executions" ON public.automation_executions AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete flow steps in their tenant" ON public.automation_flow_steps AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert flow steps in their tenant" ON public.automation_flow_steps AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update flow steps in their tenant" ON public.automation_flow_steps AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view flow steps in their tenant" ON public.automation_flow_steps AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view shared mirror flow steps" ON public.automation_flow_steps AS PERMISSIVE FOR SELECT TO authenticated USING (is_automation_shared_to_tenant(automation_id, get_effective_tenant_id()));
CREATE POLICY "Service role can insert automation logs" ON public.automation_logs AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can view automation logs in their tenant" ON public.automation_logs AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM automations
  WHERE ((automations.id = automation_logs.automation_id) AND ((automations.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY ast_delete_source_admin ON public.automation_shared_tenants AS PERMISSIVE FOR DELETE TO authenticated USING ((is_super_admin(auth.uid()) OR is_user_admin_of_automation_source_tenant(automation_id, auth.uid())));
CREATE POLICY ast_insert_source_admin ON public.automation_shared_tenants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_super_admin(auth.uid()) OR is_user_admin_of_automation_source_tenant(automation_id, auth.uid())));
CREATE POLICY ast_select_members ON public.automation_shared_tenants AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.tenant_id = automation_shared_tenants.tenant_id)))) OR is_user_in_automation_source_tenant(automation_id, auth.uid())));
CREATE POLICY "Owners can manage automations" ON public.automations AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Super admins can manage automations with permission" ON public.automations AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = automations.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = automations.tenant_id)) = true)));
CREATE POLICY "Super admins can view automations with permission" ON public.automations AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = automations.tenant_id)) = true)));
CREATE POLICY "Users can view automations in their tenant" ON public.automations AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view shared mirror automations" ON public.automations AS PERMISSIVE FOR SELECT TO authenticated USING (is_automation_shared_to_tenant(id, get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete their own blocked contacts" ON public.blocked_contacts AS PERMISSIVE FOR DELETE TO public USING (((connection_user_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert their own blocked contacts" ON public.blocked_contacts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((connection_user_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view their own blocked contacts" ON public.blocked_contacts AS PERMISSIVE FOR SELECT TO public USING (((connection_user_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete their own shares" ON public.calendar_shares AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = owner_user_id));
CREATE POLICY "Users can share their own calendar" ON public.calendar_shares AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = owner_user_id) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update their own shares" ON public.calendar_shares AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = owner_user_id));
CREATE POLICY "Users can view their calendar shares" ON public.calendar_shares AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = owner_user_id) OR (auth.uid() = shared_with_user_id) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete their own calendar token" ON public.calendar_tokens AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own calendar tokens" ON public.calendar_tokens AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own calendar token" ON public.calendar_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own calendar tokens" ON public.calendar_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read their own calendar token" ON public.calendar_tokens AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own calendar token" ON public.calendar_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own calendar tokens" ON public.calendar_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own calendar tokens" ON public.calendar_tokens AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert call logs in their tenant" ON public.call_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update call logs in their tenant" ON public.call_logs AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can view call logs in their tenant" ON public.call_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "tenant members can update alerts" ON public.campaign_alerts AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members can view alerts" ON public.campaign_alerts AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.source_tenant_id = campaign_alerts.tenant_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY cs_tenant_delete ON public.campaign_schedules AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY cs_tenant_insert ON public.campaign_schedules AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY cs_tenant_select ON public.campaign_schedules AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY cs_tenant_update ON public.campaign_schedules AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can assign campaigners to accessible agencies" ON public.campaigner_agencies AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))) AND (EXISTS ( SELECT 1
   FROM campaigners c
  WHERE ((c.id = campaigner_agencies.campaigner_id) AND (c.tenant_id = get_user_tenant_id(auth.uid()))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE ((ata.accessing_tenant_id = get_user_tenant_id(auth.uid())) AND (ata.access_level = 'read_write'::text))))))));
CREATE POLICY "Users can delete campaigner_agencies" ON public.campaigner_agencies AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))) AND (EXISTS ( SELECT 1
   FROM campaigners c
  WHERE ((c.id = campaigner_agencies.campaigner_id) AND (c.tenant_id = get_user_tenant_id(auth.uid()))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE ((ata.accessing_tenant_id = get_user_tenant_id(auth.uid())) AND (ata.access_level = 'read_write'::text))))))));
CREATE POLICY "Users can update campaigner_agencies" ON public.campaigner_agencies AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))) AND (EXISTS ( SELECT 1
   FROM campaigners c
  WHERE ((c.id = campaigner_agencies.campaigner_id) AND (c.tenant_id = get_user_tenant_id(auth.uid()))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE ((ata.accessing_tenant_id = get_user_tenant_id(auth.uid())) AND (ata.access_level = 'read_write'::text)))))))) WITH CHECK ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))) AND (EXISTS ( SELECT 1
   FROM campaigners c
  WHERE ((c.id = campaigner_agencies.campaigner_id) AND (c.tenant_id = get_user_tenant_id(auth.uid()))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE ((ata.accessing_tenant_id = get_user_tenant_id(auth.uid())) AND (ata.access_level = 'read_write'::text))))))));
CREATE POLICY "Users can view campaigner_agencies" ON public.campaigner_agencies AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM campaigners c
  WHERE ((c.id = campaigner_agencies.campaigner_id) AND (c.tenant_id = get_user_tenant_id(auth.uid()))))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE (ata.accessing_tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Super admins can manage campaigners with permission" ON public.campaigners AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = campaigners.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = campaigners.tenant_id)) = true)));
CREATE POLICY "Super admins can view campaigners with permission" ON public.campaigners AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = campaigners.tenant_id)) = true)));
CREATE POLICY "Team managers and owners can insert campaigners" ON public.campaigners AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR (tenant_id IN ( SELECT ur.tenant_id
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role])))))));
CREATE POLICY "Team managers can view cross-tenant campaigners on their client" ON public.campaigners AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'team_manager'::app_role) AND (id = ANY (COALESCE(get_cross_tenant_campaigner_ids(auth.uid()), ARRAY[]::uuid[])))));
CREATE POLICY "Users can delete campaigners in their tenant" ON public.campaigners AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = campaigners.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update campaigners in their tenant" ON public.campaigners AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = campaigners.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role]))))))) WITH CHECK ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = campaigners.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role])))))));
CREATE POLICY "Users can view campaigners in their active tenant" ON public.campaigners AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "View campaigners linked to cross-tenant agencies" ON public.campaigners AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_cross_tenant_campaigner(id, auth.uid()));
CREATE POLICY cme_select_tenant ON public.carmen_memory_episodes AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY cmp_select_tenant ON public.carmen_memory_pointers AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant members can update carmen sessions" ON public.carmen_whatsapp_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant members can view carmen sessions" ON public.carmen_whatsapp_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users and admins can manage contact tags" ON public.chat_contact_tags AS PERMISSIVE FOR ALL TO public USING (((user_id = auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'agency_owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role))) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view contact tags in their tenant" ON public.chat_contact_tags AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can update blocked status" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Users can delete their connection messages" ON public.chat_messages AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR (connection_user_id = auth.uid()) OR (sent_by_user_id = auth.uid())));
CREATE POLICY "Users can delete their own connection messages" ON public.chat_messages AS PERMISSIVE FOR DELETE TO public USING (((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can insert chat_messages in their tenant" ON public.chat_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert messages through their connection" ON public.chat_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR ((connection_user_id = auth.uid()) AND (sent_by_user_id = auth.uid()))));
CREATE POLICY "Users can insert their own connection messages" ON public.chat_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update chat_messages in their tenant" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update their connection messages" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR (connection_user_id = auth.uid()) OR (sent_by_user_id = auth.uid())));
CREATE POLICY "Users can update their own connection messages" ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public USING (((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid())))) WITH CHECK (((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can view their own connection messages" ON public.chat_messages AS PERMISSIVE FOR SELECT TO public USING (((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid())) AND (is_blocked = false)));
CREATE POLICY "Users view their connection messages in current tenant" ON public.chat_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR ((connection_user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid())) AND (is_blocked = false))));
CREATE POLICY "Owners can manage tags in their tenant" ON public.chat_tags AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can manage tags in their tenant" ON public.chat_tags AS PERMISSIVE FOR ALL TO public USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view tags in their tenant" ON public.chat_tags AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete client contacts in their tenant" ON public.client_contacts AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can insert client contacts in their tenant" ON public.client_contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update client contacts in their tenant" ON public.client_contacts AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can view client contacts in their tenant" ON public.client_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can delete credentials in their tenant" ON public.client_credentials AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can insert credentials in their tenant" ON public.client_credentials AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can update credentials in their tenant" ON public.client_credentials AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can view credentials in their tenant" ON public.client_credentials AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Super admins can manage client_onboarding with permission" ON public.client_onboarding AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = client_onboarding.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = client_onboarding.tenant_id)) = true)));
CREATE POLICY "Super admins can view client_onboarding with permission" ON public.client_onboarding AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = client_onboarding.tenant_id)) = true)));
CREATE POLICY "Team managers can manage client_onboarding from managed agencie" ON public.client_onboarding AS PERMISSIVE FOR ALL TO authenticated USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'team_manager'::app_role) AND (user_manages_agency(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_onboarding.client_id) AND user_manages_agency(auth.uid(), c.agency_id))))))))) WITH CHECK ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'team_manager'::app_role) AND (user_manages_agency(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_onboarding.client_id) AND user_manages_agency(auth.uid(), c.agency_id)))))))));
CREATE POLICY "Team managers can view client_onboarding from managed agencies" ON public.client_onboarding AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'team_manager'::app_role) AND (user_manages_agency(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_onboarding.client_id) AND user_manages_agency(auth.uid(), c.agency_id))))))) OR (has_role(auth.uid(), 'team_manager'::app_role) AND (user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_onboarding.client_id) AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)))))))));
CREATE POLICY "Users can manage client_onboarding in their tenant" ON public.client_onboarding AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.agency_id = client_onboarding.agency_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY "Users can view client_onboarding from shared agencies" ON public.client_onboarding AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_onboarding.client_id) AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id))))));
CREATE POLICY "Users can view client_onboarding in their tenant" ON public.client_onboarding AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete client_suppliers in their tenant" ON public.client_suppliers AS PERMISSIVE FOR DELETE TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can insert client_suppliers in their tenant" ON public.client_suppliers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can update client_suppliers in their tenant" ON public.client_suppliers AS PERMISSIVE FOR UPDATE TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can view client_suppliers in their tenant" ON public.client_suppliers AS PERMISSIVE FOR SELECT TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can delete client_team in their tenant" ON public.client_team AS PERMISSIVE FOR DELETE TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can insert client_team in their tenant" ON public.client_team AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can update client_team in their tenant" ON public.client_team AS PERMISSIVE FOR UPDATE TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can view client_team in their tenant" ON public.client_team AS PERMISSIVE FOR SELECT TO authenticated USING (((get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can delete financial data in their tenant" ON public.client_tenant_financial_data AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert financial data in their tenant" ON public.client_tenant_financial_data AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update financial data in their tenant" ON public.client_tenant_financial_data AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (clients c
     JOIN agency_tenant_access ata ON ((ata.agency_id = c.agency_id)))
  WHERE ((c.id = client_tenant_financial_data.client_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY "Users can view financial data in their tenant" ON public.client_tenant_financial_data AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (clients c
     JOIN agency_tenant_access ata ON ((ata.agency_id = c.agency_id)))
  WHERE ((c.id = client_tenant_financial_data.client_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY "Users can create client updates in their tenant" ON public.client_updates AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete own client updates" ON public.client_updates AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can update own client updates" ON public.client_updates AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can view client updates in their tenant" ON public.client_updates AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Authenticated users can delete clients" ON public.clients AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Authenticated users can insert clients" ON public.clients AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Campaigners view assigned clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'campaigner'::app_role) AND (id = ANY (get_user_client_ids(auth.uid())))));
CREATE POLICY "Owners can delete clients in their tenants" ON public.clients AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = clients.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners view all clients in tenant" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'owner'::app_role) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))));
CREATE POLICY "SEO users view SEO-tagged clients" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'seo'::app_role) AND ((is_seo_client = true) OR (services @> ARRAY['seo'::text])) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))));
CREATE POLICY "Sales people can view clients from their agencies" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))))));
CREATE POLICY "Super admins can manage clients with permission" ON public.clients AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = clients.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = clients.tenant_id)) = true)));
CREATE POLICY "Super admins can view clients with permission" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = clients.tenant_id)) = true)));
CREATE POLICY "Super admins view clients with permission" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = clients.tenant_id)) = true)));
CREATE POLICY "Team managers view clients from managed agencies" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id) AND ((tenant_id = get_effective_tenant_id()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))));
CREATE POLICY "Users can create clients in their tenants" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'sales_person'::app_role]))))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert clients in their tenants" ON public.clients AS PERMISSIVE FOR INSERT TO public WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = ur.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'sales_person'::app_role, 'campaigner'::app_role]))))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update clients in their or shared tenants" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR (((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'sales_person'::app_role) OR (has_role(auth.uid(), 'campaigner'::app_role) AND (id = ANY (get_user_client_ids(auth.uid())))))))) WITH CHECK ((is_super_admin(auth.uid()) OR (((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'sales_person'::app_role) OR (has_role(auth.uid(), 'campaigner'::app_role) AND (id = ANY (get_user_client_ids(auth.uid()))))))));
CREATE POLICY "Service role can manage communication_logs" ON public.communication_logs AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Tenant users can insert communication_logs" ON public.communication_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant users can view communication_logs" ON public.communication_logs AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (clients c
     JOIN agency_tenant_access ata ON ((ata.agency_id = c.agency_id)))
  WHERE ((c.id = communication_logs.client_id) AND (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))));
CREATE POLICY communication_logs_tenant_access ON public.communication_logs AS PERMISSIVE FOR ALL TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can create dashboards in their tenant" ON public.crm_dashboards AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can delete dashboards in their tenant" ON public.crm_dashboards AS PERMISSIVE FOR DELETE TO public USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can update dashboards in their tenant" ON public.crm_dashboards AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can view dashboards by role scope" ON public.crm_dashboards AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR ((client_id IS NOT NULL) AND user_can_access_client(auth.uid(), client_id)) OR ((NOT user_is_restricted_client_viewer(auth.uid())) AND (client_id IS NULL) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)))));
CREATE POLICY "Owners can manage fields" ON public.crm_fields AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM crm_tables
  WHERE ((crm_tables.id = crm_fields.table_id) AND (crm_tables.tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_tables
  WHERE ((crm_tables.id = crm_fields.table_id) AND (crm_tables.tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can view fields" ON public.crm_fields AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM crm_tables
  WHERE ((crm_tables.id = crm_fields.table_id) AND ((crm_tables.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Restrict campaigner record reads to assigned clients" ON public.crm_records AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT user_is_restricted_client_viewer(auth.uid())) OR user_can_access_crm_table(auth.uid(), table_id)));
CREATE POLICY "Users can manage records in their tenant" ON public.crm_records AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view records from shared agencies" ON public.crm_records AS PERMISSIVE FOR SELECT TO public USING (((agency_id IS NOT NULL) AND (user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can view records in their tenant" ON public.crm_records AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Campaigners can manage tables for assigned clients" ON public.crm_tables AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'campaigner'::app_role) AND (client_id IS NOT NULL) AND (client_id = ANY (get_user_client_ids(auth.uid()))))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'campaigner'::app_role) AND (client_id IS NOT NULL) AND (client_id = ANY (get_user_client_ids(auth.uid())))));
CREATE POLICY "Owners can manage all tables in tenant" ON public.crm_tables AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Team managers can manage their tables" ON public.crm_tables AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'team_manager'::app_role) AND (((agency_id IS NULL) AND (client_id IS NULL)) OR user_manages_agency(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = crm_tables.client_id) AND user_manages_agency(auth.uid(), c.agency_id)))))))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'team_manager'::app_role) AND (((agency_id IS NULL) AND (client_id IS NULL)) OR user_manages_agency(auth.uid(), agency_id) OR ((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = crm_tables.client_id) AND user_manages_agency(auth.uid(), c.agency_id))))))));
CREATE POLICY "Users can view tables by role scope" ON public.crm_tables AS PERMISSIVE FOR SELECT TO authenticated USING (user_can_access_crm_table(auth.uid(), id));
CREATE POLICY "Owners can manage custom_fields" ON public.custom_fields AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view custom_fields in their tenant" ON public.custom_fields AS PERMISSIVE FOR SELECT TO public USING (((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can manage their own shares" ON public.dashboard_shares AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role full access" ON public.deleted_facebook_leads AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view deleted facebook leads in their tenant" ON public.deleted_facebook_leads AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Allow insert for all" ON public.error_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "No direct read" ON public.error_logs AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY "Users can create expense_payments in their tenant" ON public.expense_payments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete expense_payments in their tenant" ON public.expense_payments AS PERMISSIVE FOR DELETE TO public USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view expense_payments in their tenant" ON public.expense_payments AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users with finance permission can delete finance" ON public.finance AS PERMISSIVE FOR DELETE TO authenticated USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_finance_permission(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users with finance permission can insert finance" ON public.finance AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_finance_permission(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users with finance permission can update finance" ON public.finance AS PERMISSIVE FOR UPDATE TO authenticated USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_finance_permission(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users with finance permission can view finance" ON public.finance AS PERMISSIVE FOR SELECT TO authenticated USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_finance_permission(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service can manage flow processed leads" ON public.flow_processed_leads AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "Users can view flow processed leads in their tenant" ON public.flow_processed_leads AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Super admins can manage global_settings" ON public.global_settings AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view global_settings" ON public.global_settings AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can manage their own allowed labels" ON public.gmail_allowed_labels AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can manage own blocked senders" ON public.gmail_blocked_senders AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Tenant users can manage gmail categories" ON public.gmail_categories AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant users can view gmail categories" ON public.gmail_categories AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can manage own rules" ON public.gmail_category_rules AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can manage own message categories" ON public.gmail_message_categories AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own gmail tokens" ON public.gmail_tokens AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own gmail tokens" ON public.gmail_tokens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own gmail tokens" ON public.gmail_tokens AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view own gmail tokens" ON public.gmail_tokens AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete goals in their tenant" ON public.goals AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert goals in their tenant" ON public.goals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update goals in their tenant" ON public.goals AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view goals in their tenant" ON public.goals AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Service can insert heartbeat logs" ON public.heartbeat_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view heartbeat logs in their tenant" ON public.heartbeat_logs AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete their own hidden chats" ON public.hidden_chats AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert their own hidden chats" ON public.hidden_chats AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view their own hidden chats" ON public.hidden_chats AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert import_history in their tenant" ON public.import_history AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view import_history in their tenant" ON public.import_history AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can create income_payments in their tenant" ON public.income_payments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete income_payments in their tenant" ON public.income_payments AS PERMISSIVE FOR DELETE TO public USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view income_payments in their tenant" ON public.income_payments AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant members can view their integration alerts" ON public.integration_alerts_log AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant isolation for integration_health" ON public.integration_health AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can manage integration sharing" ON public.integration_tenant_access AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM tenant_integrations ti
  WHERE ((ti.id = integration_tenant_access.integration_id) AND (ti.tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view integration access for their tenant" ON public.integration_tenant_access AS PERMISSIVE FOR SELECT TO public USING (((accessing_tenant_id = get_user_tenant_id(auth.uid())) OR (EXISTS ( SELECT 1
   FROM tenant_integrations ti
  WHERE ((ti.id = integration_tenant_access.integration_id) AND (ti.tenant_id = get_user_tenant_id(auth.uid()))))) OR is_super_admin(auth.uid())));
CREATE POLICY "Integration owners can manage permissions" ON public.integration_user_permissions AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) OR user_owns_integration(integration_id))) WITH CHECK ((is_super_admin(auth.uid()) OR user_owns_integration(integration_id)));
CREATE POLICY "Super admins can manage all permissions" ON public.integration_user_permissions AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view relevant integration permissions" ON public.integration_user_permissions AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR is_super_admin(auth.uid()) OR user_owns_integration(integration_id)));
CREATE POLICY "Owners and super admins can create invitation tokens" ON public.invitation_tokens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "Service role can read invitation tokens" ON public.invitation_tokens AS PERMISSIVE FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can update invitation tokens" ON public.invitation_tokens AS PERMISSIVE FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view invitations in their tenant" ON public.invitation_tokens AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members delete invoice_uploads" ON public.invoice_uploads AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members insert invoice_uploads" ON public.invoice_uploads AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members update invoice_uploads" ON public.invoice_uploads AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members view invoice_uploads" ON public.invoice_uploads AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant isolation for job_queue" ON public.job_queue AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete their own presets" ON public.lead_filter_presets AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert their own presets" ON public.lead_filter_presets AS PERMISSIVE FOR INSERT TO public WITH CHECK (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update their own presets" ON public.lead_filter_presets AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid()));
CREATE POLICY "Users can view tenant presets" ON public.lead_filter_presets AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Owners can manage pipeline stages" ON public.lead_pipeline_stages AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view pipeline stages in their tenant" ON public.lead_pipeline_stages AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can delete lead_sales_people" ON public.lead_sales_people AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role)))));
CREATE POLICY "Owners can insert lead_sales_people" ON public.lead_sales_people AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role)))));
CREATE POLICY "Owners can update lead_sales_people" ON public.lead_sales_people AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role)))));
CREATE POLICY "Users can view lead_sales_people in their tenant" ON public.lead_sales_people AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Owners can manage statuses" ON public.lead_statuses AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)))) WITH CHECK ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))));
CREATE POLICY "Users can view statuses in their tenant" ON public.lead_statuses AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can create lead updates" ON public.lead_updates AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) AND (lead_id IN ( SELECT l.id
   FROM leads l
  WHERE ((l.agency_id = ANY (get_user_agency_ids(auth.uid()))) OR has_role(auth.uid(), 'owner'::app_role) OR (l.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))))))));
CREATE POLICY "Users can delete own lead updates" ON public.lead_updates AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own lead updates" ON public.lead_updates AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view lead updates" ON public.lead_updates AS PERMISSIVE FOR SELECT TO public USING ((lead_id IN ( SELECT l.id
   FROM leads l
  WHERE ((l.agency_id = ANY (get_user_agency_ids(auth.uid()))) OR has_role(auth.uid(), 'owner'::app_role) OR (l.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))))));
CREATE POLICY "Owners can delete leads in their tenants" ON public.leads AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = leads.tenant_id) AND (ur.role = 'owner'::app_role)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners view all leads in tenant" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'owner'::app_role) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))));
CREATE POLICY "Sales people view assigned leads" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'sales_person'::app_role) AND (tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM lead_sales_people lsp
  WHERE ((lsp.lead_id = leads.id) AND (lsp.tenant_id = leads.tenant_id) AND (lsp.sales_person_id = get_user_sales_person_id(auth.uid())))))));
CREATE POLICY "Super admins can manage leads with permission" ON public.leads AS PERMISSIVE FOR ALL TO authenticated USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = leads.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = leads.tenant_id)) = true)));
CREATE POLICY "Super admins can view leads with permission" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = leads.tenant_id)) = true)));
CREATE POLICY "Team managers view leads from managed agencies" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'team_manager'::app_role) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR ((agency_id IS NOT NULL) AND user_manages_agency(auth.uid(), agency_id)) OR ((agency_id IS NOT NULL) AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)))));
CREATE POLICY "Users can create leads in their tenants" ON public.leads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = leads.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role]))))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update leads in their tenants" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR (((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'sales_person'::app_role))))) WITH CHECK ((is_super_admin(auth.uid()) OR (((tenant_id = get_user_tenant_id(auth.uid())) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'sales_person'::app_role)))));
CREATE POLICY "Users can delete their own marked read contacts" ON public.manually_read_contacts AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own marked read contacts" ON public.manually_read_contacts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own marked read contacts" ON public.manually_read_contacts AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Super admins can manage all manus tasks" ON public.manus_tasks AS PERMISSIVE FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can delete manus tasks in their tenant" ON public.manus_tasks AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can insert manus tasks in their tenant" ON public.manus_tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can update manus tasks in their tenant" ON public.manus_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can view manus tasks in their tenant" ON public.manus_tasks AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "tenant members manage assets" ON public.marketing_assets AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_insert_transitions ON public.marketing_item_transitions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY tenant_select_transitions ON public.marketing_item_transitions AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY mml_tenant_delete ON public.marketing_media_library AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY mml_tenant_insert ON public.marketing_media_library AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY mml_tenant_select ON public.marketing_media_library AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY mml_tenant_update ON public.marketing_media_library AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_all_stages ON public.marketing_pipeline_stages AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY tenant_all_pipelines ON public.marketing_pipelines AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "tenant members read runs" ON public.marketing_runs AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members update runs" ON public.marketing_runs AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members write runs" ON public.marketing_runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members manage templates" ON public.marketing_stage_templates AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members manage triggers" ON public.marketing_triggers AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_all_items ON public.marketing_work_items AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "Delete maskyoo overrides" ON public.maskyoo_manual_overrides AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_effective_tenant_id()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.source_tenant_id = maskyoo_manual_overrides.tenant_id) AND (ata.agency_id = ANY (get_user_agency_ids(auth.uid()))))))));
CREATE POLICY "Insert maskyoo overrides" ON public.maskyoo_manual_overrides AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR (tenant_id = get_effective_tenant_id()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.source_tenant_id = maskyoo_manual_overrides.tenant_id) AND (ata.agency_id = ANY (get_user_agency_ids(auth.uid()))))))));
CREATE POLICY "Update maskyoo overrides" ON public.maskyoo_manual_overrides AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_effective_tenant_id()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.source_tenant_id = maskyoo_manual_overrides.tenant_id) AND (ata.agency_id = ANY (get_user_agency_ids(auth.uid()))))))));
CREATE POLICY "View maskyoo overrides" ON public.maskyoo_manual_overrides AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_effective_tenant_id()) OR (EXISTS ( SELECT 1
   FROM agency_tenant_access ata
  WHERE ((ata.source_tenant_id = maskyoo_manual_overrides.tenant_id) AND (ata.agency_id = ANY (get_user_agency_ids(auth.uid()))))))));
CREATE POLICY "tenant members delete maskyoo_numbers" ON public.maskyoo_numbers AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members insert maskyoo_numbers" ON public.maskyoo_numbers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members read maskyoo_numbers" ON public.maskyoo_numbers AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant members update maskyoo_numbers" ON public.maskyoo_numbers AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant members read maskyoo settings" ON public.maskyoo_settings AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Tenant owners manage maskyoo settings" ON public.maskyoo_settings AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can manage menu_items" ON public.menu_items AS PERMISSIVE FOR ALL TO public USING ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid()))) WITH CHECK ((((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can update menu_items" ON public.menu_items AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Super admins can manage all menu_items" ON public.menu_items AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant owners and super admins can update menu_items" ON public.menu_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.tenant_id = menu_items.tenant_id) AND (tu.role = 'owner'::text)))))));
CREATE POLICY "Users can view menu_items in their tenant" ON public.menu_items AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete one_time_incomes in their tenant" ON public.one_time_incomes AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert one_time_incomes in their tenant" ON public.one_time_incomes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update one_time_incomes in their tenant" ON public.one_time_incomes AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view one_time_incomes in their tenant" ON public.one_time_incomes AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can create payment links in their tenant" ON public.payment_links AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can delete payment links in their tenant" ON public.payment_links AS PERMISSIVE FOR DELETE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can update payment links in their tenant" ON public.payment_links AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can view payment links from their tenant" ON public.payment_links AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Tenant isolation for processed_events" ON public.processed_events AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Super admins can manage products with permission" ON public.products AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = products.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = products.tenant_id)) = true)));
CREATE POLICY "Super admins can view products with permission" ON public.products AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = products.tenant_id)) = true)));
CREATE POLICY "Users can delete products in their tenant" ON public.products AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert products in their tenant" ON public.products AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update products in their tenant" ON public.products AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view products in their tenant" ON public.products AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR ((agency_id IS NOT NULL) AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))));
CREATE POLICY "Owners and super admins can update profiles in their tenants" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN tenant_users tu ON ((tu.tenant_id = ur.tenant_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'owner'::app_role) AND (tu.user_id = profiles.id))))));
CREATE POLICY "Service role can insert profiles" ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Super admins can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((id IN ( SELECT tu1.user_id
   FROM tenant_users tu1
  WHERE (tu1.tenant_id IN ( SELECT tu2.tenant_id
           FROM tenant_users tu2
          WHERE (tu2.user_id = auth.uid()))))));
CREATE POLICY "Users can view their own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Users can view alert logs through alert" ON public.rank_tracking_alert_logs AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (rank_tracking_alerts a
     JOIN rank_tracking_projects p ON ((p.id = a.project_id)))
  WHERE ((a.id = rank_tracking_alert_logs.alert_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can manage alerts through project" ON public.rank_tracking_alerts AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_alerts.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can view alerts through project" ON public.rank_tracking_alerts AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_alerts.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can manage competitors through project" ON public.rank_tracking_competitors AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_competitors.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can view competitors through project" ON public.rank_tracking_competitors AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_competitors.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can create history through project" ON public.rank_tracking_history AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM (rank_tracking_keywords k
     JOIN rank_tracking_projects p ON ((p.id = k.project_id)))
  WHERE ((k.id = rank_tracking_history.keyword_id) AND (p.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Users can view history through project" ON public.rank_tracking_history AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (rank_tracking_keywords k
     JOIN rank_tracking_projects p ON ((p.id = k.project_id)))
  WHERE ((k.id = rank_tracking_history.keyword_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can create keywords through project" ON public.rank_tracking_keywords AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_keywords.project_id) AND (p.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Users can delete keywords through project" ON public.rank_tracking_keywords AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_keywords.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can update keywords through project" ON public.rank_tracking_keywords AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_keywords.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can view keywords through project" ON public.rank_tracking_keywords AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM rank_tracking_projects p
  WHERE ((p.id = rank_tracking_keywords.project_id) AND ((p.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Users can create rank tracking projects in their tenant" ON public.rank_tracking_projects AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete rank tracking projects in their tenant" ON public.rank_tracking_projects AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update rank tracking projects in their tenant" ON public.rank_tracking_projects AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view rank tracking projects in their tenant" ON public.rank_tracking_projects AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can create alerts in their tenant" ON public.report_alerts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can delete alerts in their tenant" ON public.report_alerts AS PERMISSIVE FOR DELETE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can update alerts in their tenant" ON public.report_alerts AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can view alerts in their tenant" ON public.report_alerts AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Super admins can manage sales_people with permission" ON public.sales_people AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = sales_people.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = sales_people.tenant_id)) = true)));
CREATE POLICY "Super admins can view sales_people with permission" ON public.sales_people AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = sales_people.tenant_id)) = true)));
CREATE POLICY "Users can delete sales_people in their tenant" ON public.sales_people AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert sales_people in their tenant" ON public.sales_people AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update sales_people in their tenant" ON public.sales_people AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view sales_people in their tenant" ON public.sales_people AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can manage sales_person_agencies" ON public.sales_person_agencies AS PERMISSIVE FOR ALL TO authenticated USING ((has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid()))) WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view sales_person_agencies in their tenant" ON public.sales_person_agencies AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM sales_people
  WHERE ((sales_people.id = sales_person_agencies.sales_person_id) AND ((sales_people.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))))));
CREATE POLICY "Delete snapshots in tenant or shared agency" ON public.seo_call_snapshots AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Insert snapshots in tenant or shared agency" ON public.seo_call_snapshots AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Read snapshots in tenant or shared agency" ON public.seo_call_snapshots AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Update snapshots in tenant or shared agency" ON public.seo_call_snapshots AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY seo_monthly_updates_tenant_access ON public.seo_monthly_updates AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)));
CREATE POLICY "Users can create documents in their tenant" ON public.signature_documents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete documents in their tenant" ON public.signature_documents AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update documents in their tenant" ON public.signature_documents AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view documents in their tenant" ON public.signature_documents AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete recipients in their tenant" ON public.signature_recipients AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can manage recipients in their tenant" ON public.signature_recipients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update recipients in their tenant" ON public.signature_recipients AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view recipients in their tenant" ON public.signature_recipients AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role can insert events" ON public.site_events AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can view events in their tenant" ON public.site_events AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role can insert pageviews" ON public.site_pageviews AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update pageviews" ON public.site_pageviews AS PERMISSIVE FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view pageviews in their tenant" ON public.site_pageviews AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role can insert sessions" ON public.site_sessions AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update sessions" ON public.site_sessions AS PERMISSIVE FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view sessions in their tenant" ON public.site_sessions AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete tracking configs in their tenant" ON public.site_tracking_configs AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert tracking configs in their tenant" ON public.site_tracking_configs AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update tracking configs in their tenant" ON public.site_tracking_configs AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view tracking configs in their tenant" ON public.site_tracking_configs AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Service role can insert visitors" ON public.site_visitors AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update visitors" ON public.site_visitors AS PERMISSIVE FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view visitors in their tenant" ON public.site_visitors AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_comments modify" ON public.social_comments AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_comments select" ON public.social_comments AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY delete_own_tenant ON public.social_gantt_posts AS PERMISSIVE FOR DELETE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY insert_own_tenant ON public.social_gantt_posts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY select_own_tenant ON public.social_gantt_posts AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY update_own_tenant ON public.social_gantt_posts AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY tenant_isolation ON public.social_media_channels AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_isolation ON public.social_media_post_channels AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM social_media_posts p
  WHERE ((p.id = social_media_post_channels.post_id) AND ((p.tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))))));
CREATE POLICY tenant_isolation ON public.social_media_posts AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Cross-tenant agency access to wp sites" ON public.social_media_wordpress_sites AS PERMISSIVE FOR SELECT TO authenticated USING (((agency_id IS NOT NULL) AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)));
CREATE POLICY tenant_isolation ON public.social_media_wordpress_sites AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_pages modify" ON public.social_pages AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_pages select" ON public.social_pages AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_pub modify" ON public.social_publications AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "tenant social_pub select" ON public.social_publications AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete invoices in their tenant" ON public.supplier_invoices AS PERMISSIVE FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can insert invoices in their tenant" ON public.supplier_invoices AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update invoices in their tenant" ON public.supplier_invoices AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can view invoices in their tenant" ON public.supplier_invoices AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Super admins can manage suppliers with permission" ON public.suppliers AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = suppliers.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = suppliers.tenant_id)) = true)));
CREATE POLICY "Super admins can view suppliers with permission" ON public.suppliers AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = suppliers.tenant_id)) = true)));
CREATE POLICY "Users can delete suppliers in their tenant" ON public.suppliers AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert suppliers in their tenant" ON public.suppliers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update suppliers in their tenant" ON public.suppliers AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view suppliers in their tenant" ON public.suppliers AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can create sync jobs in their tenant" ON public.sync_jobs AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update sync jobs in their tenant" ON public.sync_jobs AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can view sync jobs in their tenant" ON public.sync_jobs AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can manage their tenant table shares" ON public.table_shares AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_effective_tenant_id()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can add collaborators in their tenant" ON public.task_collaborators AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can remove collaborators in their tenant" ON public.task_collaborators AS PERMISSIVE FOR DELETE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can view collaborators in their tenant" ON public.task_collaborators AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can create task updates" ON public.task_updates AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) AND (task_id IN ( SELECT t.id
   FROM tasks t
  WHERE ((t.agency_id = ANY (get_user_agency_ids(auth.uid()))) OR has_role(auth.uid(), 'owner'::app_role) OR (t.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))) OR user_manages_agency(auth.uid(), t.agency_id))))));
CREATE POLICY "Users can delete own task updates" ON public.task_updates AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own task updates" ON public.task_updates AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view task updates" ON public.task_updates AS PERMISSIVE FOR SELECT TO public USING ((task_id IN ( SELECT t.id
   FROM tasks t
  WHERE ((t.agency_id = ANY (get_user_agency_ids(auth.uid()))) OR has_role(auth.uid(), 'owner'::app_role) OR (t.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))) OR user_manages_agency(auth.uid(), t.agency_id)))));
CREATE POLICY "Users can create tasks in accessible agencies" ON public.tasks AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = tasks.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role]))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE (ata.accessing_tenant_id = get_user_tenant_id(auth.uid()))))))));
CREATE POLICY "Users can delete tasks in accessible agencies" ON public.tasks AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = tasks.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role]))))) AND ((tenant_id = get_user_tenant_id(auth.uid())) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE (ata.accessing_tenant_id = get_user_tenant_id(auth.uid()))))))));
CREATE POLICY "Users can update tasks in accessible agencies" ON public.tasks AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid())) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE (ata.accessing_tenant_id = get_user_tenant_id(auth.uid())))))) WITH CHECK ((is_super_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.tenant_id = tasks.tenant_id) AND (ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role]))))) AND ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.tenant_id = get_user_tenant_id(auth.uid())))) OR (agency_id IN ( SELECT ata.agency_id
   FROM agency_tenant_access ata
  WHERE (ata.accessing_tenant_id = get_user_tenant_id(auth.uid()))))))));
CREATE POLICY "Users can view tasks for their leads" ON public.tasks AS PERMISSIVE FOR SELECT TO public USING (((lead_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = tasks.lead_id) AND ((l.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())))))));
CREATE POLICY "Users can view tasks from accessible agencies" ON public.tasks AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'owner'::app_role)) OR ((tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id)) OR (has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id) AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)) OR ((has_role(auth.uid(), 'campaigner'::app_role) OR has_role(auth.uid(), 'seo'::app_role)) AND (((campaigner_id IS NOT NULL) AND (campaigner_id = get_user_campaigner_id(auth.uid()))) OR ((client_id IS NOT NULL) AND (client_id = ANY (COALESCE(get_user_client_ids(auth.uid()), ARRAY[]::uuid[])))) OR ((created_by IS NOT NULL) AND (created_by = auth.uid()))))));
CREATE POLICY "Users can manage categories in their tenant" ON public.team_channel_categories AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view categories in their tenant" ON public.team_channel_categories AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Channel admins can create invites" ON public.team_channel_invites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM team_channel_members
  WHERE ((team_channel_members.channel_id = team_channel_invites.channel_id) AND (team_channel_members.user_id = auth.uid()) AND (team_channel_members.role = 'admin'::text)))));
CREATE POLICY "Channel admins can update invites" ON public.team_channel_invites AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_channel_members
  WHERE ((team_channel_members.channel_id = team_channel_invites.channel_id) AND (team_channel_members.user_id = auth.uid()) AND (team_channel_members.role = 'admin'::text)))));
CREATE POLICY "Channel members can view invites" ON public.team_channel_invites AS PERMISSIVE FOR SELECT TO authenticated USING (is_channel_member(channel_id, auth.uid()));
CREATE POLICY "Admins can remove members" ON public.team_channel_members AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM team_channel_members tcm2
  WHERE ((tcm2.channel_id = tcm2.channel_id) AND (tcm2.user_id = auth.uid()) AND (tcm2.role = 'admin'::text)))) OR (user_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Admins or creators can add members" ON public.team_channel_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM team_channel_members tcm2
  WHERE ((tcm2.channel_id = tcm2.channel_id) AND (tcm2.user_id = auth.uid()) AND (tcm2.role = 'admin'::text)))) OR (NOT (EXISTS ( SELECT 1
   FROM team_channel_members tcm3
  WHERE (tcm3.channel_id = tcm3.channel_id)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Channel admins can add members" ON public.team_channel_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Members can view channel members" ON public.team_channel_members AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can manage links in their tenant" ON public.team_channel_whatsapp_links AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can view links in their tenant" ON public.team_channel_whatsapp_links AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Authenticated users can create channels" ON public.team_channels AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Channel admins can delete" ON public.team_channels AS PERMISSIVE FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Channel admins can update" ON public.team_channels AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM team_channel_members
  WHERE ((team_channel_members.channel_id = team_channel_members.id) AND (team_channel_members.user_id = auth.uid()) AND (team_channel_members.role = 'admin'::text)))) OR is_super_admin(auth.uid())));
CREATE POLICY "Members can view their channels" ON public.team_channels AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND (is_channel_member(id, auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can delete their own files" ON public.team_chat_files AS PERMISSIVE FOR DELETE TO authenticated USING (((uploaded_by = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert files in their tenant" ON public.team_chat_files AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update their own files" ON public.team_chat_files AS PERMISSIVE FOR UPDATE TO authenticated USING (((uploaded_by = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view files in their tenant" ON public.team_chat_files AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Members can add attachments" ON public.team_message_attachments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM team_messages tm
  WHERE ((tm.id = team_message_attachments.message_id) AND (tm.sender_id = auth.uid())))));
CREATE POLICY "Members can view attachments" ON public.team_message_attachments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_messages tm
  WHERE ((tm.id = team_message_attachments.message_id) AND is_channel_member(tm.channel_id, auth.uid())))));
CREATE POLICY "Members can add reactions" ON public.team_message_reactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM team_messages tm
  WHERE ((tm.id = team_message_reactions.message_id) AND is_channel_member(tm.channel_id, auth.uid()))))));
CREATE POLICY "Members can view reactions" ON public.team_message_reactions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_messages tm
  WHERE ((tm.id = team_message_reactions.message_id) AND is_channel_member(tm.channel_id, auth.uid())))));
CREATE POLICY "Users can remove own reactions" ON public.team_message_reactions AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own read status" ON public.team_message_read_status AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own read status" ON public.team_message_read_status AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view own read status" ON public.team_message_read_status AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Members can send messages" ON public.team_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_channel_member(channel_id, auth.uid()) AND (sender_id = auth.uid())));
CREATE POLICY "Members can view messages" ON public.team_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((is_channel_member(channel_id, auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Senders can delete messages" ON public.team_messages AS PERMISSIVE FOR DELETE TO authenticated USING (((sender_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Senders can edit messages" ON public.team_messages AS PERMISSIVE FOR UPDATE TO authenticated USING ((sender_id = auth.uid()));
CREATE POLICY "Owners can manage telegram bot state" ON public.telegram_bot_state AS PERMISSIVE FOR ALL TO authenticated USING (((has_role(auth.uid(), 'owner'::app_role) AND (tenant_id = get_user_tenant_id(auth.uid()))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can create shared telegram bot state" ON public.telegram_bot_state AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((shared_from_state_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM telegram_bot_state src
  WHERE ((src.id = src.shared_from_state_id) AND (src.tenant_id IN ( SELECT tenant_users.tenant_id
           FROM tenant_users
          WHERE (tenant_users.user_id = auth.uid())))))) AND (tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid())))));
CREATE POLICY "Users can delete shared telegram bot state" ON public.telegram_bot_state AS PERMISSIVE FOR DELETE TO authenticated USING (((shared_from_state_id IS NOT NULL) AND ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM telegram_bot_state src
  WHERE ((src.id = src.shared_from_state_id) AND (src.tenant_id IN ( SELECT tenant_users.tenant_id
           FROM tenant_users
          WHERE (tenant_users.user_id = auth.uid())))))))));
CREATE POLICY "Users can view telegram bot state in their tenant" ON public.telegram_bot_state AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert telegram messages in their tenant" ON public.telegram_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view telegram messages in their tenants" ON public.telegram_messages AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can manage own telephony settings" ON public.telephony_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can update own telephony settings" ON public.telephony_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can view telephony settings in their tenant" ON public.telephony_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((is_super_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Users can insert their tenant heartbeat settings" ON public.tenant_heartbeat_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can update their tenant heartbeat settings" ON public.tenant_heartbeat_settings AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = get_effective_tenant_id())) WITH CHECK ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Users can view their tenant heartbeat settings" ON public.tenant_heartbeat_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_effective_tenant_id()));
CREATE POLICY "Cross-tenant agency members can view integrations" ON public.tenant_integrations AS PERMISSIVE FOR SELECT TO public USING (user_has_cross_tenant_integration_access(auth.uid(), tenant_id));
CREATE POLICY "Super admins can manage all integrations" ON public.tenant_integrations AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can insert their own integrations" ON public.tenant_integrations AS PERMISSIVE FOR INSERT TO public WITH CHECK (((user_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.tenant_id = tenant_integrations.tenant_id)))) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can manage their own integrations" ON public.tenant_integrations AS PERMISSIVE FOR ALL TO public USING (((user_id = auth.uid()) OR is_super_admin(auth.uid()))) WITH CHECK (((user_id = auth.uid()) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view accessible integrations" ON public.tenant_integrations AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR is_super_admin(auth.uid()) OR user_is_tenant_member(tenant_id) OR user_has_integration_access(id)));
CREATE POLICY "Tenant isolation for rate_limits" ON public.tenant_rate_limits AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Super admins can manage all tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR ALL TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Tenant owners and super admins can insert tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.tenant_id = tenant_settings.tenant_id) AND (tu.role = 'owner'::text)))))));
CREATE POLICY "Tenant owners and super admins can update tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_super_admin(auth.uid()) OR ((tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM tenant_users
  WHERE ((tenant_users.user_id = auth.uid()) AND (tenant_users.tenant_id = tenant_settings.tenant_id) AND (tenant_users.role = 'owner'::text)))))));
CREATE POLICY "Tenant owners can insert their tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.tenant_id = tenant_settings.tenant_id) AND (tu.role = 'owner'::text))))));
CREATE POLICY "Tenant owners can update their tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND (EXISTS ( SELECT 1
   FROM tenant_users
  WHERE ((tenant_users.user_id = auth.uid()) AND (tenant_users.tenant_id = tenant_settings.tenant_id) AND (tenant_users.role = 'owner'::text))))));
CREATE POLICY "Tenant owners can view their tenant_settings" ON public.tenant_settings AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Owners can create templates from their tenant" ON public.tenant_templates AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR ((source_tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))));
CREATE POLICY "Owners can delete their templates" ON public.tenant_templates AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) OR ((source_tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))));
CREATE POLICY "Owners can update their templates" ON public.tenant_templates AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin(auth.uid()) OR ((source_tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))));
CREATE POLICY "Users can view templates from their tenant or public templates" ON public.tenant_templates AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (is_public = true) OR (source_tenant_id = get_user_tenant_id(auth.uid()))));
CREATE POLICY "Owners can manage terminology" ON public.tenant_terminology AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Super admins can manage all terminology" ON public.tenant_terminology AS PERMISSIVE FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view tenant terminology" ON public.tenant_terminology AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can view tenant_users in their tenant" ON public.tenant_users AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role))));
CREATE POLICY "Service role can insert tenant_users" ON public.tenant_users AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Super admins can delete tenant_users" ON public.tenant_users AS PERMISSIVE FOR DELETE TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can insert tenant_users" ON public.tenant_users AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update tenant_users" ON public.tenant_users AS PERMISSIVE FOR UPDATE TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins see all tenant_users" ON public.tenant_users AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users see own tenant_users" ON public.tenant_users AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Super admins and owners can insert tenants" ON public.tenants AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_super_admin(auth.uid()) OR has_role(auth.uid(), 'owner'::app_role)));
CREATE POLICY "Super admins can delete tenants" ON public.tenants AS PERMISSIVE FOR DELETE TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update tenants" ON public.tenants AS PERMISSIVE FOR UPDATE TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins see all tenants" ON public.tenants AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users see member tenants" ON public.tenants AS PERMISSIVE FOR SELECT TO authenticated USING ((id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Anyone can view public presets" ON public.terminology_presets AS PERMISSIVE FOR SELECT TO authenticated USING ((is_public = true));
CREATE POLICY "Owners manage own presets" ON public.terminology_presets AS PERMISSIVE FOR ALL TO authenticated USING ((created_by_user_id = auth.uid()));
CREATE POLICY "Super admins full access" ON public.terminology_presets AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'super_admin'::app_role)))));
CREATE POLICY "Super admins can manage time_entries with permission" ON public.time_entries AS PERMISSIVE FOR ALL TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = time_entries.tenant_id)) = true))) WITH CHECK ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = time_entries.tenant_id)) = true)));
CREATE POLICY "Super admins can view time_entries with permission" ON public.time_entries AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) AND (( SELECT tenants.allow_super_admin_access
   FROM tenants
  WHERE (tenants.id = time_entries.tenant_id)) = true)));
CREATE POLICY "Users can manage time_entries in their tenant" ON public.time_entries AS PERMISSIVE FOR ALL TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view time_entries from shared agencies" ON public.time_entries AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM campaigner_agencies ca
  WHERE ((ca.campaigner_id = time_entries.campaigner_id) AND user_has_cross_tenant_agency_access(auth.uid(), ca.agency_id))))));
CREATE POLICY "Users can view time_entries in their tenant" ON public.time_entries AS PERMISSIVE FOR SELECT TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete breaks in their tenant" ON public.time_entry_breaks AS PERMISSIVE FOR DELETE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can insert breaks in their tenant" ON public.time_entry_breaks AS PERMISSIVE FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can update breaks in their tenant" ON public.time_entry_breaks AS PERMISSIVE FOR UPDATE TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Users can view breaks in their tenant" ON public.time_entry_breaks AS PERMISSIVE FOR SELECT TO public USING ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));
CREATE POLICY "Super admins see all active_tenant" ON public.user_active_tenant AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users manage own active tenant" ON public.user_active_tenant AS PERMISSIVE FOR ALL TO public USING (((auth.uid() = user_id) OR is_super_admin(auth.uid()))) WITH CHECK (((auth.uid() = user_id) OR is_super_admin(auth.uid())));
CREATE POLICY "Users manage own active_tenant" ON public.user_active_tenant AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users read own active tenant" ON public.user_active_tenant AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR is_super_admin(auth.uid())));
CREATE POLICY "Owners can delete managed agencies" ON public.user_managed_agencies AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can insert managed agencies" ON public.user_managed_agencies AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update managed agencies" ON public.user_managed_agencies AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can view all managed agencies" ON public.user_managed_agencies AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Users can view their own managed agencies" ON public.user_managed_agencies AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Owners can delete permissions" ON public.user_permissions AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can insert permissions" ON public.user_permissions AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update permissions" ON public.user_permissions AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can view all permissions" ON public.user_permissions AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Super admins can view all permissions" ON public.user_permissions AS PERMISSIVE FOR SELECT TO public USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can delete permissions they can manage" ON public.user_permissions AS PERMISSIVE FOR DELETE TO public USING (can_manage_user_permissions(user_id));
CREATE POLICY "Users can insert permissions they can manage" ON public.user_permissions AS PERMISSIVE FOR INSERT TO public WITH CHECK (can_manage_user_permissions(user_id));
CREATE POLICY "Users can update permissions they can manage" ON public.user_permissions AS PERMISSIVE FOR UPDATE TO public USING (can_manage_user_permissions(user_id)) WITH CHECK (can_manage_user_permissions(user_id));
CREATE POLICY "Users can view permissions they can manage" ON public.user_permissions AS PERMISSIVE FOR SELECT TO public USING (can_manage_user_permissions(user_id));
CREATE POLICY "Users can view their own permissions" ON public.user_permissions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Owners can delete roles with restrictions" ON public.user_roles AS PERMISSIVE FOR DELETE TO public USING ((has_role(auth.uid(), 'owner'::app_role) AND (((role = 'owner'::app_role) AND (user_id = auth.uid())) OR ((role = 'super_admin'::app_role) AND (user_id = auth.uid())) OR (role <> ALL (ARRAY['owner'::app_role, 'super_admin'::app_role])))));
CREATE POLICY "Owners can insert roles" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update roles" ON public.user_roles AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Super admins can delete roles" ON public.user_roles AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin(auth.uid()) AND (((role = 'owner'::app_role) AND (user_id <> auth.uid())) OR ((role = 'super_admin'::app_role) AND (user_id = auth.uid())) OR (role <> ALL (ARRAY['owner'::app_role, 'super_admin'::app_role])))));
CREATE POLICY "Super admins see all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Users see own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "users manage own layout" ON public.user_workspace_layout AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can manage groups in their tenant" ON public.whatsapp_groups AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view groups in their tenant" ON public.whatsapp_groups AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY service_role_all ON public.whatsapp_sessions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_read_woo_customers ON public.woocommerce_customers AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_read_woo_orders ON public.woocommerce_orders AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_read_woo_products ON public.woocommerce_products AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY tenant_read_woo_sync_log ON public.woocommerce_sync_log AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can delete zoom recordings in their tenant" ON public.zoom_recordings AS PERMISSIVE FOR DELETE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can insert zoom recordings in their tenant" ON public.zoom_recordings AS PERMISSIVE FOR INSERT TO public WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can update zoom recordings in their tenant" ON public.zoom_recordings AS PERMISSIVE FOR UPDATE TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));
CREATE POLICY "Users can view zoom recordings in their tenant" ON public.zoom_recordings AS PERMISSIVE FOR SELECT TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- End of schema export.
