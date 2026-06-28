# Carmen — Learned Skills Log (Claude's memory)

This file is **Claude's own long-term memory** of capabilities it has taught
Carmen. Every Claude Code session clones this repo, so anything recorded here is
available to all future sessions.

## How this works

When Carmen hits a task she can't do herself, she asks Claude via the `claude-mcp`
MCP bridge (`request_dev_task` / `ask_claude`). Claude solves it and then, if the
task represents a **reusable** capability, does two things:

1. **Makes Carmen independent** — writes a skin (row in `public.ai_skills`,
   `scope='tenant'`, `created_by_agent=true`) so Carmen can do it herself next
   time, triggered by the relevant Hebrew/English phrases.
2. **Remembers it here** — appends a dated entry below, so future Claude sessions
   know this ground has already been covered (and which skin slug owns it).

Trivial one-off requests are skipped — only genuinely reusable capabilities are
logged.

## Entry format

```
### YYYY-MM-DD — <short capability name>
- **Skin slug:** <ai_skills.slug> (tenant: <tenant_id or "global">)
- **What Carmen can now do:** <one or two sentences>
- **How:** <tools / steps the skin uses>
- **Origin:** Carmen request — "<short paraphrase of what she asked for>"
```

## Log

<!-- New entries go below this line, newest first. -->
### 2026-06-26 — save_memory engine fix (UUID sentinel)
- **Skin slug:** n/a (engine bug fix — no new Carmen skill needed)
- **What changed:** `run-ai-agent` was crashing with `invalid input syntax for type uuid: "system"` whenever `save_memory` was called without a logged-in user (e.g. WhatsApp automations). `ai_memory.user_id` is `NOT NULL uuid` but the fallback was the literal string `'system'`. Fixed in PR #65: introduced `SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000000'` and replaced both broken sites (save_memory tool + auto-instruction-capture path). Carmen no longer needs any workaround — the engine handles it.
- **Key context:** The 2026-06-25 `save_agent_memory` skin was a symptom workaround (using David's hardcoded UUID). The root fix is now in the engine.
- **Origin:** Carmen escalated — `save_memory` failing for WhatsApp automation sessions.

### 2026-06-26 — grant_module_permission (הענקת גישה למודול)
- **Skin slug:** `grant_module_permission` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Grant a user (campaigner, team_manager, etc.) explicit access to a restricted AIOS UI module (e.g. `integrations`, `accounting_integrations`) by upserting a row in `user_permissions`. Verifies the user is within their existing role scope before granting — refuses out-of-scope elevations. Logs to `claude_carmen_audit`.
- **How:** (1) `search_entities(entity_type=user)` to resolve user_id; (2) verify role in `user_roles`; (3) `INSERT INTO user_permissions (user_id, module, can_access) VALUES (?, ?, true) ON CONFLICT (user_id, module) DO UPDATE SET can_access=true`; (4) log to `claude_carmen_audit`; (5) confirm in Hebrew.
- **Key context:** `restrictedModules` in `src/hooks/useUserPermissions.ts` lists modules that require explicit `can_access=true` even for owners. The `integrations` module is the parent screen — a user can have `lead_integrations=true` but still see a blank integrations screen if the parent `integrations` row is missing.
- **Origin:** Carmen escalated — Ana (Anna Relin, `adamchik2301@gmail.com`) had `lead_integrations=true` but no `integrations` row, so she saw no integrations screen. Fix applied live (safe-fix: missing row, no role elevation).

### 2026-06-26 — ניתוח קמפיינים פייסבוק (facebook campaign analysis)
- **Skin slug:** `facebook-campaign-analysis` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Fetch live Facebook/Meta campaign data for any client, list campaigns with their IDs, analyze a specific campaign in depth (CPL/CTR/frequency vs 30d/7d/today), and check ad account health — all via live Meta API, no CRM sync table required.
- **How:** (1) `list_clients` or `search_entities` to get `client_id`; (2) `get_facebook_campaign_data(client_id)` for insights; (3) `list_facebook_campaigns(client_id)` for campaign IDs; (4) `analyze_facebook_campaign(campaign_id)` for deep analysis; (5) `check_ad_accounts_health()` for status. If tools return `fb_not_connected` the Facebook token has expired — report to David.
- **Bug fixed (PR #37):** `fbResolveClientAdAccount` in `run-ai-agent` was ignoring `clients.meta_ads_account_id` and only checking `crm_tables.integration_settings`. 50 clients had their Meta account ID set directly on the client record but no linked facebook_insights crm_table — all live FB calls silently returned empty. Fixed by adding a fallback to `clients.meta_ads_account_id` in both `fbResolveClientAdAccount` and `check_ad_accounts_health`.
- **Origin:** Carmen escalated — `analyze_campaign` failing for "רווה קולינריה נוזלית" (`meta_ads_account_id=685779550291000`).

### 2026-06-26 — תיקון גישת קמפיינר (fix campaigner access)
- **Skin slug:** `fix-campaigner-access` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When a campaigner reports they cannot see a client that should be accessible, Carmen calls `fix_campaigner_access` via the `carmen-admin-mcp` MCP connection. The tool checks that the campaigner already belongs to the client's agency before granting access — refuses out-of-scope requests. Returns a Hebrew outcome: *granted / already_assigned / refused_out_of_scope*. Every call is logged to `claude_carmen_audit`.
- **How:** Use connection `carmen-admin-mcp` (id `64ce6fdc-dd23-45f3-ab5b-a12db3a7e509`, bearer `aios-admin-mcp-4e7k3m9p2x1r`). Steps: (1) resolve `campaigner_id` via `search_entities`, (2) resolve `client_id` via `list_clients`, (3) call `fix_campaigner_access`, (4) relay the Hebrew outcome to the user.
- **Origin:** Carmen escalated (PR #36 WIP); completed 2026-06-26 after data audit confirmed the agency check is real (51 assignments / 23 campaigners / 12 agencies — not all-to-all). SQL function `carmen_fix_campaigner_access` (SECURITY DEFINER) was already deployed; this session deployed the edge function and registered the MCP connection.


### 2026-06-25 — async session result handling + save to memory (behavior instruction)
- **Skin slug:** `save_agent_memory` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:**
  1. **Save behavior instructions to `ai_memory`** correctly — using `user_id = ac7b2493-dcfa-47d8-80cc-b3900a406c46` (David's UUID). The previous failure used the string `"system"` which is not a valid UUID.
  2. **Handle async Claude session results**: always retrieve the session result before replying; never say "no update" without checking; deliver the actual answer directly to the user.
- **How:** `save_agent_memory` skin: INSERT into `ai_memory` with the owner's UUID, ON CONFLICT upsert. The behavior instruction is already saved to `ai_memory` under `category=behavior`, `key=async_session_result_handling`.
- **Origin:** Carmen request — "define instruction for async session result handling + save it; previous save failed with uuid 'system' error."

### 2026-06-25 — צור ארגון ללקוח (create org for client)
- **Skin slug:** `create_org_for_client` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** In one step, provision a fully-wired new tenant from an existing client record — creates the org, invites the primary contact as owner, shares all integrations (via `shared_from_integration_id` mirror rows), shares social pages + WP sites (via junction tables), and clones Carmen + automations + pipelines.
- **How:** Call `create-org-for-client` edge function with `{ client_id, clone_carmen: true, share_llm: false }`. Set `share_llm: true` only if user explicitly asks to share the AI key. Parse `owner_status` (existing_user / invited / no_email) and `shared` counts for the summary message.
- **Origin:** PR #32 — implemented from the agreed plan in `docs/plan-create-org-for-client.md`. Also fixed a correlated-subquery bug in the pre-existing shared-access RLS policies on `social_pages` and `social_media_wordpress_sites`.

### 2026-06-25 — escalate-to-Claude + teach-back loop
- **Skin slug:** `claude_escalation` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When stuck on any task she cannot do independently, Carmen escalates to Claude via MCP (`mcp_Claude__ask_claude` / `mcp_Claude__request_dev_task`), relays the session URL to the user, and then learns from the solution so she can act independently next time.
- **How:** Uses `agent_mcp_connections` entry pointing at the `claude-mcp` edge function. Trigger phrases include "אני לא יודעת", "אין לי כלי", "צריך פיתוח", "ask claude".
- **Origin:** PR #20 (Claude-initiated) — wired the claude-mcp MCP server; PR #22 added the teach-back loop with auto-written skins and this log.

### 2026-06-25 — image generation API key resolution + fallback
- **Skin slug:** `image_generation_with_fallback` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Call `generate_ad_image` for image requests; if it fails with an API key error, explain the issue and suggest SerpAPI image search as a fallback.
- **How:** `generate_ad_image` → if error contains "מפתח OpenAI" or API key, inform user and fall back to `serpapi_search` with `image=true`. The underlying fix: `run-ai-agent` and `ai-generate-social-image` now call `resolveOpenAIKey()` (checks env secret first, then `tenant_integrations` LLM row) instead of `Deno.env.get('OPENAI_API_KEY')` directly.
- **Origin:** Carmen asked about "cute cat image" failure. Root cause: both image-gen code paths called the env var directly, bypassing the tenant key stored in `tenant_integrations`. Fix deployed in PR #29.

### 2026-06-25 — client pulse check (בדיקת דופק)
- **Skin slug:** `pulse_check` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Full systematic scan of all active clients in an agency — campaign performance vs. prior week, account status, integration disconnections, ecommerce metrics (ROAS, purchases, cost-per-purchase) — with per-client `add_client_update` entries and a sorted WhatsApp summary.
- **How:** `analyze_campaign_performance` per client → `delegate_to_background` when >5 clients → `add_client_update` + `batch_update_client_health`. Output sorted worst-first (churn\_risk → wavering → happy).
- **Origin:** Carmen asked Claude "how to do a proper pulse check for clients" after David reported the Campaigner skin references `pulse_check` by slug but the skill had `slug=null`. Fix: set `slug='pulse_check'`, added `system_prompt` and `triggers` to the existing `בדיקת דופק` ai_skill (`id: 007384e7-c62c-42f8-b0d8-0187eb378eaa`).

---

## 2026-06-26 — Agent routing: position-aware keyword matching + session switching

**Problem Carmen reported:** Carmen was responding to messages addressed to other agents
(e.g. "אנה"). Separately, the Claude agent was hijacking Carmen sessions when messages
mentioned "קלוד" incidentally at the end (e.g. "…קלוד אומר שזה תוקן").

**Root causes ():**

1.  and  used  on the full message text —
   any keyword occurrence anywhere triggered that agent. A mention at the very end of a
   sentence addressed to Carmen would spin up the wrong agent.

2. Active-session continuity had no agent-switch mechanism — once session A was open, all
   messages in that chat went to agent A even if the user explicitly addressed agent B.

**Fixes (PR #46):**

1. Both functions now only treat a keyword as a direct-address trigger when it appears
   within the **first 80 characters** of the message (after stripping the voice marker).
   Keywords appearing only mid-message or at the end are ignored for routing.

2. **Agent-switch guard** added in : when an active session for
   automation A exists but the message triggers automation B's keyword in the prefix,
   session A is ended silently and session B starts fresh on the same message.

**Remaining manual step:** For Ana ("אנה") routing, create an  row for Ana and
a flow-builder automation with . The switch guard will then route
her messages correctly without any further code changes.

## 2026-06-26 — Outbound-to-Third-Party Guard

**Tenant:** AfterLead (`2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
**PR:** [#54](https://github.com/davidcastelnuovo/aios/pull/54) — `fix/carmen-outbound-third-party`
**ai_skills slug:** `outbound-third-party-guard`

**Problem:** When David sends a message from his connected phone to a third party (e.g. Ana),
the Manus gateway delivers the webhook with `fromMe=true`. Two bugs caused Carmen to
respond incorrectly:

1. **LID resolver ran for outbound events** — the resolver searched for an active Carmen
   session and overwrote `counterpartPhone` with Carmen's session phone, mis-attributing
   "Hi Ana" to Carmen's own chat thread.

2. **No explicit outbound-to-third-party guard** — `handleCarmenMessage` found the active
   session and processed the message (the active-session path has no keyword requirement).

**Fixes (`manus-wa-webhook/index.ts`):**

1. **Fix 1** (~line 336): Added `&& !fromMeFlag` to the LID resolution block guard.
   When `fromMeFlag=true`, `to` already contains the real recipient phone — the LID
   resolver must not overwrite it with a Carmen session phone.

2. **Fix 2** (before `handleCarmenMessage` call): Explicit guard:
   - Fires when `isOutgoingFromPhone && !pairedFromGreenApi && !isGroup`
   - Checks for trigger keyword (`כרמן/קלוד/carmen/claude`) in first 80 chars (PR #47)
   - If no keyword: queries `carmen_whatsapp_sessions` for active session on this `chatId`
   - If no session: returns `{ received: true, ignored: "outbound_third_party" }` — Carmen skipped

**What is preserved:**
- PR #47: trigger keyword detection in first 80 chars unchanged
- Active Carmen session continuation: outbound in Carmen's own thread → Carmen continues
- Group / Green API pairing / inbound messages: guards are no-ops

**Regression tests:** `supabase/functions/manus-wa-webhook/index.test.ts`
— 16 Deno tests covering scenarios A (skip), B (continue-with-session), C (keyword routing),
  PR #47 80-char window, inbound/group/green-api passthroughs, and Fix 1 LID gate.

---

## 2026-06-26 — claude_health_check

**Skill slug:** `claude_health_check`
**Trigger phrases:** health check, בדיקת תקינות, status check, are you operational, confirm operational, האם קלוד פועל

Claude Code health-check skill written to `ai_skills` (scope=tenant, created_by_agent=true).

**What it does:** Confirms Claude Code is operational by checking Supabase DB and GitHub API accessibility, listing open/pending PRs in the AIOS repo, marking any pending `claude_dispatches` row as completed, logging to `claude_carmen_audit`, and notifying David via `claude_notify_david`.

**Note on git clone:** This container's egress policy blocks `github.com` git traffic (403 from local proxy at port 41729). Code reads use the GitHub API instead; code writes require a session with git clone access enabled.

---

## 2026-06-27 — list_google_ad_accounts + connect_google_ads_account

**Capability:** שליפת חשבונות Google Ads המחוברים לטננט ושיוכם ללקוחות ב-CRM.

**What was built:**
- שני כלים חדשים ב-`run-ai-agent/index.ts`:
  1. `list_google_ad_accounts(client_id?)` — קורא ל-Google Ads API (`listAccessibleCustomers` + GAQL לפרטי לקוח), ומחזיר עבור כל חשבון: `customer_id, name, status, is_manager, client_id, client_name`. תומך בפרמטר `client_id` לסינון. קורא ל-`clients.google_ads_account_id` לשיוך.
  2. `connect_google_ads_account(client_id, customer_id)` — מעדכן `clients.google_ads_account_id` ומתעד ב-`agent_action_log`.
- Auth: `settings.refresh_token` מ-`tenant_integrations` (integration_type=`google_ads`, is_active=true) + exchange ל-access_token via `oauth2.googleapis.com/token` + env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`.
- **Skin עודכן:** `campaigner` (slug=`campaigner`) — נוסף ל-`system_prompt` ול-`steps` הסבר על שימוש ב-`list_google_ad_accounts` ו-`connect_google_ads_account`.

**How to use:**
- "תראי לי את חשבונות Google Ads" → `list_google_ad_accounts()`
- "תחברי את לקוח X לחשבון Google Ads 1234567890" → `connect_google_ads_account(client_id=..., customer_id=...)`
- סינון לפי לקוח: `list_google_ad_accounts(client_id=...)`

**PR:** [יתעדכן עם מספר PR]

---

## 2026-06-28 — auto_task_calendar_sync (implemented)

**Capability:** יצירת אירוע Google Calendar אוטומטי כשמשימה נוצרת דרך create_task.

**Root cause of original failure:** הסנכרון היה ידני בלבד — `sync-tasks-to-calendar` דרש auth token של משתמש מחובר. כרמן רצה כ-system (ללא user session), כך שהפונקציה לא יכלה לרוץ אחרי יצירת משימה.

**Fix (PR #86, merged to main, deployed):** הוספת לוגיקת auto-sync ישירות ב-`create_task` handler בתוך `executeTool()` ב-`run-ai-agent/index.ts`. לאחר insert מוצלח של משימה עם `due_date` + `due_time`, הקוד:
1. מחפש את ה-user_id הקשור ל-campaigner_id (via `profiles`)
2. שולף את `calendar_tokens` של אותו user (service role — לא צריך auth token)
3. מרענן access_token אם פג תוקף
4. יוצר אירוע ב-Google Calendar עם start/end בשעון ישראל (`Asia/Jerusalem`)
5. שומר `google_calendar_event_id` ב-tasks row

**Return value of create_task:** כולל `calendar_event_id` ו-`calendar_synced: true` כשהסנכרון הצליח. סנכרון נכשל = לא ממצע את יצירת המשימה (non-fatal).

**How Carmen should use it:** אין שינוי — פשוט קוראת ל-`create_task` עם `due_date` ו-`due_time`. אין צורך בקריאה נפרדת לכלי calendar.

**Skin updated:** `auto_task_calendar_sync` (scope=tenant, created_by_agent=true) — system_prompt עודכן לציין שהפיצ'ר מיושם וש-create_task מחזיר calendar_event_id.


---

## 2026-06-28 — get_group_members + WhatsApp group sender identification

**Capability:** זיהוי משתתפי קבוצות WhatsApp ובפרט זיהוי מי שלח הודעה — האם הוא קמפיינר, לקוח, או לא מוכר.

**What was built:**

1. **כלי `get_group_members`** ב-`run-ai-agent/index.ts`:
   - קורא ל-`getGroupData` של GreenAPI
   - מעשיר כל משתתף בנתוני CRM: phone, name, role (campaigner/client/unknown), id, is_known_contact
   - Parameters: `group_chat_id` (חובה), `integration_id` (אופציונלי)

2. **זיהוי שולח אוטומטי בהודעות קבוצה:**
   - כשמגיעה הודעה מקבוצת WhatsApp, מספר הטלפון של השולח נבדק מול:
     - טבלת `campaigners` (כבר היה קיים)
     - טבלת `clients` (חדש — אם לא נמצא קמפיינר)
   - אם השולח הוא לקוח: מוזרק לסיסטם פרומפט: "הלקוח [שם] שלח הודעה זו — הגב רק על מידע הנוגע ללקוח זה"
   - משתני `callerClientId` ו-`callerClientName` זמינים בתוך run-ai-agent

**How to use:**
- "מי בקבוצה הזו?" → `get_group_members(group_chat_id="120363...@g.us")`
- מתבצע אוטומטית כשלקוח כותב בקבוצה — כרמן תדע שהשולח הוא הלקוח ותגיב בהתאמה אישית

**DB:** `ai_skills` slug=`get_group_members` (scope=tenant, created_by_agent=true)

**Commits:** c5d0280, 58b4a62 → main
