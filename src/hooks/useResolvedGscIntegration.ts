import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";

export interface ResolvedGscIntegration {
  /** GSC integration ID to use for fetch-gsc-data calls. Null when nothing is available. */
  integrationId: string | null;
  /** GSC site URL resolved by the edge function (matches expectedSiteUrl when possible). */
  siteUrl: string | null;
  /** Email of the integration owner (display only). */
  ownerEmail: string | null;
  /** True when no personal/shared integration was found and the org-level fallback is being used. */
  isFallback: boolean;
  /** True while either step is loading. */
  isLoading: boolean;
}

/**
 * Resolves a GSC integration for the SEO dashboard.
 *
 * Priority:
 *   1. The user's own / explicitly-shared integration (via useUserIntegrations).
 *   2. A tenant-wide active GSC integration that maps to the client's site
 *      (resolved via the `resolve-seo-gsc-integration` edge function, mirroring
 *      the public link's behavior so internal viewers don't have to "sync"
 *      manually just because someone else owns the OAuth).
 *
 * Tokens are NEVER returned to the client — only the integration ID. All token
 * use happens server-side inside fetch-gsc-data (service-role).
 */
export function useResolvedGscIntegration(params: {
  clientId: string | undefined;
  tenantIds: string[] | undefined;
  savedSiteUrl?: string;
  enabled?: boolean;
}): ResolvedGscIntegration {
  const { clientId, tenantIds, savedSiteUrl, enabled = true } = params;

  const tenantsKey = (tenantIds || []).slice().sort().join(",");

  // Step 1 — personal/shared integration (existing behavior, unchanged).
  const { data: personalIntegrations = [], isLoading: isLoadingPersonal } =
    useUserIntegrations(tenantIds, "google_search_console", { enabled });

  const hasPersonal = personalIntegrations.length > 0;

  // Step 2 — fallback only when there's no personal/shared integration.
  const fallbackEnabled =
    enabled && !hasPersonal && !isLoadingPersonal && !!clientId && !!tenantsKey;

  const { data: fallback, isLoading: isLoadingFallback } = useQuery({
    queryKey: ["resolved-gsc-fallback", clientId, tenantsKey, savedSiteUrl || ""],
    enabled: fallbackEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { integrationId: null, siteUrl: null, ownerEmail: null };

      const response = await supabase.functions.invoke("resolve-seo-gsc-integration", {
        body: {
          clientId,
          tenantIds,
          expectedSiteUrl: savedSiteUrl || undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        console.warn("[useResolvedGscIntegration] resolve failed:", response.error);
        return { integrationId: null, siteUrl: null, ownerEmail: null };
      }
      return (response.data || { integrationId: null, siteUrl: null, ownerEmail: null }) as {
        integrationId: string | null;
        siteUrl: string | null;
        ownerEmail: string | null;
      };
    },
  });

  if (hasPersonal) {
    return {
      integrationId: null, // personal path handled inside GscIntegration directly
      siteUrl: null,
      ownerEmail: null,
      isFallback: false,
      isLoading: isLoadingPersonal,
    };
  }

  return {
    integrationId: fallback?.integrationId ?? null,
    siteUrl: fallback?.siteUrl ?? null,
    ownerEmail: fallback?.ownerEmail ?? null,
    isFallback: !!fallback?.integrationId,
    isLoading: isLoadingPersonal || isLoadingFallback,
  };
}
