import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useUserAgencies() {
  const { isOwner, isTeamManager, isCampaigner, userId } = useUserRole();

  const { data: userAgencyIds, isLoading } = useQuery({
    queryKey: ["user-agency-ids", userId, isOwner, isTeamManager, isCampaigner],
    queryFn: async () => {
      if (isOwner) {
        // Owners see all agencies
        return null; // null means "all agencies"
      }

      if (!userId) return [];

      const aggregated = new Set<string>();

      // Campaigner or Team Manager with campaigner_id: agencies via campaigner_agencies
      if (isCampaigner || isTeamManager) {
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

          if (error) {
            console.error("Error fetching campaigner agencies:", error);
            throw error;
          }

          agencyLinks?.forEach((l) => aggregated.add(l.agency_id));
        }
      }

      // Team Manager: also get agencies via user_managed_agencies
      if (isTeamManager) {
        const { data: managed, error: managedErr } = await supabase
          .from("user_managed_agencies")
          .select("agency_id")
          .eq("user_id", userId);

        if (managedErr) {
          console.error("Error fetching managed agencies:", managedErr);
          throw managedErr;
        }

        managed?.forEach((m) => aggregated.add(m.agency_id));
      }

      console.log("useUserAgencies result:", {
        userId,
        roles: { isOwner, isTeamManager, isCampaigner },
        agencyIds: Array.from(aggregated),
      });

      return Array.from(aggregated);
    },
    enabled: !!userId,
  });

  return {
    userAgencyIds,
    isLoading,
    isOwner,
  };
}
