# AIOS agent instructions

This is the canonical instruction file for all coding agents; `CLAUDE.md` is a relative symlink to it. Edit this file to update shared rules.

## Environments (standing — read first)

**There IS a development environment. Never tell David or Carmen that it does not exist.**

Source of truth: `docs/ENVIRONMENTS.md`. Cursor rule: `.cursor/rules/environments.mdc`.

- The **development environment** is the Vercel Preview URL of this branch. It talks to AIOS Staging.
- Flow: **Feature → Preview → merge `develop` (Staging) → verify → `main` (Production)**. Never use Production as a development environment.
- `main` = Production. `develop` = Staging. Feature work = `feature/*` or `fix/*`.
- This Cloud Agent's local `.env` still points at Production. That is **not** proof Staging is missing.
- **NEVER MODIFY PRODUCTION DIRECTLY.** No direct commits to `main`, no ad-hoc Production SQL, no Production migrations without Staging + David's `מאשר לפרודקשן`.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- Before architecture or implementation work, use the shared `aios-system-graph` MCP tools (`query_system_graph` and `graph_status`) when available to locate existing components, dependencies, database objects, Edge Functions, Carmen skins, tools, and memory paths. Confirm the central graph matches a recent `main` commit; reuse existing functionality and inspect affected dependencies again before opening a PR.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the local graph current (AST-only, no API cost); the central graph is rebuilt after merges to `main`.
- Keep Graphify output, generated reports, summaries, reflections, and work-memory files out of commits. Keep changes to Carmen and other critical monolithic functions small and additive.

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
- **Branch freshness:** before opening/updating a PR, `git fetch origin <base>` and merge/rebase so HEAD contains the latest base. CI `Require PR up to date with base` must stay green — never merge a stale branch (it overwrites newer fixes). Use the manual `sync-develop-from-main` workflow for hotfix backports.
- Shared-agency dashboards + permission personas: `pnpm test:guards` (and CI) must stay green — never list `crm_dashboards` by UI `tenant_id` alone in `DynamicTables` / client Reports; use `fetchAccessibleDashboards`. When changing RLS / `user_can_*` / `is_seo_staff` / `useUserRole.isSeo` / `crm-tables` scope, extend `scripts/permission-personas.config.json` if adding a persona class. Postmortems: `docs/postmortems/2026-09-09-dmm-dashboards-regression.md`, `docs/postmortems/2026-09-09-hybrid-seo-report-access-regression.md`.
- Small UI changes: verify with `pnpm build` (and a focused lint of changed files if useful). Do **not** run browser sessions, click-throughs, or screenshots/recordings unless the user explicitly asked for a visual check.
- Data / production changes: verify with SQL against the hosted project. That is the source of truth; do not add a UI walkthrough on top.
- Skip extra “manual testing” loops by default. If a check is not needed to prove the change, do not run it.

## Stack / hosting
- **Frontend hosting: Vercel** (migrated off Lovable). Canonical domain: `https://aios.co.il`. Do NOT reference Lovable — it is fully removed from the codebase.
- **Backend: Supabase** (Postgres + Edge Functions). Production and Staging project refs are `<configured-outside-git>`. Never point Staging frontend at Production.
- Edge functions deploy via the `deploy-edge-function.yml` GitHub Action (auto on merge to `main`, or manual run).

## Working mode and releases

- Default to action for authorized work; pause for genuinely ambiguous, architecturally significant, destructive, irreversible, or unexpected external-facing actions.
- After each completed branch change and follow-up push, send David the Vercel Preview URL and in-app path when known. For `develop`, also send `STAGING_DOMAIN=https://staging.aios.co.il`.
- Tenant pages require `/t/<tenant-slug-or-id>/…`; bare routes such as `/signatures` 404. Public routes such as `/sign/:token` are the exception.
- Each agent sends its own preview; nobody merges on another agent's behalf.
- After an authorized edge-function merge, confirm the `deploy-edge-function.yml` run succeeds.
- The `safe-bugfix` label can trigger automatic merging for eligible branches; apply it only after an explicit merge request and the production approval required above. Eligibility: `fix/*` or `cursor/fix-*`, at most 8 files, no migrations/ops/workflow edits, and a passing frontend build. See `docs/postmortems/2026-09-01-clients-dialog-import.md`.

## Task-specific references

Before changing AI providers, Carmen memory, agent profiles, escalation bridges, or voice, or handling a Carmen-delegated task, read the relevant sections of `docs/agents/carmen.md`.

## Agent skills

### Pull requests

- When creating any PR in this repo, including through the `create-pr` skill, create it as a **draft** (`gh pr create --draft` or API `draft: true`). Target `develop` for feature work.
- Keep the PR in draft until the user explicitly asks to mark it ready for review. Creating a PR, passing checks, or completing the task is not permission to mark it ready or merge it.
- Leave auto-merge disabled and merge-triggering labels unset unless the user explicitly requests merging. Existing production approval rules still apply.
- Before reporting the PR as created, verify `gh pr view <number> --json isDraft` returns `isDraft: true`.

### Issue tracker

Issues and PRDs live in Linear team AIO. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels in AIO's Triage label group. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
