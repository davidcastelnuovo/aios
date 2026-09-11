/** Shared React Query tuning for report / dashboard data. */
export const REPORT_QUERY_STALE_MS = 5 * 60 * 1000;
export const REPORT_QUERY_GC_MS = 24 * 60 * 60 * 1000;

export function reportQueryOptions<TData>() {
  return {
    staleTime: REPORT_QUERY_STALE_MS,
    gcTime: REPORT_QUERY_GC_MS,
    placeholderData: (previousData: TData | undefined) => previousData,
    refetchOnWindowFocus: false,
  };
}

/**
 * Bust stale empty lists after permission grants without refetching full
 * dashboards/tables on every remount (that made all reports feel slow).
 */
export function refetchOnMountIfEmpty(
  query: { state: { status: string; data: unknown } },
): boolean | "always" {
  if (query.state.status === "error") return true;
  const data = query.state.data;
  if (data === undefined || data === null) return true;
  if (Array.isArray(data) && data.length === 0) return "always";
  // `true` refetches only when stale. Cached rows remain visible while the
  // background request runs; `false` kept persisted reports stale indefinitely.
  return true;
}

export function getReportLastSyncAt(table: {
  last_sync_at?: string | null;
  integration_settings?: { last_sync_at?: string | null } | null;
} | null | undefined): string | null {
  if (!table) return null;
  return table.integration_settings?.last_sync_at || table.last_sync_at || null;
}
