import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";

/**
 * Hook to get agency IDs that are shared with the current tenant
 * via agency_tenant_access table.
 * Returns the IDs and a helper to build an OR filter for client queries.
 */
export function useCrossTenantAgencyIds() {
  const { tenantId } = useCurrentTenant();

  const { data: crossTenantAgencyIds = [] } = useQuery({
    queryKey: ["cross-tenant-agency-ids", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId);
      if (error) throw error;
      return data?.map((r) => r.agency_id) || [];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  /**
   * Builds an OR filter string for Supabase queries on tables with tenant_id + agency_id.
   * Returns null if no cross-tenant agencies exist (use simple .eq instead).
   */
  const buildCrossTenantFilter = (): string | null => {
    if (!tenantId) return null;
    if (crossTenantAgencyIds.length === 0) return null;
    return `tenant_id.eq.${tenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`;
  };

  return {
    crossTenantAgencyIds,
    hasCrossTenantAccess: crossTenantAgencyIds.length > 0,
    buildCrossTenantFilter,
    tenantId,
  };
}
