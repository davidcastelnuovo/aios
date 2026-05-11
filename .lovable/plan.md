## Problem

The "סנכרן עכשיו (34)" button on the SEO category in Dynamic Tables (`CategorySyncControl`) does **not** actually fetch fresh data from Ahrefs. For SEO reports (tables of type `ahrefs` with `data_source = "ahrefs_reports"`) it only re-reads what's already in the `ahrefs_reports` table and rebuilds `crm_records`. That's why a sync done earlier this month did not refresh the per-domain Ahrefs data — only 24karat (which was synced manually today via `fetch-ahrefs-snapshot`) ended up updated.

The same is true of the per-card "סנכרן Ahrefs" button in `DynamicTableView` for `data_source = "ahrefs_reports"`.

The function that actually pulls fresh Ahrefs data and persists it through `ahrefs-webhook` already exists: `fetch-ahrefs-snapshot` (takes `{ clientId, domain, country }`).

## Fix

Make the bulk SEO sync (and per-card sync) actually call Ahrefs for each table, then rebuild `crm_records` from the freshly stored `ahrefs_reports`.

### 1. `src/components/dynamic-tables/CategorySyncControl.tsx`

In `syncStoredAhrefsReportTable(t)`, before reading `ahrefs_reports`:

- Resolve `clientId` and `domain` from `t.integration_settings` (`targetDomain || target || domain`, falling back to the client's website if missing — same logic `fetch-ahrefs-snapshot` already supports server-side, so passing only `clientId` is acceptable when domain is unknown).
- `await supabase.functions.invoke('fetch-ahrefs-snapshot', { body: { clientId, domain, country: settings.country || 'il' } })`.
- If the call fails, surface the error so the table is counted as failed (don't silently fall back to stale rebuild). Concurrency is already capped at 3 so this won't hammer the API too hard, but we should drop concurrency to **2** for SEO to stay polite to Ahrefs.
- After success, continue with the existing logic that pulls `ahrefs_reports` and rewrites `crm_records`.

Also: invalidate `['ahrefs-reports']` and `['seo-dashboard-reports']` query keys at the end of `handleSyncAll` so the SEO dashboards refresh.

### 2. `src/pages/DynamicTableView.tsx` — `syncAhrefsMutation`

In the `if (settings.data_source === 'ahrefs_reports')` branch (around line 1011), before the `from('ahrefs_reports').select(...)` call:

- Fetch a fresh snapshot via `fetch-ahrefs-snapshot` with `{ clientId, domain: settings.targetDomain || settings.target || settings.domain, country: settings.country || 'il' }`.
- If it errors, throw — the toast will report it. (Behavior parity with bulk.)
- Then proceed with the existing rebuild from `ahrefs_reports`.

This way both the per-card button and the bulk button do the same thing: fresh API fetch → rebuild crm_records.

### 3. UX touch

Update the bulk button label while running for SEO from `מסנכרן… (done/total)` to `מסנכרן Ahrefs… (done/total)` so the user understands it now hits the API (slower than before).

### Out of scope

- No DB / RLS changes.
- No changes to `ahrefs-webhook` or `fetch-ahrefs-snapshot`.
- Other categories (Facebook, Google Ads, GA, GSC) keep current behavior.

## Verification

1. Open `/t/marketingcaptain/dynamic-tables`, switch to the SEO category, click `סנכרן עכשיו (34)`.
2. Watch the progress counter increment to 34/34.
3. Query `ahrefs_reports` for a sample of domains (e.g. `imaga.co.il`, `tavnicol.co.il`) and confirm a row with `received_at = today` exists.
4. Open one of those clients' SEO dashboard and confirm the new report is auto-selected (latest `received_at`).
