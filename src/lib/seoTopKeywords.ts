/** Ranking used by the SEO "Top 20" tab.

Search Console average position is the rank Google actually shows.
Ahrefs position is only a fallback when that query has no Search Console row.
*/
export function finiteRank(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function top20Rank(keyword: {
  position?: unknown;
  gsc_position?: unknown;
} | null | undefined): { rank: number; source: "gsc" | "ahrefs" } | null {
  if (!keyword) return null;
  const gsc = finiteRank(keyword.gsc_position);
  if (gsc != null) return { rank: gsc, source: "gsc" };
  const ahrefs = finiteRank(keyword.position);
  if (ahrefs != null) return { rank: ahrefs, source: "ahrefs" };
  return null;
}

export function isSearchTop20(keyword: {
  position?: unknown;
  gsc_position?: unknown;
} | null | undefined): boolean {
  const ranked = top20Rank(keyword);
  return ranked != null && ranked.rank <= 20;
}
