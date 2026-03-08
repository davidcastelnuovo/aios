import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { useUserRole } from "./useUserRole";

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
  | "recordings" // Recordings management
  | "team_chat" // Team internal communication
  | "signatures" // Digital signatures
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

  // Removed realtime subscription to reduce DB connection pressure.
  // Permissions are cached and will refresh on page reload or after staleTime.

  const hasPermission = (module: ModulePermission): boolean => {
    // While loading or user unknown, do NOT allow (prevents leaks)
    if (isLoading) {
      console.log(`[hasPermission] ${module}: LOADING - returning false`);
      return false;
    }

    // Super admins can access all modules in the UI
    if (isSuperAdmin) {
      console.log(`[hasPermission] ${module}: isSuperAdmin - returning true`);
      return true;
    }

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
      "ai_support",
    ];

    // Owners always see these admin modules in the UI
    if ((module === "tenants" || module === "menu_management" || module === "fields_management" || module === "ai_support") && isOwner) {
      console.log(`[hasPermission] ${module}: isOwner override - returning true`);
      return true;
    }

    if (restrictedModules.includes(module)) {
      return permissions?.[module] === true;
    }

    // Modules accessible to ALL authenticated org members regardless of permissions
    const alwaysAccessibleModules: ModulePermission[] = ["team_chat", "settings"];

    if (alwaysAccessibleModules.includes(module)) {
      return true;
    }

    // If user has no permissions defined at all:
    // - Owners get full access to non-restricted modules
    // - Regular users only get access to their profile
    if (!hasAnyPermissions) {
      if (isOwner) return true;
      // Only allow access to profile for users without explicit permissions
      return false;
    }

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
