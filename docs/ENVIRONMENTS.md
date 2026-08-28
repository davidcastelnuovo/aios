# AIOS environments

Standing rule for every agent and human:

```
NEVER MODIFY PRODUCTION DIRECTLY.
Feature → Preview → Staging → Production
```

Secrets, project refs, team names, and domains live **outside git**. Use placeholders only:

```
SUPABASE_STAGING_PROJECT_ID=<configured-outside-git>
SUPABASE_PRODUCTION_PROJECT_ID=<configured-outside-git>
STAGING_DOMAIN=<configured-in-vercel>
PRODUCTION_DOMAIN=<configured-in-vercel>
```

When a task finishes, **always send David the development environment link**: the Vercel Preview URL for the feature branch. If the work is on `develop`, also send `STAGING_DOMAIN`. Never merge to `main` without an explicit `מאשר לפרודקשן`.

## Flow

```
feature/* or fix/*
    → Vercel Preview (this branch)
    → merge to develop
    → AIOS Staging (persistent)
    → validate
    → explicit approval
    → merge to main
    → Production
```

| Git | Deploy | Data |
| --- | --- | --- |
| local | `pnpm dev` | Cloud Agent `.env` still talks to Production — do not write test data |
| `feature/*` | Vercel Preview | Target: isolated/staging data (Preview DB still pending) |
| `develop` | Persistent Staging | AIOS Staging Supabase |
| `main` | Production | Production Supabase |

`APP_ENV`: `development` | `preview` | `staging` | `production`. Unset is treated as **production** so existing deploys stay unchanged.

## Audit (current vs this plan)

Already in place:

- Vercel Production on `main` (Production env rows unchanged)
- GitHub `develop` branch
- **Every Vercel Preview** (all feature branches + `develop`) uses AIOS Staging credentials
- `APP_ENV=staging`, `VITE_APP_ENV=staging`, `STAGING_SAFE_MODE=true` on Preview
- Staging auth allows `http://localhost:8080` and `https://*.vercel.app`; email signup autoconfirm is on
- WhatsApp send paths go through `IntegrationGuard`
- Staging / Preview / Dev visual banner via `VITE_APP_ENV`
- `deploy-staging-edge-functions.yml` deploys functions on `develop` only, using GitHub secret `SUPABASE_STAGING_PROJECT_ID` (never a hardcoded ref)

Gaps (do not touch Production to close these):

1. Staging schema/function sync: **237 Edge Functions deployed**; **~229 public tables** applied from repo migrations. Production data seeds were skipped on purpose. Some cron jobs need `pg_cron` (optional).
2. Add GitHub secret `SUPABASE_STAGING_PROJECT_ID` so the Staging deploy workflow can run.
3. Copy non-customer secrets the Staging functions need (e.g. `OPENAI_API_KEY`) in the Staging project dashboard — never commit them. Do **not** copy Production WhatsApp/Meta tokens.
4. No persistent custom Staging domain yet (`STAGING_DOMAIN=<configured-in-vercel>`).
5. No dedicated Staging seed/test tenants yet — sign up on the Preview URL to create the first user.
6. Email / webhooks / cron / automations are not fully on the guard yet (WhatsApp is).
7. Branch protection on `main` / `develop` is a GitHub settings change.
8. This Cloud Agent workspace `.env` still points at Production.

## Agent working rules

1. Create `feature/*` or `fix/*` from `develop` when Staging work is in flight; from `main` only for hotfixes David asked for.
2. Implement on the feature branch. Never commit to `main`. Never run unbounded `DELETE`/`UPDATE` on Production.
3. Open a PR. **Always reply with the Vercel Preview URL** (the development environment link) and the in-app path.
4. Merge to `develop` only when David asks. That is Staging.
5. Merge `develop` → `main` only after `מאשר לפרודקשן`.
6. Edge-function or migration work: add files under `supabase/functions` / `supabase/migrations`. Do not apply them to Production from the agent. Staging apply is a later phase.

## Staging Safe Mode

On Staging (`APP_ENV=staging`, `STAGING_SAFE_MODE=true`):

- WhatsApp send is **BLOCK** unless the number is in `STAGING_ALLOWED_PHONE_NUMBERS`
- Groups are blocked
- Production is never blocked by this guard (unset/`production` → ALLOW)

Set `STAGING_ALLOWED_PHONE_NUMBERS` only in Staging secrets / Vercel Preview+`develop`, never in git.

## Phases

1. Audit — this document.
2. Staging infrastructure — `develop` + Preview env vars (done). Remaining: Staging domain, Staging secrets on the Staging Supabase project, auto-deploy `develop`.
3. Database — migration workflow onto Staging; seed data. No Production schema edits from agents.
4. Integration safety — central guard (WhatsApp done). Next: email, webhooks, automations dry-run, cron.
5. Preview workflow — feature branches should not use Production credentials.
6. CI — typecheck/tests before merge; optional Staging function deploy on `develop`.
7. Validation — E2E on Staging.
8. Docs — this file is the source of truth.

## Production impact of this PR

- **No Production env vars changed.**
- **No Production database changed.**
- Integration guard is a no-op when `APP_ENV` is unset or `production`.
- Staging banner is hidden in Production.
- Creating GitHub `develop` does not change `main`.
