

## Plan: Per-User Google Connections with Sharing

### Current State
- Google Analytics/GSC/Google Ads connections are stored in `tenant_integrations` with `tenant_id` scoping — any user in the tenant sees all connections
- The table already has `user_id` and `shared_from_integration_id` columns
- `integration_user_permissions` table and `ManageIntegrationPermissionsDialog` already exist for permission sharing
- The edge function `google-analytics-auth` already stores `userId` in the state and saves it to `tenant_integrations.user_id`

### What Changes

**Goal**: Each user connects their own Google account. They see only their own connections + connections shared with them. They can share their connection with other team members.

### Technical Details

#### 1. Frontend — GoogleAnalyticsSettings.tsx
- Change the integration query to filter by current user OR shared permissions:
  - Fetch integrations where `user_id = currentUserId` (own connections)
  - Also fetch integrations where the user has a record in `integration_user_permissions`
- Add a "Share" button next to each connected account that opens `ManageIntegrationPermissionsDialog`
- Show shared connections with a badge indicating who shared them

#### 2. Frontend — GoogleAnalyticsTableDialog.tsx
- Update the GA integration query (line 43-61) to show user's own connections + shared ones
- Add a selector if the user has multiple connections (own + shared) to pick which account to use

#### 3. Frontend — SeoReportTabs.tsx / GscIntegration.tsx
- Same pattern: filter integrations by user ownership or shared permissions

#### 4. Frontend — Integrations.tsx
- Update the integration status queries to check per-user connections (own + shared)

#### 5. Edge Function — google-analytics-auth
- No changes needed — already stores `user_id`

#### 6. Edge Functions — sync functions (sync-google-analytics-data, sync-gsc-data, etc.)
- When syncing, resolve the integration by `integrationId` (already works — no tenant-wide assumption)

#### 7. Database — No schema changes needed
- `tenant_integrations.user_id` already exists
- `integration_user_permissions` already exists
- `shared_from_integration_id` already exists

### Files to Edit (~6 files)
1. `src/pages/GoogleAnalyticsSettings.tsx` — Per-user filtering + share button
2. `src/components/dynamic-tables/GoogleAnalyticsTableDialog.tsx` — Show user's accessible integrations
3. `src/components/dynamic-tables/seo/GscIntegration.tsx` — Per-user GSC filtering
4. `src/pages/Integrations.tsx` — Per-user connection status display
5. `src/pages/GoogleSearchConsoleSettings.tsx` — Per-user filtering + share button (if exists)
6. Same pattern for Google Ads settings if applicable

### User Experience
- User goes to GA settings → sees only their own connected accounts
- Clicks "Share" → opens the existing permissions dialog to grant access to teammates
- When creating a GA table, user sees their own connections + connections shared with them
- Shared connections show a badge: "שותף על ידי [שם]"

