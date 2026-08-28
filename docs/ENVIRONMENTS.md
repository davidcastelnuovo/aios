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

- Vercel Production on `main`
- GitHub `develop` branch
- Vercel Preview env rows for **`develop` only** pointing at AIOS Staging (`APP_ENV=staging`, `STAGING_SAFE_MODE=true`, Staging URL/keys)
- Production Vercel values left untouched
- WhatsApp send paths go through `IntegrationGuard` (`send-manus-wa-message`, `send-green-api-message`, `send-meta-whatsapp-message`)
- Staging / Preview / Dev visual banner via `VITE_APP_ENV`

Gaps (do not touch Production to close these):

1. Staging Supabase schema / Edge Functions / cron are not yet synced from this repo (Staging project had no migrations connected).
2. GitHub Actions (`deploy-edge-function`, `apply-sql-migration`) still deploy **only** to Production on `main`.
3. Feature-branch Previews still inherit the shared Production frontend keys unless the branch is `develop`.
4. No persistent Staging domain alias yet (`STAGING_DOMAIN=<configured-in-vercel>`).
5. No Staging seed/test data.
6. Email / webhooks / cron / automations are not fully on the guard yet (WhatsApp is).
7. Branch protection on `main` / `develop` is a GitHub settings change, not a code change.
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
