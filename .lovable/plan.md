## Change

In `src/pages/GoogleAnalyticsSettings.tsx`:

1. Default the active tab to `"direct"` instead of `"make"` (line 25: `useState("direct")`).
2. Move the "מומלץ" badge from the Make.com trigger to the API ישיר trigger.
3. Reorder the `TabsList` so **API ישיר** is the primary/first tab and **Make.com** is the secondary one — under RTL this puts API on the right (the visually-default position the user expects).
4. Update the help line currently at line 441 ("מומלץ לנסות את אפשרות Make.com") to drop the "recommended" framing — phrase Make.com as a fallback only.

No logic, queries, or backend changes — pure UI/default-state tweak. Scope limited to GA settings (not Google Ads) per the request.
