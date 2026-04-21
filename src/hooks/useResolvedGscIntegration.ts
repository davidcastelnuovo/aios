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
  /** True when no personal/shared usable integration was found and the org-level fallback is being used. */
  isFallback: boolean;
  /** True while either step is loading. */
  isLoading: boolean;
}

function normalizeSiteUrl(value?: string | null): string {
  return String(value || "")
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function siteMatches(a?: string | null, b?: string | null): boolean {
  const na = normalizeSiteUrl(a);
  const nb = normalizeSiteUrl(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Resolves a GSC integration for the SEO dashboard.
 *
 * Priority:
 *   1. The user's own / explicitly-shared integration — ONLY if it has a usable
 *      mapping for this client (and matches expectedSiteUrl when provided).
 *   2. A tenant-wide active GSC integration that maps to the client's site
 *      (resolved via the `resolve-seo-gsc-integration` edge function, mirroring
 *      the public link's behavior so internal viewers don't have to "sync"
 *      manually just because someone else owns the OAuth, OR their own
 *      connection isn't mapped to the right property).
 *
 * Tokens are NEVER returned to the client — only the integration ID. All token
 * use happens server-side inside fetch-gsc-data (service-role).
 */
export function useResolvedGscIntegration(params: {
  clientId: string | undefined;
  tenantIds: string[] | undefined;
  savedSiteUrl?: string;
  /** Report domain — used as a secondary match target when no savedSiteUrl is set. */
  expectedDomain?: string;
  enabled?: boolean;
}): ResolvedGscIntegration {
  const { clientId, tenantIds, savedSiteUrl, expectedDomain, enabled = true } = params;

  const tenantsKey = (tenantIds || []).slice().sort().join(",");
  const expectedSiteUrl = savedSiteUrl || expectedDomain || "";

  // Step 1 — personal/shared integration (existing behavior, unchanged).
  const { data: personalIntegrations = [], isLoading: isLoadingPersonal } =
    useUserIntegrations(tenantIds, "google_search_console", { enabled });

  // Determine whether the user's personal/shared integration is "usable" for THIS client/site.
  const personalIsUsable = (() => {
    if (!personalIntegrations.length || !clientId) return false;
    return personalIntegrations.some((i: any) => {
      const settings = i?.settings || {};
      const mapped: string | null = settings?.client_sites?.[clientId] || null;
      const availableSites: any[] = Array.isArray(settings?.available_sites) ? settings.available_sites : [];

      const meta = mapped ? availableSites.find((s: any) => s?.siteUrl === mapped) : null;
      const mappedIsUsable = !!mapped && (!meta || meta.permissionLevel !== "siteUnverifiedUser");

      if (!mappedIsUsable) return false;
      // If we have an expected site, require the mapped site to match it.
      if (expectedSiteUrl) return siteMatches(mapped, expectedSiteUrl);
      return true;
    });
  })();

  // Step 2 — fallback when no personal/shared *usable* integration exists.
  const fallbackEnabled =
    enabled && !personalIsUsable && !isLoadingPersonal && !!clientId && !!tenantsKey;

  const { data: fallback, isLoading: isLoadingFallback } = useQuery({
    queryKey: [
      "resolved-gsc-fallback",
      clientId,
      tenantsKey,
      savedSiteUrl || "",
      expectedDomain || "",
    ],
    enabled: fallbackEnabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { integrationId: null, siteUrl: null, ownerEmail: null };

      const response = await supabase.functions.invoke("resolve-seo-gsc-integration", {
        body: {
          clientId,
          tenantIds,
          expectedSiteUrl: expectedSiteUrl || undefined,
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

  if (personalIsUsable) {
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
