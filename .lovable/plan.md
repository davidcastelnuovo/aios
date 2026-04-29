## Goal

In the Dynamic Tables page (`/dynamic-tables`), when the user enters a category (Analytics, Facebook Ecommerce, Facebook Insights, Google Ads, SEO), show at the top of that category:

1. **Last sync timestamp** – the most recent `integration_settings.last_sync_at` across all tables in the category (formatted in Hebrew, relative + absolute).
2. **Manual "Sync all now" button** – triggers a sync for every table in the current category, shows progress, and refreshes the timestamps when done.

This does not change the existing automatic daily cron schedules – it only adds a visible status + manual override.

## Where

File: `src/pages/DynamicTables.tsx`, inside the category header block (lines ~694–745, right next to the "חזרה לקטגוריות" button / category title).

A small new component `CategorySyncControl.tsx` under `src/components/dynamic-tables/` will encapsulate the logic so the page stays readable.

## Mapping: category → sync function

Use `integration_type` of each table to decide which edge function to invoke per-table. The existing per-table sync functions are already deployed:

| Category (display) | integration_type values | Edge function to call per table |
|---|---|---|
| Analytics | `google_analytics` | `sync-google-analytics-data` |
| Facebook Ecommerce | `facebook_ecommerce` | `sync-facebook-ecommerce` |
| Facebook Insights | `facebook_insights` | `sync-facebook-insights` (and `sync-facebook-leads` where relevant – will reuse current single-table sync path already used by existing "sync" buttons) |
| Google Ads | `google_ads` | `sync-google-ads-data` |
| SEO | `google_search_console`, `ahrefs` | `sync-google-search-console-data` / `sync-ahrefs-data` based on each table's type |

The manual button iterates over `groupedTables[selectedCategory]` and calls the right function for each table in parallel (with a small concurrency cap of 3 to avoid timeouts).

## UI behavior

Header row gets an extra right-aligned cluster:

```text
[← חזרה לקטגוריות]  [📊 Analytics (25)]         ... quick switcher ...   סנכרון אחרון: לפני 3 שעות  [🔄 סנכרן עכשיו]
```

- **Last sync label**: computed as `max(table.integration_settings?.last_sync_at)` across tables in the category. Shown as `סנכרון אחרון: {formatDistanceToNow}` with a tooltip showing the exact date/time. If none, show `לא סונכרן עדיין`.
- **Manual sync button**:
  - Disabled while running; shows spinner + `מסנכרן… (x/y)` counter.
  - On completion: toast with `סונכרנו N דוחות בהצלחה` (and count of failures if any).
  - Invalidates the `crm_tables` query so `last_sync_at` refreshes in the cards.

## Technical details

1. **New component** `src/components/dynamic-tables/CategorySyncControl.tsx`:
   - Props: `{ category: string; tables: CRMTable[] }`.
   - Computes latest `last_sync_at` via `useMemo`.
   - `handleSyncAll`:
     ```ts
     const fn = (t) => {
       switch (t.integration_type) {
         case 'google_analytics': return 'sync-google-analytics-data';
         case 'facebook_ecommerce': return 'sync-facebook-ecommerce';
         case 'facebook_insights': return 'sync-facebook-insights';
         case 'google_ads': return 'sync-google-ads-data';
         case 'google_search_console': return 'sync-google-search-console-data';
         case 'ahrefs': return 'sync-ahrefs-data';
         default: return null;
       }
     };
     ```
   - Calls `supabase.functions.invoke(fn, { body: { tableId: t.id } })` (param name already used by each function – will double-check each one matches its expected body key: some use `tableId`, some `table_id`; the component will send both for safety, matching the patterns already used elsewhere in the codebase).
   - Concurrency limited with a simple 3-slot pool.
   - Uses `date-fns` `formatDistanceToNow` with `locale: he`.

2. **DynamicTables.tsx change**: insert `<CategorySyncControl category={selectedCategory} tables={groupedTables[selectedCategory] || []} />` in the header flex row (around line 722, before the quick switcher, or as a second row on narrow screens with `flex-wrap`).

3. **No DB / cron changes** – automatic daily syncs already run:
   - `daily-ga-sync` (04:00), `daily-google-ads-sync` (04:00)
   - `cron-sync-facebook-ecommerce-daily` (05:00), `sync-facebook-insights-weekly`, `sync-facebook-leads-every-minute`
   - SEO (GSC/Ahrefs) currently do not have a cron job. This plan does **not** add one (per user request: just add manual button + last-sync label). If desired later, we can add a daily SEO cron as a follow-up.

4. **Types**: `integration_settings` is already read as `any` in the page; the new component will type it as `{ last_sync_at?: string } | null`.

## Out of scope

- Changing existing per-table "sync" buttons inside `DynamicTableView`.
- Adding new cron jobs for SEO.
- Any backend migration.
