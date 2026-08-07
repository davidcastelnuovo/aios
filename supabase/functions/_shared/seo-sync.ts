/** Shared SEO Ahrefs sync helpers — keep cron + fetch paths aligned with the UI. */

export function normalizeSeoDomain(value?: string | null): string {
  let v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^sc-domain:/, "");
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/^www\./, "");
  v = v.split("/")[0].split("?")[0].split("#")[0];
  v = v.replace(/:\d+$/, "");
  return v;
}

export function looksLikeSeoDomain(value?: string | null): boolean {
  const n = normalizeSeoDomain(value);
  if (!n || n.includes(" ")) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(n);
}

export function extractDomainHint(text?: string | null): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const m = raw.match(
    /(?:^|[\s\-–—])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i,
  );
  return m ? normalizeSeoDomain(m[1]) : "";
}

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

/** UI shows ahrefs_reports.received_at; cron used only integration_settings.last_sync_at. */
export function needsSeoSyncThisMonth(
  lastSyncAt?: string | null,
  latestReportReceivedAt?: string | null,
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
