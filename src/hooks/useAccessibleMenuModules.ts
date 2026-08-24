import { useMemo } from "react";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  MENU_TABS,
  permissionForMenuKey,
  type MenuModule,
  type MenuTabId,
} from "@/lib/menuStructure";

export type AccessibleMenuGroup = {
  id: MenuTabId;
  label: string;
  modules: MenuModule[];
};

export function useAccessibleMenuModules() {
  const { menuItems, isLoading: menuLoading } = useMenuItems();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  const groups = useMemo<AccessibleMenuGroup[]>(() => {
    const dbByKey = new Map(menuItems.map((item) => [item.menu_key, item]));

    return MENU_TABS.map((tab) => {
      const modules = tab.sections.flatMap((section) => section.items)
        .filter((module) => {
          const configured = dbByKey.get(module.key);
          if (configured && !configured.is_visible) return false;
          if (module.key === "my-profile") return true;
          return hasPermission(permissionForMenuKey(module.key));
        })
        .map((module) => ({
          ...module,
          label: dbByKey.get(module.key)?.custom_label || module.label,
        }));

      return {
        id: tab.id,
        label: dbByKey.get(`tab:${tab.id}`)?.custom_label || tab.label,
        modules,
      };
    }).filter((group) => group.modules.length > 0);
  }, [menuItems, hasPermission]);

  return {
    groups,
    modules: groups.flatMap((group) => group.modules),
    isLoading: menuLoading || permissionsLoading,
  };
}

