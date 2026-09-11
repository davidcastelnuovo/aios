# AI cost monitoring & brain architecture (2026-09-01)

## Command Center — OpenAI billing widget

**Edge function:** `openai-billing-status` (JWT, owner/super_admin/Command Center billing allowlist).

**APIs used (OpenAI Admin key — not a normal sk- project key):**

| Endpoint | Data |
|---|---|
| `GET /v1/organization/costs?bucket_width=1d` | Current-month spend, daily cost trend, line-item breakdown |
| `GET /v1/organization/usage/completions?bucket_width=1d` | Input/output tokens, model request counts |
| `GET /v1/organization/spend_limits` (best-effort) | Hard/soft limits when configured |

**Not available via public API (never invented):**

- Remaining prepaid credit / account balance → dashboard only
- Per-tenant breakdown (org-wide only)
- Real-time Cursor Cloud / Grok billing (separate products)

**Secrets (Staging first):**

- `OPENAI_ADMIN_KEY` — preferred
- Fallback: `tenant_integrations.llm.settings.openai_admin_api_key`

**UI:** Command Center → HUD menu **שימוש** / dashboard `UsagePanel` — OpenAI Admin block + internal `ai_usage_log` / `agent_action_log` block.

---

## Recommendation: Carmen lightweight brain (fixed direct chat)

### Current state

- Command Center default brain = **Cursor Direct** (`DEFAULT_BRAIN_SLUG=cursor`).
- Each message can spawn a **new** Cursor Cloud Agent unless sticky reuse is enabled.
- **Internal Carmen** (`run-ai-agent`) loads full tool router + memory — highest token overhead but required for WhatsApp CRM/tools.

### Recommendation

| Surface | Default | Rationale |
|---|---|---|
| Command Center chat | Cursor Direct **sticky follow-up** on fixed `bc-…` session | Same thread, no new agent credits; async callback preserved |
| WhatsApp / tasks | Internal Carmen (`run-ai-agent`) | Tools, approvals, CRM — do not route through Cursor |
| Dev escalations | Existing `request_dev_task` / dev-task queue | Avoid Carmen↔Cursor ping-pong |

### Safe implementation (feature flag)

Set on **Staging** Supabase secrets:

```bash
CARMEN_LIGHTWEIGHT_BRAIN=true
# optional — allow new bc- only when sticky chat is busy:
# CURSOR_DIRECT_ALLOW_CREATE=true
```

When enabled:

- `CURSOR_DIRECT_STICKY` behavior is forced — reuse `CURSOR_DIRECT_AGENT_ID` / `cursor_sticky_agents` before creating agents.
- Loop guard logs `loop_guard_warning` to `agent_action_log` when >8 sends / 2 min on same conversation+provider.

### Risks

- **Medium:** Sticky session busy → user waits or needs `CURSOR_DIRECT_ALLOW_CREATE=true`.
- **Low:** WhatsApp unaffected (different entrypoint).
- **Loop risk:** Mitigated by loop guard + existing callback idempotency; do not auto-route WhatsApp through Cursor Direct.

### Phase 2 (not in flag)

- Slim internal brain mode in `run-ai-agent` (fewer tools, `gpt-4o-mini`) for sidecar/system-fix only.

---

## Recommendation: Codex via OpenAI API

### Current state

- **Codex Direct** uses **Cursor Cloud Agents** (`launchCloudDirect`) — same as Cursor seat, unreliable when Cloud env/agent misconfigured.

### Recommendation

Replace Codex seat with **sync OpenAI Chat Completions** for simple Q&A in Command Center; keep Cursor Cloud for repo/code tasks.

### Safe implementation (feature flag)

```bash
CODEX_USE_OPENAI_API=true
CODEX_API_MODEL=gpt-4o-mini   # or codex-capable model when available on your org key
```

Requires existing `OPENAI_API_KEY` or `llm` integration key (same as Carmen internal — **not** Admin key).

When enabled, Codex Direct returns **inline** reply (no callback wait). Parliament / multi-seat flows still use Cloud path.

### Risks

| Risk | Level | Mitigation |
|---|---|---|
| No repo access / tools | High for coding tasks | Keep flag off until Codex seat is Q&A-only; use Cursor for code |
| Model cost on org key | Medium | Default `gpt-4o-mini`; monitor Admin costs widget |
| Gemini fallback break | Low | Codex path is OpenAI-only; internal Carmen fallbacks unchanged |
| Carmen↔Codex loops | Low | Sync path; no MCP back to Carmen |

### Required env vars summary

| Variable | Purpose |
|---|---|
| `OPENAI_ADMIN_KEY` | Command Center billing widget |
| `CARMEN_LIGHTWEIGHT_BRAIN` | Sticky Cursor Direct reuse |
| `CODEX_USE_OPENAI_API` | Codex sync API path |
| `CODEX_API_MODEL` | Model for Codex API path |
| `CURSOR_DIRECT_AGENT_ID` | Fixed bc- session for sticky reuse |
| `CURSOR_API_KEY` | Cursor Cloud (when flags off) |

---

## Deploy notes

- Edge functions deploy via `deploy-edge-function.yml` after merge to `main` (David approval).
- Preview branch talks to **Staging** — copy `OPENAI_ADMIN_KEY` to Staging secrets before billing widget shows live data.
