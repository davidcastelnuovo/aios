## What to change

### 1. Proper icons for every report tab (`src/components/clients/ClientTablesTab.tsx`)

Today only `facebook_insights`, `facebook_ecommerce`, `google_ads` get branded icons — Google Analytics, Search Console, Ahrefs, etc. all fall back to a plain spreadsheet icon (this is what you see in the screenshot).

Extend `renderTableIcon` to cover every `integration_type` the project uses, using the same colored SVGs already defined in `SharedTable.tsx` / `SharedDashboard.tsx` / `DashboardView.tsx` for visual consistency:

- `facebook_insights`, `facebook_ecommerce`, `facebook`, `facebook_lead_ads` → Facebook (blue) / ShoppingCart (green for ecommerce)
- `google_ads` → official Google Ads colored SVG
- `google_analytics` → official GA colored SVG (yellow/orange bars)
- `google_search_console` → Google "G" colored SVG
- `ahrefs` → small "A" badge in Ahrefs blue, or a `Search` lucide icon tinted
- `make_api`, `google_ads_via_make` → small Make/lightning icon
- `maskyoo` → `Phone` icon
- default → `FileSpreadsheet`

Implementation detail: extract the same `getIntegrationIcon` helper that already lives in `SharedTable.tsx` into a small shared file (e.g. `src/lib/integrationIcons.tsx`) and reuse it in `ClientTablesTab.tsx` instead of maintaining two divergent copies. `SharedTable.tsx`, `SharedDashboard.tsx`, and `DashboardView.tsx` can be switched to the shared helper as a follow-up but are not required for this change.

### 2. Fix the "Analytics throws an error" warning

The console shows:
```
Warning: Encountered two children with the same key, `9c3e4680-…`
  at DynamicTableView
```
This appears on the current GA route (`/table/ga----…`). It is the React duplicate-key warning that fires when `filteredRecords` returned for a GA table contains rows with the same `crm_records.id` (GA syncs can produce multiple report rows that share an id when joined client-side — e.g. `monthly_channel` + `daily_source`).

Fix in `src/pages/DynamicTableView.tsx`:
- Change the rows render at line 3100 from `key={record.id}` to `key={\`${record.id}-${index}\`}` (and pass the index from the `.map`), so even if two records share an id React still gets unique keys.
- Same defensive fix at line 3013 for `fields?.map` if duplicate field ids ever appear.
- No behavioral change; this only silences the warning and prevents the row-omission bug React warns about.

If after this fix the GA table still shows a *visible* error (not just the console warning), we'll need a screenshot of the actual error message — but based on the console output the "error" the user is seeing is this React warning, which the key fix resolves.

## Files touched

- `src/components/clients/ClientTablesTab.tsx` — use shared icon helper
- `src/lib/integrationIcons.tsx` — new shared helper (extracted)
- `src/pages/DynamicTableView.tsx` — unique keys for rows/fields

No backend, schema, or business-logic changes.
