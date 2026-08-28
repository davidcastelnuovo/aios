# AIOS — project notes for Claude

## Environments (standing)
- Source of truth: `docs/ENVIRONMENTS.md`. Flow: Feature → Preview → Staging → Production.
- **NEVER MODIFY PRODUCTION DIRECTLY.** `main` is Production; `develop` is Staging.
- Every completed task must include the Vercel Preview URL (the development environment link). Merge to `main` only after David says `מאשר לפרודקשן`.

## Shared AIOS system graph
- Before architecture or implementation work, query the `aios-system-graph` MCP server to locate existing components, dependencies, database objects, Edge Functions, Carmen skins, skills, tools, and memory paths. Reuse or improve existing functionality instead of creating a parallel implementation.
- Use `query_system_graph` for discovery and `graph_status` to confirm that the central graph matches a recent `main` commit. Inspect affected dependencies again before opening a pull request.
- The central graph is rebuilt automatically after merges to `main`. If MCP is unavailable and `graphify-out/graph.json` exists locally, fall back to `graphify query`, `graphify path`, and `graphify affected`.
- Never commit Graphify output, `graph.json`, generated reports, summaries, reflections, or work-memory files. Keep changes to Carmen and other critical monolithic functions small and additive.

## Working mode / autonomy (David's standing preference)
- **Default to action — do not ask for confirmation on obvious, low-risk fixes or clearly-requested work.** Implement → commit → open PR → send David the Vercel preview URL → wait for an explicit merge ask.
- **Never merge to `main` until David has the preview link and explicitly asks to merge.** This applies to every Cloud Agent / coding session (copy, creative, and anything else).
- At the end of every completed change that has a frontend preview, include the Vercel preview URL in the reply (and the in-app path when known). Send it again whenever you finish a follow-up that pushed to the PR.
- After merging an edge-function change (only when David asked to merge), confirm the `deploy-edge-function.yml` run went green.
- **Only pause and ask** when the change is genuinely ambiguous (several valid interpretations), architecturally significant or irreversible, destructive (possible data loss), or external-facing in a way David wouldn't expect.
- Report what was done concisely afterward; don't narrate every intermediate step.

## Stack / hosting
- **Frontend hosting: Vercel** (migrated off Lovable). Canonical domain: `https://aios.co.il`. Do NOT reference Lovable — it is fully removed from the codebase.
- **Backend: Supabase** (Postgres + Edge Functions). Production and Staging project refs are `<configured-outside-git>`. Never point Staging frontend at Production.
- Edge functions deploy via the `deploy-edge-function.yml` GitHub Action (auto on merge to `main`, or manual run).

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
When acting on a Carmen escalation (or any autonomous prod change), these are HARD rules — never override them for convenience:
1. **Never widen access.** You may grant a user access ONLY to resources already within their existing role/scope (e.g. add a client to a campaigner's `client_team` when that client is in an agency they already belong to). NEVER raise someone's role, NEVER grant access to data their access level does not already permit. If a request asks for that, refuse and tell David.
2. **No destructive or schema-widening SQL live.** `DROP`, `DELETE`/`UPDATE` without a precise `WHERE`, disabling RLS, or broadening a policy must go through a migration + PR + David's explicit go-ahead — never ad-hoc on prod.
3. **Safe-fix allowlist (may do live):** repointing a misconfigured row, fixing a broken sync, correcting a scoped `client_team` assignment, redeploying an edge function with a fix. Anything outside this → open a PR and ask.
4. **Always log + report.** Write a row to `public.claude_carmen_audit` (`actor`, `action`, `target`, `details`) for every autonomous prod change, and tell David via `claude_notify_david`. Nothing happens silently.
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
