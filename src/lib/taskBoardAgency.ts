/**
 * Agency for tasks created from the weekly board / calendar overlay.
 * When the header is filtered to a specific agency, new tasks must land there
 * instead of whichever agency happens to be first in the tenant list.
 */
export function resolveBoardTaskAgency(
  selectedAgency: string | null | undefined,
  fallbackAgencyId: string | null | undefined,
): string | null {
  if (selectedAgency && selectedAgency !== "all") return selectedAgency;
  return fallbackAgencyId ?? null;
}

export type AgencyScopedTask = {
  agency_id?: string | null;
};

/**
 * Client-side guard matching Clients.tsx / Dashboard: when the header picks a
 * specific agency, only rows stamped with that agency_id may render.
 * "all" (or empty) leaves the list untouched.
 */
export function filterTasksBySelectedAgency<T extends AgencyScopedTask>(
  tasks: T[],
  selectedAgency: string | null | undefined,
): T[] {
  if (!selectedAgency || selectedAgency === "all") return tasks;
  return tasks.filter((task) => task.agency_id === selectedAgency);
}

/**
 * How the tasks board should scope the Supabase query for tenant / agency.
 * When a specific agency is selected, filter ONLY by agency_id — do not also
 * apply the broad cross-tenant `or(tenant_id, agency_id.in(...))`, which stacks
 * another PostgREST `or` and left localTasks showing mixed agencies while the
 * narrower fetch was in flight (and could confuse filter composition).
 */
export type TasksBoardScope =
  | { type: "agency"; agencyId: string }
  | { type: "tenant_or_shared"; tenantId: string; crossTenantAgencyIds: string[] }
  | { type: "tenant"; tenantId: string };

export function resolveTasksBoardScope(input: {
  tenantId: string;
  selectedAgency: string | null | undefined;
  crossTenantAgencyIds?: string[];
}): TasksBoardScope {
  const { tenantId, selectedAgency, crossTenantAgencyIds = [] } = input;
  if (selectedAgency && selectedAgency !== "all") {
    return { type: "agency", agencyId: selectedAgency };
  }
  if (crossTenantAgencyIds.length > 0) {
    return {
      type: "tenant_or_shared",
      tenantId,
      crossTenantAgencyIds,
    };
  }
  return { type: "tenant", tenantId };
}

/**
 * Sync helper for localTasks: while a refetch is in flight we keep the previous
 * list to avoid an empty flash — but we MUST still narrow by selectedAgency so
 * switching the header filter cannot keep other agencies' tasks on screen.
 */
export function syncLocalTasksForAgencyFilter<T extends AgencyScopedTask>(input: {
  isFetching: boolean;
  fetchedTasks: T[] | undefined | null;
  previousLocal: T[];
  selectedAgency: string | null | undefined;
}): T[] {
  const { isFetching, fetchedTasks, previousLocal, selectedAgency } = input;
  if (isFetching) {
    return filterTasksBySelectedAgency(previousLocal, selectedAgency);
  }
  return filterTasksBySelectedAgency(fetchedTasks ?? [], selectedAgency);
}
