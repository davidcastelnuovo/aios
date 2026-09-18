# Carmen and AI integration reference

Read the relevant sections when changing AI providers, Carmen memory, agent profiles, escalation bridges, or voice, or handling a Carmen-delegated task.

## WhatsApp connections — NEVER mix (standing)

Cursor rule: `.cursor/rules/whatsapp-connections.mdc`.

| Connection | Whose phone | Use for |
| --- | --- | --- |
| **Manus** (`manus_wa`) | Carmen | Carmen chat + her group membership |
| **Green API** (`green_api`) | Operator (David) | CRM chat / broadcasts — **not** Carmen membership |
| **Meta Cloud API** | Business number | Official Cloud API |

Hard rules for every agent:
1. Carmen group allowlists / sync = **Manus only** (Gateway `list-groups` or `chat_messages.provider='manus_wa'`).
2. **Never** dump the full `whatsapp_groups` table into Carmen permissions — it includes Green API operator groups.
3. Staging Manus is often `mocked` without tokens — do **not** "fix" by copying Green API groups or Production WA tokens.
4. Automations stay connection-scoped (`carmen_integration_id` / Manus vs Green). Do not bypass dual-channel guards.

## AI providers (replacing the former Lovable AI gateway)
We use the org's own connected models. Standardized helper: `supabase/functions/_shared/ai.ts`.
- **Chat / extraction:** OpenAI `gpt-4o-mini` (via `OPENAI_API_KEY` secret), endpoint `api.openai.com/v1/chat/completions`.
- **Embeddings:** OpenAI `text-embedding-3-small`, **1536 dims** — must match the `summary_embedding` vector columns on `carmen_memory_pointers` / `agent_memory`.
- **Image gen:** OpenAI Images `gpt-image-1` (`/v1/images/generations`, returns base64 PNG).
- Per-tenant LLM keys for the main agent live in the `llm` row of `tenant_integrations` (see `resolveLLMTarget` in `run-ai-agent`).
- **Transcription:** OpenAI Whisper (`whisper-1`). **TTS:** OpenAI (`gpt-4o-mini-tts`). Helpers `aiTranscribe`/`aiSpeak` in `_shared/ai.ts`.
- **Telegram:** direct Telegram Bot API via the `TELEGRAM_BOT_TOKEN` secret (no connector).
- ✅ Lovable removal COMPLETE — zero `lovable` references in app code. Required secrets: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`. TikTok (`tiktok-connect`/`sync-tiktok-content`) is gated on `TIKTOK_ACCESS_TOKEN` and needs a proper direct TikTok integration to re-enable.

## Carmen memory architecture
- `carmen_memory_pointers` = a **pointer map** (category/path/title/summary/importance + `summary_embedding`). Content is fetched live on demand — not one big blob.
- Semantic retrieval via the `kb_match_pointers` RPC; agent memory via `match_agent_memory`. FTS is a fallback.
- Write path: `carmen-learn-from-session` (extract) → `upsertPointer` (dedup on `tenant_id,path,entity_type,entity_id,subcategory`). Known gap: dedup is by storage key, not semantic — near-duplicate instructions from different sessions can still accumulate.
- Always-injected layer is kept small (curated instructions/style + top `ai_memory`); everything else is retrieved on demand.

## Agents
- `ai_agents` has a swappable `mood` column: `fun|focused|tired|angry|random|NULL` (tone-only; never overrides hard rules). Edited in the agent Profile tab; read by `run-ai-agent`.
- `ai_agents.voice` holds Carmen's TTS voice (default `shimmer`); set in Profile → VoiceCard.

## Carmen → Cursor bridge (preferred escalation for complex work)
- Carmen talks to **Cursor Cloud Agents** over MCP via the `cursor-mcp` edge function. It exposes `request_dev_task` + `ask_cursor`, and each call creates a real Cloud Agent via `POST https://api.cursor.com/v1/agents`. See `supabase/functions/cursor-mcp/README.md`.
- Required secrets: `CURSOR_API_KEY`, `CURSOR_MCP_BEARER`. Recommended: `CURSOR_CLOUD_ENV_NAME` (same environment David uses).
- Same teach / keep-David-updated / fix-on-fail loop as Claude. Completion WhatsApp still uses `claude_notify_david`. Dispatches logged in `cursor_dispatches`.
- Frontend: MCP Connections preset **Cursor**; Profile → Escalation agent can be set to `cursor`.
- **Grok Bot** (`grok-mcp`): preset **Grok Bot** in MCP Connections, bearer `GROK_MCP_BEARER` (falls back to `CURSOR_MCP_BEARER`). Tools: `mcp_Grok__request_dev_task` / `mcp_Grok__ask_grok`. Profile → Escalation agent can be set to `grok`. **Preferred:** POST to David's Grok Bot Cursor Automation webhook (`GROK_BOT_WEBHOOK_URL` + `GROK_BOT_WEBHOOK_KEY`, body `{task, context}`); Grok replies via `carmen-mcp` / `ask_carmen`. **Fallback:** Cursor Cloud Agents API (`GROK_MODEL_ID`, default `cursor-grok-4.6-high-fast`). Dispatches logged in `grok_dispatches`.
- **Grok Bot → Carmen** is the reverse bridge (`carmen-mcp`): Grok Bot Settings → Plugins → custom MCP → the Staging/Production `carmen-mcp` URL (`<configured-outside-git>`) with bearer `CARMEN_MCP_BEARER`. Tool: `ask_carmen`. Dispatches logged in `carmen_mcp_dispatches`. See `supabase/functions/carmen-mcp/README.md`.

## Carmen → Claude bridge (legacy / alternate)
- Carmen talks to Claude over MCP via the `claude-mcp` edge function (an MCP server). It exposes `request_dev_task` + `ask_claude`, and each call fires a real Claude Code on the web session via the Routines `/fire` API. See `supabase/functions/claude-mcp/README.md`.
- When Carmen can't do something herself, she can escalate to Claude (always-on instruction in `ai_memory` + the `claude_escalation` skin) or to Cursor (`cursor_escalation`). The request also asks the coding agent to **teach Carmen**: write a reusable skin into `ai_skills` (`scope='tenant'`, `created_by_agent=true`) so she's independent next time.
- The request carries two loop rules (mirrored in Carmen's instruction/skin): **keep David updated** — Carmen tells David at hand-off (with the session link) and again with a summary when the result/PR lands; and **fix-on-fail** — if a capability Carmen already learned fails in practice, she reports the exact error back (`request_dev_task`), the coding agent fixes the skin/code, and she retries.
- **Guaranteed update channel:** when a coding-agent session finishes a Carmen-delegated task, it pushes a WhatsApp update straight to David by running `select public.claude_notify_david('<message>', '<tenant_id>'::uuid);` via its Supabase connector. That SECURITY DEFINER function reads the shared bearer from Vault and calls the `claude-notify` edge function, which sends through the tenant's Carmen WhatsApp automation — independent of any live Carmen session.

## Safety rules for autonomous fixes (Carmen → Claude)
When acting on a Carmen escalation, follow the release and production approval rules in root `AGENTS.md`, plus these task-specific safeguards:
1. **Never widen access.** You may grant a user access ONLY to resources already within their existing role/scope (e.g. add a client to a campaigner's `client_team` when that client is in an agency they already belong to). NEVER raise someone's role, NEVER grant access to data their access level does not already permit. If a request asks for that, refuse and tell David.
2. **No destructive or schema-widening SQL live.** `DROP`, `DELETE`/`UPDATE` without a precise `WHERE`, disabling RLS, or broadening a policy must go through a migration + PR + David's explicit go-ahead — never ad-hoc on prod.
3. **Scoped fixes:** repointing a misconfigured row, fixing a broken sync, correcting a scoped `client_team` assignment, and redeploying an edge function all follow the Staging + approved Production release flow. This list grants no permission for ad-hoc Production changes.
4. **Always log + report.** Write a row to `public.claude_carmen_audit` (`actor`, `action`, `target`, `details`) for every approved Production change, and tell David via `claude_notify_david`. Nothing happens silently.
- **Claude's own memory of what it taught Carmen lives in `docs/carmen-learned-skills.md`.** When you (a Claude session) solve a Carmen escalation that yields a reusable capability, append an entry there and create/update the matching `ai_skills` skin. Consult that file to avoid re-deriving capabilities Carmen already has.

## Carmen voice (ALWAYS support both surfaces)
Carmen must support voice on **both** her surfaces — keep this true going forward:
1. **WhatsApp "Carmen direct" automation** (triggers on "כרמן"):
   - **Voice-IN:** `manus-wa-webhook` → `resolveMessageText()` transcribes inbound audio via Whisper (`aiTranscribe`) before it reaches `handleCarmenMessage` (both group + private call sites).
   - **Voice-OUT:** `send-manus-wa-voice` generates TTS (`aiSpeak`, opus) and probes the Manus gateway audio endpoints. The working endpoint must be wired into the reply path (text fallback if the gateway rejects audio). The Manus gateway has no documented media-send endpoint yet — confirm the probe result before relying on it.
2. **Internal in-app Carmen chat** (`src/components/AIOSDialog.tsx`):
   - **Voice-IN:** mic button → `MediaRecorder` → `transcribe-voice` → auto-send (already wired).
   - **Voice-OUT:** each assistant bubble has a "השמע" speaker button → `carmen-speak` edge function (`aiSpeak`, mp3) → browser `<audio>` playback.
- TTS/STT helpers live in `_shared/ai.ts` (`aiSpeak` / `aiTranscribe`). Voice = `ai_agents.voice` (default `shimmer`).
