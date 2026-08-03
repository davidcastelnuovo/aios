## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- Before architecture or implementation work, prefer the shared `aios-system-graph` MCP tools (`query_system_graph` and `graph_status`) when available. They read the centrally maintained graph of `main` without requiring a local Graphify installation.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Cursor Cloud specific instructions

Scope note: this environment sets up the **frontend web app** (the core product surface). The backend is the **hosted/remote Supabase project** (`zvoijyneresvkadpprel`), not a local stack — there is no local DB/`supabase start` config, so no local backend is needed to run and use the app.

Services and how to run them:
- **Frontend (Vite + React + TS)** — start with `pnpm dev`; it serves on `http://localhost:8080` (host `::`, port fixed in `vite.config.ts`). Other scripts (in `package.json`): `pnpm build`, `pnpm build:dev`, `pnpm preview`, `pnpm lint`.
- The app reads `VITE_SUPABASE_*` from the committed root `.env` and talks directly to the hosted Supabase (Postgres + ~215 Deno Edge Functions). Auth, data, and edge functions are all remote, so login/data actions hit **production** — do not create throwaway accounts or write test data casually.

Non-obvious gotchas:
- **Default org / Carmen = MarketingCaptain** (`2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019`). WhatsApp updates via `claude_notify_david` must go through Marketing Captain Carmen. Do not pass a client’s tenant (e.g. DMM) unless David explicitly says to work on DMM / Carmen of DMM.
- Package manager is `pnpm` (a `pnpm-workspace.yaml` exists). Multiple lockfiles coexist (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock*`) but Vercel/production and this dev setup use different managers; prefer `pnpm` locally for consistency. `bun` is not installed here.
- `pnpm lint` (`eslint .`) lints the whole repo including `supabase/functions/**` (Deno) and currently reports thousands of **pre-existing** errors (mostly `@typescript-eslint/no-explicit-any`, plus Deno-specific code). This is the baseline repo state — a non-zero lint exit is expected and not caused by env setup.
- The Chrome extension in `extension/` is a **separate** product with its own `package.json`/lockfile (`bun`); it is not part of the root workspace and is optional for core dev.
- When capturing screen recordings of the app, note that Chrome's GPU-composited surface may not be captured by the recorder (shows a black screen / spinning cube). Screenshots capture the real page correctly; prefer screenshots for UI evidence here.
