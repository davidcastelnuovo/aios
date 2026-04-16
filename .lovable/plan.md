

## Plan: Add "Create GA Table" button in SEO Report Analytics tab

### Problem
When viewing an SEO report's Analytics tab, the GA table selector dropdown doesn't offer a way to create a new GA table. The user needs to navigate away to create one.

### Solution
Add a "+" button next to the GA table selector that opens the existing `GoogleAnalyticsTableDialog`. After creating a table, the list refreshes and the new table can be selected.

### Technical Details

**File: `src/components/dynamic-tables/SeoReportTabs.tsx`**
1. Import `GoogleAnalyticsTableDialog` and `Plus` icon
2. Add state: `const [showGaDialog, setShowGaDialog] = useState(false)`
3. Next to the GA `<Select>`, add a `<Button>` with a `+` icon that opens the dialog
4. Render `<GoogleAnalyticsTableDialog open={showGaDialog} onOpenChange={setShowGaDialog} />` 
5. On dialog close after creation, `queryClient.invalidateQueries(['seo-related-tables'])` will auto-refresh the GA tables list (since `GoogleAnalyticsTableDialog` already invalidates `crm-tables`, we may need to also invalidate `seo-related-tables`)

**File: `src/components/dynamic-tables/GoogleAnalyticsTableDialog.tsx`**
- No changes needed — the dialog already works standalone and invalidates queries on creation.

**Query invalidation note:** The existing dialog invalidates `crm-tables` but `SeoReportTabs` uses `seo-related-tables` query key. We'll add invalidation of `seo-related-tables` in `SeoReportTabs` by watching for dialog close, or extend the dialog to accept an `onSuccess` callback.

