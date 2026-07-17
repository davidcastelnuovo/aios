import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

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
      let query = supabase
        .from("agencies")
        .select("*")
        .eq("tenant_id", tenantId);
      if (activeOnly) query = query.eq("status", "active");
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
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
