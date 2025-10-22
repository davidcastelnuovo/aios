import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useManagedAgencies() {
  const { userId, isAgencyManager } = useUserRole();

  const { data: managedAgencies, isLoading } = useQuery({
    queryKey: ["managed-agencies", userId],
    queryFn: async () => {
      if (!userId || !isAgencyManager) return [];

      const { data, error } = await supabase
        .from("user_managed_agencies")
        .select(`
          agency_id,
          agencies (
            id,
            name
          )
        `)
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching managed agencies:", error);
        return [];
      }

      return data?.map(item => item.agencies).filter(Boolean) || [];
    },
    enabled: !!userId && isAgencyManager,
  });

  return {
    managedAgencies: managedAgencies || [],
    isLoading,
  };
}
