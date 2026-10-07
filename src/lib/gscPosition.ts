import {
  buildTrackedTokenIndex,
  isKeywordRelevantToTracked,
  normalizeKeywordPhrase,
} from "./seoKeywordRelevance.ts";

export {
  aggregateGscQueryRows,
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

import { top20DisplayPosition } from "../../supabase/functions/_shared/gscPosition.ts";

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
