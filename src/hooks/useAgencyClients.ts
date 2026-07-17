import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export interface AgencyOption {
  id: string;
  name: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

/**
 * Fetch clients belonging to a given agency (id + name, ordered by name).
 * Shared by the table-creation dialogs.
 */
export function useAgencyClients(
  agencyId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["clients", "by-agency", agencyId],
    queryFn: async (): Promise<ClientOption[]> => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agency_id", agencyId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId && (options?.enabled ?? true),
  });
}

/**
 * Fetch the current tenant's agencies (id + name, ordered by name).
 * When `includeShared` is true, cross-tenant shared agencies (via
 * `agency_tenant_access`) are merged in, deduped, and sorted by Hebrew name.
 */
export function useTableDialogAgencies(options?: {
  includeShared?: boolean;
  enabled?: boolean;
}) {
  const { tenantId } = useCurrentTenant();
  const includeShared = !!options?.includeShared;

  return useQuery({
    queryKey: ["agencies", tenantId, { shared: includeShared }],
    queryFn: async (): Promise<AgencyOption[]> => {
      if (!tenantId) return [];

      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (ownedError) throw ownedError;

      if (!includeShared) return ownedAgencies || [];

      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select(`
          agency_id,
          agencies (
            id,
            name
          )
        `)
        .eq("accessing_tenant_id", tenantId);
      if (sharedError) throw sharedError;

      const sharedAgencies = (sharedAccess || [])
        .map((row: any) => (Array.isArray(row.agencies) ? row.agencies[0] : row.agencies))
        .filter(Boolean)
        .map((agency: any) => ({ id: agency.id, name: agency.name }));

      const mergedAgencies = [...(ownedAgencies || []), ...sharedAgencies].filter(
        (agency, index, arr) => arr.findIndex((item) => item.id === agency.id) === index
      );

      return mergedAgencies.sort((a, b) => a.name.localeCompare(b.name, "he"));
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}
