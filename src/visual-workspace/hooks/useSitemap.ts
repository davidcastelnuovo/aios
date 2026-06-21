import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import {
  MENU_TABS, SUB_MODULES, INTEGRATION_SETTINGS, ORPHAN_MODULES,
  MenuModule, MenuTab, MenuTabId,
  buildParentMenuKey, parseParentMenuKey,
} from "@/lib/menuStructure";
import { toast } from "sonner";

export type SitemapNode = {
  module: MenuModule;
  /** sub-modules that hang off this module (settings pages, sub-pages) */
  children: MenuModule[];
  hidden: boolean;
  customLabel: string | null;
};

export type SitemapColumn = {
  id: string;             // tab:<tabId>:<sectionLabel>  OR special: "orphans" / "hidden"
  tabId: MenuTabId | null;
  tabLabel: string;
  sectionLabel: string;
  customSectionLabel: string | null;
  customTabLabel: string | null;
  modules: SitemapNode[];
  isSpecial?: "orphans" | "hidden";
};

export function useSitemap() {
  const { tenantId } = useCurrentTenant();
  const { menuItems } = useMenuItems();
  const qc = useQueryClient();

  const data = useMemo(() => buildSitemap(menuItems), [menuItems]);

  const upsertOverride = useMutation({
    mutationFn: async (input: {
      menu_key: string;
      original_label: string;
      route: string;
      patch: Partial<Pick<MenuItem, "custom_label" | "is_visible" | "sort_order" | "parent_menu_key" | "icon">>;
    }) => {
      if (!tenantId) throw new Error("No tenant");
      const existing = menuItems.find(m => m.menu_key === input.menu_key);
      if (existing) {
        const { error } = await supabase
          .from("menu_items")
          .update({ ...input.patch, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert({
          tenant_id: tenantId,
          menu_key: input.menu_key,
          original_label: input.original_label,
          route: input.route,
          is_visible: true,
          sort_order: 0,
          ...input.patch,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-items", tenantId] });
    },
    onError: (err: any) => {
      toast.error("שגיאה בשמירת השינוי", { description: err?.message });
    },
  });

  return {
    columns: data.columns,
    overlay: data.overlay,
    isReady: !!tenantId,
    renameSection: (tabId: MenuTabId, sectionLabel: string, newLabel: string) =>
      upsertOverride.mutateAsync({
        menu_key: `section:${tabId}:${sectionLabel}`,
        original_label: sectionLabel,
        route: "#",
        patch: { custom_label: newLabel.trim() || null },
      }),
    renameTab: (tabId: MenuTabId, newLabel: string) =>
      upsertOverride.mutateAsync({
        menu_key: `tab:${tabId}`,
        original_label: tabId,
        route: "#",
        patch: { custom_label: newLabel.trim() || null },
      }),
    renameModule: (mod: MenuModule, newLabel: string) =>
      upsertOverride.mutateAsync({
        menu_key: mod.key,
        original_label: mod.label,
        route: mod.route,
        patch: { custom_label: newLabel.trim() || null },
      }),
    moveModule: (mod: MenuModule, target: { tabId: MenuTabId; sectionLabel: string } | null) =>
      upsertOverride.mutateAsync({
        menu_key: mod.key,
        original_label: mod.label,
        route: mod.route,
        patch: {
          parent_menu_key: target ? buildParentMenuKey(target.tabId, target.sectionLabel) : null,
        },
      }),
    toggleVisibility: (mod: MenuModule, current: boolean) =>
      upsertOverride.mutateAsync({
        menu_key: mod.key,
        original_label: mod.label,
        route: mod.route,
        patch: { is_visible: !current },
      }),
  };
}

/** Pure reducer used by both hook and sidebar overlay. */
export function buildSitemap(menuItems: MenuItem[]): {
  columns: SitemapColumn[];
  /** Overlay map for AppSidebar consumption. */
  overlay: SidebarOverlay;
} {
  // 1. Index overrides by key
  const itemByKey = new Map<string, MenuItem>();
  for (const m of menuItems) itemByKey.set(m.menu_key, m);

  // 2. Map sub-modules / integration settings by parent
  const childrenByParent = new Map<string, MenuModule[]>();
  for (const sub of [...SUB_MODULES, ...INTEGRATION_SETTINGS]) {
    const arr = childrenByParent.get(sub.parentKey) || [];
    arr.push(sub);
    childrenByParent.set(sub.parentKey, arr);
  }

  // 3. For each tab+section, gather default modules, then apply re-parent overrides
  type CK = string;
  const moduleHomeOverrides = new Map<string, { tabId: MenuTabId; sectionLabel: string }>();
  for (const m of menuItems) {
    const parsed = parseParentMenuKey(m.parent_menu_key);
    if (parsed) moduleHomeOverrides.set(m.menu_key, parsed);
  }

  const columnsMap = new Map<CK, SitemapColumn>();
  const ensureColumn = (tab: MenuTab, sectionLabel: string): SitemapColumn => {
    const id = `tab:${tab.id}:${sectionLabel}`;
    let col = columnsMap.get(id);
    if (!col) {
      col = {
        id,
        tabId: tab.id,
        tabLabel: tab.label,
        sectionLabel,
        customSectionLabel: itemByKey.get(`section:${tab.id}:${sectionLabel}`)?.custom_label || null,
        customTabLabel: itemByKey.get(`tab:${tab.id}`)?.custom_label || null,
        modules: [],
      };
      columnsMap.set(id, col);
    }
    return col;
  };

  const seenModuleKeys = new Set<string>();

  // Populate default columns
  for (const tab of MENU_TABS) {
    for (const section of tab.sections) {
      ensureColumn(tab, section.label);
      for (const mod of section.items) {
        const override = moduleHomeOverrides.get(mod.key);
        if (override) continue; // moved elsewhere — handled below
        const col = ensureColumn(tab, section.label);
        col.modules.push(buildNode(mod, itemByKey, childrenByParent));
        seenModuleKeys.add(mod.key);
      }
    }
  }

  // Apply overrides — place modules in their target column even if section/tab is new
  for (const [moduleKey, target] of moduleHomeOverrides) {
    // find the original module def from MENU_TABS
    const mod = findModuleByKey(moduleKey);
    if (!mod) continue;
    const targetTab = MENU_TABS.find(t => t.id === target.tabId);
    if (!targetTab) continue;
    const col = ensureColumn(targetTab, target.sectionLabel);
    col.modules.push(buildNode(mod, itemByKey, childrenByParent));
    seenModuleKeys.add(moduleKey);
  }

  // Sort modules in each column by sort_order override
  for (const col of columnsMap.values()) {
    col.modules.sort((a, b) => {
      const sa = itemByKey.get(a.module.key)?.sort_order ?? 100;
      const sb = itemByKey.get(b.module.key)?.sort_order ?? 100;
      return sa - sb;
    });
  }

  // Special columns
  const hiddenCol: SitemapColumn = {
    id: "hidden",
    tabId: null,
    tabLabel: "מוסתר",
    sectionLabel: "לא בשימוש",
    customSectionLabel: null,
    customTabLabel: null,
    modules: [],
    isSpecial: "hidden",
  };
  const orphanCol: SitemapColumn = {
    id: "orphans",
    tabId: null,
    tabLabel: "אחר",
    sectionLabel: "אין דרך ישירה",
    customSectionLabel: null,
    customTabLabel: null,
    modules: [],
    isSpecial: "orphans",
  };

  // Move hidden modules across all columns into the hidden column (still showing in workspace)
  for (const col of columnsMap.values()) {
    col.modules = col.modules.filter(node => {
      if (node.hidden) {
        hiddenCol.modules.push(node);
        return false;
      }
      return true;
    });
  }

  // Orphans: explicit list
  for (const o of ORPHAN_MODULES) {
    if (seenModuleKeys.has(o.key)) continue;
    orphanCol.modules.push(buildNode(o, itemByKey, childrenByParent));
  }

  const columns = [...columnsMap.values(), orphanCol, hiddenCol];

  // Sidebar overlay: precompute the same data so AppSidebar can render the effective tabs
  const overlay = computeSidebarOverlay(menuItems);

  return { columns, overlay };
}

function buildNode(
  mod: MenuModule,
  itemByKey: Map<string, MenuItem>,
  childrenByParent: Map<string, MenuModule[]>
): SitemapNode {
  const item = itemByKey.get(mod.key);
  return {
    module: mod,
    children: childrenByParent.get(mod.key) || [],
    hidden: item ? !item.is_visible : false,
    customLabel: item?.custom_label || null,
  };
}

function findModuleByKey(key: string): MenuModule | null {
  for (const tab of MENU_TABS) {
    for (const section of tab.sections) {
      const m = section.items.find(i => i.key === key);
      if (m) return m;
    }
  }
  return null;
}

// ─── Sidebar overlay ─────────────────────────────────────────────────────────
export type SidebarOverlay = {
  tabLabels: Map<MenuTabId, string>;
  sectionLabels: Map<string, string>; // key = `${tabId}:${sectionLabel}`
  /** module key → effective placement (or null = removed from default home) */
  moduleHome: Map<string, { tabId: MenuTabId; sectionLabel: string }>;
};

export function computeSidebarOverlay(menuItems: MenuItem[]): SidebarOverlay {
  const tabLabels = new Map<MenuTabId, string>();
  const sectionLabels = new Map<string, string>();
  const moduleHome = new Map<string, { tabId: MenuTabId; sectionLabel: string }>();

  for (const m of menuItems) {
    if (m.menu_key.startsWith("tab:") && !m.menu_key.includes(":", 4) && m.custom_label) {
      tabLabels.set(m.menu_key.slice(4) as MenuTabId, m.custom_label);
    } else if (m.menu_key.startsWith("section:") && m.custom_label) {
      const rest = m.menu_key.slice(8);
      sectionLabels.set(rest, m.custom_label);
    } else {
      const parsed = parseParentMenuKey(m.parent_menu_key);
      if (parsed) moduleHome.set(m.menu_key, parsed);
    }
  }
  return { tabLabels, sectionLabels, moduleHome };
}
