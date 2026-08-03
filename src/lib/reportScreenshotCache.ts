const CACHE_KEY_PREFIX = "report-screenshot-";
const META_KEY_PREFIX = "report-screenshot-meta-";

type CacheEntry = {
  dataUrl: string;
  cachedAt: number;
};

const memoryCache = new Map<string, CacheEntry>();

/** Fresh enough to skip a background prefetch (still re-captured on open). */
export const REPORT_SCREENSHOT_PREFETCH_MAX_AGE_MS = 45 * 60 * 1000;

export function reportScreenshotCacheKey(tableId: string): string {
  return CACHE_KEY_PREFIX + tableId;
}

export function getCachedReportScreenshot(tableId: string): string | null {
  const mem = memoryCache.get(tableId);
  if (mem?.dataUrl) return mem.dataUrl;

  try {
    const dataUrl = localStorage.getItem(CACHE_KEY_PREFIX + tableId);
    if (!dataUrl || dataUrl.length < 200) return null;
    let cachedAt = Date.now();
    try {
      const metaRaw = localStorage.getItem(META_KEY_PREFIX + tableId);
      if (metaRaw) {
        const parsed = JSON.parse(metaRaw) as { cachedAt?: number };
        if (typeof parsed.cachedAt === "number") cachedAt = parsed.cachedAt;
      }
    } catch {
      /* ignore meta parse */
    }
    memoryCache.set(tableId, { dataUrl, cachedAt });
    return dataUrl;
  } catch {
    return null;
  }
}

export function setCachedReportScreenshot(tableId: string, dataUrl: string): void {
  if (!dataUrl || dataUrl.length < 200) return;
  const cachedAt = Date.now();
  memoryCache.set(tableId, { dataUrl, cachedAt });

  // localStorage ~5MB quota — skip oversized payloads.
  if (dataUrl.length >= 4_000_000) {
    try {
      localStorage.removeItem(CACHE_KEY_PREFIX + tableId);
      localStorage.removeItem(META_KEY_PREFIX + tableId);
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    localStorage.setItem(CACHE_KEY_PREFIX + tableId, dataUrl);
    localStorage.setItem(META_KEY_PREFIX + tableId, JSON.stringify({ cachedAt }));
  } catch {
    /* quota exceeded — memory cache still works for this session */
  }
}

export function hasFreshReportScreenshot(
  tableId: string,
  maxAgeMs = REPORT_SCREENSHOT_PREFETCH_MAX_AGE_MS,
): boolean {
  const mem = memoryCache.get(tableId);
  if (mem?.dataUrl && Date.now() - mem.cachedAt < maxAgeMs) return true;

  try {
    const metaRaw = localStorage.getItem(META_KEY_PREFIX + tableId);
    const dataUrl = localStorage.getItem(CACHE_KEY_PREFIX + tableId);
    if (!metaRaw || !dataUrl || dataUrl.length < 200) return false;
    const parsed = JSON.parse(metaRaw) as { cachedAt?: number };
    if (typeof parsed.cachedAt !== "number") return false;
    if (Date.now() - parsed.cachedAt >= maxAgeMs) return false;
    memoryCache.set(tableId, { dataUrl, cachedAt: parsed.cachedAt });
    return true;
  } catch {
    return false;
  }
}

/** Session-scoped set of table IDs already prefetched (or skipped) this page load. */
export const reportScreenshotPrefetchDone = new Set<string>();

/** Prefer ads integrations for the "primary" report tab screenshot. */
const PREFETCH_INTEGRATION_PRIORITY = [
  "facebook_insights",
  "facebook_ecommerce",
  "google_ads",
] as const;

export function pickPrimaryReportTable(
  tables: Array<{
    id: string;
    slug?: string;
    client_id?: string;
    integration_type?: string;
    campaign_active?: boolean;
  }>,
  clientId: string,
): { id: string; slug: string; integration_type?: string } | null {
  const clientTables = tables.filter(
    (t) => t.client_id === clientId && t.slug && (t.campaign_active ?? true) !== false,
  );
  if (clientTables.length === 0) return null;

  for (const type of PREFETCH_INTEGRATION_PRIORITY) {
    const match = clientTables.find((t) => t.integration_type === type);
    if (match?.slug) {
      return { id: match.id, slug: match.slug, integration_type: match.integration_type };
    }
  }

  const first = clientTables[0];
  if (!first?.slug) return null;
  return { id: first.id, slug: first.slug, integration_type: first.integration_type };
}
