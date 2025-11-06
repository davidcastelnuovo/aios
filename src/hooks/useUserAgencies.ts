import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useUserAgencies() {
  const { isOwner, isTeamManager, isCampaigner, isSalesPerson, userId, salesPersonAgencyIds, campaignerId } = useUserRole();

  const { data: userAgencyIds, isLoading } = useQuery({
    queryKey: ["user-agency-ids", userId, isOwner, isTeamManager, isCampaigner, isSalesPerson, campaignerId],
    queryFn: async () => {
      if (isOwner) {
        return null; // null means "all agencies"
      }

      if (!userId) {
        return [];
      }

      const aggregated = new Set<string>();

      // Sales Person: use their assigned agencies from salesPersonAgencyIds
      if (isSalesPerson && salesPersonAgencyIds && salesPersonAgencyIds.length > 0) {
        salesPersonAgencyIds.forEach((id) => aggregated.add(id));
      }

      // Campaigner: agencies via campaigner_agencies (Team Managers use managed agencies only)
      if (isCampaigner && !isTeamManager) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.campaigner_id) {
          const { data: agencyLinks, error } = await supabase
            .from("campaigner_agencies")
            .select("agency_id")
            .eq("campaigner_id", profile.campaigner_id);

          if (error) throw error;
          agencyLinks?.forEach((l) => aggregated.add(l.agency_id));
        }
      }

      // Team Manager: also get agencies via user_managed_agencies
      if (isTeamManager) {
        const { data: managed, error: managedErr } = await supabase
          .from("user_managed_agencies")
          .select("agency_id")
          .eq("user_id", userId);

        if (managedErr) throw managedErr;
        managed?.forEach((m) => aggregated.add(m.agency_id));
      }

      // Get shared agencies via agency_tenant_access
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (tenantData?.tenant_id) {
        const { data: sharedAgencies, error: sharedErr } = await supabase
          .from("agency_tenant_access")
          .select("agency_id")
          .eq("accessing_tenant_id", tenantData.tenant_id);

        if (sharedErr) throw sharedErr;
        sharedAgencies?.forEach((s) => aggregated.add(s.agency_id));
      }

      return Array.from(aggregated);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    userAgencyIds,
    isLoading,
  };
}
