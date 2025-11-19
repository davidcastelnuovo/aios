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
  | "finance_view" // Special permission for viewing financial data
  | "automations" // Automations management (admin only)
  | "tenants" // Tenant management (admin only)
  | "branding" // System branding and customization
  | "accounting" // Accounting integrations (admin only)
  | "ai_support" // AI Support chatbot
  | "menu_management" // Menu customization (owner only)
  | "fields_management" // Custom fields management (owner only)
  | "dynamic_tables" // Dynamic tables (owner only)
  | "chat" // Chat with clients via ManyChat
  | "products" // Products and services management
  | "manychat_settings" // ManyChat integration settings
  | "green_api_settings" // Green API WhatsApp integration settings
  | "chat_integrations" // Chat integrations settings
  | "accounting_integrations" // Accounting integrations
  | "settings"; // System settings

export function useUserPermissions() {
  const { user } = useCurrentUser();
  const { isOwner, isSuperAdmin } = useUserRole();
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

    // Super admins can access all modules in the UI
    if (isSuperAdmin) return true;

    const { permissions, hasAnyPermissions } = permissionsData || { permissions: null, hasAnyPermissions: false };

    // Modules requiring explicit allow unless owner override
    const restrictedModules: ModulePermission[] = [
      "sales_dashboard",
      "leads",
      "sales_people",
      "lead_integrations",
      "automations",
      "tenants",
      "menu_management",
      "fields_management",
      "branding",
      "manychat_settings",
      "green_api_settings",
      "chat_integrations",
      "accounting_integrations",
    ];

    // Owners always see these admin modules in the UI
    if ((module === "tenants" || module === "menu_management" || module === "fields_management") && isOwner) return true;

    if (restrictedModules.includes(module)) {
      return permissions?.[module] === true;
    }

    // If user has no permissions defined at all, owners get full access baseline
    if (!hasAnyPermissions) return isOwner;

    // Owners always get access to non-restricted modules, even if permission says false
    if (isOwner && !restrictedModules.includes(module)) return true;

    return permissions?.[module] === true;
  };

  const canViewFinance = (): boolean => {
    if (isSuperAdmin || isOwner) return true;
    return hasPermission("finance_view");
  };

  return {
    hasPermission,
    canViewFinance,
    isLoading,
  };
}
