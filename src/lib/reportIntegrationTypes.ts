/**
 * Report / CRM table OAuth connection types.
 *
 * These are tenant-scoped for listing in report UI: any member who can open
 * reports may see and select connections owned by Anna / Yuval / David / etc.
 * Viewing synced rows is already gated by `user_can_access_crm_table`.
 *
 * Chat / WhatsApp / Green API stay per-user (connection_visibility).
 */
export const REPORT_TENANT_SCOPED_INTEGRATION_TYPES = new Set([
  "google_analytics",
  "google_search_console",
  "google_ads",
  "facebook",
  "facebook_lead_ads",
  "ahrefs",
  "tiktok",
]);

export function isReportTenantScopedIntegration(type: string | null | undefined): boolean {
  return !!type && REPORT_TENANT_SCOPED_INTEGRATION_TYPES.has(type);
}
