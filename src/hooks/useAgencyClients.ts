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
 * Fetch agencies available in table-create/edit dialogs.
 *
 * Defaults to including cross-tenant shared agencies (via
 * `agency_tenant_access`) so MarketingCaptain can pick DMM-MC, etc.
 * Pass `includeShared: false` only when a dialog must stay tenant-local.
 */
export function useTableDialogAgencies(options?: {
  includeShared?: boolean;
  enabled?: boolean;
}) {
  const { tenantId } = useCurrentTenant();
  const includeShared = options?.includeShared ?? true;

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

      // 1) Which agencies are shared INTO this tenant?
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId);
      if (sharedError) throw sharedError;

      const sharedIds = Array.from(
        new Set(
          (sharedAccess || [])
            .map((row: any) => row.agency_id as string | null)
            .filter((id): id is string => !!id),
        ),
      ).filter((id) => !(ownedAgencies || []).some((a) => a.id === id));

      if (sharedIds.length === 0) {
        return (ownedAgencies || []).sort((a, b) => a.name.localeCompare(b.name, "he"));
      }

      // 2) Resolve names via agencies SELECT (requires shared-agency RLS for owners).
      //    Prefer a direct id filter over an embed — clearer when RLS blocks a row.
      const { data: sharedAgencies, error: sharedAgenciesError } = await supabase
        .from("agencies")
        .select("id, name")
        .in("id", sharedIds);
      if (sharedAgenciesError) throw sharedAgenciesError;

      const mergedAgencies = [...(ownedAgencies || []), ...(sharedAgencies || [])].filter(
        (agency, index, arr) => arr.findIndex((item) => item.id === agency.id) === index,
      );

      return mergedAgencies.sort((a, b) => a.name.localeCompare(b.name, "he"));
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}
