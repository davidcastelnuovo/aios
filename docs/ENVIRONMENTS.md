# AIOS environments and deployment workflow

Status: foundation in progress. Supabase project `AIOS Staging`
(`mzjsuvatrzhciojmbbbm`) was provisioned on 2026-08-28 in `ap-northeast-1`.
It is not ready for application use until schema, seed data, secrets and safety
controls are applied and verified. See the audit and migration plan before assuming
an environment is isolated.

## Non-negotiable workflow

```text
feature/* | fix/* | refactor/*
              -> Vercel Preview + isolated Supabase Preview when DB is involved
develop       -> persistent AIOS Staging + Supabase Staging
main          -> AIOS Production + Supabase Production
```

Production is never a development or integration-test environment. An agent may
build, push, validate Preview, deploy Staging, and repair Staging. Promotion from
`develop` to `main`, Production migrations, and Production integration deployment
require David's explicit approval: `מאשר לפרודקשן`.

## Environment contract

| Environment | Git source | Frontend | Database | External side effects |
| --- | --- | --- | --- | --- |
| Development | local feature branch | local Vite | local/isolated development DB | blocked/mock only |
| Preview | feature/fix/refactor branch or PR | Vercel Preview | Supabase Preview/isolated DB when required | blocked, redirected, allowlisted, or dry-run |
| Staging | `develop` | persistent staging deployment and domain | Supabase `mzjsuvatrzhciojmbbbm` | safe mode and allowlists |
| Production | `main` | `https://aios.co.il` | Supabase `zvoijyneresvkadpprel` | live |

Required application variable: `APP_ENV=development|preview|staging|production`.
Staging also requires `STAGING_SAFE_MODE=true`. Secrets and credentials must be
scoped per environment. Preview and Staging must never inherit Production database,
service-role, webhook, Meta, WhatsApp, email, or automation credentials.

## Current-state audit — 2026-08-28

The audit was performed read-only against repository commit `7bb44aaf`. No Vercel
deployment, Supabase mutation, migration, Edge Function deployment, or Production
change was made.

### Existing architecture

- Frontend: Vite, React 18, TypeScript, shadcn/ui and Tailwind, deployed through
  Vercel Git integration. `main` is the repository default and Production branch.
- Backend: one hosted Supabase project, ref `zvoijyneresvkadpprel`, containing
  Postgres, RLS, database functions, cron jobs and 238 Edge Function directories.
- Database history: 768 SQL files under `supabase/migrations/`, plus operational SQL
  under `supabase/ops/`.
- CI: GitHub Actions deploy changed Edge Functions to the Production project on
  pushes to `main`; a second workflow applies selected `supabase/ops` SQL directly
  to the same Production project. The system graph is also rebuilt from `main`.
- Vercel: `vercel.json` enables Git integration and SPA rewrites. No repository-level
  configuration currently establishes a persistent `develop` staging target.
- Agent guidance: `AGENTS.md` and `CLAUDE.md` already existed, but the previous rules
  described local development as connected directly to Production. `CLAUDE.md` also
  contained unresolved merge-conflict markers.

### What already aligns

- Feature branches are widely used.
- Vercel Git integration is enabled and existing agent rules already require a
  Preview URL before a Production merge.
- A large migration history exists in version control.
- Production Edge Function deployment is tied to `main`, not arbitrary branches.
- The repository has central agent instruction files and a shared architecture graph.

### Gaps and risks

1. There is no `develop` branch and no persistent full-system Staging environment.
2. `supabase/config.toml`, the committed root `.env`, CI workflows, documentation,
   and some source files reference the Production Supabase project directly.
3. The committed `.env` contains a Production-facing publishable key and URL. While
   a publishable key is not a server secret, it makes local and Preview builds unsafe
   because they can read/write Production subject to RLS.
4. Preview deployments can therefore connect to Production unless Vercel branch
   variables override every relevant value. That isolation is not enforced in code.
5. There is no central `APP_ENV`, `STAGING_SAFE_MODE`, Integration Guard, destination
   allowlist, or uniform dry-run policy.
6. Outbound behavior is distributed across many Edge Functions and integrations,
   including WhatsApp, Meta WhatsApp, email, webhooks, automations, calendars,
   publishing, campaign control and Carmen paths.
7. Cron definitions exist in migrations/ops and currently target hosted functions;
   no environment-wide safe-mode policy exists.
8. Migration deployment is split between `supabase/migrations` and an ad-hoc
   Production `supabase/ops` workflow. There is no Staging gate or automated schema
   parity check before Production.
9. No versioned Staging seed dataset was found.
10. The root package has build and lint scripts but no root `test` or `typecheck`
    script. Whole-repo lint has a known large pre-existing failure baseline.
11. The README is stale and still describes Lovable, although current project notes
    identify Vercel as the canonical host.
12. Live connector verification found one Vercel project linked to this repository:
    `after-lead` (`prj_8rhx2txEzvAz2UaGGQAGLcMbFtUH`) on team `aios-crm`. Its latest
    deployment is Production and its domains include `aios.co.il`; no separate
    Staging Vercel project was found.
13. Supabase connector verification found only the healthy Production project
    `AfterLead` for AIOS and no database branches under it. No dedicated AIOS
    Staging project or Preview branch currently exists.
14. The Vercel team is currently reported as a Hobby plan. Plan capabilities must be
    checked before relying on advanced deployment protection or environment features.
15. GitHub branch-protection and exact Vercel environment-variable scopes still need
    authenticated read-only verification; the available project read API did not
    expose those settings.

## Migration plan

### Phase 1 — audit and guardrails

- Keep this document and agent instructions authoritative.
- Inventory live Vercel projects/domains/environment-variable scopes, Supabase
  projects/branches/secrets, GitHub protections, cron jobs, webhook registrations,
  and deployment history without mutating them.
- Map every external side-effect callsite and classify it as allow/block/mock/
  redirect/dry-run for each environment.

### Phase 2 — staging infrastructure

- Create dedicated Supabase Staging; record only its non-secret identifiers in repo.
- Create `develop` from a validated `main` baseline and map it to a persistent Vercel
  Staging deployment/domain.
- Configure branch-scoped Preview and Staging variables. Verify both point away from
  Production before any authenticated interaction.

Production impact: creating isolated resources has none. Changing Git/Vercel branch
configuration can affect deployment routing and must be verified before enabling it.

### Phase 3 — database workflow and seed data

- Establish migration parity from Production schema to Staging without copying live
  customer data by default.
- Consolidate normal schema/RLS changes under `supabase/migrations/`; reserve
  `supabase/ops` for documented, exceptional operations.
- Add deterministic, synthetic multi-tenant seed data for roles, organizations,
  agencies, clients, leads, tasks, reports, Carmen and automations.

Production impact: none until a validated migration is explicitly promoted. Schema
capture must be read-only; no live data is copied without separate approval and a
sanitization plan.

### Phase 4 — integration safety

- Add one shared Integration Guard returning `ALLOW`, `BLOCK`, `MOCK`, `REDIRECT`,
  or `DRY_RUN` from environment, integration, action and destination.
- Route all outbound WhatsApp, email, webhook, Carmen, automation, Meta/Google,
  publishing and calendar actions through adapters using the guard.
- Make Staging fail closed: allowlisted test phones/mailboxes only, Staging endpoints,
  sandbox resources, dry-run automations, and disabled/safe cron jobs.

Production impact: guard introduction touches high-traffic integration paths. Use
additive adapters, contract tests and environment-specific rollout; preserve
Production behavior as `ALLOW` until each path is verified.

### Phase 5 — Preview workflow

- Require a Vercel Preview for every feature/PR.
- For schema-dependent changes, create/use an isolated Supabase Preview branch and
  bind only that branch's variables to the Vercel Preview.
- Add an automated PR comment/check that exposes the Preview URL and fails the handoff
  if the deployment is missing or unhealthy.

### Phase 6 — CI/CD gates

- Add focused typecheck, lint, test, build and migration validation jobs.
- Add Staging Edge Function/migration workflows targeting only Staging on `develop`.
- Gate `develop -> main` on successful Staging checks, RLS tests, integration safety
  tests and explicit Production approval.
- Pin CLI/action versions and remove workflows that can apply arbitrary operational
  SQL to Production without the new gate.

Production impact: modifying current `main` workflows can change live deployment
behavior. Introduce and prove Staging workflows first; change Production workflows
only in a separately reviewed phase.

### Phase 7 — validation

- Run role/RLS isolation tests for Super Admin, Owner, Manager, Campaigner and Client.
- Run cross-module E2E scenarios with synthetic data and intercepted outbound actions.
- Verify environment-labelled logs, rollback procedures and the visible STAGING badge.

### Phase 8 — documentation and operating model

- Update README/bootstrap instructions and environment inventory.
- Document secrets ownership, migration lifecycle, rollback, incident handling and
  Production approval.
- Keep the agent completion contract below mandatory.

## Agent completion contract

Every completed coding task must be pushed to its own branch and conclude with:

```text
Preview URL: https://<deployment>.vercel.app
Route: /<relevant-path>
Verification: READY + checks performed
Production changed: no
Known limitations: none | <details>
```

The agent must wait for Vercel, verify the deployment is reachable, and provide the
URL again after follow-up commits. A task without a usable Preview URL is blocked,
not complete. Only tasks with no runnable frontend artifact may use `Preview: N/A`,
and the agent must explain why.

## Rollback principles

- Application: retain and document the last known-good Vercel deployment; rollback
  by alias/promotion only after identifying the exact target deployment.
- Database: prefer expand -> deploy -> migrate -> contract. Avoid destructive changes
  that make the previous application version incompatible.
- Integrations: use environment flags and kill switches so external side effects can
  be disabled independently of a frontend rollback.
