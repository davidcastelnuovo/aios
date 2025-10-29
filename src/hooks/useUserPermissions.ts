import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { useUserRole } from "./useUserRole";
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
  | "users" // Access to user management
  | "sales_dashboard" // Sales dashboard
  | "leads" // Leads management
  | "sales_people" // Sales people management
  | "lead_integrations" // Lead integrations
  | "finance_view"; // Special permission for viewing financial data

export function useUserPermissions() {
  const { user } = useCurrentUser();
  const { isOwner } = useUserRole();
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

    // For sales-related modules, require an explicit allow flag in DB
    const salesModules: ModulePermission[] = [
      "sales_dashboard",
      "leads",
      "sales_people",
      "lead_integrations",
    ];
    if (salesModules.includes(module)) {
      return permissions?.[module] === true;
    }

    // If user has no permissions defined at all, only owners get full access
    if (!hasAnyPermissions) return isOwner;

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
