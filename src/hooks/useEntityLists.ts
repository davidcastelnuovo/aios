import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { agenciesFromJoin, mergeAgencyLists } from "@/lib/resolveTenantAgency";

/**
 * Shared tenant-scoped entity list hooks.
 * All hooks filter by the current tenant and include tenantId in the query key,
 * so caches never leak across tenants.
 */

export function useAgencies(options?: { activeOnly?: boolean; enabled?: boolean }) {
  const { tenantId } = useCurrentTenant();
  const activeOnly = options?.activeOnly ?? false;

  return useQuery({
    queryKey: ["agencies", tenantId, { activeOnly }],
    queryFn: async () => {
      if (!tenantId) return [];
      let ownedQuery = supabase
        .from("agencies")
        .select("*")
        .eq("tenant_id", tenantId);
      if (activeOnly) ownedQuery = ownedQuery.eq("status", "active");

      const [
        { data: owned, error: ownedError },
        { data: sharedAccess, error: sharedError },
      ] = await Promise.all([
        ownedQuery.order("name"),
        supabase
          .from("agency_tenant_access")
          .select("agency_id, agencies(*)")
          .eq("accessing_tenant_id", tenantId),
      ]);
      if (ownedError) throw ownedError;
      if (sharedError) {
        console.error("Error fetching shared agencies:", sharedError);
      }

      const shared = (sharedAccess || [])
        .flatMap((row) => agenciesFromJoin((row as { agencies?: unknown }).agencies))
        .filter((agency) => !activeOnly || agency.status === "active" || !agency.status);

      return mergeAgencyLists(owned || [], shared as typeof owned).sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "he"),
      );
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}

export function useCampaigners(options?: { activeOnly?: boolean; enabled?: boolean }) {
  const { tenantId } = useCurrentTenant();
  const activeOnly = options?.activeOnly ?? false;

  return useQuery({
    queryKey: ["campaigners", tenantId, { activeOnly }],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("campaigners")
        .select("*")
        .eq("tenant_id", tenantId);
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query.order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}

export function useSalesPeople(options?: { activeOnly?: boolean; enabled?: boolean }) {
  const { tenantId } = useCurrentTenant();
  const activeOnly = options?.activeOnly ?? false;

  return useQuery({
    queryKey: ["sales-people", tenantId, { activeOnly }],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("sales_people")
        .select("*")
        .eq("tenant_id", tenantId);
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query.order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}
