# AIOS — project notes for Claude

## Stack / hosting
- **Frontend hosting: Vercel** (migrated off Lovable). Do NOT reference Lovable.
- **Backend: Supabase** (Postgres + Edge Functions). Production project ref: `zvoijyneresvkadpprel` (AfterLead).
- Edge functions deploy via the `deploy-edge-function.yml` GitHub Action (auto on merge to `main`, or manual run).

## AI providers (replacing the former Lovable AI gateway)
We use the org's own connected models. Standardized helper: `supabase/functions/_shared/ai.ts`.
- **Chat / extraction:** OpenAI `gpt-4o-mini` (via `OPENAI_API_KEY` secret), endpoint `api.openai.com/v1/chat/completions`.
- **Embeddings:** OpenAI `text-embedding-3-small`, **1536 dims** — must match the `summary_embedding` vector columns on `carmen_memory_pointers` / `agent_memory`.
- **Image gen:** OpenAI Images `gpt-image-1` (`/v1/images/generations`, returns base64 PNG).
- Per-tenant LLM keys for the main agent live in the `llm` row of `tenant_integrations` (see `resolveLLMTarget` in `run-ai-agent`).
- ⚠️ Lovable removal is in progress — `LOVABLE_API_KEY` / `ai.gateway.lovable.dev` / `connector-gateway.lovable.dev` must be replaced everywhere. Carmen's memory cluster is done; other functions (transcription, telegram, invoices, image, marketing, app URLs) still pending.

## Carmen memory architecture
- `carmen_memory_pointers` = a **pointer map** (category/path/title/summary/importance + `summary_embedding`). Content is fetched live on demand — not one big blob.
- Semantic retrieval via the `kb_match_pointers` RPC; agent memory via `match_agent_memory`. FTS is a fallback.
- Write path: `carmen-learn-from-session` (extract) → `upsertPointer` (dedup on `tenant_id,path,entity_type,entity_id,subcategory`). Known gap: dedup is by storage key, not semantic — near-duplicate instructions from different sessions can still accumulate.
- Always-injected layer is kept small (curated instructions/style + top `ai_memory`); everything else is retrieved on demand.

## Agents
- `ai_agents` has a swappable `mood` column: `fun|focused|tired|angry|random|NULL` (tone-only; never overrides hard rules). Edited in the agent Profile tab; read by `run-ai-agent`.
