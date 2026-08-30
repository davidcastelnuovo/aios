# cursor-mcp — Carmen talks to Cursor

MCP server that lets Carmen escalate complex tasks and fixes to **Cursor Cloud Agents** — the same runtime David uses in the Cursor Agents UI (repo clone, GitHub, DB, skins, PRs).

Carmen already speaks MCP as a client (`agent_mcp_connections`, `mcp-connect`, `_shared/mcp-tools.ts`). This function is the server side: each tool call creates a real Cloud Agent via [`POST https://api.cursor.com/v1/agents`](https://cursor.com/docs/cloud-agent/api/endpoints).

## Tools

| Tool | What it does |
| --- | --- |
| `request_dev_task` | Code/feature/bugfix. Cursor implements on a branch and opens a PR. |
| `ask_cursor` | Research, analysis, planning, investigation (may still open a PR). |

Both are **asynchronous**: the call returns `https://cursor.com/agents/<bcId>` immediately.

### Sticky agent (conversation memory)

By default Carmen reuses **one Cloud Agent per tenant** (`cursor_sticky_agents`):
follow-ups call `POST /v1/agents/{id}/runs` so Cursor keeps the same conversation
and workspace. A new agent is created only when none exists or the sticky one is gone.

Optional secrets: `CURSOR_STICKY_AGENT_ID` (force a specific `bc-…`), `CURSOR_STICKY=false` to disable.

## One-time setup

### 1. Cursor API key (David)

1. Open [Cursor Dashboard → API Keys](https://cursor.com/dashboard/api).
2. Create a user or service-account API key with permission to launch Cloud Agents on `davidcastelnuovo/aios`.
3. (Recommended) Note the cloud environment name for AIOS (e.g. `davidcastelnuovo/aios`) so agents boot with the same install/secrets as interactive runs.

### 2. Supabase secrets (project `zvoijyneresvkadpprel`)

| Secret | Required | Value |
| --- | --- | --- |
| `CURSOR_API_KEY` | ✅ | Cursor API key |
| `CURSOR_MCP_BEARER` | ✅ | Carmen only — Agent Editor → MCP Connections → Cursor |
| `GROK_CURSOR_MCP_BEARER` | ✅ (Grok direct) | Grok Bot → Cursor direct channel only — **separate from Carmen** |
| `CURSOR_CLOUD_ENV_NAME` | recommended | named cloud environment (same VM setup as David) |
| `CURSOR_REPO_URL` | optional | default `https://github.com/davidcastelnuovo/aios` |
| `CURSOR_STARTING_REF` | optional | default `main` |
| `CURSOR_MODEL_ID` | optional | default `composer-2.5` (fast). Set explicitly to override; omitting used to fall back to account default (often Grok). |
| `CURSOR_AUTO_CREATE_PR` | optional | default `true` |
| `CURSOR_DEFAULT_TENANT_ID` | optional | fallback tenant for teach-back skins |

```bash
supabase secrets set \
  CURSOR_API_KEY=crsr_... \
  CURSOR_MCP_BEARER="$(openssl rand -hex 32)" \
  CURSOR_CLOUD_ENV_NAME='davidcastelnuovo/aios' \
  CURSOR_DEFAULT_TENANT_ID=2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019
```

### 3. Register the MCP connection (Carmen)

In the app: **Agent Editor → MCP Connections → חיבור חדש → preset Cursor**, paste the same `CURSOR_MCP_BEARER`, connect.

Carmen then gets `mcp_Cursor__request_dev_task` and `mcp_Cursor__ask_cursor`.

### 4. Grok Bot Direct (same live chat)

`reply_to_cursor_session` posts into a **specific** Cursor Cloud Agent (`session_id` = `bc-…`).
This is the Grok equivalent of Carmen Direct — not a new agent.

Webhook context from Cursor should include `reply_to_bc_id: bc-…`.
Grok then calls:

```
reply_to_cursor_session({ session_id: "bc-…", message: "OK …" })
```

### 5. Grok Bot → Cursor (direct MCP)

Grok Bot talks to Cursor via **Streamable HTTP MCP**:

| Field | Value |
| --- | --- |
| **URL** | `https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp/mcp` |
| **Header** | `Authorization: Bearer <GROK_CURSOR_MCP_BEARER>` |

Tools: `ask_cursor`, `request_dev_task`, `generate_creative`, `reply_to_cursor_session` (Grok Bot Direct — reply into a live `bc-…` chat).

**Do not use `CURSOR_MCP_BEARER` here** — that belongs to Carmen's separate Cursor connection.

### 6. Cursor → Grok Bot (direct)

Repo `.mcp.json` includes **Grok** → `grok-mcp/mcp` with `GROK_MCP_BEARER` (must be in Cloud Environment secrets).

Calls default `reply_via: cursor` + `session_id` so Grok replies via `reply_to_cursor_session` into **this** chat.

### 6. Teach / update / fix-on-fail

Same loop as Claude: every dispatch asks Cursor to teach a reusable `ai_skills` skin, notify David via `claude_notify_david`, and fix broken skins on fail. Dispatches are logged to `public.cursor_dispatches`.

## Notes

- Needs `CURSOR_API_KEY` in production before Carmen can fire agents.
- Table `cursor_dispatches` is created by migration / ops SQL on merge.
- Completion WhatsApp updates reuse the existing `claude_notify_david` path (no separate notify function).
