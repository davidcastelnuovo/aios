

## Plan: Embed Mode for Dynamic Tables in Client Card

### Problem
Currently, tables in the client "Reports" tab are loaded via iframe with `?embed=1`, but `DynamicTableView.tsx` doesn't handle this parameter. The full page renders — including header, back button, sync controls, settings dialogs, alerts, and column management — creating a cluttered experience inside the client card.

### Solution
Add `embed` query parameter support to `DynamicTableView.tsx` that strips away everything except the core data table/dashboard content.

### Technical Details

**File: `src/pages/DynamicTableView.tsx`**
1. Read `embed` from `useSearchParams` at the top of the component
2. When `embed=1`:
   - Hide the title row (h1, badges, description)
   - Hide the controls row (back button, sync buttons, settings, dropdown menu)
   - Hide alerts (scenario clone, no-data warnings)
   - Hide the "add column" and "delete row" UI elements
   - Hide all settings/delete dialogs
   - Keep only: date filter (compact), campaign search, the data table itself, and integration dashboards (GA, GSC, SEO, Facebook summary)
   - Remove container padding (`py-8 px-4` → `py-2 px-2`)

This is a single-file change. The iframe in `ClientTablesTab.tsx` already passes `?embed=1` so no other changes needed.

