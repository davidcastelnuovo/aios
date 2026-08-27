# grok-mcp — Carmen talks to Grok Bot

MCP server that lets Carmen escalate complex tasks and fixes to **Grok Bot**.

## Preferred path: Cursor Automation webhook

When `GROK_BOT_WEBHOOK_URL` + `GROK_BOT_WEBHOOK_KEY` are set, Carmen POSTs to David's Grok Bot automation:

```bash
curl -X POST "$GROK_BOT_WEBHOOK_URL" \
  -H "Authorization: Bearer $GROK_BOT_WEBHOOK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"צור קריאייטיב לינקדאין ללקוח X","context":"עברית, 16:9"}'
```

- `request_dev_task` → `task` + optional `context` / `branch`
- `ask_grok` → `request` is mapped to `task` in the webhook body
- Empty pings without `task` are ignored on the Grok Bot side
- Grok Bot replies back to Carmen via **`carmen-mcp` / `ask_carmen`** when finished (or **`cursor-mcp` / `ask_cursor`** when `reply_via: cursor`)

## Grok Bot Direct (same live Cursor chat)

Like Carmen Direct: Cursor sends `{ task, context }` to the automation webhook **and** includes `reply_to_bc_id` / `session_id`. Grok replies with `reply_to_cursor_session` — **not** `ask_cursor` (that opens a new agent).

```
Cursor chat (bc-…) → webhook → Grok Bot
Grok Bot → reply_to_cursor_session({ session_id, message }) → same Cursor chat
```

## Cursor ↔ Grok Bot direct (no Carmen)

| Direction | Setup |
| --- | --- |
| **Cursor → Grok** | `.mcp.json` → `grok-mcp/mcp` + `GROK_MCP_BEARER` in Cloud Environment secrets |
| **Grok → Cursor** | Grok Bot Plugins → `cursor-mcp/mcp` + **`GROK_CURSOR_MCP_BEARER`** (not Carmen's `CURSOR_MCP_BEARER`) |

Both URLs **must end with `/mcp`** (Streamable HTTP).

## Fallback: Cursor Cloud Agents API

If webhook secrets are **not** set, `grok-mcp` falls back to launching a Cursor Cloud Agent pinned to `GROK_MODEL_ID` (sticky per tenant via `grok_sticky_agents`).

## Tools

| Tool | What it does |
| --- | --- |
| `request_dev_task` | Code/feature/bugfix. Grok implements on a branch and opens a PR. |
| `ask_grok` | Research, analysis, planning, investigation. |

Both are **asynchronous** in webhook mode: Carmen gets an immediate ack; Grok replies later via `ask_carmen`.

## One-time setup

### 1. Secrets (project `zvoijyneresvkadpprel`)

| Secret | Required | Value |
| --- | --- | --- |
| `GROK_MCP_BEARER` | ✅ | strong random string; Carmen presents this as the MCP bearer. Falls back to `CURSOR_MCP_BEARER`. |
| `GROK_BOT_WEBHOOK_URL` | ✅ (webhook mode) | `https://api2.cursor.sh/automations/webhook/…` from the Grok Bot automation panel |
| `GROK_BOT_WEBHOOK_KEY` | ✅ (webhook mode) | Bearer token from the same panel |
| `CURSOR_API_KEY` | fallback only | same Cursor API key used by `cursor-mcp` |
| `GROK_MODEL_ID` | optional | default `cursor-grok-4.6-high-fast` (cloud-agent fallback) |
| `CURSOR_CLOUD_ENV_NAME` | optional | `davidcastelnuovo/aios` (cloud-agent fallback) |

```bash
supabase secrets set \
  GROK_MCP_BEARER="$(openssl rand -hex 32)" \
  GROK_BOT_WEBHOOK_URL='https://api2.cursor.sh/automations/webhook/…' \
  GROK_BOT_WEBHOOK_KEY='…'
```

### 2. Register the MCP connection (in the app)

**Agent Editor → MCP Connections → חיבור חדש → preset Grok Bot**, paste `GROK_MCP_BEARER`, connect.

Carmen then gets `mcp_Grok__request_dev_task` and `mcp_Grok__ask_grok`.

Optional: Profile → Escalation agent → **Grok Bot בלבד**.

### 3. Full loop (webhook mode)

```
Carmen (ask_grok / request_dev_task)
  → grok-mcp POST webhook
  → Grok Bot automation wakes
  → Grok does the work
  → Grok calls carmen-mcp ask_carmen
  → Carmen tells David / continues the session
```

### 4. Teach / update / fix-on-fail

Same loop as Cursor/Claude: every dispatch asks Grok to teach a reusable `ai_skills` skin, notify David via `claude_notify_david`, and fix broken skins on fail. Dispatches are logged to `public.grok_dispatches`.

## Notes

- Webhook mode needs `GROK_BOT_WEBHOOK_URL` + `GROK_BOT_WEBHOOK_KEY` before Carmen can reach the real Grok Bot.
- Reverse direction (Grok → Carmen) uses `carmen-mcp` with `CARMEN_MCP_BEARER`.
- Tables `grok_dispatches` / `grok_sticky_agents` are created by migration on merge.
- Completion WhatsApp updates reuse `claude_notify_david`.
