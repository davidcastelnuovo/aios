/**
 * Domain matching for SEO artifacts (Ahrefs tables/reports, Search Console
 * properties). A client's SEO data MUST never be resolved from a row that
 * belongs to a different site: a single stray row (e.g. an Ahrefs table for
 * another client's domain attached to the wrong client) used to leak that
 * client's keywords, clicks and impressions into the report.
 */

/** Reduce a URL / GSC property / bare domain to a comparable host. */
export function normalizeSeoDomain(value?: string | null): string {
  let v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^sc-domain:/, "");
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split("/")[0].split("?")[0].split("#")[0];
  v = v.replace(/:\d+$/, "");
  v = v.replace(/^www\./, "");
  return v;
}

/**
 * True when both values point at the same site. Equal hosts match, and so does
 * a subdomain of the other host (`shop.example.com` ↔ `example.com`).
 * Deliberately NOT a substring check — `rinatmatanot.co.il` and `drdogs.net`
 * must never match, and loose `includes()` comparisons have produced false
 * positives for short domains.
 */
export function seoDomainsMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeSeoDomain(a);
  const nb = normalizeSeoDomain(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(`.${nb}`) || nb.endsWith(`.${na}`);
}

type SeoTableLike = {
  client_id?: string | null;
  integration_settings?: unknown;
  updated_at?: string | null;
  created_at?: string | null;
};

function settingsOf(table: SeoTableLike): Record<string, unknown> {
  return (table?.integration_settings && typeof table.integration_settings === "object"
    ? (table.integration_settings as Record<string, unknown>)
    : {}) as Record<string, unknown>;
}

function tableTimestamp(table: SeoTableLike): number {
  const raw = table.updated_at || table.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** The domain an SEO table claims to track. */
export function seoTableDomain(table: SeoTableLike): string {
  const s = settingsOf(table);
  return normalizeSeoDomain(
    (s.targetDomain as string) || (s.domain as string) || (s.linkedGscSiteUrl as string) || "",
  );
}

/**
 * Pick the SEO/Ahrefs table for a client. Tables whose tracked domain matches
 * the client's own domain always win; ties break on the most recently updated
 * row so the choice is stable instead of depending on row order.
 */
export function selectSeoTableForClient<T extends SeoTableLike>(
  tables: T[],
  clientId: string,
  expectedDomain?: string | null,
): T | null {
  const candidates = (tables || []).filter((t) => {
    if (t.client_id === clientId) return true;
    // Legacy tables carry the client only inside integration_settings.
    return settingsOf(t).clientId === clientId;
  });
  if (candidates.length === 0) return null;

  const expected = normalizeSeoDomain(expectedDomain);
  const scored = candidates.map((table) => {
    const domain = seoTableDomain(table);
    let score = 0;
    if (expected && domain) score = seoDomainsMatch(domain, expected) ? 2 : 0;
    else if (domain) score = 1;
    return { table, score, ts: tableTimestamp(table) };
  });

  scored.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return scored[0].table;
}

type SeoReportLike = {
  domain?: string | null;
  received_at?: string | null;
  report_date?: string | null;
};

/**
 * Keep only the reports that belong to the client's own domain. When the
 * expected domain is unknown, or no report matches it (e.g. the client record
 * has a stale website), the input is returned untouched so existing clients
 * don't lose their report.
 */
export function filterSeoReportsByDomain<T extends SeoReportLike>(
  reports: T[],
  expectedDomain?: string | null,
): T[] {
  const expected = normalizeSeoDomain(expectedDomain);
  if (!expected) return reports || [];
  const matching = (reports || []).filter((r) => seoDomainsMatch(r.domain, expected));
  return matching.length > 0 ? matching : (reports || []);
}

/** Sort reports newest-first by sync time, falling back to the report date. */
export function sortSeoReportsByRecency<T extends SeoReportLike>(reports: T[]): T[] {
  const time = (r: T) => {
    const t = new Date(r.received_at || r.report_date || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  return [...(reports || [])].sort((a, b) => time(b) - time(a));
}

type SeoTenantScopeClient = {
  tenant_id?: string | null;
  agency_id?: string | null;
};

type AgencyTenantAccessRow = {
  accessing_tenant_id?: string | null;
  source_tenant_id?: string | null;
};

/**
 * Tenant ids that may host ahrefs_reports for a client. fetch-ahrefs-snapshot
 * always writes under clients.tenant_id; shared-agency SEO tables often live
 * on a partner tenant (e.g. MarketingCaptain) while the client home tenant is
 * DMM — CategorySyncControl must read across the same scope as SeoDashboardView.
 */
export function buildSeoReportTenantIds(
  client: SeoTenantScopeClient | null | undefined,
  agencyAccessRows: AgencyTenantAccessRow[] | null | undefined,
  extraTenantIds: string[] = [],
): string[] {
  const set = new Set<string>();
  for (const id of extraTenantIds) {
    if (id) set.add(id);
  }
  if (client?.tenant_id) set.add(client.tenant_id);
  for (const row of agencyAccessRows || []) {
    if (row.accessing_tenant_id) set.add(row.accessing_tenant_id);
    if (row.source_tenant_id) set.add(row.source_tenant_id);
  }
  return Array.from(set);
}

/** True when neither table last_sync_at nor latest ahrefs report is in the current month. */
export function seoTableNeedsSyncThisMonth(
  lastSyncAt: string | null | undefined,
  latestReportReceivedAt?: string | null | undefined,
): boolean {
  const now = new Date();
  const inCurrentMonth = (iso?: string | null): boolean => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  };
  if (inCurrentMonth(lastSyncAt) || inCurrentMonth(latestReportReceivedAt)) return false;
  return true;
}

/** Same resolution order as cron-sync-ahrefs and the SEO dashboard tabs. */
export function pickSeoSyncDomain(input: {
  settings?: Record<string, unknown> | null;
  client?: { website?: string | null; ahrefs_domain?: string | null } | null;
  tableName?: string | null;
  latestReportDomain?: string | null;
}): { domain: string; from: string | null } {
  const settings = input.settings || {};
  const tryPick = (raw: unknown, from: string): { domain: string; from: string } | null => {
    const n = normalizeSeoDomain(String(raw || ""));
    return looksLikeSeoDomain(n) ? { domain: n, from } : null;
  };
  const chain: Array<{ raw: unknown; from: string }> = [
    { raw: settings.targetDomain || settings.target || settings.domain, from: "targetDomain" },
    { raw: settings.linkedGscSiteUrl, from: "linkedGscSiteUrl" },
    { raw: input.client?.ahrefs_domain, from: "ahrefs_domain" },
    { raw: input.client?.website, from: "website" },
    { raw: input.latestReportDomain, from: "ahrefs_reports" },
    { raw: extractDomainHint(input.tableName), from: "table_name" },
  ];
  for (const item of chain) {
    const hit = tryPick(item.raw, item.from);
    if (hit) return hit;
  }
  return { domain: "", from: null };
}

/** Pull a hostname from free text (table title, client name suffix, etc.). */
export function extractDomainHint(text?: string | null): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const m = raw.match(
    /(?:^|[\s\-–—])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i,
  );
  return m ? normalizeSeoDomain(m[1]) : "";
}

/** Reject client names mistakenly stored as targetDomain (must look like a host). */
export function looksLikeSeoDomain(value?: string | null): boolean {
  const n = normalizeSeoDomain(value);
  if (!n || n.includes(" ")) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(n);
}
