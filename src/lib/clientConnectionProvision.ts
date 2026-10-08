import { pickGaPropertyForDomain } from "@/lib/gaPropertyMatch";
import { normalizeSeoDomain, seoDomainsMatch } from "@/lib/seoDomain";
import type { ChannelFieldKey } from "@/config/clientChannels";

export type ConnectionFieldMap = Partial<Record<ChannelFieldKey, string | null | undefined>>;

/**
 * Count distinct marketing connections the user has entered on the client card.
 * SEO (website / Ahrefs / GSC) counts as one bundle — not three.
 * Standalone GA counts only when SEO isn't already counted.
 */
export function countFilledConnections(
  fields: ConnectionFieldMap,
  services: string[] | null | undefined = [],
): number {
  const s = Array.isArray(services) ? services : [];
  const has = (key: ChannelFieldKey) => !!String(fields[key] ?? "").trim();
  let n = 0;
  if (has("google_ads_account_id")) n += 1;
  if (has("meta_ads_account_id")) n += 1;

  const seoBundle =
    has("ahrefs_domain") ||
    has("gsc_site_url") ||
    (has("website") && s.includes("seo"));
  if (seoBundle) n += 1;

  // Analytics alone (no SEO bundle) is its own connection.
  if (has("ga_property_id") && !seoBundle) n += 1;

  return n;
}

export function shouldCreateDashboardForConnections(
  fields: ConnectionFieldMap,
  services: string[] | null | undefined = [],
): boolean {
  return countFilledConnections(fields, services) > 1;
}

export function isSeoClient(services: string[] | null | undefined): boolean {
  return Array.isArray(services) && services.includes("seo");
}

/** Best GSC siteUrl for a domain (prefer sc-domain: host). */
export function pickGscSiteForDomain(
  sites: Array<{ siteUrl?: string | null }>,
  domain: string,
): string | null {
  const host = normalizeSeoDomain(domain);
  if (!host || !sites?.length) return null;
  const preferred = sites.find((s) => String(s.siteUrl || "").toLowerCase() === `sc-domain:${host}`);
  if (preferred?.siteUrl) return preferred.siteUrl;
  const match = sites.find((s) => seoDomainsMatch(s.siteUrl, host));
  return match?.siteUrl || null;
}

export { pickGaPropertyForDomain };
