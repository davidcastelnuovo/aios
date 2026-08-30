## Environments (standing — read first)

**There IS a development environment. Never tell David or Carmen that it does not exist.**

Source of truth: `docs/ENVIRONMENTS.md`. Cursor rule: `.cursor/rules/environments.mdc`.

- The **development environment** is the Vercel Preview URL of this branch. It talks to AIOS Staging.
- Flow: **Feature → Preview → Staging → Production**. Never use Production as a development environment.
- `main` = Production. `develop` = Staging. Feature work = `feature/*` or `fix/*`.
- This Cloud Agent's local `.env` still points at Production. That is **not** proof Staging is missing.
- **NEVER MODIFY PRODUCTION DIRECTLY.** No direct commits to `main`, no ad-hoc Production SQL, no Production migrations without Staging + David's `מאשר לפרודקשן`.
- When a task is done, **always send David the development environment link**: the Vercel Preview URL for this branch (and the in-app path). If the work is on `develop`, also send `STAGING_DOMAIN=<configured-in-vercel>`.
- Do not merge to `main` until he has that preview link **and** explicitly says `מאשר לפרודקשן`.
- A merge to `main` auto-updates `develop` so the persistent development environment stays current. Do not merge to `develop` by hand unless that sync failed.

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

Scope note: this environment sets up the **frontend web app** (the core product surface). The backend is the hosted/remote Supabase project (`SUPABASE_PRODUCTION_PROJECT_ID=<configured-outside-git>`), not a local stack — there is no local DB/`supabase start` config, so no local backend is needed to run and use the app.

Services and how to run them:
- **Frontend (Vite + React + TS)** — start with `pnpm dev`; it serves on `http://localhost:8080` (host `::`, port fixed in `vite.config.ts`). Other scripts (in `package.json`): `pnpm build`, `pnpm build:dev`, `pnpm preview`, `pnpm lint`.
- The app reads `VITE_SUPABASE_*` from the committed root `.env`. **This Cloud Agent checkout still talks to Production Supabase** — do not create throwaway accounts or write test data. Staging credentials live in Vercel Preview+`develop` only (`docs/ENVIRONMENTS.md`). The backend project refs are `<configured-outside-git>`.

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
- **Always send David the Vercel preview URL** (the development environment link) when you finish work on a branch, and again after every follow-up that pushes new commits. Include the in-app path when known (e.g. `/t/<tenant>/marketing/department/copy`).
- **Do not merge to `main` until he has that preview link and explicitly says `מאשר לפרודקשן`.** Coordinate with other open agents the same way — each agent sends its own branch preview; nobody merges on another agent's behalf.
