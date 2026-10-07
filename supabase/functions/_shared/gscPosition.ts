/** A rank Google actually reported. 0 and blank values are not a position. */
export function finiteRank(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Numeric position is a Top 20 rank. Anything worse stays blank. */
export function top20DisplayPosition(value: unknown): number | null {
  const n = finiteRank(value);
  if (n == null || n > 20) return null;
  return Math.round(n * 10) / 10;
}

export type RankSource = "ahrefs" | "gsc";

/**
 * Rank that belongs in Top 20.
 * A Search Console average inside the top 20 is used when Ahrefs has no
 * rank there, so the Search Console tab and the Top 20 tab agree.
 */
export function resolveTop20Rank(input: {
  ahrefsPosition?: unknown;
  gscPosition?: unknown;
}): { position: number; source: RankSource } | null {
  const ahrefs = top20DisplayPosition(input.ahrefsPosition);
  const gsc = top20DisplayPosition(input.gscPosition);
  if (ahrefs != null && (gsc == null || ahrefs <= gsc)) {
    return { position: ahrefs, source: "ahrefs" };
  }
  if (gsc != null) return { position: gsc, source: "gsc" };
  return null;
}

export function keywordTop20Rank(kw: {
  position?: unknown;
  gsc_position?: unknown;
  ahrefs_position?: unknown;
  _source?: string;
} | null | undefined): { position: number; source: RankSource } | null {
  if (!kw) return null;
  const fromGsc = kw._source === "gsc";
  const gscPosition = kw.gsc_position ?? (fromGsc ? kw.position : null);
  const ahrefsPosition = fromGsc ? kw.ahrefs_position : (kw.ahrefs_position ?? kw.position);
  return resolveTop20Rank({ ahrefsPosition, gscPosition });
}

export function normalizeGscQuery(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact query match. Substring matches must not borrow another phrase's rank. */
export function gscQueriesMatch(a: unknown, b: unknown): boolean {
  const left = normalizeGscQuery(a);
  const right = normalizeGscQuery(b);
  return left.length > 0 && left === right;
}

export type GscAggregateSample = {
  query?: string;
  keyword?: string;
  clicks?: unknown;
  impressions?: unknown;
  position?: unknown;
};

export type GscAggregateRow = {
  query: string;
  clicks: number;
  impressions: number;
  /** Clicks / impressions, 0–1. */
  ctr: number;
  /** Impression-weighted average. 0 when no real position was reported. */
  position: number;
};

/**
 * Impression-weighted position. Days with position 0 or a missing rank are
 * skipped so they cannot pull a query that is outside the top 20 into it.
 */
export function aggregateGscQueryRows(rows: GscAggregateSample[]): GscAggregateRow[] {
  const map = new Map<string, {
    query: string;
    clicks: number;
    impressions: number;
    posWeight: number;
    posImpr: number;
  }>();

  for (const row of rows) {
    const query = String(row.query || row.keyword || "").trim();
    if (!query) continue;
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;
    const position = finiteRank(row.position);
    const cur = map.get(query) || {
      query,
      clicks: 0,
      impressions: 0,
      posWeight: 0,
      posImpr: 0,
    };
    cur.clicks += clicks;
    cur.impressions += impressions;
    if (position != null) {
      const weight = impressions > 0 ? impressions : 1;
      cur.posWeight += position * weight;
      cur.posImpr += weight;
    }
    map.set(query, cur);
  }

  return Array.from(map.values()).map((v) => ({
    query: v.query,
    clicks: v.clicks,
    impressions: v.impressions,
    ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    position: v.posImpr > 0 ? Math.round((v.posWeight / v.posImpr) * 10) / 10 : 0,
  }));
}
