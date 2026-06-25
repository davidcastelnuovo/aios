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

### 2026-06-25 — escalate-to-Claude + teach-back loop
- **Skin slug:** `claude_escalation` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** When stuck on any task she cannot do independently, Carmen escalates to Claude via MCP (`mcp_Claude__ask_claude` / `mcp_Claude__request_dev_task`), relays the session URL to the user, and then learns from the solution so she can act independently next time.
- **How:** Uses `agent_mcp_connections` entry pointing at the `claude-mcp` edge function. Trigger phrases include "אני לא יודעת", "אין לי כלי", "צריך פיתוח", "ask claude".
- **Origin:** PR #20 (Claude-initiated) — wired the claude-mcp MCP server; PR #22 added the teach-back loop with auto-written skins and this log.

### 2026-06-25 — client pulse check (בדיקת דופק)
- **Skin slug:** `pulse_check` (tenant: `2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`)
- **What Carmen can now do:** Full systematic scan of all active clients in an agency — campaign performance vs. prior week, account status, integration disconnections, ecommerce metrics (ROAS, purchases, cost-per-purchase) — with per-client `add_client_update` entries and a sorted WhatsApp summary.
- **How:** `analyze_campaign_performance` per client → `delegate_to_background` when >5 clients → `add_client_update` + `batch_update_client_health`. Output sorted worst-first (churn\_risk → wavering → happy).
- **Origin:** Carmen asked Claude "how to do a proper pulse check for clients" after David reported the Campaigner skin references `pulse_check` by slug but the skill had `slug=null`. Fix: set `slug='pulse_check'`, added `system_prompt` and `triggers` to the existing `בדיקת דופק` ai_skill (`id: 007384e7-c62c-42f8-b0d8-0187eb378eaa`).
