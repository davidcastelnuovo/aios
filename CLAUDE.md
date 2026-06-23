# CLAUDE.md — AIOS Project Memory

> Persistent project knowledge for Claude Code. Auto-loaded every session.
> Last mapped: 2026-06. Keep this updated when architecture changes.

## What this project is

**AIOS** (originally "after-lead") — a multi-tenant **SaaS for digital marketing agencies**.
Combines CRM, lead/client management, automations, ad-campaign management
(Meta/Google/TikTok), SEO, multi-channel chat (WhatsApp/Telegram), finance, and an
**AI agent layer** whose flagship is **Carmen** — a Hebrew-speaking WhatsApp agent that
runs marketing operations.

Scale: ~120 pages, ~190 edge functions, ~200 tables, ~400 migrations. Mature, actively developed.
UI language is primarily **Hebrew (RTL)**.

## Tech stack

- **Frontend:** Vite + React 18 + TypeScript, shadcn-ui + Tailwind, react-router-dom v6,
  @tanstack/react-query. Path alias `@` → `src/`. Deployed on **Vercel**.
- **Backend:** Supabase — Postgres + RLS, Auth, Storage, ~190 Edge Functions (Deno/TypeScript).
- **AI:** Lovable AI Gateway (`ai.gateway.lovable.dev`) — Gemini 3/2.5 + GPT-5.x + embeddings.
- **Scripts:** `npm run dev` (port 8080), `npm run build`, `npm run lint`. (Package manager: bun/npm/pnpm lockfiles all present.)

## Migration context (IMPORTANT)

Project was migrated **off Lovable** to a private server + private Supabase DB.
- `.env` → new DB `zvoijyneresvkadpprel.supabase.co`
- `supabase/config.toml` → **still old project `jnzguisakdtcollxmgzd`** ⚠️ (mismatch — fix before CLI deploys)
- `database/schema.sql` (524KB) = full schema export for a fresh DB (DB migration largely done).

### Remaining Lovable couplings (de-Lovable TODO)
1. 🔴 `supabase/config.toml` `project_id` points to OLD project — update it.
2. 🔴 **Lovable AI Gateway**: 22 fns + all of Carmen/memory/embeddings depend on
   `ai.gateway.lovable.dev` + `LOVABLE_API_KEY`. Biggest remaining dependency — decide:
   keep Lovable gateway or switch to a direct provider (Google/OpenAI/Anthropic).
3. 🟠 Hardcoded `after-lead.lovable.app` in invite/chat links (src + functions) — use `SITE_URL`/new domain.
4. 🟠 `connector-gateway.lovable.dev` for Telegram + TikTok.
5. 🟡 ~38 edge-function secrets must exist in the new Supabase project.
6. 🟡 pg_cron jobs (9) + Storage buckets (9: carmen-media, recordings, invoices, task-attachments,
   entity-attachments, supplier-invoices, team-chat-files, social-media) must be recreated.
7. 🟢 `lovable-tagger` in vite.config (dev-only) — harmless.

## Architecture

### Multi-tenancy (the core)
- Routing: `/t/:tenantSlug/...`. The **URL is the source of truth** for current tenant.
- `TenantProvider` (`src/contexts/TenantContext.tsx`) resolves slug → tenant id, syncs to
  `user_active_tenant`, **blocks render until synced** (prevents cross-tenant leaks).
- DB isolation via RLS on `tenant_id`. Key SQL fns: `get_effective_tenant_id()`,
  `get_user_tenant_id(uuid)`, `is_super_admin(uuid)`, `has_role(uuid, app_role, tenant_id)`,
  `can_access_agency(...)`.
- Agency sharing across tenants via `agency_tenant_access`. Org hierarchy via
  `tenants.parent_tenant_id` + `org_type` (root/organization/sub_organization).
- **Rule:** every data table has `tenant_id`; every insert must set it; every query is RLS-scoped.
  Globals (no tenant_id): `tenants`, `tenant_users`, `user_roles`, `profiles`. See `TENANT_ISOLATION.md`.

### Provider tree (src/App.tsx)
QueryClient → BrowserRouter → Tooltip → **Tenant → Theme → UIMode → AIOS → Agency** → Routes.
Order matters (inner providers depend on tenant being resolved).

### Permissions & roles
- Roles (`app_role` enum): owner, agency_owner, team_manager, campaigner, sales_person, seo, super_admin.
- Per-module gates: `useUserPermissions` (table `user_permissions`), `useUserRole`.
- Routes gated by `<ProtectedRoute requiredPermission="...">`. super_admin bypasses UI checks.
- "ViewAs" feature (`ViewAsContext`) lets admins simulate another user.

### Dynamic UI per tenant
- Menu: `src/lib/menuStructure.ts` (base) + `menu_items` table overrides (`useMenuItems`).
  Editable visually in **Visual Workspace** (`src/visual-workspace/`, `/t/:slug/visual-workspace`).
- Terminology: `useTerminology` + `tenant_terminology`. Custom field labels: `useCustomFieldLabels`.
- Modules/feature catalog: `src/lib/modules.ts` (`PERMISSION_CATEGORIES`).

### AIOS chat/command bar
`src/contexts/AIOSContext.tsx` + `src/components/aios/*` + `AIOSDialog.tsx`. Streams NDJSON from
`run-ai-agent` (`token` / `display_data` / `invalidate` / `done`). Renders tables/cards/stats in DataCanvas.

## AI Agent subsystem ("Agent Hub")

Pages: `AgentHub.tsx`, `AgentTasksPage.tsx`, `CarmenInsights.tsx`, `GithubAgent.tsx`.
Components: `src/components/agents/**` (editor, tabs: Profile/Tools/ToolRegistry/Mcp/Memory/
Knowledge/Goals/Evals/Approvals/Cost/Runs/Supervisor/Tasks/UserProfiles).

### Core tables
- `ai_agents` — config: name, engine (LLM), system_prompt, allowed_tools[], personality/soul/talent, max_tool_rounds, language (he).
- `agent_runs` — executions: goal, status, steps, tokens, cost, parent_run_id, delegated_to_agent_id.
- `agent_action_log` — per-step: step_kind (plan/tool/observation/reflection/final/approval_pending), tool_name, tool_input, observation.
- `agent_tasks` — background/scheduled work queue (cron_expression, task_skills, task_mode).
- `agent_tools` — tool catalog: handler_kind (edge/internal/mcp), handler_ref, requires_approval.
- `agent_approval_queue` — human-in-the-loop gate for mutating actions.
- `agent_memory` — layers via `agent_memory_layer` enum (working/episodic/semantic/user_model), 1536-dim embeddings, FTS.
- `agent_mcp_connections`, `agent_supervisors`, `agent_goals`, `agent_evals`/`agent_eval_runs`,
  `agent_knowledge_folders`/`_items`, `agent_user_profiles`, `ai_skills`.

### Carmen specifics
- Hebrew WhatsApp marketing-ops agent. Trigger keyword "כרמן" (or per-tenant). Idle timeout ~5 min.
- 150+ tools: leads/clients/tasks CRUD, Meta+Google campaign create/control, social publishing, delegation.
- **Iron rule:** zero data mutations without explicit approval via `execute_pending_approval`.
- Prompt v2 (modular) activates via `ai_agents.metadata.prompt_version = 'v2'`, else falls back to v1.

### Run flow
WhatsApp webhook → `handleCarmenMessage` (carmen.ts) → `run-ai-agent` → build prompt + load MCP
tools + skills → AI Gateway (ReAct loop, tool calls) → reply. Async heavy work → `spawnSubagent`
→ `agent_tasks` → `run-agent-task`.

### LLM models — `supabase/functions/_shared/models.ts`
Single source of truth. Families: google (Gemini 3 Flash = default), openai (GPT-5.x), anthropic (legacy).
`resolveModelId(engine)` maps alias/legacy → gateway id. Embeddings: `google/gemini-embedding-001` (1536).

## Edge functions (~190) — domains

- **AI agents:** run-ai-agent(-v2), run-agent-task, dispatch-agent-tasks, run-agent-{supervisor,eval},
  {replay,resume}-agent-run, agent-heartbeat, carmen-* (memory worker/consolidate/backfill, learn, approval-execute, save-media), mcp-connect.
- **WhatsApp/chat:** green-api-* , manus-wa-*, manychat-*, telegram-*, send-chat-message, get-chat-history, process-chat-invite.
- **Meta:** facebook-auth/-lead-webhook/-capi-event/-subscribe-page, sync-facebook-{leads,insights,ecommerce} (+cron-*), fb-campaign-{monitor,analyze,control}, toggle-facebook-campaign.
- **Google:** google-{calendar,ads,analytics,search-console,gmail}-auth, sync-google-* (+cron-*), calendar CRUD/watch/webhook, gmail-api.
- **SEO:** ahrefs-* , serpapi-* , fetch-gsc-data, resolve-seo-gsc-integration, rank tracking via DB.
- **Telephony:** maskyoo-* , paycall-* (make-call, webhooks, sync-cdr, get-recording).
- **Social:** social-media-publish, social-publish, social-pages-sync, social-comments, social-gantt-generate, tiktok-*.
- **CRM dynamic tables:** crm-tables, crm-fields, crm-records (timezone Asia/Jerusalem).
- **Leads:** webhook-lead-intake, auto-sync-new-lead, merge-duplicate-leads, normalize-lead-phones, import-*-from-sheets.
- **Recordings:** zoom-webhook, fetch-zoom-recordings, process-new-recording, transcribe-{recording,voice}, summarize-recording.
- **Finance:** extract-invoice-data, process-invoice-emails, create-sumit-payment.
- **Commerce:** sync-woocommerce-data (+cron), test-wordpress-connection.
- **Automation:** trigger-automation, marketing-run-{pipeline,stage}, campaign-scheduler-cron.
- **Jobs:** start/run/stop-sync-job, process-job-queue (tables: sync_jobs, job_queue).
- **Unified/Make:** unified-api-proxy, unified-calendar-proxy, unified-connections, make-api.
- **Users/tenants:** signup-tenant, invite-user, process-user-invitation, manage/update-user-roles, delete-user/-tenant, grant-super-admin, create-tenant-with-owner, convert-tenant-type, duplicate-client, clone-automation-to-tenant.
- **Misc:** report-error, notify-team-message, analytics-{script,track,identify}, public-{dashboard,table}, list-ai-models, ai-detection-scan, ai-generate-social-image, github-agent.

### Shared libs — `supabase/functions/_shared/`
- `carmen.ts` (session state machine), `carmen-prompt-v2.ts` (modular prompt), `carmen-memory.ts` (episodes).
- `agent-memory.ts` (summarize+embed+store per run), `subagent.ts` (spawn background tasks).
- `mcp-tools.ts` (load MCP connections → tool defs via JSON-RPC), `skills/registry.ts` (DB skills, 30s cache, fallbacks: pulse_check/ecommerce_pulse/ad_accounts_health).
- `models.ts` (LLM catalog), `security.ts` (requireAuth, HMAC, timing-safe), `cors.ts`, `fireIntegrationAlert.ts`.

### Function auth (`config.toml`)
`verify_jwt = false` for webhooks/cron/auth/public; `true` for user/service-role endpoints.

## Data model — key domains (see database/schema.sql, src/integrations/supabase/types.ts)

- **CRM/sales:** leads, lead_updates, lead_statuses, lead_pipeline_stages, clients, client_updates,
  client_onboarding, agencies, agency_tenant_access, campaigners, sales_people, suppliers, products.
- **Tasks/time:** tasks, task_updates, task_collaborators, goals, time_entries.
- **Finance:** finance, income/expense_payments, invoice_uploads, payment_links, supplier_invoices.
- **Chat:** chat_messages (provider enum: manychat/green_api/internal/manus_wa), chat_tags, team_channels/messages,
  carmen_whatsapp_sessions, whatsapp_groups, blocked_contacts.
- **Automations:** automations (21 triggers / 13 actions enums), automation_flow_steps, automation_executions/logs, automation_shared_tenants.
- **Dynamic data:** crm_tables/records/fields, crm_dashboards, custom_fields, menu_items, tenant_terminology, tenant_settings.
- **Integrations:** tenant_integrations (OAuth tokens per tenant), integration_health/alerts, gmail_tokens, calendar_tokens, telegram_bot_state.
- **Analytics/SEO:** rank_tracking_* , ahrefs_reports, seo_monthly_updates, site_visitors/sessions/pageviews/events, ai_detection_*.
- **Social/marketing:** social_media_posts/channels, marketing_work_items, marketing_media_library, marketing_pipelines/stages.
- **AI:** all agent_* + carmen_memory_* + ai_skills/ai_memory/ai_conversations.
- **System:** job_queue, sync_jobs, error_logs, invitation_tokens, import_history, global_settings.

~30 Postgres enums (app_role, lead_status, lead_source, client_status, task_status, automation_trigger/action,
chat_provider, job_status/type/priority, agent_memory_layer, etc.). Extensions: pgcrypto, uuid-ossp, pg_net, pg_cron, vector.

## Conventions & gotchas

- **Always scope by `tenant_id`** on new tables/queries/inserts (RLS + explicit). Add RLS policies for new tables.
- React Query: `enabled: !!tenantId`, queryKeys include tenantId, staleTime 5m, no refetch on focus/mount.
- Supabase client: `src/integrations/supabase/client.ts` (auto-generated header — env-driven, localStorage session).
- Edge fns: import `corsHeaders` from `_shared/cors.ts`; use `_shared/security.ts` for auth/webhook verification.
- Adding an LLM model → edit `_shared/models.ts` only.
- Adding a Carmen tool → register in `agent_tools` + implement handler (edge/internal/mcp).
- Timezone for CRM date math: **Asia/Jerusalem** (`APP_TIME_ZONE`).
- Git: develop on the assigned feature branch; do not push to other branches without permission.

## Docs in repo
`README.md`, `TENANT_ISOLATION.md` (security model), `LOVABLE_DEPLOYMENT.md` (legacy deploy),
`DEPENDENCY_AUDIT_REPORT.md`, `database/schema.sql` (full DDL export), `.lovable/plan.md` (schema-export plan).
