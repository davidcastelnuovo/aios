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
