## Problem

In the Leads "chat" view, changing the pipeline stage or response status from the toolbar Selects has no visible effect. The data also feels disconnected between chat / kanban / table views.

## Root Cause

In `src/pages/Leads.tsx`:

1. The actual React Query key for kanban data (line 860) includes `isViewingAs` and `viewAsSalesPersonId` at the end:
   ```
   ["leads-kanban", tenantId, selectedAgency, searchQuery, filterSalesPersonIds,
    filterResponseStatus, filterTagIds, filterFollowUpToday, startDate?.toISOString(),
    endDate?.toISOString(), PIPELINE_STAGES.map(s => s.id).join(','),
    isViewingAs, viewAsSalesPersonId]
   ```

2. But the optimistic-update key inside `updateLeadStatus.onMutate` (line 1407) is **missing the last two segments**, so `queryClient.setQueryData(kanbanQueryKey, ...)` writes to a key that doesn't exist. The chat view, which reads from `kanbanStageData → leads → secureFilteredLeads → filteredLeads → selectedLead`, never sees the change.

3. `updateLeadResponseStatus` doesn't touch React Query cache at all — only local `accumulatedLeads`/`stageLeadsData` state, which the chat view doesn't consume. And neither mutation calls `invalidateQueries` on success, so no refetch ever happens for the chat view.

4. `LeadsChatView` reads `selectedLead` from the `leads` prop. Because the cache never updates, the Select keeps showing the old value and the toolbar appears unresponsive.

## Fix

Single file: `src/pages/Leads.tsx`.

### 1. `updateLeadStatus` mutation
- Update `kanbanQueryKey` inside `onMutate` to match the real query key exactly (append `isViewingAs`, `viewAsSalesPersonId`). Same for `tableQueryKey` (the table query key on line 1014 also includes these two).
- Add an `onSettled` that invalidates `["leads-kanban"]`, `["leads-table"]`, and `["leads-count"]` so every view (kanban, table, chat) ends up consistent with the DB.

### 2. `updateLeadResponseStatus` mutation
- Mirror the same approach: do an optimistic `setQueryData` against the correct kanban + table keys (include `isViewingAs`, `viewAsSalesPersonId`), so the chat view's `selectedLead.response_status` flips instantly.
- Add `onSettled` invalidation for the same three query keys.
- Keep existing automation trigger logic untouched.

### 3. Confirm there is one shared dialog
`LeadsChatView` already renders a single `EditLeadDialog` instance gated by `editingLead`/`editDialogOpen`, opened from the Pencil button and from the Proposals / Files / Meeting tabs via `initialTab`. No additional dialog instances exist, so once the cache fix above lands, all entry points (toolbar Selects, tab triggers, edit dialog) will read and write the same lead and stay in sync across kanban, table and chat views.

## Out of Scope

No schema changes, no new components, no UI restyle. Only the two mutations in `Leads.tsx` are touched.
