import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useSitemap } from "../hooks/useSitemap";
import { CategoryColumn } from "./CategoryColumn";
import { MENU_TABS, type MenuTabId } from "@/lib/menuStructure";
import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SitemapTree() {
  const sitemap = useSitemap();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [editingTab, setEditingTab] = useState<MenuTabId | null>(null);
  const [draftTab, setDraftTab] = useState("");

  if (!sitemap.isReady) {
    return (
      <div className="p-6 grid grid-cols-3 gap-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  // Group columns by tab for visual structure
  const columnsByTab = new Map<string, typeof sitemap.columns>();
  for (const col of sitemap.columns) {
    const k = col.tabId ?? "_special";
    const arr = columnsByTab.get(k) || [];
    arr.push(col);
    columnsByTab.set(k, arr);
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const moduleKey = active.data.current?.moduleKey as string | undefined;
    if (!moduleKey) return;
    const overData = over.data.current as any;

    // Find the module def to send full info
    const node = sitemap.columns
      .flatMap(c => c.modules)
      .find(n => n.module.key === moduleKey);
    if (!node) return;

    if (overData?.type === "section") {
      sitemap.moveModule(node.module, { tabId: overData.tabId, sectionLabel: overData.sectionLabel });
    } else if (overData?.type === "special" && overData.kind === "hidden") {
      // hide it
      if (!node.hidden) sitemap.toggleVisibility(node.module, true);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="p-4 space-y-6" dir="rtl">
        {MENU_TABS.map(tab => {
          const cols = columnsByTab.get(tab.id) || [];
          const TabIcon = tab.icon;
          const tabLabel = cols[0]?.customTabLabel || tab.label;
          return (
            <div key={tab.id} className="space-y-2">
              <div className="flex items-center gap-2 group">
                <TabIcon className="h-5 w-5 text-primary" />
                {editingTab === tab.id ? (
                  <>
                    <input
                      autoFocus
                      value={draftTab}
                      onChange={e => setDraftTab(e.target.value)}
                      className="text-lg font-bold bg-background border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={e => {
                        if (e.key === "Enter") { sitemap.renameTab(tab.id, draftTab); setEditingTab(null); }
                        if (e.key === "Escape") setEditingTab(null);
                      }}
                    />
                    <button onClick={() => { sitemap.renameTab(tab.id, draftTab); setEditingTab(null); }} className="text-emerald-600">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingTab(null)} className="text-rose-600">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold">{tabLabel}</h2>
                    <button
                      onClick={() => { setDraftTab(tabLabel); setEditingTab(tab.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                      title="ערוך שם תפריט"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, minmax(180px, 1fr))` }}
              >
                {cols.map(col => (
                  <CategoryColumn
                    key={col.id}
                    column={col}
                    onRenameSection={(label) => sitemap.renameSection(tab.id, col.sectionLabel, label)}
                    onRenameTab={(label) => sitemap.renameTab(tab.id, label)}
                    onRenameModule={(mod, label) => sitemap.renameModule(mod, label)}
                    onToggleModuleVisibility={(mod, current) => sitemap.toggleVisibility(mod, current)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Special columns: orphans + hidden */}
        <div className="space-y-2 pt-4 border-t">
          <h2 className="text-lg font-bold text-muted-foreground">מחוץ לתפריט הראשי</h2>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {(columnsByTab.get("_special") || []).map(col => (
              <CategoryColumn
                key={col.id}
                column={col}
                onRenameSection={() => {}}
                onRenameTab={() => {}}
                onRenameModule={(mod, label) => sitemap.renameModule(mod, label)}
                onToggleModuleVisibility={(mod, current) => sitemap.toggleVisibility(mod, current)}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
