import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
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
  const { user } = useCurrentUser();
  const { isOwner, isSuperAdmin } = useUserRole();

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
        hasAnyPermissions: !!data && data.length > 0,
      };
    },
    enabled: !!user?.id,
  });

  // Global loading: until we know the user id OR query finished
  const isLoading = !user?.id || queryLoading;

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
      isOwner &&
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

    // ── מודולים נגישים לכל המשתמשים המאומתים ─────────────────────────
    const alwaysAccessibleModules: ModulePermission[] = [
      "team_chat",
      "settings",
      "reports",
    ];

    if (alwaysAccessibleModules.includes(module)) return true;

    // ── אם אין הרשאות מוגדרות כלל ────────────────────────────────────
    if (!hasAnyPermissions) {
      if (isOwner) return true;
      return false;
    }

    // ── בעלים מקבלים גישה למודולים לא-מוגבלים ────────────────────────
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
