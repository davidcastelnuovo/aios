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

  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return { permissions: null, hasAnyPermissions: false };

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

      return { 
        permissions: permissionsMap, 
        hasAnyPermissions: data && data.length > 0 
      };
    },
    enabled: !!user?.id,
  });

  const hasPermission = (module: ModulePermission): boolean => {
    // If still loading or no data, allow by default
    if (!permissionsData) return true;
    
    const { permissions, hasAnyPermissions } = permissionsData;
    
    // If user has no permissions defined at all, allow access (backwards compatibility)
    if (!hasAnyPermissions) return true;
    
    // If user has permissions defined, only allow access to explicitly granted modules
    // If permission is explicitly set to true, allow
    // If permission is explicitly set to false or not defined, deny
    return permissions[module] === true;
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
