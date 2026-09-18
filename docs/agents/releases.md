# Pull request and release procedure

Follow the merge and production approval rules in root `AGENTS.md`.

- Before opening or updating a PR, fetch its base with `git fetch origin <base>` and merge/rebase so HEAD contains the latest base. Keep the up-to-date check green and never merge a stale branch.
- Main pushes automatically run `sync-develop-from-main`, which merges into `develop` and invokes Staging Edge deployment and frontend CI; manual dispatch remains available for recovery. See `docs/ENVIRONMENTS.md` for synchronization rules.
- After each completed branch change and follow-up push, send David the Vercel Preview URL and in-app path when known. For `develop`, use the stable alias `https://after-lead-git-develop-aios-crm.vercel.app`; include the custom domain only after the verification described in `docs/ENVIRONMENTS.md`.
- Tenant pages require `/t/<tenant-slug-or-id>/…`; bare routes such as `/signatures` 404. Public routes such as `/sign/:token` are the exception.
- Each agent sends its own preview; nobody merges on another agent's behalf.
- For edge-function changes, also follow `docs/agents/development.md` for deployment verification.
- Before applying `safe-bugfix` or assessing auto-merge eligibility, read `.github/workflows/auto-merge-safe-bugfix.yml` and verify every enforced condition: branch pattern, target branch, label, file and line limits, blocked paths, successful build at the current PR head, and base freshness. The workflow is the source of truth for these criteria. Apply the label only after an explicit merge request and the production approval required in `AGENTS.md`. See `docs/postmortems/2026-09-01-clients-dialog-import.md` for context.
