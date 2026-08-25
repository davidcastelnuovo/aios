# carmen-mcp — Grok Bot talks to Carmen

MCP server that lets **Grok Bot** (and any external MCP client) ask **Carmen** — the AIOS operational agent — questions and run operational tasks. This is the reverse of `grok-mcp` (Carmen → Grok).

Grok Bot connects as an MCP **client**; this edge function is the **server**.

## Tools

| Tool | What it does |
| --- | --- |
| `ask_carmen` | Send a message to Carmen's full brain (`run-ai-agent`). Returns her reply. Optional `conversation_id` for continuity. |

## One-time setup

### 1. Secrets (project `zvoijyneresvkadpprel`)

| Secret | Required | Value |
| --- | --- | --- |
| `CARMEN_MCP_BEARER` | ✅ | strong random string (`openssl rand -hex 32`) — Grok Bot sends this as `Authorization: Bearer …` |
| `CARMEN_MCP_TENANT_ID` | recommended | tenant UUID for Carmen (or rely on `CLAUDE_DEFAULT_TENANT_ID`) |
| `CARMEN_MCP_USER_ID` | optional | acting user UUID (default David — full owner permissions) |

### 2. Grok Bot plugin

1. Open **Grok Bot → Settings → Plugins**.
2. Add **custom MCP server** (not from marketplace).
3. **Name:** `Carmen` (any label).
4. **URL:** `https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-mcp`
5. **Header:** `Authorization` = `Bearer <CARMEN_MCP_BEARER>` (paste the full value including `Bearer ` prefix if the UI expects the raw token only, use the token without `Bearer` — match what other plugins do).

6. Save. Tools should list `ask_carmen`.

### 3. Use in a Bot task

Attach the Carmen connector to a task (with `@` if the UI supports it), then prompt e.g.:

> שאלי כרמן מה מצב הדופק של הסוכנויות השבוע

Or in English:

> Use ask_carmen to get Carmen's latest pulse check summary for all agencies.

Pass back `conversation_id` from Carmen's reply on follow-up questions.

## Verify

```bash
curl -sS "https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-mcp" \
  -H "Authorization: Bearer $CARMEN_MCP_BEARER" | jq .

curl -sS "https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-mcp" \
  -H "Authorization: Bearer $CARMEN_MCP_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .
```

## Logging

Dispatches are stored in `public.carmen_mcp_dispatches` (request text, conversation id, tools used, status).

## Related

- `grok-mcp` — Carmen escalates **to** Grok Bot (Cloud Agent).
- `cursor-mcp` / `claude-mcp` — Carmen escalates to other coding agents.
