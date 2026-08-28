Canonical environment docs: [`docs/ENVIRONMENTS.md`](./ENVIRONMENTS.md).

Configure **Vercel → Settings → Environment Variables**. Values live only in Vercel (and the Staging project dashboard). They must never be committed or pasted into a public PR.

## Placeholders (not real values)

```
SUPABASE_STAGING_PROJECT_ID=<configured-outside-git>
STAGING_DOMAIN=<configured-in-vercel>
```

Copy Staging keys from **Supabase → AIOS Staging → Project Settings → API**. Do not put those values in git or chat.

## Mapping

| Vercel variable | Source (Staging API settings) |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable / Anon key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Publishable / Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / Service Role key |
| `APP_ENV` | `staging` |
| `STAGING_SAFE_MODE` | `true` |

The frontend client also reads `VITE_SUPABASE_PUBLISHABLE_KEY`. Set that Preview value to the same Staging publishable/anon key, or the Preview build will still talk to the wrong backend.

## Save rules (every variable)

- Add a **new** value. Do not edit or delete existing Production values.
- Target: **Preview only**.
- If Branch is offered, set it to **`develop`**.
- Do not enable Production or Development for these Staging rows.

## Apply via API (optional)

With secrets injected in the environment (never in git):

```
node scripts/set-vercel-preview-staging-env.mjs
```

Required env: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`. Optional: `VERCEL_ORG_ID` / `VERCEL_TEAM_ID`, `SUPABASE_STAGING_PROJECT_ID`, `PREVIEW_GIT_BRANCH` (default `develop`).

The script only **creates or updates Preview + branch** rows. It never patches a row whose targets include Production, and it never deletes variables.

## Public-repo rule

Do not publish: project refs, internal hostnames, account/team names, integration tokens, or any secret. Use the placeholders above.
