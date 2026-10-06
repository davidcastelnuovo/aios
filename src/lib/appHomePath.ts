import { resolveTenantSlug } from "@/hooks/useResolveTenant";

/** Tenant-scoped home (module tiles) for an authenticated user. */
export async function resolveAppHomePath(userId: string): Promise<string | null> {
  const slug = await resolveTenantSlug(userId, 5);
  if (!slug) return null;
  return `/t/${slug}/home`;
}
