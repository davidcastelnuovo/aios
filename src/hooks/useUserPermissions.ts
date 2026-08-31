import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

/**
 * ModulePermission
 * ─────────────────────────────────────────────────────────────────────────────
 * ה-catalog נגזר ממבנה התפריט (menuStructure.ts → modules.ts), לכן הטיפוס הוא
 * string — אין צורך לתחזק כאן union ידני כשמוסיפים מודול.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type ModulePermission = string;

export function useUserPermissions() {
  const { isOwner, isSuperAdmin, isCampaigner, isTeamManager, isAgencyOwner, userId } = useUserRole();
  // Mirror Clients/DynamicTables: team managers and agency owners use daily modules
  // (recordings, clients, tasks) without a per-module row in user_permissions.
  const hasManagementAccess = isOwner || isTeamManager || isAgencyOwner;

  const {
    data: permissionsData,
    isPending: permissionsPending,
    isFetching: permissionsFetching,
    isError: permissionsError,
    isFetchedAfterMount: permissionsFetchedAfterMount,
  } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return { permissions: null, hasAnyPermissions: false };

      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, can_access")
        .eq("user_id", userId);

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
        hasAnyPermissions: !!data && data.length > 0,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // Block only on first load — keep using cached permissions during background refetch.
  const isLoading = !userId || permissionsPending;

  const hasPermission = (module: ModulePermission): boolean => {
    // While loading or user unknown, do NOT allow (prevents leaks)
    if (isLoading) return false;

    // Super admins can access all modules in the UI
    if (isSuperAdmin) return true;

    const { permissions, hasAnyPermissions } = permissionsData || {
      permissions: null,
      hasAnyPermissions: false,
    };

    // ── מודולים שדורשים הרשאה מפורשת (גם לבעלים) ─────────────────────
    const restrictedModules: ModulePermission[] = [
      "sales_dashboard",
      "leads",
      "sales_people",
      "integrations",
      "lead_integrations",
      "automations",
      "tenants",
      "menu_management",
      "fields_management",
      "branding",
      "manychat_settings",
      "green_api_settings",
      "manus_wa_settings",
      "chat_integrations",
      "accounting_integrations",
      "ai_support",
    ];

    // ── בעלים תמיד רואים מודולי ניהול ────────────────────────────────
    if (
      hasManagementAccess &&
      (module === "tenants" ||
        module === "menu_management" ||
        module === "fields_management" ||
        module === "ai_support")
    ) {
      return true;
    }

    if (restrictedModules.includes(module)) {
      return permissions?.[module] === true;
    }

    // Campaigners need pulse dashboard access; row scope is enforced in DMMDashboard + RLS.
    if (isCampaigner && module === "crm_dashboard") return true;

    // ── מודולים נגישים לכל המשתמשים המאומתים ─────────────────────────
    const alwaysAccessibleModules: ModulePermission[] = [
      "team_chat",
      "settings",
      "reports",
    ];

    if (alwaysAccessibleModules.includes(module)) return true;

    // ── אם אין הרשאות מוגדרות כלל ────────────────────────────────────
    if (!hasAnyPermissions) {
      if (hasManagementAccess) return true;
      return false;
    }

    // ── בעלים / מנהלי צוות / בעלי סוכנות — מודולים לא-מוגבלים ─────────
    if (hasManagementAccess && !restrictedModules.includes(module)) return true;

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
    isFetching: permissionsFetching,
    isError: permissionsError,
    isReady: permissionsData !== undefined,
    isFetchedAfterMount: permissionsFetchedAfterMount,
    isSuperAdmin,
    isOwner,
  };
}
