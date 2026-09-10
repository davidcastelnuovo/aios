import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";

const STORAGE_KEY = "aios-report-query-cache-v3";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PERSISTED_QUERY_ROOTS = new Set([
  "crm-records",
  "crm-tables",
  "crm-fields",
  "crm-records-dashboard",
  "crm-fields-dashboard",
  "crm-tables-for-dashboard",
  "ahrefs-reports",
  // client-crm-tables / all-crm-tables: linking changes often — do not persist (empty lists stuck after fixes).
  "woo-report-attribution",
]);

/** Never persist empty report payloads — permission fixes would stay invisible for days. */
function hasPersistableReportData(data: unknown): boolean {
  if (data === undefined || data === null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") {
    const recordCount = (data as { records?: unknown[] }).records;
    if (Array.isArray(recordCount)) return recordCount.length > 0;
    return Object.keys(data as object).length > 0;
  }
  return true;
}

function isPersistedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
}

function filterDehydratedState(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: (state.queries ?? []).filter((entry) => {
      if (!isPersistedQueryKey(entry.queryKey as readonly unknown[])) return false;
      return hasPersistableReportData(entry.state?.data);
    }),
  };
}

export function hydrateReportQueryCache(queryClient: QueryClient): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { savedAt: number; state: DehydratedState };
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(queryClient, filterDehydratedState(parsed.state));
  } catch (error) {
    console.warn("[reportQueryCache] hydrate failed", error);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Bust client-card report lists after linking/unlinking tables outside ClientTablesTab. */
export function invalidateClientCrmTablesQueries(
  queryClient: QueryClient,
  tenantId?: string | null,
  clientId?: string | null,
): void {
  if (tenantId && clientId) {
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables", tenantId, clientId] });
  } else if (tenantId) {
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables", tenantId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables"] });
  }
  if (tenantId) {
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
  }
}

export function setupReportQueryCachePersistence(queryClient: QueryClient): void {
  hydrateReportQueryCache(queryClient);

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (!isPersistedQueryKey(event.query.queryKey)) return;

    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const state = filterDehydratedState(dehydrate(queryClient));
        if (state.queries.length === 0) return;
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ savedAt: Date.now(), state }),
        );
      } catch (error) {
        console.warn("[reportQueryCache] persist failed", error);
      }
    }, 800);
  });
}
