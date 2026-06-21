import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModuleCard } from "./ModuleCard";
import type { SitemapColumn, SitemapNode } from "../hooks/useSitemap";
import type { MenuModule, MenuTabId } from "@/lib/menuStructure";

type Props = {
  column: SitemapColumn;
  onRenameSection: (newLabel: string) => void;
  onRenameTab: (newLabel: string) => void;
  onRenameModule: (mod: MenuModule, newLabel: string) => void;
  onToggleModuleVisibility: (mod: MenuModule, current: boolean) => void;
};

export function CategoryColumn({
  column,
  onRenameSection,
  onRenameTab,
  onRenameModule,
  onToggleModuleVisibility,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: column.tabId
      ? { type: "section", tabId: column.tabId, sectionLabel: column.sectionLabel }
      : { type: "special", kind: column.isSpecial },
  });

  const [editingSection, setEditingSection] = useState(false);
  const [draftSection, setDraftSection] = useState("");
  const sectionLabel = column.customSectionLabel || column.sectionLabel;
  const tabLabel = column.customTabLabel || column.tabLabel;

  return (
    <div
      ref={setNodeRef}
      data-column-id={column.id}
      className={cn(
        "flex flex-col rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "bg-primary/10 border-primary",
      )}
      dir="rtl"
      style={{ minWidth: 180 }}
    >
      {/* Tab badge */}
      {!column.isSpecial && (
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-0.5">
          {tabLabel}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-1 mb-2 group">
        {editingSection && !column.isSpecial ? (
          <>
            <input
              autoFocus
              value={draftSection}
              onChange={e => setDraftSection(e.target.value)}
              className="flex-1 text-sm font-bold bg-background border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={e => {
                if (e.key === "Enter") { onRenameSection(draftSection); setEditingSection(false); }
                if (e.key === "Escape") setEditingSection(false);
              }}
            />
            <button
              onClick={() => { onRenameSection(draftSection); setEditingSection(false); }}
              className="text-emerald-600 hover:text-emerald-700"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditingSection(false)} className="text-rose-600 hover:text-rose-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <h3 className={cn(
              "flex-1 text-sm font-bold truncate",
              column.isSpecial === "orphans" && "text-amber-600",
              column.isSpecial === "hidden" && "text-muted-foreground",
            )}>
              {sectionLabel}
              <span className="mr-1 text-[10px] font-normal text-muted-foreground">
                ({column.modules.length})
              </span>
            </h3>
            {!column.isSpecial && (
              <button
                onClick={() => { setDraftSection(sectionLabel); setEditingSection(true); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                title="ערוך שם קטגוריה"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 min-h-[40px]">
        {column.modules.map(node => (
          <CardWithChildren
            key={node.module.key}
            node={node}
            columnId={column.id}
            onRename={(newLabel) => onRenameModule(node.module, newLabel)}
            onToggleVisibility={() => onToggleModuleVisibility(node.module, !node.hidden)}
          />
        ))}
        {column.modules.length === 0 && (
          <div className="text-[11px] text-muted-foreground/60 text-center py-2 italic">
            גרור לכאן מודול
          </div>
        )}
      </div>
    </div>
  );
}

function CardWithChildren({
  node, columnId, onRename, onToggleVisibility,
}: { node: SitemapNode; columnId: string; onRename: (l: string) => void; onToggleVisibility: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col">
      {renaming ? (
        <div className="flex items-center gap-1 px-1.5 py-1 bg-card border rounded-md" style={{ width: 148 }}>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none"
            onKeyDown={e => {
              if (e.key === "Enter") { onRename(draft); setRenaming(false); }
              if (e.key === "Escape") setRenaming(false);
            }}
          />
          <button onClick={() => { onRename(draft); setRenaming(false); }} className="text-emerald-600">
            <Check className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <ModuleCard
          node={node}
          cardId={`${columnId}::${node.module.key}`}
          onRename={() => { setDraft(node.customLabel || node.module.label); setRenaming(true); }}
          onToggleVisibility={onToggleVisibility}
        />
      )}
      {node.children.length > 0 && (
        <div className="mr-3 mt-0.5 flex flex-col gap-0.5 border-r border-dashed border-muted-foreground/30 pr-2">
          {node.children.map(child => {
            const ChildIcon = child.icon;
            return (
              <div
                key={child.key}
                className="flex items-center gap-1 text-[10px] text-muted-foreground"
                title={child.route}
              >
                <ChildIcon className="h-2.5 w-2.5" />
                <span className="truncate">{child.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
