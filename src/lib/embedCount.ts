/** PostgREST embed count (`relation(count)`) or legacy id rows. */
export function embedCount(
  embed: Array<{ id?: string; count?: number }> | null | undefined,
): number {
  if (!embed?.length) return 0;
  const first = embed[0];
  if (typeof first.count === "number") return first.count;
  return embed.length;
}
