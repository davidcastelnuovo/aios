import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useTenant } from "@/contexts/TenantContext";

export function useUserAgencies() {
  const { isOwner, isTeamManager, isCampaigner, isSalesPerson, userId, salesPersonAgencyIds, campaignerId } = useUserRole();
  const { currentTenantId } = useTenant();

  const { data: userAgencyIds, isLoading } = useQuery({
    queryKey: ["user-agency-ids", userId, currentTenantId, isOwner, isTeamManager, isCampaigner, isSalesPerson, campaignerId],
    queryFn: async () => {
      if (isOwner) {
        return null; // null means "all agencies"
      }

      if (!userId || !currentTenantId) {
        return [];
      }

      const aggregated = new Set<string>();

      // 🔒 Sales Person: Filter agencies by current tenant
      if (isSalesPerson && salesPersonAgencyIds && salesPersonAgencyIds.length > 0) {
        const { data: filteredAgencies } = await supabase
          .from("agencies")
          .select("id")
          .in("id", salesPersonAgencyIds)
          .eq("tenant_id", currentTenantId);
        
        filteredAgencies?.forEach((a) => aggregated.add(a.id));
      }

      // 🔒 Campaigner: Filter agencies by current tenant with JOIN
      if (isCampaigner) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.campaigner_id) {
          const { data: agencyLinks, error } = await supabase
            .from("campaigner_agencies")
            .select("agency_id, agencies!inner(tenant_id)")
            .eq("campaigner_id", profile.campaigner_id)
            .eq("agencies.tenant_id", currentTenantId);

          if (error) throw error;
          agencyLinks?.forEach((l) => aggregated.add(l.agency_id));
        }
      }

      // 🔒 Team Manager: Filter agencies by current tenant with JOIN
      if (isTeamManager) {
        const { data: managed, error: managedErr } = await supabase
          .from("user_managed_agencies")
          .select("agency_id, agencies!inner(tenant_id)")
          .eq("user_id", userId)
          .eq("agencies.tenant_id", currentTenantId);

        if (managedErr) throw managedErr;
        managed?.forEach((m) => aggregated.add(m.agency_id));
      }

      // 🔒 Shared agencies: Use currentTenantId directly from URL
      const { data: sharedAgencies, error: sharedErr } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", currentTenantId);

      if (sharedErr) throw sharedErr;
      sharedAgencies?.forEach((s) => aggregated.add(s.agency_id));

      return Array.from(aggregated);
    },
    enabled: !!userId && !!currentTenantId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    userAgencyIds,
    isLoading,
  };
}
