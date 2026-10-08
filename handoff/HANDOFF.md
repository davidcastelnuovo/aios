# Handoff: label-gated Supabase deploys

**Delete this whole `handoff/` folder when you're finished** (`git rm -r handoff`). It exists only because the cloud session's token cannot write `.github/workflows/**`.

## Goal
Bring UpLine's GitHub Actions deploy system (`chiptus/UpLine`, `.github/workflows/`) to aios: a `staging` label on a PR deploys its migrations and edge functions to the Staging Supabase project before merge; merging to `main` deploys Production behind the `production` environment approval.

## What to do
1. Move the workflow files into place (from the repo root, on this branch):
   ```bash
   cp handoff/workflows/*.yml .github/workflows/   # overwrites the two edge workflows with the changed versions
   git add .github/workflows
   ```
2. Do the GitHub setup below.
3. Run **Supabase migration dry run** (Actions) for `staging` and `prod` and check the migration history (the user is reconciling history separately; don't start `db push` before it is clean).
4. `git rm -r handoff`, commit, push (needs a credential that can write workflows), open a PR into `develop`. Don't merge without an explicit request.

## What the branch contains
- `handoff/workflows/` (to be moved): `deploy-staging.yml`, `deploy-prod.yml`, `deploy-staging-develop.yml`, `_db_migrate.yml`, `_check_types.yml`, `staging-lock.yml`, `staging-db-commands.yml`, `supabase-migration-dryrun.yml`, plus the changed `deploy-edge-reusable.yml` (new `mode: pr` input) and `deploy-edge-function.yml` (manual-only; prod deploys now run from `deploy-prod.yml` so they wait for migrations).
- Already in place: `.github/scripts/` (PR comment script, repair-command scripts and test), `scripts/gen-types.sh`, a new section in `docs/ENVIRONMENTS.md`, `test:guards` addition in `package.json`.
- `.github/workflows/` still has the unmodified existing workflows until you copy.

## Decisions already made (don't re-ask)
- Branch model stays `feature/*` → `develop` (Staging) → `main` (Prod). `develop` → `main` release PRs are exempt from the label gate and lock; hotfix PRs into `main` follow the label flow.
- Migrations use `supabase db push` on `supabase/migrations`; the legacy `supabase/ops/*.sql` workflows stay until history is reconciled.
- Types are check-only (CI regenerates from staging and fails on a diff); no GitHub App credentials. Developers regenerate with `scripts/gen-types.sh`.
- Edge functions keep the existing guarded deploy scripts: they wrap each staging function with the outbound guard so staging, which holds mirrored prod data, cannot send real messages. Simplifying this is a later PR (runtime guard keyed on `SUPABASE_URL`, fails closed; codemod for the 261 entrypoints; plain `supabase functions deploy`).
- Out of scope: removing Lovable; migration history reconciliation.

## Things to verify
- Types check may fail on first run from formatting differences; the CLI is pinned to 2.116.0 everywhere.
- In `pr` mode, if Staging runs another PR's functions that aren't in this PR's history, all functions are redeployed; the `edge-deployed-staging` tag must not move.
- `staging-lock.yml` and `staging-db-commands.yml` (`pull_request_target`, `issue_comment`) only run from the default branch, so they take effect once on `main`.
- The edge "recover deployment base" step assumes merge commits (ancestor check); squash merges into `develop` would break it.

## GitHub setup
- Variables: `PROD_PROJECT_REF`, `STAGING_PROJECT_REF`.
- Secrets: `PROD_DB_PASSWORD`, `STAGING_DB_PASSWORD` (`BASE_ACCESS_TOKEN` already exists and is reused).
- Environments: `staging`, `production` (David as required reviewer; this is the `מאשר לפרודקשן` gate).
- Label: `staging`.
- Required checks on `develop` and `main`: `Require staging label`, `Verify staging lock ownership`.

## References
- Reference implementation: UpLine `.github/workflows/` and `docs/adr/0009-generate-types-against-staging-migrate.md`.
- aios docs: `AGENTS.md`, `docs/ENVIRONMENTS.md`, `docs/agents/releases.md`.

## Suggested skills
`supabase` (history and `db push`), `create-pr`, `code-review` (final pass over the workflows).
