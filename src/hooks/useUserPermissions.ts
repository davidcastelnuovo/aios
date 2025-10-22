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
  | "finance_view" // Special permission for viewing financial data
  | "users"; // Access to user management

export function useUserPermissions() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: permissionsData, isLoading: queryLoading } = useQuery({
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

      const permissionsMap: Record<string, boolean> = {};
      data?.forEach((perm) => {
        permissionsMap[perm.module] = perm.can_access;
      });

      return { 
        permissions: permissionsMap, 
        hasAnyPermissions: !!data && data.length > 0 
      };
    },
    enabled: !!user?.id,
  });

  // Global loading: until we know the user id OR query finished
  const isLoading = !user?.id || queryLoading;

  // Real-time subscription for permission changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-permissions", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const hasPermission = (module: ModulePermission): boolean => {
    // While loading or user unknown, do NOT allow (prevents leaks)
    if (isLoading) return false;

    const { permissions, hasAnyPermissions } = permissionsData || { permissions: null, hasAnyPermissions: false };

    // If user has no permissions defined at all, allow access (owner/backwards compat)
    if (!hasAnyPermissions) return true;

    return permissions?.[module] === true;
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
