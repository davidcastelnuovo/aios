

## Plan: Inline Report Panel in Client Card Reports Tab

### What the user wants
Replace the iframe-based table views in the client card "Reports" tab with an inline report panel that:
1. Auto-syncs data when entering the tab and captures a screenshot of summary tables
2. Shows cached/old screenshot while new data loads (with loading indicator)
3. Includes the same SendReportDialog functionality (WhatsApp group, email, phone, message text, share link) — but embedded inline, not as a modal
4. Fits within the client card's available space

### Technical approach

**1. New component: `src/components/clients/ClientReportPanel.tsx`**
- For each linked table, renders an inline panel (not a dialog) with:
  - Screenshot preview area (cached image with loading overlay while refreshing)
  - Send controls: WhatsApp group selector (pre-filled from client's `whatsapp_group_id`), phone input, email input, message textarea, share link indicator
  - Send button using existing `send-green-api-file` edge function
- On mount/table change: triggers a sync of the table data (calls the appropriate sync edge function based on `integration_type`), then captures a screenshot via the embed iframe approach or by loading the table view in a hidden container and using `html-to-image`

**2. Screenshot capture approach**
- Use a hidden iframe loading `?embed=1` for each table
- Once the iframe loads, use `html-to-image` (`toPng`) to capture it
- Store the captured blob per table in state
- Cache the last screenshot blob (or data URL) in `localStorage` keyed by table ID so old images show immediately on re-entry
- While capturing, show the cached image with a spinning loader overlay

**3. Update `ClientTablesTab.tsx`**
- Replace the iframe-based collapsible rendering with the new `ClientReportPanel` for each table
- Keep the link/unlink management section as-is
- Pass `clientId`, `tenantId`, client data to each panel

**4. Auto-sync on tab entry**
- When `ClientReportPanel` mounts, fire the sync edge function for the table's integration type (facebook_insights → `sync-facebook-insights`, google_ads → `sync-google-ads-data`)
- After sync completes, reload the iframe and re-capture the screenshot
- Show a loading state during this process

### Files to change
- **New**: `src/components/clients/ClientReportPanel.tsx` — inline report panel with screenshot + send controls
- **Edit**: `src/components/clients/ClientTablesTab.tsx` — replace iframe rendering with `ClientReportPanel`

### Notes
- Reuses the same WhatsApp/email sending logic from `SendReportDialog`
- The panel is not a modal — it renders inline within the client card's space
- Share link lookup uses the same `table_shares` query pattern

