/** GSC CTR may be stored as 0–1 (API decimal) or 0–100 (normalized % from fetch-gsc-data). */
export function formatGscCtrPercent(ctr: number | null | undefined): string | null {
  if (ctr == null || !Number.isFinite(Number(ctr))) return null;
  const n = Number(ctr);
  const pct = n > 1 ? n : n * 100;
  return `${pct.toFixed(1)}%`;
}

/** Same scale normalization, for tables that need a numeric percent. */
export function gscCtrAsPercent(ctr: number | null | undefined): number | null {
  if (ctr == null || !Number.isFinite(Number(ctr))) return null;
  const n = Number(ctr);
  return n > 1 ? n : n * 100;
}
