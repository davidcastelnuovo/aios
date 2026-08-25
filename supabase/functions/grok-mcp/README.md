# grok-mcp — Carmen talks to Grok Bot

MCP server that lets Carmen escalate complex tasks and fixes to **Grok Bot** — the Cursor/xAI cloud teammate. There is no separate public “create Bot” API, so each tool call launches a Cursor Cloud Agent pinned to a Grok model (`GROK_MODEL_ID`, default `cursor-grok-4.6-high-fast`).

Carmen already speaks MCP as a client (`agent_mcp_connections`, `mcp-connect`, `_shared/mcp-tools.ts`). This function is the server side.

## Tools

| Tool | What it does |
| --- | --- |
| `request_dev_task` | Code/feature/bugfix. Grok implements on a branch and opens a PR. |
| `ask_grok` | Research, analysis, planning, investigation (may still open a PR). |

Both are **asynchronous**: the call returns `https://cursor.com/agents/<bcId>` immediately.

### Sticky agent

By default Carmen reuses **one Grok Cloud Agent per tenant** (`grok_sticky_agents`), separate from the Cursor sticky agent so the two conversations do not mix.

Optional secrets: `GROK_STICKY_AGENT_ID` (force a specific `bc-…`), `GROK_STICKY=false` to disable.

## One-time setup

### 1. Secrets (project `zvoijyneresvkadpprel`)

| Secret | Required | Value |
| --- | --- | --- |
| `CURSOR_API_KEY` | ✅ | same Cursor API key used by `cursor-mcp` |
| `GROK_MCP_BEARER` | recommended | strong random string; Carmen presents this as the MCP bearer. If unset, `CURSOR_MCP_BEARER` is accepted. |
| `GROK_MODEL_ID` | optional | default `cursor-grok-4.6-high-fast` |
| `CURSOR_CLOUD_ENV_NAME` | recommended | `davidcastelnuovo/aios` |

```bash
supabase secrets set \
  GROK_MCP_BEARER="$(openssl rand -hex 32)" \
  GROK_MODEL_ID='cursor-grok-4.6-high-fast'
```

`CURSOR_API_KEY` and `CURSOR_CLOUD_ENV_NAME` should already exist from the Cursor bridge.

### 2. Register the MCP connection (in the app)

**Agent Editor → MCP Connections → חיבור חדש → preset Grok Bot**, paste `GROK_MCP_BEARER` (or the existing `CURSOR_MCP_BEARER`), connect.

Carmen then gets `mcp_Grok__request_dev_task` and `mcp_Grok__ask_grok`.

Optional: Profile → Escalation agent → **Grok Bot בלבד**.

### 3. Teach / update / fix-on-fail

Same loop as Cursor/Claude: every dispatch asks Grok to teach a reusable `ai_skills` skin, notify David via `claude_notify_david`, and fix broken skins on fail. Dispatches are logged to `public.grok_dispatches`.

## Notes

- Needs `CURSOR_API_KEY` in production before Carmen can fire Grok agents.
- Tables `grok_dispatches` / `grok_sticky_agents` are created by migration on merge.
- Completion WhatsApp updates reuse `claude_notify_david`.
