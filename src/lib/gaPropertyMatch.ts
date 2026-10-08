import { normalizeSeoDomain, seoDomainsMatch } from "./seoDomain.ts";

export type GaPropertyRef = {
  id?: string;
  name?: string;
  displayName?: string;
  accountName?: string;
  websiteUrl?: string;
};

function fieldScore(value: string | undefined, host: string): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const nameHost = normalizeSeoDomain(raw);
  if (nameHost && nameHost === host) return 4;
  if (nameHost && seoDomainsMatch(nameHost, host)) return 3;
  if (raw.toLowerCase().includes(host)) return 2;
  if (nameHost && host.includes(nameHost) && nameHost.length >= 4) return 1;
  return 0;
}

export function scoreGaProperty(property: GaPropertyRef, domain: string): number {
  const host = normalizeSeoDomain(domain);
  if (!host || !String(property.id || "").trim()) return 0;
  return Math.max(
    fieldScore(property.name, host),
    fieldScore(property.displayName, host),
    fieldScore(property.accountName, host),
    fieldScore(property.websiteUrl, host),
  );
}

/** Best GA4 property id for a domain, using the name, account, or site URL. */
export function pickGaPropertyForDomain(
  properties: GaPropertyRef[],
  domain: string,
): string | null {
  const host = normalizeSeoDomain(domain);
  if (!host || !properties?.length) return null;

  let bestId = "";
  let bestScore = 0;
  for (const property of properties) {
    const score = scoreGaProperty(property, host);
    if (score > bestScore) {
      bestScore = score;
      bestId = String(property.id || "").trim();
    }
  }
  return bestId || null;
}

export type GaPropertyGroup = {
  integrationId: string;
  properties: GaPropertyRef[];
  /** The signed-in user's own Google login, not a shared one. */
  own?: boolean;
};

export function bestGaPropertyMatch(
  groups: GaPropertyGroup[],
  domain: string,
  preferredIntegrationId?: string,
): { integrationId: string; propertyId: string; property: GaPropertyRef } | null {
  const host = normalizeSeoDomain(domain);
  if (!host) return null;

  let best: {
    integrationId: string;
    propertyId: string;
    property: GaPropertyRef;
    rank: number;
  } | null = null;

  for (const group of groups) {
    const preferred = !!preferredIntegrationId && group.integrationId === preferredIntegrationId;
    for (const property of group.properties || []) {
      const propertyId = String(property.id || "").trim();
      const score = scoreGaProperty(property, host);
      if (!propertyId || score <= 0) continue;
      // The account the user picked wins a tie. Otherwise their own login
      // wins over a shared login. A higher domain score always wins.
      const rank = score * 4 + (preferred ? 2 : 0) + (group.own ? 1 : 0);
      if (!best || rank > best.rank) {
        best = { integrationId: group.integrationId, propertyId, property, rank };
      }
    }
  }

  return best
    ? { integrationId: best.integrationId, propertyId: best.propertyId, property: best.property }
    : null;
}

/**
 * Search every connected Google login. Name and account matches resolve first.
 * `loadProperties(..., domain)` is the slower pass that can attach the site URL.
 */
export async function findGaIntegrationForDomain(
  integrations: Array<{ id: string; own?: boolean }>,
  domain: string,
  loadProperties: (integrationId: string, matchDomain: string | null) => Promise<GaPropertyRef[] | null>,
  preferredIntegrationId?: string,
): Promise<{ integrationId: string; propertyId: string; property: GaPropertyRef } | null> {
  const host = normalizeSeoDomain(domain);
  if (!host || !integrations.length) return null;

  const loaded = await Promise.all(
    integrations.map(async (integration) => ({
      integrationId: integration.id,
      own: integration.own,
      properties: await loadProperties(integration.id, null),
    })),
  );
  const reachable = loaded.filter(
    (group): group is { integrationId: string; own?: boolean; properties: GaPropertyRef[] } =>
      Array.isArray(group.properties),
  );

  const named = bestGaPropertyMatch(reachable, host, preferredIntegrationId);
  if (named && scoreGaProperty(named.property, host) >= 2) return named;

  const withUrls: GaPropertyGroup[] = [];
  for (const group of reachable) {
    if (group.properties.length === 0) continue;
    const properties = await loadProperties(group.integrationId, host);
    if (!properties?.length) continue;
    withUrls.push({ integrationId: group.integrationId, own: group.own, properties });
    const found = bestGaPropertyMatch(withUrls, host, preferredIntegrationId);
    if (found && scoreGaProperty(found.property, host) >= 4) return found;
  }

  return bestGaPropertyMatch(withUrls, host, preferredIntegrationId) || named;
}
