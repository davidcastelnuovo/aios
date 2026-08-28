/** Sentinel value for "show all clients" in marketing department filters. */
export const ALL_CLIENTS_FILTER = "__all_clients__";

export type MarketingClientFilter = string | null;

export function parseClientFilter(param: string | null | undefined): MarketingClientFilter {
  if (param === "all" || param == null || param === "") return ALL_CLIENTS_FILTER;
  if (param === "general" || param === "none") return null;
  return param;
}

export function clientFilterToParam(filter: MarketingClientFilter): string | undefined {
  if (filter === ALL_CLIENTS_FILTER) return "all";
  if (!filter) return "general";
  return filter;
}

export function applyClientFilter<T extends { eq: (col: string, val: string) => T; is: (col: string, val: null) => T }>(
  query: T,
  filter: MarketingClientFilter,
  column = "client_id",
): T {
  if (filter === ALL_CLIENTS_FILTER) return query;
  if (filter) return query.eq(column, filter);
  return query.is(column, null);
}

export function clientFilterLabel(filter: MarketingClientFilter): string {
  if (filter === ALL_CLIENTS_FILTER) return "כל הלקוחות";
  if (!filter) return "תוכן כללי";
  return "לקוח";
}

/** Creative always opens on every client so the project list is complete. */
export function entryClientFilter(department: string | undefined, current: MarketingClientFilter): MarketingClientFilter {
  if (department === "creative") return ALL_CLIENTS_FILTER;
  return current;
}

/** Creative has no unassigned-only view — missing filter means every client. */
export function resolveCreativeListFilter(filter: MarketingClientFilter): MarketingClientFilter {
  return filter ?? ALL_CLIENTS_FILTER;
}
