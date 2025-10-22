import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { useEffect } from "react";

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
  const queryClient = useQueryClient();

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

  // Real-time subscription for permission changes
  useEffect(() => {
    if (!user?.id) return;

    console.log("🔔 Setting up real-time permissions listener for user:", user.id);

    const channel = supabase
      .channel('user-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'user_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔄 Permission changed:", payload);
          // Invalidate and refetch permissions
          queryClient.invalidateQueries({ queryKey: ["user-permissions", user.id] });
        }
      )
      .subscribe();

    return () => {
      console.log("🔕 Cleaning up permissions listener");
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

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
