# AIOS — project notes for Claude

## Stack / hosting
- **Frontend hosting: Vercel** (migrated off Lovable). Canonical domain: `https://aios.co.il`. Do NOT reference Lovable — it is fully removed from the codebase.
- **Backend: Supabase** (Postgres + Edge Functions). Production project ref: `zvoijyneresvkadpprel` (AfterLead).
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

## Carmen voice (ALWAYS support both surfaces)
Carmen must support voice on **both** her surfaces — keep this true going forward:
1. **WhatsApp "Carmen direct" automation** (triggers on "כרמן"):
   - **Voice-IN:** `manus-wa-webhook` → `resolveMessageText()` transcribes inbound audio via Whisper (`aiTranscribe`) before it reaches `handleCarmenMessage` (both group + private call sites).
   - **Voice-OUT:** `send-manus-wa-voice` generates TTS (`aiSpeak`, opus) and probes the Manus gateway audio endpoints. The working endpoint must be wired into the reply path (text fallback if the gateway rejects audio). The Manus gateway has no documented media-send endpoint yet — confirm the probe result before relying on it.
2. **Internal in-app Carmen chat** (`src/components/AIOSDialog.tsx`):
   - **Voice-IN:** mic button → `MediaRecorder` → `transcribe-voice` → auto-send (already wired).
   - **Voice-OUT:** each assistant bubble has a "השמע" speaker button → `carmen-speak` edge function (`aiSpeak`, mp3) → browser `<audio>` playback.
- TTS/STT helpers live in `_shared/ai.ts` (`aiSpeak` / `aiTranscribe`). Voice = `ai_agents.voice` (default `shimmer`).
