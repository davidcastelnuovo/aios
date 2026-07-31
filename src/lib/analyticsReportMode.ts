// Analytics "leads vs ecommerce" mode for GoogleAnalyticsDashboard.
// Prefer an explicit saved choice; otherwise infer from ads campaign types so
 // lead-gen clients (e.g. Eco) don't open as ecommerce by default.

export type AnalyticsReportMode = "leads" | "ecommerce";

const ADS_TYPES = new Set([
  "google_ads",
  "facebook_insights",
  "facebook_ecommerce",
]);

export function normalizeAnalyticsReportMode(
  value?: string | null,
): AnalyticsReportMode | null {
  const v = String(value || "").toLowerCase();
  if (v === "leads" || v === "ecommerce") return v;
  return null;
}

export function resolveAnalyticsReportMode(opts: {
  dashboardMode?: string | null;
  tableMode?: string | null;
  tables?: Array<{
    integration_type?: string | null;
    integration_settings?: { campaign_type?: string | null; default_report_mode?: string | null } | null;
  }>;
}): AnalyticsReportMode {
  const fromDashboard = normalizeAnalyticsReportMode(opts.dashboardMode);
  if (fromDashboard) return fromDashboard;

  const fromTable = normalizeAnalyticsReportMode(opts.tableMode);
  if (fromTable) return fromTable;

  const tables = opts.tables || [];
  for (const table of tables) {
    if (table.integration_type !== "google_analytics") continue;
    const mode = normalizeAnalyticsReportMode(
      table.integration_settings?.default_report_mode,
    );
    if (mode) return mode;
  }

  // Self-evident fallback: match ads campaign type when present.
  const adsAreEcommerce = tables.some((table) => {
    const type = String(table.integration_type || "");
    if (!ADS_TYPES.has(type)) return false;
    if (type === "facebook_ecommerce") return true;
    return String(table.integration_settings?.campaign_type || "").toLowerCase() === "ecommerce";
  });

  return adsAreEcommerce ? "ecommerce" : "leads";
}
