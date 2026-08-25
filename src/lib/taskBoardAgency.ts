export type AgencyScopedTask = {
  agency_id?: string | null;
  client_id?: string | null;
  clients?: { agency_id?: string | null } | null;
};

/**
 * The agency a task really belongs to.
 *
 * `tasks.agency_id` is only a stamp taken at creation time, and historically it
 * was taken from the creator's default agency rather than the client's. When a
 * task is linked to a client, the client's agency is the source of truth — the
 * same rule the Carmen notification router already uses for outbound routing.
 */
export function resolveTaskEffectiveAgency(task: AgencyScopedTask): string | null {
  const clientAgencyId = task.clients?.agency_id;
  if (task.client_id && clientAgencyId) return clientAgencyId;
  return task.agency_id ?? null;
}

/**
 * Agency stamp for a task being created or re-linked. A task that belongs to a
 * client must carry that client's agency, whatever the header filter says;
 * otherwise it falls back to the selected agency, then the tenant's first one.
 */
export function resolveNewTaskAgency(input: {
  clientAgencyId?: string | null;
  selectedAgency?: string | null;
  fallbackAgencyId?: string | null;
}): string | null {
  const { clientAgencyId, selectedAgency, fallbackAgencyId } = input;
  if (clientAgencyId) return clientAgencyId;
  if (selectedAgency && selectedAgency !== "all") return selectedAgency;
  return fallbackAgencyId ?? null;
}

/**
 * Agency for tasks created from the weekly board / calendar overlay when no
 * client is involved (quick add, calendar slot, backlog line).
 */
export function resolveBoardTaskAgency(
  selectedAgency: string | null | undefined,
  fallbackAgencyId: string | null | undefined,
): string | null {
  return resolveNewTaskAgency({ selectedAgency, fallbackAgencyId });
}

/**
 * Client-side guard: when the header picks a specific agency, only tasks whose
 * effective agency matches may render. "all" (or empty) leaves the list alone.
 */
export function filterTasksBySelectedAgency<T extends AgencyScopedTask>(
  tasks: T[],
  selectedAgency: string | null | undefined,
): T[] {
  if (!selectedAgency || selectedAgency === "all") return tasks;
  return tasks.filter((task) => resolveTaskEffectiveAgency(task) === selectedAgency);
}

/**
 * Header agency (same control as Clients) only narrows the team board.
 * A person view — "שלי בלבד", a specific campaigner, or unassigned — spans
 * every accessible agency. Clients filters by `client.agency_id`; applying
 * that same header here hid assigned tasks whose client lives on another agency.
 */
export function headerAgencyAppliesToBoard(campaignerFilter: string): boolean {
  return campaignerFilter === "all";
}

export function filterTasksForBoardView<T extends AgencyScopedTask>(
  tasks: T[],
  selectedAgency: string | null | undefined,
  campaignerFilter: string,
): T[] {
  if (!headerAgencyAppliesToBoard(campaignerFilter)) return tasks;
  return filterTasksBySelectedAgency(tasks, selectedAgency);
}

/**
 * Tenant scope for the board query.
 *
 * The header agency is deliberately NOT pushed into the query: a task can be
 * stamped with one agency while its client belongs to another, so filtering
 * server-side on `agency_id` both leaks foreign tasks and hides tasks that
 * really belong to the selected agency. The effective-agency filter above does
 * the narrowing on rows the tenant may already read.
 */
export type TasksBoardScope =
  | { type: "tenant_or_shared"; tenantId: string; crossTenantAgencyIds: string[] }
  | { type: "tenant"; tenantId: string };

export function resolveTasksBoardScope(input: {
  tenantId: string;
  crossTenantAgencyIds?: string[];
  accessibleAgencyIds?: string[];
}): TasksBoardScope {
  const { tenantId, crossTenantAgencyIds = [], accessibleAgencyIds = [] } = input;
  const agencyIds = Array.from(new Set([...crossTenantAgencyIds, ...accessibleAgencyIds]));
  if (agencyIds.length > 0) {
    return { type: "tenant_or_shared", tenantId, crossTenantAgencyIds: agencyIds };
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
  campaignerFilter?: string;
}): T[] {
  const { isFetching, fetchedTasks, previousLocal, selectedAgency, campaignerFilter = "all" } = input;
  if (isFetching) {
    return filterTasksForBoardView(previousLocal, selectedAgency, campaignerFilter);
  }
  return filterTasksForBoardView(fetchedTasks ?? [], selectedAgency, campaignerFilter);
}
