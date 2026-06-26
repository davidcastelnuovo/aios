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
---

## 2026-06-26 — Outbound owner message routing guard

**Problem diagnosed:** Carmen was responding to messages that were NOT addressed to her.
Because David's personal phone is connected to AIOS, Carmen receives ALL his WhatsApp
threads — including conversations with human team members like Ana. Two code paths
in `handleCarmenMessage` allowed `isManualOutgoing` messages (David typing in WA app)
to trigger AI replies:

1. **Active session path** (line 805): outbound messages passed straight through to AI
   execution and sent a reply, hijacking private chats.
2. **New session path** (line 1026): outbound messages with a trigger keyword could create
   new Carmen sessions in third-party threads, again hijacking the chat.

**Fixes (PR #52):**

Added two outbound guards in `supabase/functions/_shared/carmen.ts`:

1. **Active session guard** (inserted after `if (activeSession) {`): when `isManualOutgoing
   && !isIncoming`, update `session.last_message_at` to keep the session warm for the
   next inbound, then return `{ handled: true, outcome: 'active' }` — no AI, no reply.

2. **New session guard** (inserted before trigger-keyword check): when `isManualOutgoing
   && !isIncoming`, return `{ handled: false, reason: 'outbound_no_new_session' }` — no
   session is ever created from an owner's outbound message.

**Invariant enforced:** Only *inbound* messages (counterpart → David's number) can start
or advance a Carmen session. David's own outgoing messages are context-only: they keep
the session clock warm but never produce an agent reply.
