import type { CreativeVariation } from "./types";

/** Merge a local write with the latest payload so Cursor completes and user rejects do not clobber each other. */
export function mergeCreativeVariations(
  live: CreativeVariation[],
  incoming: CreativeVariation[],
): CreativeVariation[] {
  const liveById = new Map(live.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const merged: CreativeVariation[] = [];
  for (const row of incoming) {
    seen.add(row.id);
    const existing = liveById.get(row.id);
    if (!existing) {
      merged.push(row);
      continue;
    }
    merged.push({
      ...existing,
      ...row,
      rejected: row.rejected === false ? false : Boolean(row.rejected || existing.rejected),
      rejectNote: row.rejectNote || existing.rejectNote,
    });
  }
  for (const row of live) {
    if (!seen.has(row.id) && row.imageUrl) merged.push(row);
  }
  return merged;
}
