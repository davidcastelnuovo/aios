import {
  buildTrackedTokenIndex,
  isKeywordRelevantToTracked,
  normalizeKeywordPhrase,
} from "./seoKeywordRelevance.ts";

export {
  aggregateGscQueryRows,
  betterDisplayRank,
  displayRank,
  finiteRank,
  gscQueriesMatch,
  keywordTop20Rank,
  mergeTrackedKeywordRows,
  normalizeGscQuery,
  resolveTop20Rank,
  top20DisplayPosition,
  type GscAggregateRow,
  type GscAggregateSample,
  type RankSource,
} from "../../supabase/functions/_shared/gscPosition.ts";

import {
  betterDisplayRank,
  displayRank,
  gscQueriesMatch,
  normalizeGscQuery,
  top20DisplayPosition,
} from "../../supabase/functions/_shared/gscPosition.ts";

/**
 * Position shown on the Search Console tab: a real top-20 rank for a phrase
 * that also qualifies for the Top 20 list (tracked relevance, not marked irrelevant).
 */
export function visibleGscPosition(
  query: string,
  position: unknown,
  opts?: {
    tracked?: Array<{ keyword?: string } | string>;
    forceIrrelevant?: string[];
  },
): number | null {
  const rank = top20DisplayPosition(position);
  if (rank == null) return null;
  const phrase = normalizeKeywordPhrase(query);
  const blocked = new Set(
    (opts?.forceIrrelevant || []).map((item) => normalizeKeywordPhrase(item)),
  );
  if (phrase && blocked.has(phrase)) return null;
  const tracked = opts?.tracked || [];
  if (tracked.length > 0) {
    const index = buildTrackedTokenIndex(tracked);
    if (!isKeywordRelevantToTracked(query, index, { forceIrrelevant: blocked }))
      return null;
  }
  return rank;
}

/**
 * Tracked phrases keep their Search Console rank even outside the top 20,
 * because that list already shows their clicks and impressions.
 * Other queries still show a position only inside the top 20.
 */
export function trackedQueryPosition(
  query: string,
  position: unknown,
  opts?: {
    tracked?: Array<{ keyword?: string } | string>;
    forceIrrelevant?: string[];
  },
): number | null {
  const phrase = normalizeKeywordPhrase(query);
  const blocked = new Set(
    (opts?.forceIrrelevant || []).map((item) => normalizeKeywordPhrase(item)),
  );
  if (phrase && blocked.has(phrase)) return null;
  const tracked = opts?.tracked || [];
  const exact = tracked.some((item) =>
    gscQueriesMatch(query, typeof item === "string" ? item : item?.keyword),
  );
  if (exact) return displayRank(position);
  return visibleGscPosition(query, position, opts);
}

/** Tracked phrase: better of the stored Ahrefs rank and the Search Console rank. */
export function trackedPhraseRank(
  query: string,
  gscPosition: unknown,
  opts?: {
    tracked?: Array<{ keyword?: string } | string>;
    forceIrrelevant?: string[];
    ahrefsPositions?: Record<string, number>;
  },
): { position: number; source: "ahrefs" | "gsc" } | null {
  const phrase = normalizeKeywordPhrase(query);
  const blocked = new Set(
    (opts?.forceIrrelevant || []).map((item) => normalizeKeywordPhrase(item)),
  );
  if (phrase && blocked.has(phrase)) return null;
  const tracked = opts?.tracked || [];
  const exact = tracked.some((item) =>
    gscQueriesMatch(query, typeof item === "string" ? item : item?.keyword),
  );
  const gsc = exact
    ? displayRank(gscPosition)
    : visibleGscPosition(query, gscPosition, opts);
  const ahrefs = exact
    ? opts?.ahrefsPositions?.[normalizeGscQuery(query)]
    : null;
  return betterDisplayRank({ ahrefsPosition: ahrefs, gscPosition: gsc });
}

/**
 * Tracked phrases show a position whenever Ahrefs or Search Console has one.
 * A gap between the two sources shows the better rank.
 */
export function keywordDisplayPosition(
  kw:
    | {
        position?: unknown;
        gsc_position?: unknown;
        ahrefs_position?: unknown;
        _source?: string;
        _position_source?: string;
      }
    | null
    | undefined,
): { position: number; source: "ahrefs" | "gsc" } | null {
  if (!kw) return null;
  const rankIsGsc = kw._source === "gsc" || kw._position_source === "gsc";
  const gscPosition = kw.gsc_position ?? (rankIsGsc ? kw.position : null);
  const ahrefsPosition = kw.ahrefs_position ?? (rankIsGsc ? null : kw.position);
  return betterDisplayRank({ ahrefsPosition, gscPosition });
}

/** Newest report wins. A later list without ranks keeps the last stored Ahrefs rank. */
export function ahrefsPositionsFromReports(
  reports: Array<
    | {
        report_data?: {
          tracked_keywords?: Array<{
            keyword?: unknown;
            position?: unknown;
            best_position?: unknown;
          }>;
        };
      }
    | null
    | undefined
  >,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const report of reports || []) {
    const rows = report?.report_data?.tracked_keywords || [];
    for (const row of rows) {
      const key = normalizeGscQuery(row?.keyword);
      if (!key || map.has(key)) continue;
      const rank = displayRank(row?.position ?? row?.best_position);
      if (rank != null) map.set(key, rank);
    }
  }
  return map;
}
