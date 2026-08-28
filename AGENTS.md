## AIOS environment workflow — mandatory

Read `docs/ENVIRONMENTS.md` before any architecture, implementation, database,
integration, deployment, or debugging work. These rules apply to every coding
agent and every session, regardless of where the work starts.

- **Never modify Production directly.** Production is `main` + the Production
  Vercel deployment + Supabase project `zvoijyneresvkadpprel`.
- Start every change from an up-to-date integration branch and create a dedicated
  `feature/*`, `fix/*`, or `refactor/*` branch. While the staging migration is in
  progress, do not assume `develop` exists; check the repository first.
- The target flow is `Feature -> Preview -> Staging (develop) -> Production (main)`.
- A feature branch must use an isolated Preview environment. It must never be
  configured with Production Supabase credentials or Production integration
  secrets.
- Database changes belong in `supabase/migrations/` and must be validated outside
  Production before they are eligible for Production.
- Never run Production migrations, deploy Production Edge Functions, test external
  side effects against real customers, or merge to `main` without David's explicit
  approval: **"מאשר לפרודקשן"**.
- Do not use the committed root `.env` for testing: it currently points at the
  hosted Production Supabase project. Treat local app use as Production-connected
  until the staging foundation is complete.
- Every integration change must preserve safe-by-default behavior. In non-production
  environments, external actions must be blocked, redirected, mocked, allowlisted,
  or dry-run through the central guard described in `docs/ENVIRONMENTS.md`.

### Required completion handoff

An implementation task is not complete until the agent pushes its branch, waits for
the Vercel Preview deployment, verifies that it is reachable, and sends David:

1. the exact Vercel Preview URL;
2. the relevant in-app route;
3. verification status and any known limitations;
4. an explicit statement that Production was not changed.

If a Preview cannot be created, report the blocker clearly. Never substitute a
Production URL or describe the task as complete without a usable Preview link.

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

## David — tone (standing)

- Reply in **at most 3 short sentences**. No preambles, recaps, or tables unless he asked.
- If something needs more: **one step at a time**, wait for him. Do not dump the whole explanation.
- Prefer what to do / what happened. Skip “why the architecture exists” unless he asks.

## Cursor Cloud specific instructions

Scope note: this environment sets up the **frontend web app** (the core product surface). The backend is the **hosted/remote Supabase project** (`zvoijyneresvkadpprel`), not a local stack — there is no local DB/`supabase start` config, so no local backend is needed to run and use the app.

Services and how to run them:
- **Frontend (Vite + React + TS)** — start with `pnpm dev`; it serves on `http://localhost:8080` (host `::`, port fixed in `vite.config.ts`). Other scripts (in `package.json`): `pnpm build`, `pnpm build:dev`, `pnpm preview`, `pnpm lint`.
- The app reads `VITE_SUPABASE_*` from the committed root `.env` and talks directly to the hosted Supabase (Postgres + ~215 Deno Edge Functions). Auth, data, and edge functions are all remote, so login/data actions hit **production** — do not create throwaway accounts or write test data casually.

Non-obvious gotchas:
- Package manager is `pnpm` (a `pnpm-workspace.yaml` exists). Multiple lockfiles coexist (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock*`) but Vercel/production and this dev setup use different managers; prefer `pnpm` locally for consistency. `bun` is not installed here.
- `pnpm lint` (`eslint .`) lints the whole repo including `supabase/functions/**` (Deno) and currently reports thousands of **pre-existing** errors (mostly `@typescript-eslint/no-explicit-any`, plus Deno-specific code). This is the baseline repo state — a non-zero lint exit is expected and not caused by env setup.
- The Chrome extension in `extension/` is a **separate** product with its own `package.json`/lockfile (`bun`); it is not part of the root workspace and is optional for core dev.
- When capturing screen recordings of the app, note that Chrome's GPU-composited surface may not be captured by the recorder (shows a black screen / spinning cube). Screenshots capture the real page correctly; prefer screenshots for UI evidence here.

Verification / token budget:
- Small UI changes: verify with `pnpm build` (and a focused lint of changed files if useful). Do **not** run browser sessions, click-throughs, or screenshots/recordings unless the user explicitly asked for a visual check.
- Data / production changes: verify with SQL against the hosted project. That is the source of truth; do not add a UI walkthrough on top.
- Skip extra “manual testing” loops by default. If a check is not needed to prove the change, do not run it.

Preview / merge (standing rule for every Cloud Agent):
- **Always send David the Vercel preview URL** when you finish work on a branch, and again after every follow-up that pushes new commits. Include the in-app path when known (e.g. `/t/<tenant>/marketing/department/copy`).
- **Do not merge to `main` until he has that preview link and explicitly asks to merge.** Coordinate with other open agents the same way — each agent sends its own branch preview; nobody merges on another agent's behalf.
