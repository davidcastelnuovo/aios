/**
 * Decide what ModulePermissionGate should render.
 * Navigation remounts used to flash a stale React Query error (or a
 * permission redirect) for one frame before refetch completed.
 */

export type PermissionGateView = "children" | "skeleton" | "error" | "redirect";

export type PermissionGateState = {
  permission?: string;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** True when the permissions query has any cached/placeholder data. */
  isReady: boolean;
  /** True after THIS observer has finished a fetch since it mounted. */
  isFetchedAfterMount: boolean;
  allowed: boolean;
};

export function resolvePermissionGateView(
  state: PermissionGateState,
): PermissionGateView {
  const {
    permission,
    isSuperAdmin,
    isLoading,
    isFetching,
    isError,
    isReady,
    isFetchedAfterMount,
    allowed,
  } = state;

  if (!permission || isSuperAdmin) return "children";
  if (isLoading) return "skeleton";

  // Cached data is enough to render — never cover a working page with a stale error.
  if (isReady && allowed) return "children";

  if (!isReady) {
    if (isError && !isFetching && isFetchedAfterMount) return "error";
    return "skeleton";
  }

  if (!allowed) return "redirect";
  return "children";
}
