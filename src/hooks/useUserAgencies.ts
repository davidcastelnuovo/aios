import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useUserAgencies() {
  const { isOwner, isTeamManager, isCampaigner, isSalesPerson, userId, salesPersonAgencyIds } = useUserRole();

  const { data: userAgencyIds, isLoading } = useQuery({
    queryKey: ["user-agency-ids", userId, isOwner, isTeamManager, isCampaigner, isSalesPerson],
    queryFn: async () => {
      console.log("🔍 useUserAgencies - Starting:", { userId, isOwner, isTeamManager, isCampaigner, isSalesPerson });
      
      if (isOwner) {
        console.log("✅ User is Owner - returning null (all agencies)");
        return null; // null means "all agencies"
      }

      if (!userId) {
        console.log("❌ No userId - returning empty array");
        return [];
      }

      const aggregated = new Set<string>();

      // Sales Person: use their assigned agencies from salesPersonAgencyIds
      if (isSalesPerson && salesPersonAgencyIds && salesPersonAgencyIds.length > 0) {
        console.log("🔍 Sales Person - using salesPersonAgencyIds:", salesPersonAgencyIds);
        salesPersonAgencyIds.forEach((id) => aggregated.add(id));
      }

      // Campaigner: agencies via campaigner_agencies (Team Managers use managed agencies only)
      if (isCampaigner && !isTeamManager) {
        console.log("🔍 Fetching profile for campaigner");
        const { data: profile } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .eq("id", userId)
          .maybeSingle();

        console.log("📋 Profile data:", profile);

        if (profile?.campaigner_id) {
          console.log("🔍 Fetching agencies for campaigner_id:", profile.campaigner_id);
          const { data: agencyLinks, error } = await supabase
            .from("campaigner_agencies")
            .select("agency_id")
            .eq("campaigner_id", profile.campaigner_id);

          if (error) {
            console.error("❌ Error fetching campaigner agencies:", error);
            throw error;
          }

          console.log("📋 Agency links found:", agencyLinks);
          agencyLinks?.forEach((l) => aggregated.add(l.agency_id));
        } else {
          console.log("⚠️ No campaigner_id found in profile");
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

      const finalAgencies = Array.from(aggregated);
      console.log("✅ useUserAgencies final result:", {
        userId,
        roles: { isOwner, isTeamManager, isCampaigner, isSalesPerson },
        agencyIds: finalAgencies,
        count: finalAgencies.length,
      });

      return finalAgencies;
    },
    enabled: !!userId,
  });

  return {
    userAgencyIds,
    isLoading,
  };
}
