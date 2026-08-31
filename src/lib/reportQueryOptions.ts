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

export function getReportLastSyncAt(table: {
  last_sync_at?: string | null;
  integration_settings?: { last_sync_at?: string | null } | null;
} | null | undefined): string | null {
  if (!table) return null;
  return table.integration_settings?.last_sync_at || table.last_sync_at || null;
}
