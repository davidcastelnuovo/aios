# claude-mcp — Carmen talks to Claude

This edge function is an **MCP server** that lets Carmen (and any AIOS agent)
talk directly to **Claude the developer/assistant** over MCP — the same way
David asks Claude to build things, fix bugs, or do research.

Carmen already speaks MCP as a *client* (see `agent_mcp_connections`,
`mcp-connect`, `_shared/mcp-tools.ts`). This function is the *server* side:
Carmen connects to it like any other MCP server, and each tool call fires a
**real Claude Code on the web cloud session** via the
[Routines `/fire` API](https://platform.claude.com/docs/en/api/claude-code/routines-fire).
Claude then works on the repo autonomously and opens a pull request.

## Tools exposed

| Tool | What it does |
| --- | --- |
| `request_dev_task` | Code/feature/bugfix work. Claude reads the repo, implements the change on a branch, and opens a PR. |
| `ask_claude` | Any general request — research, analysis, writing, planning, investigation. |

Both are **asynchronous**: the call returns a Claude Code session URL
immediately; the actual work (and the PR) lands when the session finishes. The
returned session URL is what Carmen reports back so David can watch the run.

## One-time setup

### 1. Create a routine (David, in the Claude Code web UI)

1. Go to **https://claude.ai/code/routines** and create a routine.
2. **Repositories:** add the AIOS repo (`davidcastelnuovo/aios`).
3. **Prompt:** make it generic so it handles both dev and general asks. The
   per-call `text` Carmen sends carries the actual task. Recommended prompt:

   > You are Claude, David's developer and assistant, working in the AIOS
   > codebase. The incoming message (the routine `text`) is a request from
   > Carmen on David's behalf, prefixed with either `DEV TASK` or `REQUEST`.
   > For a DEV TASK: implement the change and open a pull request. For a
   > REQUEST: do the research/analysis/writing and report your findings;
   > open a PR if there's an artifact to deliver. Follow the repo's CLAUDE.md.

4. **Triggers:** click **Add another trigger → API → Generate token**. Copy the
   `trig_…` routine id and the `sk-ant-oat01-…` token (shown once).
5. (Optional) Create a second routine for dev tasks if you want different repo
   scope / branch-push settings, and use the `CLAUDE_DEV_*` secrets below.

### 2. Set Supabase secrets (project `zvoijyneresvkadpprel`)

| Secret | Required | Value |
| --- | --- | --- |
| `CLAUDE_ROUTINE_ID` | ✅ | the `trig_…` routine id |
| `CLAUDE_ROUTINE_TOKEN` | ✅ | the `sk-ant-oat01-…` per-routine token |
| `CLAUDE_MCP_BEARER` | ✅ | any strong random string; protects this endpoint |
| `CLAUDE_DEV_ROUTINE_ID` | optional | separate routine id for dev tasks |
| `CLAUDE_DEV_ROUTINE_TOKEN` | optional | token for the dev routine |
| `CLAUDE_ROUTINE_BETA` | optional | override the experimental beta header |
| `CLAUDE_DEFAULT_TENANT_ID` | optional | fallback tenant for the "teach Carmen a skin" step when it can't be resolved from the caller's bearer |

## Teach + update + fix-on-fail loop

Every help request appends a block instructing Claude to:

- **Teach Carmen** — after solving, if the task is a reusable capability, write a
  skin into `public.ai_skills` (`scope='tenant'`, `created_by_agent=true`) so
  Carmen can do it herself next time, and record it in
  `docs/carmen-learned-skills.md` (Claude's own cross-session memory). Trivial
  one-offs are skipped.
- **Keep David updated** — when Claude finishes, make sure David is informed of
  the result (call Carmen back via `run-ai-agent` so she relays it, or put the
  summary + PR link in the PR description). Carmen's own instruction also tells
  her to update David at hand-off (with the session link) and again on
  completion.
- **Fix-on-fail** — if the request says a previously-taught skin failed in
  practice, Claude treats fixing it as the priority (diagnose → fix the skin
  and/or code → verify → report) so Carmen can retry.

The tenant + agent are resolved server-side from the caller's bearer (tenant
falls back to `CLAUDE_DEFAULT_TENANT_ID`), so the model never has to pass a UUID.

```bash
supabase secrets set \
  CLAUDE_ROUTINE_ID=trig_xxx \
  CLAUDE_ROUTINE_TOKEN=sk-ant-oat01-xxx \
  CLAUDE_MCP_BEARER="$(openssl rand -hex 32)"
```

### 3. Register the connection so Carmen sees the tools

In the app: **Agent Editor → MCP Connections tab → "חיבור חדש"** (a one-click
**Claude** preset is provided), then fill in:

- **Name:** `Claude`
- **URL:** `https://zvoijyneresvkadpprel.supabase.co/functions/v1/claude-mcp`
- **Bearer Token:** the same value you set for `CLAUDE_MCP_BEARER`

`mcp-connect` probes the server (`initialize` + `tools/list`) and stores the
connection. Carmen now has `mcp_Claude__request_dev_task` and
`mcp_Claude__ask_claude` available, loaded by `loadMcpTools` on every run.

Equivalent curl:

```bash
curl -X POST "https://zvoijyneresvkadpprel.supabase.co/functions/v1/mcp-connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE_KEY" \
  -d '{
    "tenant_id": "<tenant uuid>",
    "agent_id": "<carmen agent uuid, or omit for tenant-wide>",
    "name": "Claude",
    "url": "https://zvoijyneresvkadpprel.supabase.co/functions/v1/claude-mcp",
    "bearer_token": "<CLAUDE_MCP_BEARER value>"
  }'
```

## Notes & limits

- **Async only.** `/fire` returns once the session is *created*; it does not
  stream output or wait. Carmen gets a session URL, not the final result.
- **No idempotency.** Each call creates a new session — don't retry blindly.
- **Auth.** This endpoint can launch real Claude sessions, so `CLAUDE_MCP_BEARER`
  should always be set in production. The function rejects calls without it.
- **Experimental API.** The routine fire endpoint is behind the dated beta
  header `experimental-cc-routine-2026-04-01`; override via `CLAUDE_ROUTINE_BETA`
  if Anthropic ships a new version.
- **Single repo.** The target repo is whatever the routine is configured with
  (AIOS). The MCP `tools/call` payload carries only the task text, not a tenant,
  so all tenants fire the same routine. Use separate routines + a second
  deployment if you need per-tenant repo scoping.
