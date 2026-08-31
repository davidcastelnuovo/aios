/** Warm lazy route chunks before navigation — cuts first-open wait on report pages. */
export function prefetchReportTableView(): void {
  void import("@/pages/DynamicTableView");
}

export function prefetchDashboardView(): void {
  void import("@/pages/DashboardView");
}
