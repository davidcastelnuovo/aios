# Development and verification

## Environment and commands

- Before running the app or data checks, read `docs/ENVIRONMENTS.md` and confirm which Supabase environment the current checkout uses without exposing credentials. A Cloud Agent checkout may point at Production; do not create throwaway accounts or test data there.
- Prefer `pnpm` locally despite the multiple lockfiles. Check installed tools in the current environment instead of assuming `bun` or other runtimes are available.
- Read `package.json` for scripts and `vite.config.ts` for the development server address and port.
- The frontend uses hosted Supabase; check the current repository configuration before assuming a local backend exists or is required.
- Treat `extension/` as a separate product with its own package configuration; it is optional for core frontend work.

## Verification

- Shared-agency dashboards + permission personas: `pnpm test:guards` (and CI) must stay green — never list `crm_dashboards` by UI `tenant_id` alone in `DynamicTables` / client Reports; use `fetchAccessibleDashboards`. When changing RLS / `user_can_*` / `is_seo_staff` / `useUserRole.isSeo` / `crm-tables` scope, extend `scripts/permission-personas.config.json` if adding a persona class. Postmortems: `docs/postmortems/2026-09-09-dmm-dashboards-regression.md`, `docs/postmortems/2026-09-09-hybrid-seo-report-access-regression.md`.
- Small UI changes: verify with `pnpm build` (and a focused lint of changed files if useful). Do **not** run browser sessions, click-throughs, or screenshots/recordings unless the user explicitly asked for a visual check.
- Data / production changes: verify with SQL against the hosted project. That is the source of truth; do not add a UI walkthrough on top.
- Skip extra “manual testing” loops by default. If a check is not needed to prove the change, do not run it.
- Whole-repo lint has historically included pre-existing frontend and Deno errors. Compare failures against the baseline; do not dismiss new failures merely because lint was already failing.
- When a visual check is explicitly requested, prefer screenshots: Chrome's GPU-composited surface may appear black or as a spinning cube in recordings.

## Hosting

- Frontend hosting is Vercel; the canonical domain is `https://aios.co.il`. Lovable is no longer the hosting provider.
- Backend services use Supabase. Keep project refs and credentials outside git, and keep Staging connected to Staging.
- Inspect `deploy-edge-function.yml` for current deployment triggers; after an authorized edge-function merge, confirm its run succeeds.
