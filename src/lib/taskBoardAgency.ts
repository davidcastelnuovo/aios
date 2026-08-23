/**
 * Agency for tasks created from the weekly board / calendar overlay.
 * When the header is filtered to a specific agency, new tasks must land there
 * instead of whichever agency happens to be first in the tenant list.
 */
export function resolveBoardTaskAgency(
  selectedAgency: string | null | undefined,
  fallbackAgencyId: string | null | undefined,
): string | null {
  if (selectedAgency && selectedAgency !== "all") return selectedAgency;
  return fallbackAgencyId ?? null;
}
