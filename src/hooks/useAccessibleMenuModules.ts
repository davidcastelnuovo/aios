import { useMemo } from "react";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  MENU_TABS,
  permissionForMenuKey,
  type MenuModule,
  type MenuTabId,
} from "@/lib/menuStructure";
import { computeSidebarOverlay } from "@/visual-workspace/hooks/useSitemap";

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
    const overlay = computeSidebarOverlay(menuItems);
    const modulesByTab = new Map<MenuTabId, MenuModule[]>(
      MENU_TABS.map((tab) => [tab.id, []]),
    );

    for (const tab of MENU_TABS) {
      for (const module of tab.sections.flatMap((section) => section.items)) {
        const targetTabId = overlay.moduleHome.get(module.key)?.tabId || tab.id;
        if (!modulesByTab.has(targetTabId)) continue;
        const accessible = (() => {
          const configured = dbByKey.get(module.key);
          if (configured && !configured.is_visible) return false;
          if (module.key === "my-profile") return true;
          return hasPermission(permissionForMenuKey(module.key));
        })();
        if (!accessible) continue;
        modulesByTab.get(targetTabId)!.push({
          ...module,
          label: dbByKey.get(module.key)?.custom_label || module.label,
        });
      }
    }

    return MENU_TABS.map((tab) => {
      return {
        id: tab.id,
        label: overlay.tabLabels.get(tab.id) || tab.label,
        modules: modulesByTab.get(tab.id) || [],
      };
    }).filter((group) => group.modules.length > 0);
  }, [menuItems, hasPermission]);

  return {
    groups,
    modules: groups.flatMap((group) => group.modules),
    isLoading: menuLoading || permissionsLoading,
  };
}

