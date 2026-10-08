import {
  buildTrackedTokenIndex,
  isKeywordRelevantToTracked,
  normalizeKeywordPhrase,
} from "./seoKeywordRelevance.ts";

export {
  aggregateGscQueryRows,
  displayRank,
  finiteRank,
  gscQueriesMatch,
  keywordTop20Rank,
  normalizeGscQuery,
  resolveTop20Rank,
  top20DisplayPosition,
  type GscAggregateRow,
  type GscAggregateSample,
  type RankSource,
} from "../../supabase/functions/_shared/gscPosition.ts";

import { displayRank, gscQueriesMatch, top20DisplayPosition } from "../../supabase/functions/_shared/gscPosition.ts";

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
    if (!isKeywordRelevantToTracked(query, index, { forceIrrelevant: blocked })) return null;
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

/** Ahrefs rank when the row has one, otherwise the Search Console rank beside the clicks. */
export function keywordDisplayPosition(kw: {
  position?: unknown;
  gsc_position?: unknown;
  _position_source?: string;
} | null | undefined): { position: number; source: "ahrefs" | "gsc" } | null {
  if (!kw) return null;
  const primary = displayRank(kw.position);
  if (primary != null) {
    return { position: primary, source: kw._position_source === "gsc" ? "gsc" : "ahrefs" };
  }
  const gsc = displayRank(kw.gsc_position);
  if (gsc != null) return { position: gsc, source: "gsc" };
  return null;
}
