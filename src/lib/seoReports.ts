/**
 * SEO report tables (integration_type = 'ahrefs') are rendered as the unified
 * SEO dashboard (SeoReportTabs/SeoDashboardView), which reads straight from the
 * `ahrefs_reports` table — not from `crm_records`.
 *
 * Historically these tables were tagged `integration_settings.data_source =
 * 'ahrefs_reports'`. The SEO report creation dialog later started writing
 * `'seo_unified'` instead, but the render/sync gates still only recognised the
 * old value — so every newer SEO table fell through to the generic (empty) CRM
 * grid and showed "אין נתונים לתקופה זו". Treat both values as a SEO report
 * source everywhere the dashboard is gated.
 */
export const SEO_REPORT_DATA_SOURCES = ['ahrefs_reports', 'seo_unified'] as const;

export function isSeoReportSource(dataSource: unknown): boolean {
  return dataSource === 'ahrefs_reports' || dataSource === 'seo_unified';
}
