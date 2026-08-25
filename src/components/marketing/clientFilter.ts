/** Sentinel value for "show all clients" in marketing department filters. */
export const ALL_CLIENTS_FILTER = "__all_clients__";

export type MarketingClientFilter = string | null;

export function parseClientFilter(param: string | null | undefined): MarketingClientFilter {
  if (param === "all") return ALL_CLIENTS_FILTER;
  return param ?? null;
}

export function clientFilterToParam(filter: MarketingClientFilter): string | undefined {
  if (filter === ALL_CLIENTS_FILTER) return "all";
  return filter ?? undefined;
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
