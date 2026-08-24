/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  REPORT_TABLE_CLIENT_FIELD_MAP,
  normalizeGoogleCustomerId,
  normalizeMetaAdAccountId,
  extractAccountIdFromReportTable,
  validateReportTableAccountId,
  syncClientCardFromReportTable,
  googleResolveClientCustomerId,
  buildGoogleCustomerClientMap,
} from './client-report-sync.mjs';
