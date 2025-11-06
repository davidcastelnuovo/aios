import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Hook to check if the current user owns a specific agency
 * This determines if they can edit financial fields
 */
export function useAgencyOwnership(agencyId: string | undefined) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["agency-ownership", agencyId, user?.id],
    queryFn: async () => {
      if (!agencyId || !user?.id) return false;

      const { data, error } = await supabase
        .rpc("user_owns_agency", {
          _user_id: user.id,
          _agency_id: agencyId,
        });

      if (error) {
        console.error("Error checking agency ownership:", error);
        return false;
      }

      return data || false;
    },
    enabled: !!agencyId && !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
