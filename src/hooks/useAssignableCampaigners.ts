import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";

/**
 * Campaigners that can be assigned while working in the active organization:
 * campaigners owned by the organization plus campaigners attached to an agency
 * shared with it. RLS remains the final authority over the returned rows.
 */
export function useAssignableCampaigners(options?: { activeOnly?: boolean; enabled?: boolean }) {
  const { tenantId } = useCurrentTenant();
  const { crossTenantAgencyIds } = useCrossTenantAgencyIds();
  const activeOnly = options?.activeOnly ?? true;

  return useQuery({
    queryKey: [
      "assignable-campaigners",
      tenantId,
      crossTenantAgencyIds.join(","),
      activeOnly,
    ],
    queryFn: async () => {
      if (!tenantId) return [];

      let sharedCampaignerIds: string[] = [];
      if (crossTenantAgencyIds.length > 0) {
        const { data: agencyRows, error: agencyError } = await supabase
          .from("campaigner_agencies")
          .select("campaigner_id")
          .in("agency_id", crossTenantAgencyIds);
        if (agencyError) throw agencyError;

        sharedCampaignerIds = Array.from(
          new Set((agencyRows || []).map((row) => row.campaigner_id))
        );
      }

      let query = supabase
        .from("campaigners")
        .select("id, full_name, email, phone, active, tenant_id")
        .order("full_name");

      if (activeOnly) query = query.eq("active", true);

      query =
        sharedCampaignerIds.length > 0
          ? query.or(
              `tenant_id.eq.${tenantId},id.in.(${sharedCampaignerIds.join(",")})`
            )
          : query.eq("tenant_id", tenantId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && (options?.enabled ?? true),
  });
}
