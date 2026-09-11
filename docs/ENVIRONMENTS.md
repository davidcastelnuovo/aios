# AIOS environments

**There IS a development environment. Never tell David or Carmen that it does not exist.**

What to say when asked:

- Yes — the development environment is the Vercel Preview URL of the current branch. It talks to AIOS Staging.
- Staging is git branch `develop`. Production is `main` only.
- A Cloud Agent checkout whose `.env` still points at Production is expected. That local `.env` is not the development environment.

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

When a task finishes, **always send David the development environment link**: the Vercel Preview URL for the feature branch. If the work is on `develop`, also send `STAGING_DOMAIN=https://staging.aios.co.il`. Never merge to `main` without an explicit `מאשר לפרודקשן`.

## Canonical URLs

| Environment | Git | Frontend URL | When it updates |
| --- | --- | --- | --- |
| **Production** | `main` | `https://aios.co.il` | merge to `main` |
| **Staging (persistent dev)** | `develop` | `https://staging.aios.co.il` (alias: `after-lead-git-develop-aios-crm.vercel.app`) | merge to `develop` |
| **Feature Preview** | `feature/*`, `cursor/*`, etc. | `https://after-lead-git-{branch}-aios-crm.vercel.app` | push to that branch only |

### Staging domain

Use `https://after-lead-git-develop-aios-crm.vercel.app` as the stable Staging deployment alias. The intended custom domain is `https://staging.aios.co.il`; verify its Vercel branch assignment and Cloudflare DNS before declaring it available. A configured URL in documentation is not a DNS/HTTP health check.

**Important:** A feature-branch Preview does **not** update when you merge elsewhere. After merge to `develop`, use **Staging** — not an old branch URL.

`after-lead-aios-crm.vercel.app` is a **Production** alias, not Staging.

The in-app amber frame (subtle yellow border glow) marks Staging/Preview — no header space taken.

## Flow (staging-first)

```
feature/* or fix/*
    → Vercel Preview (optional — quick check on this branch)
    → merge to develop
    → Staging (after-lead-git-develop / staging.aios.co.il) — verify full picture
    → מאשר לפרודקשן
    → merge develop → main
    → Production (aios.co.il)
```

**`develop` is the release candidate.** `main` only moves after Staging is verified.

**Branch freshness (required):** every PR must contain the latest tip of its base (`develop` or `main`) before merge. CI workflow `Require PR up to date with base` fails stale heads — enable it as a required status check in GitHub branch protection. Cloud Agents must `git fetch origin <base>` and merge/rebase before opening or updating a PR.

**Staging stays current:** on every push to `main`, workflow `Sync develop from main` merges `main` → `develop` so `https://staging.aios.co.il` never lags Production hotfixes. Manual `workflow_dispatch` remains available.

| Git | Deploy | Data |
| --- | --- | --- |
| local | `pnpm dev` | Cloud Agent `.env` still talks to Production — do not write test data |
| `feature/*` | Vercel Preview | AIOS Staging (every Preview deploy) |
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
- `deploy-staging-edge-functions.yml` deploys functions on **`develop` push** only

## Code, data and deployment synchronization

- Code: feature → reviewed Preview → `develop` → verify → approved `main` release. Main hotfixes automatically merge back into develop. Conflicts fail visibly; no force-push or “ours/theirs” overwrite is used.
- A bot push does not trigger GitHub push workflows. `sync-develop-from-main.yml` therefore explicitly calls Staging Edge deployment and frontend CI at the resulting SHA.
- Edge deployment uses the last **successfully deployed** environment tag as its base. Shared module/config changes redeploy complete bundles. Both environments pin the same Supabase CLI. A superseded SHA cannot deploy over the current environment head.
- Vercel builds each environment from source with its own variables. Never promote a Preview build containing Staging URLs to Production.
- Data: `scripts/staging-data-manifest.json` lists the mirrored business tables, including clients, report definitions/records, SEO, WooCommerce, analytics and permissions. The scheduled workflow targets a five-minute cadence after this workflow is released on the default branch; GitHub scheduling is best-effort, not real-time replication.
- Every source request uses the Supabase **read-only** query endpoint. Fingerprints detect changes even if `updated_at` was not maintained. Only changed rows are transferred. Parent rows load before children. Deletion mirroring requires explicit approval and a manual `--apply-deletes` run; scheduled runs only insert/update. Import transactions restore the prior USER-trigger state and keep FK checks enabled.
- Staging-only test rows are retained. Existing Staging schema, RLS policies, function bodies, operational queues, credentials and environment/agent connections are not replaced by a data refresh. New user IDs are provisioned for data/RLS relations without cloning passwords or sessions; existing Staging logins remain unchanged. A new identity that matches an old Staging invitation fails reconciliation rather than activating the invitation's permissions. New integration parent rows are inactive placeholders until configured in Staging.
- Structural differences fail preflight instead of replaying Production's migration history over Staging. The additive reconciliation SQL adds the observed missing report columns only.
- `environment_sync.table_state` contains the last successful sync per table. A red workflow is an incomplete sync and must not be described as up to date. Previously cloned rows that were already deleted from Production before the first managed sync need explicit baseline reconciliation; they are not silently deleted as presumed test data.

## Staging outbound containment

- The Staging deployer installs a guard **before** each function entrypoint loads. Copied `APP_ENV` values cannot turn it off. Production code executes without this wrapper.
- The guard blocks external messages, publishing, arbitrary webhooks and calls into another Supabase project. Explicit read-only analytics endpoints and the approved AI/agent endpoints stay available.
- Database HTTP requests are blocked at `net.http_request_queue`. Once all live Edge bundles are downloaded and verified, requests to this Staging project's guarded functions are permitted so internal processing can work.
- `verify-staging-containment.py` checks every live entrypoint and its reviewed source before setting `environment_sync.safety.outbound_blocked=true`. Each sync compares the current function versions with the verified versions; a changed deployment closes the gate. Deployments also close the gate before changing code, and import transactions recheck it before writing.
- A complete source attestation can be reused only when all function files and all live function IDs/versions remain identical. The database HTTP guard is still checked. Credential synchronization compares the allowlisted secret digests and avoids rewriting equal values, since a secret write increments every live function version.
- The first full data sync requires a successful complete Staging deployment and containment verification. A green frontend Preview or passing local tests alone does not establish that business data is synchronized. Check the deployment, mirror workflow, and per-table timestamps before describing Staging as current.
- Keep production WhatsApp/Meta credentials out of Staging. Platform authentication email settings are separate from automation delivery; automated Auth invite/recovery calls from Edge are also blocked.

### Google login on Preview / Staging

Two gates — both must pass:

1. **Vercel SSO** — opening a `*.vercel.app` Preview URL redirects to Vercel login first. Sign in with the team Vercel account, then you reach `/auth`.
2. **Google OAuth** — the app talks to **AIOS Staging** Supabase (not Production). In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → the AIOS OAuth client → **Authorized redirect URIs**, add the Staging callback exactly as shown in **Supabase → AIOS Staging → Authentication → Providers → Google** (format: `https://<SUPABASE_STAGING_PROJECT_ID>.supabase.co/auth/v1/callback`). Keep the Production callback too — add, do not replace.

Supabase Staging already allows `https://*.vercel.app/**` as redirect URLs. Google does **not** accept `*.vercel.app` wildcards — only the Supabase callback URI above.

**Workaround:** email + password on Staging works if Google is not configured yet.

Branch protection on `main` / `develop` is a GitHub settings change; the freshness and shared-agency guards must be required. Local checkouts still need Staging variables before running the frontend.

## Agent working rules

1. Branch from `develop`. Hotfixes David asked for on Production may branch from `main`.
2. Implement on the feature branch. Never commit to `main` directly.
3. Open a PR **to `develop`**. Send the Vercel Preview URL and in-app path.
4. After merge to `develop`, verify on Staging (`after-lead-git-develop` or `staging.aios.co.il`).
5. Merge **`develop` → `main`** only after `מאשר לפרודקשן` (Production deploy + `deploy-edge-function.yml`).
6. Main pushes automatically run `sync-develop-from-main`. A release PR must contain the current main revision and the exact Staging changes approved for release; review its file diff before merge.

## Development agents (Preview / Staging)

Vercel Preview is the development environment. It talks to **AIOS Staging**, never Production. Do not “fix” Preview by pointing it at Production.

| Seat | Works on Preview today? | Why |
| --- | --- | --- |
| Carmen (internal / `run-ai-agent`) | Yes | Staging has the tenant, agent, and OpenAI path |
| Cursor / Grok / Codex Cloud seats | Only if Staging `CURSOR_API_KEY` is a **valid Cursor User key** | All three launch via `api.cursor.com` with that secret |
| Knights Round Table | Same as Cloud seats | Parliament fans out to those three |

How we keep them working:

1. **The database is not the Edge secret store.** A Staging DB clone brings `tenant_integrations` (OpenAI / Carmen). It does **not** bring Edge Function secrets. The Management API only returns SHA-256 hashes, so values cannot be read back from the dashboard/API.
2. **Copy from Production, do not re-type.** The gated function `copy-edge-secrets-to-staging` runs on Production, reads allowlisted agent secrets from `Deno.env`, and writes them to Staging. WhatsApp / Meta / project keys stay out. David is not asked to paste keys.
3. **Health probe.** Command Center calls `agent-channel-send` `action=channel_health`. If the key is rejected, the HUD shows a banner. After a copy, hashes of the allowlist should match Production; no function redeploy is required.
4. **After a copy:** from Preview → Command Center, send a one-word ping on Cursor Direct or the table. Expect `agent_channel_sessions.external_url` and no 401.

Local `pnpm dev` in this Cloud Agent workspace still reads Production `.env`. That is not the development environment — use the Vercel Preview URL.

## Report loading

Lazy snapshot renderers keep full report/export code out of the client-card entry path. Rollup derives shared chunks from imports to avoid chart/export entry cycles. Table and combined reports share per-table/date query entries; explicit refresh invalidates those entries and failed requests are not cached as empty successful reports. Empty permission-related lists revalidate on mount, and shared-agency access still uses `fetchAccessibleDashboards`.

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
- Staging frame is hidden in Production.
- Creating GitHub `develop` does not change `main`.
