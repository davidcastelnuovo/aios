import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";

/**
 * Clients that may be linked from the active organization.
 * Mirrors useAssignableCampaigners: own-tenant rows plus clients in agencies
 * shared into the tenant. RLS remains the final authority.
 */
export function useAssignableClients(options?: { activeOnly?: boolean; enabled?: boolean }) {
  const { tenantId } = useCurrentTenant();
  const { crossTenantAgencyIds } = useCrossTenantAgencyIds();
  const activeOnly = options?.activeOnly ?? false;

  return useQuery({
    queryKey: [
      "assignable-clients",
      tenantId,
      crossTenantAgencyIds.join(","),
      activeOnly,
    ],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("clients")
        .select("id, name, agency_id, status")
        .order("name");

      if (activeOnly) query = query.eq("status", "active");
      query = crossTenantAgencyIds.length > 0
        ? query.or(`tenant_id.eq.${tenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`)
        : query.eq("tenant_id", tenantId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}

