# Pull request and release procedure

Follow the draft and production approval rules in root `AGENTS.md`.

- Before opening or updating a PR, fetch its base with `git fetch origin <base>` and merge/rebase so HEAD contains the latest base. Keep the up-to-date check green and never merge a stale branch.
- Before reporting a new PR as created, verify `gh pr view <number> --json isDraft` returns `isDraft: true`.
- Use the manual `sync-develop-from-main` workflow for hotfix backports.
- After each completed branch change and follow-up push, send David the Vercel Preview URL and in-app path when known. For `develop`, also send `STAGING_DOMAIN=https://staging.aios.co.il`.
- Tenant pages require `/t/<tenant-slug-or-id>/…`; bare routes such as `/signatures` 404. Public routes such as `/sign/:token` are the exception.
- Each agent sends its own preview; nobody merges on another agent's behalf.
- For edge-function changes, also follow `docs/agents/development.md` for deployment verification.
- The `safe-bugfix` label can trigger automatic merging for eligible branches; apply it only after an explicit merge request and the production approval required in `AGENTS.md`. Eligibility: `fix/*` or `cursor/fix-*`, at most 8 files, no migrations/ops/workflow edits, and a passing frontend build. See `docs/postmortems/2026-09-01-clients-dialog-import.md`.
