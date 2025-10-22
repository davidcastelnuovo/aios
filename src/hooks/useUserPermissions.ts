import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export type ModulePermission = 
  | "dashboard"
  | "clients"
  | "agencies"
  | "campaigners"
  | "suppliers"
  | "tasks"
  | "client_onboarding"
  | "time_tracking"
  | "finance"
  | "reports"
  | "finance_view"; // Special permission for viewing financial data

export function useUserPermissions() {
  const { user } = useCurrentUser();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, can_access")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching permissions:", error);
        throw error;
      }

      // Convert to a map for easy access
      const permissionsMap: Record<string, boolean> = {};
      data?.forEach((perm) => {
        permissionsMap[perm.module] = perm.can_access;
      });

      return permissionsMap;
    },
    enabled: !!user?.id,
  });

  const hasPermission = (module: ModulePermission): boolean => {
    // If no permissions are set, allow access by default (backwards compatibility)
    if (!permissions) return true;
    
    // If permission is explicitly set, use it
    if (permissions[module] !== undefined) {
      return permissions[module];
    }
    
    // Default to true if not explicitly set
    return true;
  };

  const canViewFinance = (): boolean => {
    return hasPermission("finance_view");
  };

  return {
    hasPermission,
    canViewFinance,
    isLoading,
  };
}
