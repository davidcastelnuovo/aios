# AIOS agent instructions

This is the canonical instruction file for all coding agents; `CLAUDE.md` is a relative symlink to it. Edit shared rules here and keep task-specific procedures in the linked docs.

## Environments and production safeguards

- Development exists: each feature branch's Vercel Preview talks to AIOS Staging; `develop` is Staging and `main` is Production.
- Follow **Feature → Preview → develop → verify on Staging → main**; use `feature/*` or `fix/*` for feature work.
- **Never modify Production directly:** no direct commits to `main`, ad-hoc Production SQL, or Production migrations without Staging verification and David's **`מאשר לפרודקשן`**.
- A local checkout pointing at Production is not evidence that Staging is missing. Confirm the environment before running anything that writes data; keep test accounts and test data out of Production.

## Working style

- Default to action for authorized work; pause for genuinely ambiguous, architecturally significant, destructive, irreversible, or unexpected external-facing actions.
- Reply in at most **3 short sentences**, with no preambles, recaps, or tables unless asked; for longer topics, take one step at a time and wait.
- Prefer what to do or what happened; explain architecture only when asked.

## Pull requests

- Create every PR as a **draft**, including through `create-pr`: use `gh pr create --draft` or API `draft: true`, targeting `develop` for feature work.
- Keep it in draft until the user explicitly asks to mark it ready; creating a PR, passing checks, or completing a task is not permission to mark it ready or merge it.
- Leave auto-merge disabled and merge-triggering labels unset unless the user explicitly requests merging; Production approval still applies.

## Read before the relevant task

- **Codebase questions, architecture, implementation, or `/graphify`:** read `docs/agents/discovery.md` before exploring; it defines graph lookup, fallback, and update procedures.
- **Environment setup or deployment configuration:** read `docs/ENVIRONMENTS.md`, the environment source of truth, before changing configuration.
- **Running the app, changing code or permissions, verifying a change, or capturing visuals:** read `docs/agents/development.md` before execution for environment checks, permission guards, and focused verification.
- **Creating/updating a PR, marking it ready, merging, deploying, or reporting completed branch work:** read `docs/agents/releases.md` for branch freshness, draft verification, and preview reporting.
- **WhatsApp connections, groups, permissions, sync, or automations; AI providers; Carmen memory, profiles, bridges, or voice; or a Carmen-delegated task:** read the relevant sections of `docs/agents/carmen.md` before acting.
- **Creating or updating issues:** use Linear team **AIO** and read `docs/agents/issue-tracker.md`.
- **Triaging issues:** read `docs/agents/triage-labels.md` for the five labels in AIO's **Triage** group.
- **Exploring domain concepts or recording decisions:** read `docs/agents/domain.md` for the single-context glossary and ADR conventions.
