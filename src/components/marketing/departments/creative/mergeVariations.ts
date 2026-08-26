import type { CreativeVariation } from "./types";

/** Merge a local write with the latest payload so Cursor completes and user rejects do not clobber each other. */
export function mergeCreativeVariations(
  live: CreativeVariation[],
  incoming: CreativeVariation[],
  options?: { dropIds?: Iterable<string> },
): CreativeVariation[] {
  const drop = new Set(options?.dropIds ?? []);
  const liveById = new Map(live.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const merged: CreativeVariation[] = [];
  for (const row of incoming) {
    if (drop.has(row.id)) continue;
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
    if (drop.has(row.id) || seen.has(row.id)) continue;
    if (row.imageUrl) merged.push(row);
  }
  return merged;
}
