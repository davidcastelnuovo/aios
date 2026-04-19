export function hasValidSeoReportData(reportData: unknown) {
  if (!reportData || typeof reportData !== "object" || Array.isArray(reportData)) {
    return false;
  }

  const data = reportData as Record<string, unknown>;
  const meaningfulKeys = Object.keys(data).filter((key) => key !== "_fix");

  if (meaningfulKeys.length === 0) {
    return false;
  }

  const snapshot = data.snapshot;
  const hasSnapshot = !!snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && Object.keys(snapshot as Record<string, unknown>).length > 0;
  const hasOrganicKeywords = Array.isArray(data.organic_keywords) && data.organic_keywords.length > 0;
  const hasTrackedKeywords = Array.isArray(data.tracked_keywords) && data.tracked_keywords.length > 0;
  const hasTrafficHistory = Array.isArray(data.traffic_history) && data.traffic_history.length > 0;
  const hasHtml = typeof data.html === "string" && data.html.trim().length > 0;

  return hasSnapshot || hasOrganicKeywords || hasTrackedKeywords || hasTrafficHistory || hasHtml;
}

export function filterValidSeoReports<T extends { report_data?: unknown }>(reports: T[]) {
  return reports.filter((report) => hasValidSeoReportData(report.report_data));
}