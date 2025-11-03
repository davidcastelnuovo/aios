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
