import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useUserAgencies() {
  const { isOwner, isAgencyOwner, userId } = useUserRole();

  const { data: userAgencyIds, isLoading } = useQuery({
    queryKey: ["user-agency-ids", userId],
    queryFn: async () => {
      if (isOwner) {
        // Owners see all agencies
        return null; // null means "all agencies"
      }

      if (isAgencyOwner) {
        // Get current user's roles
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        const roles = userRoles?.map((r) => r.role) || [];
        const hasAgencyOwnerRole = roles.includes("agency_owner");

        if (hasAgencyOwnerRole) {
          // Get campaigner_id from profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("campaigner_id")
            .eq("id", userId)
            .maybeSingle();

          if (!profile?.campaigner_id) {
            console.log("No campaigner_id found for agency owner");
            return [];
          }

          // Get agencies through campaigner_agencies
          const { data: agencyLinks, error } = await supabase
            .from("campaigner_agencies")
            .select("agency_id")
            .eq("campaigner_id", profile.campaigner_id);

          if (error) {
            console.error("Error fetching user agencies:", error);
            throw error;
          }

          const agencyIds = agencyLinks?.map((link) => link.agency_id) || [];
          console.log("User agency IDs:", agencyIds);
          return agencyIds;
        }
      }

      return [];
    },
    enabled: !!userId,
  });

  return {
    userAgencyIds,
    isLoading,
    isOwner,
    isAgencyOwner,
  };
}
