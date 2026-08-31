import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAgency } from "@/contexts/AgencyContext";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { buildSystemFixContext, type SystemFixContextMetadata } from "@/lib/systemFixContext";

/** Live screen context for Carmen system-fix sidecar messages. */
export function useSystemFixContext(): SystemFixContextMetadata {
  const location = useLocation();
  const params = useParams();
  const { tenantId, tenant } = useCurrentTenant();
  const { selectedAgency } = useAgency();

  return useMemo(
    () =>
      buildSystemFixContext({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        params,
        tenantId,
        tenantSlug: tenant?.slug ?? null,
        agencyId: selectedAgency !== "all" ? selectedAgency : null,
        pageTitle: typeof document !== "undefined" ? document.title : undefined,
      }),
    [location.pathname, location.search, location.hash, params, tenantId, tenant?.slug, selectedAgency],
  );
}
