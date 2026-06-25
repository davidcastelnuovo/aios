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

### 2026-06-25 — ad creative brief from CRM data
- **Skin slug:** `ad_creative_brief` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Given a client name and performance data (CPL, spend, lead count), pull the last 10 client updates from CRM, identify which campaigns are working, and produce: 3 structured creative angles (concept + visual + why it works), 3 Hebrew copy hooks, and tactical recommendations (CPL fix, lead qualification, followup SLA). All in Hebrew, ready to hand to a copywriter/creative.
- **How:** `get_client_details` → `get_client_updates` (last 10) → analyse active campaigns, CPL issues, audience segments, known sales-process blockers → structured markdown output with the 3+3+tactics format.
- **Origin:** Carmen escalated creative brief request for רווה קולינריה נוזלית (CPL +86.6%). Root insights came from CRM weekly updates which revealed workshops vs. weddings split, a known followup problem, and which specific creative had worked historically.

### 2026-06-25 — create organization for client (one-click tenant spin-up)
- **Skin slug:** `create_org_for_client` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Given a client name or ID, spin up a full tenant organisation for that client in one call — with an owner (found or invited by email), shared integrations, social pages and WordPress sites, and an optional Carmen + automations clone.
- **How:** Call `create_org_for_client` tool with `{ client_id, clone_carmen: true, share_llm: false }`. Integrations are shared as mirror rows via `shared_from_integration_id`. Social pages and WP sites are registered in `social_pages_shared_tenants` / `wordpress_sites_shared_tenants`. Cloned automations are created **inactive** (must be activated manually). Report the summary back to the user including owner status (existing user / invited / no email).
- **Origin:** Carmen escalated "לא עשיתי" ("not done") after the plan document `docs/plan-create-org-for-client.md` was created but the implementation was never built. PR #31 implements Stages 0–2 (DB + edge function + frontend).

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
