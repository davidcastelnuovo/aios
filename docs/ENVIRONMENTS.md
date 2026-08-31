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
| **Staging (persistent dev)** | `develop` | `https://staging.aios.co.il` (alias: `after-lead-git-develop-aios-crm.vercel.app`) | push to `develop` + auto-sync from `main` |

### `staging.aios.co.il` DNS (one-time, Cloudflare)

`aios.co.il` nameservers are **Cloudflare** (`elsa` / `todd`), not Vercel — so Vercel cannot create the subdomain record automatically. Until this exists, `staging.aios.co.il` returns `NXDOMAIN`.

In **Cloudflare → aios.co.il → DNS**, add:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `staging` | `90c25ae61a2299f0.vercel-dns-017.com` | DNS only (grey cloud) |

Vercel project domain is already assigned (`gitBranch: develop`, verified). After the CNAME propagates (usually minutes), `https://staging.aios.co.il` goes live.

**Until then**, use: `https://after-lead-git-develop-aios-crm.vercel.app`
| **Feature Preview** | `feature/*`, `cursor/*`, etc. | `https://after-lead-git-{branch}-aios-crm.vercel.app` | **only** when that branch is pushed |

**Important:** A feature-branch Preview does **not** update when you merge to `main`. After merge, use **Staging** (`staging.aios.co.il`) or Production — not an old branch URL.

`after-lead-aios-crm.vercel.app` is a **Production** alias, not Staging.

The in-app amber frame (subtle yellow border glow) marks Staging/Preview — no header space taken.

## Flow

```
feature/* or fix/*
    → Vercel Preview (this branch, Staging data)
    → explicit approval
    → merge to main
    → Production
    → auto-sync develop  (sync-develop-from-main.yml)
    → persistent Staging stays on the same code
```

A merge to `main` also updates `develop`. That keeps the development environment current (frontend on the `develop` Vercel deploy, plus Staging Edge Functions via `deploy-staging-edge-functions.yml`). Do not treat `develop` as a separate release train.

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
- `deploy-staging-edge-functions.yml` deploys functions on `develop` only, using GitHub secret `SUPABASE_STAGING_PROJECT_ID` (never a hardcoded ref)

Gaps (do not touch Production to close these):

1. Staging schema/function sync: Edge Functions deployed; public tables applied from repo migrations. Operational data is cloned onto Staging (users, tenants, Carmen, clients, tasks, live integrations). WhatsApp rows are **mocked connected** (no live tokens; `IntegrationGuard` still blocks send). Huge analytics/graph/chat-history tables are skipped.
2. Add GitHub secret `SUPABASE_STAGING_PROJECT_ID` so the Staging deploy workflow can run.
3. LLM keys live in Staging `tenant_integrations` (`llm`). Do **not** copy Production WhatsApp/Meta tokens.
4. No persistent custom Staging domain yet (`STAGING_DOMAIN=<configured-in-vercel>`). Vercel Authentication is `all_except_custom_domains`, so `*.vercel.app` Preview URLs require a Vercel login. **Resolved:** `https://staging.aios.co.il` → `develop` (custom domain, no SSO gate).

### Google login on Preview / Staging

Two gates — both must pass:

1. **Vercel SSO** — opening a `*.vercel.app` Preview URL redirects to Vercel login first. Sign in with the team Vercel account, then you reach `/auth`.
2. **Google OAuth** — the app talks to **AIOS Staging** Supabase (not Production). In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → the AIOS OAuth client → **Authorized redirect URIs**, add the Staging callback exactly as shown in **Supabase → AIOS Staging → Authentication → Providers → Google** (format: `https://<SUPABASE_STAGING_PROJECT_ID>.supabase.co/auth/v1/callback`). Keep the Production callback too — add, do not replace.

Supabase Staging already allows `https://*.vercel.app/**` as redirect URLs. Google does **not** accept `*.vercel.app` wildcards — only the Supabase callback URI above.

**Workaround:** email + password on Staging works if Google is not configured yet.

5. Email / webhooks / cron / automations are not fully on the guard yet (WhatsApp is).
6. Branch protection on `main` / `develop` is a GitHub settings change.
7. This Cloud Agent workspace `.env` still points at Production.

## Agent working rules

1. Create `feature/*` or `fix/*` from `develop` when Staging work is in flight; from `main` only for hotfixes David asked for.
2. Implement on the feature branch. Never commit to `main`. Never run unbounded `DELETE`/`UPDATE` on Production.
3. Open a PR. **Always reply with the Vercel Preview URL** (the development environment link) and the in-app path.
4. Merge to `main` only after `מאשר לפרודקשן`. `develop` is then updated automatically from `main`.
5. Do not merge to `develop` by hand unless the auto-sync failed.
6. Edge-function or migration work: add files under `supabase/functions` / `supabase/migrations`. Do not apply them to Production from the agent. Staging apply is a later phase.

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
- Staging frame is hidden in Production.
- Creating GitHub `develop` does not change `main`.
