/**
 * Helpers for query-driven UI — avoid flashing stale errors or empty states
 * while React Query is still resolving (especially on module navigation).
 */

export function isQueryResolving(
  isPending: boolean,
  isLoading: boolean,
  isFetching: boolean,
): boolean {
  return isPending || isLoading || isFetching;
}

/** Show error UI only when the query has settled in an error state. */
export function shouldShowQueryError(
  isError: boolean,
  isFetching: boolean,
  isPending: boolean,
  isLoading = false,
): boolean {
  if (!isError) return false;
  if (isPending || isLoading || isFetching) return false;
  return true;
}
