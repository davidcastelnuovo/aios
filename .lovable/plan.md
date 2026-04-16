

## Plan: Supplement Ahrefs Keywords with GSC-only Keywords

### Problem
The SEO keywords table only shows keywords from Ahrefs. GSC often indexes additional keywords that Ahrefs doesn't track. These GSC-only keywords are fetched but silently discarded because they don't match any Ahrefs keyword.

### Solution
After merging Ahrefs keywords, add any remaining GSC keywords that don't already exist in the Ahrefs data. These will appear with GSC metrics (clicks, impressions, CTR, position) and empty Ahrefs-specific fields (traffic, volume, KD, CPC).

### Technical Details

**File: `src/components/dynamic-tables/SeoDashboardView.tsx`**
1. After building `organicKeywords` and `trackedKeywords`, create a set of all Ahrefs keyword names (lowercased)
2. Loop through `gscData` — for each keyword NOT in the Ahrefs set, create a new keyword object with:
   - `keyword`, `position` (from GSC), `gsc_clicks`, `gsc_impressions`, `gsc_ctr`, `gsc_position`
   - `traffic`, `volume`, `kd`, `cpc`, `url` = null (no Ahrefs data)
   - Mark with a flag like `_source: 'gsc'` for potential UI differentiation
3. Pass these GSC-only keywords as additional entries — either append to `organicKeywords` or pass as a new prop

**File: `src/components/dynamic-tables/seo/SeoKeywordsTable.tsx`**
- The table already handles null values gracefully (shows "—"), so GSC-only rows will display correctly
- Optionally add a small badge/indicator for GSC-only keywords to differentiate them from Ahrefs keywords

### Impact
- No database changes needed
- No edge function changes needed
- GSC data is already being fetched — this just uses the data that's currently being discarded

