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
