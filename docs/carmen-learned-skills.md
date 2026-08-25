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
### 2026-08-25 — Campaigner "mine" tasks hidden by header agency filter
- **Skin slug:** `campaigner_mine_tasks_visibility` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When a campaigner/team_manager says they see no tasks despite open assignments, explain that "שלי בלבד" needs header agency **"כל הסוכנויות"** (not MarketingCaptain alone); agency filter still works to narrow afterward.
- **How:** Tasks board resets header to `all` when campaigner filter is `mine`; normal `filterTasksBySelectedAgency` applies. Profile must load before mine query runs.
- **Origin:** Ana — empty tasks screen; header stuck on MarketingCaptain hid promo/DMM-MC rows.

### 2026-08-24 — Copywriter: canonical campaign inspiration library
- **Skin slug:** `copywriter` (global)
- **What Carmen can now do:** When writing ads/posts/emails/landing copy, pick 0–2 methods from a built-in library of canonical campaigns (VW Think Small, Steve Jobs keynotes, Durex humor, Nike, Dove Real Beauty, Old Spice, Patagonia, Mastercard Priceless), name the reference in the rationale, and steal the craft — never the original line.
- **How:** `ai_skills.system_prompt` / `steps` / `output_template` updated; applied on merge via `supabase/ops/apply_copywriter_inspiration_library.sql`. Copy studio addon reminds the isolated thread to cite a reference.
- **Origin:** David — give the copywriter skin a library of all-time campaigns for inspiration, including VW 1960s, Jobs presentations, Durex humor, plus at least five more niches.

### 2026-08-24 — Pulse: client-call freshness + critical campaign alerts
- **Skin slug:** `pulse_check` (global + tenant overrides updated)
- **What Carmen can now do:** (1) Report the latest client-card call — when it happened and who logged it — and flag campaign clients with no documented phone call in the last 14 days. A weekly update that affirmatively says the campaigner spoke by phone with the client is automatically marked `call`; negative notes such as "לא הצלחתי לדבר" are not. (2) Report open critical alerts (stopped campaign, disapproved ad) in a `🔴 דורש טיפול` block, but only for clients whose campaign table is still active. (3) Stop appending the redundant "details are dashboard-only" sign-off to WhatsApp digests. (4) Show the same pulse across tenants that share an agency, instead of "no pulse available" on one side.
- **How:** New client-card updates use `resolveClientUpdateType`; the SQL migration backfills qualifying existing `weekly_update` rows and `get_latest_client_call_updates` retains the same deterministic fallback. `campaign-pulse-snapshot` reads those calls and open `campaign_alerts`, matching alerts to clients by `ad_account_id` (Meta records no `client_id`). `_shared/campaign-pulse` owns the rules: `classifyCampaignPulseStatus` (14-day call rule, stopped campaign ⇒ critical), `selectPulseCriticalAlerts`, `buildPulseWhatsAppDigest`. `get_latest_campaign_pulse` reads snapshots across `accessibleTenantIds`, keeping the freshest row per client.
- **Origin:** David — add client-contact freshness, report stopped campaigns, drop the redundant sentence, and close the DMM vs Marketing Captain display gap.

### 2026-08-23 — Client card sync from assigned report tables
- **Skin slug:** `client_report_table_sync` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Recognize Google/Meta (and other channel) connections from assigned `crm_tables` even when `clients.google_ads_account_id` / `meta_ads_account_id` are empty; explain that tables are source of truth; use `list_google_campaigns` with `client_id` without false "not connected".
- **How:** DB trigger `crm_tables_sync_client_card` + `_shared/client-report-sync` helper. On create/assign of report tables, client card fields auto-update. `googleResolveClientCustomerId` resolves from assigned `google_ads` table first. Missing account IDs on assigned tables are logged.
- **Origin:** Carmen → Cursor DEV — Aviali had assigned Google Ads + Facebook tables but empty client card fields; campaign tools falsely reported not connected.

### 2026-08-23 — Ana: bug-fix escalations to Cursor (tiered dev auth)
- **Skin slug:** `bugfix_escalation_to_cursor` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When **Ana** (אנה, `d6cd8d62-…`, `972545612156`) reports a reproducible bug, escalate to Cursor via `mcp_Cursor__request_dev_task` only — not features, config, permissions, or DB schema changes. David keeps full tier (all coding agents). Everyone else is refused.
- **How:** Engine tier `getDevEscalationTier`: David=`full`, Ana=`bugfix`. Tools filtered with `isDevEscalationToolAllowed`. Ana prompt requires repro steps + «Requested by Ana — BUG FIX ONLY»; PR needs David approval before merge. Shared helper: `_shared/dev-escalation-auth`.
- **Origin:** David — allow Ana to send Carmen bug-fix requests safely without breaking prod.

### 2026-08-06 — Health/pulse WA digest + sync false-positives + `/t/` dashboard link
- **Skin slug:** `pulse_health_wa_digest_and_sync_truth` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Explain that (1) WhatsApp health (“בדיקת תקינות מערכות וקמפיינים”) and pulse digests are short counts + dashboard link only — never per-client issue lists; (2) false “Meta/Google sync old” for clients like 4/4 / בילבי often came from 18h threshold vs twice-daily sync, abandoned duplicate tables, or missing `facebook_ecommerce` cron; (3) the correct pulse dashboard URL is `https://aios.co.il/t/{slug}/dmm-dashboard` (without `/t/` the app redirects to home).
- **How:** Health WA = `buildHealthWhatsAppDigest` in `carmen-health-probe`; pulse WA = `buildPulseWhatsAppDigest`; stale check uses 30h + freshest table per platform; ecommerce sync cron `cron-sync-facebook-ecommerce-daily`. Dashboard helpers: `buildPulseDashboardAbsoluteUrl` / `buildPulseDashboardUrl`.
- **Origin:** Carmen → Cursor DEV TASK — David got full health WA list + false sync-old for 4/4/בילבי + broken dmm-dashboard link.

### 2026-08-05 — Meta WA number warming / lead opt-in (DMM +972-77)
- **Skin slug:** `meta_wa_number_warming_optin` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Guide David through warming an official Meta WhatsApp number (prefer DMM GREEN +972-77): create APPROVED template `lead_optin_confirm_he` with quick-reply «אני מאשר/ת קבלת לידים», run a controlled warm campaign with explicit admin confirm phrase, enable inbound auto-thanks, then point Make lead alerts at that integration. Never blind-retry 131049/131042.
- **How:** UI `Meta WhatsApp → חימום מספר`; edge `meta-whatsapp-warm`; tables `wa_warm_*`; webhook auto-reply via `warm_auto_reply_*` settings. Ops doc: `docs/meta-whatsapp-number-warming.md`.
- **Origin:** Carmen → Cursor DEV TASK — warm/bleach official WA number for lead alerts after Meta 131049/billing issues.

### 2026-08-07 — ManyChat lead-alert delivery failures → Carmen alerts David
- **Skin slug:** `manychat_lead_alert_failure_notify` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When Make/Webhook lead alerts via ManyChat (`send_whatsapp`, `inbound_webhook_lead`) fail for Marketing Captain, David gets a WhatsApp alert from MC Carmen with lead name, recipient phone, and error. Throttled to once per 15 minutes; cron backup every 15m.
- **How:** `trigger-automation` queues rows in `lead_alert_failure_notifications` → `claude_notify_david` (MC tenant). Backup: `cron-lead-alert-failure-watch`. Check Automations → היסטוריית ריצות for automation `314a7c5a-d7e3-4b24-9a18-095615906e08`.
- **Origin:** David — Felix not receiving alerts; need proactive failure notification.

### 2026-08-05 — Meta WA lead→client alerts: diagnose 131049/131042 (not silent queue)
- **Skin slug:** `meta_wa_lead_alert_delivery_diagnosis` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Explain when Make/Webhook lead alerts via official Meta WhatsApp fail for some clients: check automation `התראת ליד ללקוח מ-Make / Webhook` → `automation_logs`. Dominant codes: **131049** (Meta engagement/quality limit — not AIOS queue), **131042** (Meta Billing). Ops: fix WABA billing/quality; prefer GREEN number (`DMM` +972-77); don’t blind-retry 131049.
- **How:** Path = `automation-lead-webhook` → `trigger-automation` (`send_meta_whatsapp_message`, `phone_field=client_phone`) → `send-meta-whatsapp-message` → delivery webhook → `mark_automation_log_delivery_failure`. Helpers: `explainMetaWhatsAppError`, Automations → היסטוריית ריצות (Meta summary banner).
- **Origin:** Carmen → Cursor DEV TASK — David: official WA API lead alerts not reaching some clients.

### 2026-08-05 — DMM notify/pulse recipient = Felix (not David fallback)
- **Skin slug:** `dmm_notify_recipient_routing` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Know that DMM outbound pulse/health digests go to Felix (`972558833168`) via `tenant_heartbeat_settings.campaign_pulse_phone`, not to David. David only receives a DMM notify when he is the explicit `chat_id` / preferred recipient. Cross-tenant “newest session” owner fallback is refused.
- **How:** Configure/verify `campaign_pulse_phone` on Agent Tasks → heartbeat. Delivery path: `campaign-pulse-snapshot` / `carmen-health-probe` → `claude_notify_david` → `claude-notify` → `resolveCarmenNotifyTarget` (preferred → pulse phone → tenant campaigner/manager session → refuse). Shared helper: `_shared/carmen-notify-target`.
- **Origin:** Carmen → Cursor DEV TASK — David: “כרמן dmm ממשיכה לשלוח לי עדכונים במקום לפליקס”.

### 2026-08-05 — Group replies only when addressed (not talked about)
- **Skin slug:** `group_response_only_when_addressed` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** In WhatsApp groups, wake only on direct address/ask (`כרמן תבדקי`, `כרמן תצטרפי`, `כרמן?`). Stay silent when people talk about her in third person (`כרמן אמורה…`, `למה כרמן שלחה…`, `דיברנו על כרמן`).
- **How:** Deterministic gate `groupMessageInvokesCarmen` in `_shared/carmen.ts` (used by Manus + Green group paths). Uncertain → no reply. Meeting join still works when she is asked (`כרמן תצטרפי` + Zoom/Meet).
- **Origin:** Carmen → Cursor — David: pulse fired in Daniel’s group when they talked about Carmen, not to her.

### 2026-08-05 — Pulse check on WhatsApp = short digest only
- **Skin slug:** `pulse_check` (global + tenant overrides updated)
- **What Carmen can now do:** On WhatsApp / scheduled tasks, answer “בדיקת דופק” with `whatsapp_digest` only (status counts + dashboard link). Never paste a full Markdown client table. Full detail stays on `/t/{slug}/dmm-dashboard`.
- **How:** `get_latest_campaign_pulse` returns `whatsapp_digest` + `dashboard_url`; on `surface=whatsapp|task` it omits `formatted_markdown`/`rows`. Shared helper: `_shared/campaign-pulse.buildPulseWhatsAppDigest`. Morning cron `campaign-pulse-snapshot` already used the same digest.
- **Origin:** Carmen → Cursor — David: “אמרנו שכבר לא שולחים ככה” after a long WA Markdown pulse table.

### 2026-08-04 — OpenAI billing/usage status (super_admin)
- **Skin slug:** `openai_billing_status` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Answer David (super_admin) about OpenAI org spend/usage via `get_openai_billing_status`. Reports current-month cost + optional token usage. **Never invents remaining credit** — OpenAI’s public Admin API does not expose prepaid balance (dashboard-only).
- **How:** Requires `OPENAI_ADMIN_KEY` secret (or `openai_admin_api_key` on the `llm` integration). Calls `GET /v1/organization/costs` (+ usage/completions). Returns `summary_he` for WhatsApp. Shared helper: `_shared/openai-billing`.
- **Origin:** Carmen → Cursor DEV TASK — David: “כמה קרדיט OpenAI נשאר?” via API/MCP.

### 2026-08-04 — Send WhatsApp to staff by system mapping
- **Skin slug:** `wa_send_to_staff_mapping` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Look up and message campaigners, salespeople, and team members by ID/name via DB phone mapping — not only leads/clients or a raw gateway phone. Tools: `lookup_staff_whatsapp`, `send_whatsapp_to_staff` (plus `send_message_to_campaigner` wrapper). Ana (`d6cd8d62-…`, `972545612156`) is the reference authorized campaigner for direct private chat.
- **How:** (1) `lookup_staff_whatsapp` / `list_campaigners` / `search_entities(campaigner|sales_person)`; (2) `send_whatsapp_to_staff(staff_id|name, message)` — phone resolved from DB only; (3) private Ana replies stay in Ana’s thread (see `wa_private_direct_chat_routing`). Shared helper: `_shared/staff-whatsapp`.
- **Origin:** Carmen → Cursor DEV TASK — David: tool to WhatsApp staff from system mapping + confirm Ana’s phone.

### 2026-08-04 — Private WhatsApp direct-chat routing (Ana stays in her thread)
- **Skin slug:** `wa_private_direct_chat_routing` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Answer authorized private WhatsApp chats (David + Ana) in the **same originating chat**. Ana’s private DMs must not be attributed to David’s chat and must not notify David unless she explicitly asks or escalation is required. Groups still answer whoever addresses Carmen (with phone/identity verification). Outbound third-party guard preserved (David messaging contacts without “כרמן” does not wake Carmen).
- **How:** Deterministic `@lid` → phone resolve only (`payload` / `carmen_lid_aliases` / `wa_lid_map` / single allowed phone). **Never** “freshest active session” when multiple phones are allowed. `pickPrivateCarmenTarget` keeps replies on the counterpart. Ana LID `79564420182139` → `972545612156`. Shared helper: `_shared/carmen-private-routing`.
- **Origin:** Carmen → Cursor DEV TASK — Ana private messages were hijacked into David’s chat (“היי דוד”).

### 2026-08-04 — WhatsApp voice notes: clear transcript + honest capability
- **Skin slug:** `wa_voice_transcript_capability` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Read WhatsApp voice notes via automatic Whisper transcription. Messages arrive as `🎤 <transcript>` with `_voice` metadata (status/source/message_id). On failure she sees explicit `[הודעת קול · no_audio_url|transcription_failed|…]` — never a silent placeholder. When asked “את קוראת הודעות קול?” she answers from the actual marker, not assumptions.
- **How:** Manus pairs Green API transcripts **keeping 🎤**; Green/Manus store `raw_provider_data._voice`; prompt rule `buildVoiceCapabilityPromptRule`. Shared helper `_shared/wa-voice-resolve`.
- **Origin:** Carmen → Cursor FIX-ON-FAIL — David: Carmen claimed she can’t read voice notes while she had already transcribed his recording.

### 2026-08-04 — Smooth WhatsApp Meta approval confirm → execute
- **Skin slug:** `wa_meta_approval_confirm_flow` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** On WhatsApp confirms (`כן` / `מאשר` / `כן מאשר` / `תעשי את זה`), reliably bind to the latest matching pending Meta approval and execute it. If none pending — recover the last prepared request once, show a clear summary, and ask for one final confirmation. Never claim Meta execution without `execute_pending_approval` success.
- **How:** Engine: phrase detector + auto-execute short confirms; smarter `execute_pending_approval` / `list_pending_approvals`; reuse existing pending duplicate instead of re-queue loops; prompt guardrails. Shared helper `_shared/wa-approval-flow`.
- **Origin:** Carmen → Cursor FIX-ON-FAIL — after duplicate-ads approval David got stuck in "no pending / confirm again" loop ("תעשי את זה, וגם תתקני את הפלו שיהיה יותר זורם").

### 2026-08-04 — Dev/system-fix escalations: David full + Ana bugfix-only
- **Skin slug:** `dev_escalation_auth_only_david` (updated) + `bugfix_escalation_to_cursor` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Enforce tiered auth for system/dev fixes: **David** = full (Cursor/Claude/Manus/GitHub); **Ana** = bugfix-only via `mcp_Cursor__request_dev_task`; others get polite Hebrew refusal. Normal CRM tools stay under existing role permissions.
- **How:** Engine guards in `run-ai-agent`: `getDevEscalationTier` + `isDevEscalationToolAllowed`; strip unauthorized MCP tools; suppress generic escalation skins for bugfix tier; hard-refuse at execute time; system-prompt rule per tier. Shared helper: `_shared/dev-escalation-auth`.
- **Origin:** Carmen → Cursor DEV TASK — David: "תיקונים במערכת רק משתמשים מורשים"; extended 2026-08-23 for Ana bug-fix path.

### 2026-08-04 — Expose inspect/duplicate Meta tools in Carmen runtime schema
- **Skin slug:** `fb_duplicate_ad_variants` (triggers broadened)
- **What changed:** Tools from PR #325 existed in `ALL_TOOLS` but were invisible on WhatsApp — OpenAI's 128-tool cap truncated late tools (~index 147+) whenever the embedding router fell back to the full set (`agent_tool_embeddings` / `match_agent_tools` were never applied in prod). Fix: move tools next to other FB tools, add to `CORE_TOOLS` + `PRIORITY_TOOLS` (cap + router never drop them), keyword force-include for שכפול/duplicate, apply `create_agent_tool_embeddings` ops migration.
- **How Carmen retries:** Ask to duplicate Kernelios winning ad → `inspect_facebook_ad` + `fb_duplicate_ad_variants` must appear in the tool schema; queue variants → pending approval.
- **Origin:** Carmen → Cursor FIX-ON-FAIL — "tools not in current AI tool schema" after PR #325.

### 2026-08-04 — Duplicate Meta ad with copy variants (approval-gated)
- **Skin slug:** `fb_duplicate_ad_variants` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Inspect a winning Facebook ad (`inspect_facebook_ad` → adset/page/creative/lead_form), then queue `fb_duplicate_ad_variants` to create N new ads under the same ad set with different primary_text/headline while reusing media + lead form. Optional `daily_budget` (₪) at campaign or adset level. Always returns `pending_approval` — no Meta write until David approves.
- **How:** (1) `list_facebook_ads` / pick winner; (2) `inspect_facebook_ad(client_id, ad_id)`; (3) draft 4 copy variants; (4) `fb_duplicate_ad_variants(client_id, source_ad_id, variants, count?, daily_budget?)` → show summary → on כן `execute_pending_approval`. New ads default `PAUSED`.
- **Origin:** Carmen → Cursor DEV TASK — Kernelios campaign `קריאייטיבים חדשים | Test` winning ad `האיום לא מחכה- כהה` needed 4 copy variants; no safe duplicate-with-variants tool existed.

### 2026-08-04 — FB toggle approval UUID "system" fix
- **Skin slug:** n/a (engine bug — `facebook-campaign-analysis` flow already covers the procedure)
- **What changed:** WhatsApp sessions pass `user_id="system"`. `toggle_facebook_campaign` / `fb_pause` / `fb_resume` and other mutating tools were inserting that literal into `agent_approval_queue.requested_by` (uuid) → `invalid input syntax for type uuid: "system"`. Now uses `asUuidOrNull` (null for system) and prefers the profile UUID resolved from David's WhatsApp phone. Same sanitize on `approved_by` in `carmen-approval-execute`.
- **How Carmen retries:** After listing ads (`list_facebook_ads`), call `toggle_facebook_campaign` / `fb_resume` for selected low-CPL ad ids — pending approval rows should create successfully; then `execute_pending_approval` after David says כן.
- **Origin:** Carmen → Cursor FIX-ON-FAIL — Kernelios selective ad enable approvals failed after analyze worked (PR #323).

### 2026-08-04 — Kernelios lookup + FB single-campaign analyze (ad-level)
- **Skin slug:** `facebook-campaign-analysis` (updated) + `client_alias_broad_search` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** (1) Find Kernelios/Cornelius/קרנליוס/קרניליוס across CRM names, ended duplicates, and Facebook ad account names without repeated prompting. (2) Analyze a specific Facebook campaign with ad-level spend/leads/CPL (`analyze_facebook_campaign` / `list_facebook_ads`) without the old "Requested function was not found" failure. (3) Prepare approval to enable only low-CPL ads (`toggle_facebook_campaign` with `level=ad`, or `fb_resume` with ad `entity_id`).
- **How:** `list_clients`/`search_entities(type=client)` → expect active `קרניליוס` + ended `KERNELIOS` + Yael/Edvard ad accounts → `analyze_facebook_campaign`/`list_facebook_ads` → sort by `cpl_7d` → `request_approval` / `toggle_facebook_campaign` for selected ad ids only. Never toggle without approval.
- **Engine fixes:** Inline Meta analysis in `run-ai-agent` (no hard dependency on undeployed `fb-campaign-analyze`); deploy set includes `fb-campaign-analyze`/`carmen-fb-tools`/`toggle-facebook-campaign`; `carmen-fb-tools` uses `meta_ads_account_id`; `save_memory` uses `agentId` (fixes `agent_id is not defined`).
- **Origin:** Carmen → Cursor DEV TASK — Kernelios lookup flaky + analyze failed when David approved enabling only low-CPL ads.

### 2026-08-03 — diagnose campaign pulse no_data vs stale sync
- **Skin slug:** `diagnose_campaign_pulse_status` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When David says a client’s pulse shows “no data” but reports are connected, distinguish true `no_data` (no campaign table) from `warning`/stale sync, and surface available metrics (including ecommerce ROAS/purchases).
- **How:** Call `get_latest_campaign_pulse(client_name=...)`. Interpret `status` + `flags`: `no_data` = missing table; flags containing `סנכרון ישן או חסר` = connected but stale — never say “אין נתונים” for that case. If `is_ecommerce`, prefer ROAS/purchases over CPL.
- **Code fixes (same PR):** `find_campaign_tables` accepts Google `cost`; pulse classifier marks connected+empty/stale as `warning` not `no_data`; health probe uses freshest of column/settings `last_sync_at`; ecommerce tables force ecommerce metrics; sync writers update both sync timestamps.
- **Origin:** Carmen → Cursor DEV TASK — client `4/4 ארבע על ארבע` marked missing/no_data despite Meta+Google report tables connected (health said sync old/missing).

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

### 2026-08-03 — escalate-to-Cursor + teach-back loop
- **Skin slug:** `cursor_escalation` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When stuck on complex tasks, code fixes, DB/GitHub work she cannot do independently, Carmen escalates to **Cursor** via MCP (`mcp_Cursor__ask_cursor` / `mcp_Cursor__request_dev_task`), relays the Cloud Agent URL (`https://cursor.com/agents/<bcId>`) to David, and learns a skin from the solution next time.
- **How:** `agent_mcp_connections` entry named `Cursor` → `cursor-mcp` edge function + `CURSOR_MCP_BEARER`. Prefer Cursor over Claude for coding/infra. Trigger phrases: "תעבירי לקרסר", "ask cursor", "צריך פיתוח", "אין לי כלי", "תקן בקוד".
- **Origin:** Built as a direct Cursor Cloud Agents bridge (parallel to claude-mcp).

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

---

## 2026-06-29 — send_calendar_invite + send_message_to_campaigner + team roster injection

**Dispatches resolved:** d5f3de3f, ef71fbbe (2026-06-29 13:17–13:18 UTC)

**Capabilities built** (all in `run-ai-agent/index.ts`):

### 1. `send_calendar_invite` — Google Calendar invite via email

**What it does:** Creates a Google Calendar event on the organizer's calendar with an external attendee. Google automatically sends an email to the attendee with Accept / Decline buttons (ICS-based). Uses `sendUpdates=all` in the API call.

**Parameters:** `attendee_email` (required), `attendee_name`, `title`, `date` (YYYY-MM-DD), `time` (HH:MM), `duration_minutes` (default 60), `notes`

**Auth flow:** Uses the caller's calendar tokens (via `profiles.campaigner_id`). Falls back to any tenant campaigner with connected tokens. Returns error if no Google Calendar is connected.

**How to use:**
- "שלחי זימון לפגישה לפליקס מחר ב-08:00" → `send_calendar_invite(attendee_email="dmm4business@gmail.com", attendee_name="פליקס", title="פגישה עם דוד", date="2026-06-30", time="08:00")`
- פליקס יקבל מייל עם כפתורי "אשר / דחה" מגוגל

### 2. `send_message_to_campaigner` — WhatsApp to a team member

**What it does:** Sends a WhatsApp message to a campaigner by their `campaigner_id` (UUID). Looks up their phone from the `campaigners` table and sends via the tenant's active WhatsApp integration.

**Parameters:** `campaigner_id` (required), `message_text` (required)

**How to use:**
- "שלחי לפליקס הודעה..." → `list_campaigners()` לקבלת campaigner_id → `send_message_to_campaigner(campaigner_id="...", message_text="...")`
- אין צורך לדעת את מספר הטלפון — כרמן מוצאת אותו בעצמה

### 3. Team roster — injected into every session's system prompt

**What it does:** At every session startup, `run-ai-agent` fetches all tenant campaigners and injects them into Carmen's organizational context. Carmen now always knows: id, name, phone, email, role — for every team member.

**Format injected:**
```
צוות הארגון (N חברים):
• [uuid] שם | 📱 phone | ✉️ email | (role)
```

**Why:** Carmen was unaware of team members by name (e.g. "פליקס"). This fix makes the full team roster available in every session without Carmen needing to call `list_campaigners` first.

**DB (ai_skills):** slugs `send_calendar_invite`, `send_message_to_campaigner`, `team_roster_awareness` (scope=tenant, created_by_agent=true)

---

## 2026-07-08 — get_maskyoo_calls_report + sync_maskyoo_cdr (Maskyoo reports)

**Capabilities built** (in `run-ai-agent/index.ts` + RLS fix):

### 1. `get_maskyoo_calls_report` — דוח שיחות מסקיו לפי לקוח/תקופה

**What it does:** שולף ספירות שיחות נכנסות מ-`seo_call_snapshots` לפי לקוח, קטגוריה (organic/paid), ותקופה. תומך בהשוואה לתקופה קודמת (period_compare=true). מסמן אם הנתון הוכנס ידנית (is_manual).

**Parameters:**
- `client_id` — UUID לקוח (אופציונלי, בלעדיו מחזיר כל הלקוחות)
- `client_name` — חיפוש חלקי אם אין client_id
- `period_start` / `period_end` — YYYY-MM-DD (ברירת מחדל: החודש הנוכחי)
- `category` — `organic` / `paid` / `all` (ברירת מחדל: all)
- `period_compare` — boolean, אם true מחזיר גם תקופה קודמת מקבילה

**How to use:**
- "כמה שיחות היו לברלינר החודש?" → `get_maskyoo_calls_report(client_name="ברלינר", period_compare=true)`
- "דוח שיחות אורגני לחודש יוני" → `get_maskyoo_calls_report(category="organic", period_start="2026-06-01", period_end="2026-06-30")`

### 2. `sync_maskyoo_cdr` — סנכרון CDRs מ-API מסקיו

**What it does:** קורא ל-`sync-maskyoo-cdr` edge function כדי למשוך שיחות חדשות מה-API של מסקיו אל `call_logs`. מחזיר כמה רשומות נוספו.

**Parameters:** `from_date` (YYYY-MM-DD, ברירת מחדל 7 ימים אחורה)

**How to use:** "תסנכרני שיחות מסקיו" → `sync_maskyoo_cdr()`

### RLS Fix
טבלת `seo_call_snapshots` הייתה חסומה לחלוטין (RLS ללא פוליסי). הוספנו:
- owners/team_managers: גישה מלאה
- campaigners/seo: צפייה בלבד ללקוחות שלהם

**Architecture:**
- `maskyoo_numbers` — מספר טלפון → לקוח + קטגוריה (organic/paid)
- `call_logs` (provider='maskyoo') — כל השיחות הגולמיות (4,908 רשומות)
- `seo_call_snapshots` — צברים לפי לקוח/קטגוריה/תקופה (61 snapshots)
- `maskyoo_settings` — הגדרות API לטננט (base_url + api_token)

**Commits:** see branch `claude/masquio-reports-integration-d006h5`

## set_campaign_table_active + בדיקת דופק ממוקדת (2026-07-24)
- **כלי חדש ב-run-ai-agent:** `set_campaign_table_active` — מדליק/מכבה את `crm_tables.campaign_active` לפי client_id/table_id/table_name (מוגבל טננט + הרשאות caller). כשאומרים לכרמן שקמפיין הופסק/חזר — היא מעדכנת את הדגל בעצמה, ובדיקות הדופק מדווחות רק על טבלאות פעילות. יש גם Badge לחיץ בעמוד הטבלאות.
- **skins "בדיקת דופק" (שני הטננטים) סונכרנו:** סעיף 0 חדש — בידוד טננטים (רק לקוחות הטננט הנוכחי), פטור ללקוחות is_seo_client ללא שירות קמפיינים מדיווחי "חסר חיבור לטבלה", דילוג על טבלאות campaign_active=false, ו-list_clients(status="active") בלבד + סינון תוצאות check_ad_accounts_health לפי הרשימה הפעילה (הבלוק הזה היה חסר ב-MarketingCaptain).
- **carmen-realtime-session:** ההנחיות מזהות את המתקשר בשמו, מצהירות ש-ask_carmen הוא המוח של כרמן עצמה (scoping אוטומטי לפי הרשאות), ודוחות שיחות לא-עבודה ("אני באמצע ניהול עסק").
