# AIOS Landing Studio (Vercel)

One Vercel project serves every published landing page from **מחלקת עיצוב ובניית אתרים**.

## Setup

1. Create a Vercel project with **Root Directory** = `apps/landing-studio`.
2. Set environment variable `SUPABASE_URL` to the Staging (then Production) Supabase project URL.
3. Set Supabase edge secret `WEB_DESIGN_PUBLIC_BASE_URL` to the Vercel production URL (e.g. `https://aios-landing-studio.vercel.app`).

## URLs

`https://<landing-studio-domain>/{tenant_slug}/{project_slug}/`

Preview (before publish): append `?preview_token=<token>` from the project row in CRM (shown in the department UI).
