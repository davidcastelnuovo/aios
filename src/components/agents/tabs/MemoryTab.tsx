import { useState, useMemo } from "react";
import {
  useAgentMemory,
  useAgentMemoryTree,
  useCarmenMemoryTree,
  useCarmenMemoryPointers,
  useCarmenMemoryEpisodes,
  useDeleteAgentMemory,
  type MemoryItem,
  type MemoryTreeNode,
} from "@/hooks/useAgentMemory";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Search, Trash2,
  Users, MessageSquare, UserCog, Map, FileText, BookOpen, Brain, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { he } from "date-fns/locale";
import { MemoryLayersPanel } from "../MemoryLayersPanel";

const CATEGORY_META: Record<string, { icon: any; label: string }> = {
  clients: { icon: Users, label: "לקוחות" },
  conversations: { icon: MessageSquare, label: "שיחות" },
  team: { icon: UserCog, label: "צוות" },
  system_map: { icon: Map, label: "מפת מערכת" },
  episodes: { icon: BookOpen, label: "אפיזודים" },
  conversation: { icon: MessageSquare, label: "שיחה" },
  instruction: { icon: FileText, label: "הנחיה" },
  fact: { icon: FileText, label: "עובדה" },
  task: { icon: FileText, label: "משימה" },
  preference: { icon: FileText, label: "העדפה" },
  other: { icon: Folder, label: "אחר" },
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  updates: "עדכונים",
  assigned_clients: "לקוחות מוקצים",
  tasks: "משימות",
};

function isCarmenName(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

export function MemoryTab({ agent }: { agent: any }) {
  return (
    <div className="space-y-3">
      <MemoryLayersPanel agentId={agent.id} />
      {isCarmenName(agent.name)
        ? <CarmenMemoryLibrary />
        : <AgentMemoryLibrary agentId={agent.id} />}
    </div>
  );
}

// =========================================================================
// Carmen
// =========================================================================
function CarmenMemoryLibrary() {
  const { data, isLoading } = useCarmenMemoryTree();
  const tree = data?.tree ?? [];
  const episodesCount = data?.episodesCount ?? 0;

  const fullTree: MemoryTreeNode[] = useMemo(() => [
    ...tree,
    ...(episodesCount > 0 ? [{ category: "episodes", count: episodesCount, subcategories: [] }] : []),
  ], [tree, episodesCount]);

  const totalItems = fullTree.reduce((s, n) => s + n.count, 0);

  return (
    <Library
      title="ממלכת הזיכרון של כרמן"
      titleIcon={<Crown className="h-5 w-5 text-amber-500" />}
      tree={fullTree}
      totalItems={totalItems}
      isLoading={isLoading}
      useItems={useCarmenItems}
      canDelete={false}
    />
  );
}

function useCarmenItems(cat: string | null, sub: string | null | undefined) {
  const episodes = useCarmenMemoryEpisodes(cat === "episodes");
  const pointers = useCarmenMemoryPointers(cat ?? undefined, sub);
  if (cat === "episodes") {
    const items: MemoryItem[] = (episodes.data ?? []).map((e: any) => ({
      id: e.id,
      category: "episodes",
      subcategory: e.source_table,
      path: null,
      title: e.topic || "(ללא נושא)",
      summary: e.summary,
      importance: e.importance,
      ref_date: e.ref_date,
      created_at: e.created_at,
      metadata: { topic_tags: e.topic_tags, participants: e.participants, access_count: e.access_count },
    }));
    return { data: items, isLoading: episodes.isLoading };
  }
  return { data: pointers.data ?? [], isLoading: pointers.isLoading };
}

// =========================================================================
// Other agents
// =========================================================================
function AgentMemoryLibrary({ agentId }: { agentId: string }) {
  const { data: tree = [], isLoading } = useAgentMemoryTree(agentId);
  const totalItems = tree.reduce((s, n) => s + n.count, 0);

  const useItems = (cat: string | null, sub: string | null | undefined) => {
    const q = useAgentMemory(agentId, cat ?? undefined, sub);
    return { data: q.data ?? [], isLoading: q.isLoading };
  };

  return (
    <Library
      title="זיכרון אוטומטי"
      titleIcon={<Brain className="h-5 w-5 text-primary" />}
      tree={tree}
      totalItems={totalItems}
      isLoading={isLoading}
      useItems={useItems}
      canDelete
      agentId={agentId}
      emptyHint="הזיכרון נבנה אוטומטית בסוף כל אינטראקציה."
    />
  );
}

// =========================================================================
// Shared library shell
// =========================================================================
interface LibraryProps {
  title: string;
  titleIcon: React.ReactNode;
  tree: MemoryTreeNode[];
  totalItems: number;
  isLoading: boolean;
  useItems: (cat: string | null, sub: string | null | undefined) => { data: MemoryItem[]; isLoading: boolean };
  canDelete: boolean;
  agentId?: string;
  emptyHint?: string;
}

function Library({ title, titleIcon, tree, totalItems, isLoading, useItems, canDelete, agentId, emptyHint }: LibraryProps) {
  // null = root summary; string with optional :sub selects folder
  const [selected, setSelected] = useState<{ category: string | null; subcategory: string | null | undefined }>({ category: null, subcategory: undefined });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<MemoryItem | null>(null);

  const toggle = (cat: string) => setExpanded(p => ({ ...p, [cat]: !p[cat] }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {titleIcon}
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{totalItems.toLocaleString()} פריטים</Badge>
        <Badge variant="outline">{tree.length} תיקיות</Badge>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-3 min-h-[520px]">
        {/* ========== Folder tree ========== */}
        <Card className="p-2 overflow-hidden flex flex-col">
          <ScrollArea className="h-[560px] pr-2">
            <button
              onClick={() => setSelected({ category: null, subcategory: undefined })}
              className={cn(
                "w-full flex items-center gap-2 rounded-md p-2 text-sm text-right transition-colors",
                selected.category === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="flex-1 text-right">סקירה</span>
              <Badge variant={selected.category === null ? "secondary" : "outline"} className="text-[10px] h-4">
                {totalItems}
              </Badge>
            </button>

            <div className="mt-1 space-y-0.5">
              {isLoading && <p className="text-xs text-muted-foreground p-2">טוען עץ...</p>}
              {tree.map(node => {
                const meta = CATEGORY_META[node.category] ?? CATEGORY_META.other;
                const Icon = meta.icon;
                const isOpen = expanded[node.category] ?? node.subcategories.length > 0;
                const isSelectedHere = selected.category === node.category && selected.subcategory === undefined;
                return (
                  <div key={node.category}>
                    <div className="flex items-center group">
                      {node.subcategories.length > 0 && (
                        <button onClick={() => toggle(node.category)} className="p-1 hover:bg-muted rounded">
                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      )}
                      <button
                        onClick={() => setSelected({ category: node.category, subcategory: undefined })}
                        className={cn(
                          "flex-1 flex items-center gap-2 rounded-md p-1.5 text-sm text-right transition-colors",
                          isSelectedHere ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          node.subcategories.length === 0 && "mr-5"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-right truncate">{meta.label}</span>
                        <Badge variant={isSelectedHere ? "secondary" : "outline"} className="text-[10px] h-4">
                          {node.count}
                        </Badge>
                      </button>
                    </div>
                    {isOpen && node.subcategories.map(sub => {
                      const isSel = selected.category === node.category && selected.subcategory === sub.name;
                      const subLabel = SUBCATEGORY_LABELS[sub.name] ?? sub.name;
                      return (
                        <button
                          key={sub.name}
                          onClick={() => setSelected({ category: node.category, subcategory: sub.name })}
                          className={cn(
                            "mr-6 w-[calc(100%-1.5rem)] flex items-center gap-2 rounded-md p-1.5 text-xs text-right transition-colors",
                            isSel ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <Folder className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 text-right truncate">{subLabel}</span>
                          <Badge variant={isSel ? "secondary" : "outline"} className="text-[10px] h-4">
                            {sub.count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* ========== Items panel ========== */}
        <div className="space-y-2 min-w-0">
          {selected.category === null ? (
            <OverviewPanel tree={tree} totalItems={totalItems} hint={emptyHint} />
          ) : (
            <ItemsPanel
              category={selected.category}
              subcategory={selected.subcategory}
              search={search}
              setSearch={setSearch}
              useItems={useItems}
              canDelete={canDelete}
              agentId={agentId}
              onOpenItem={setOpenItem}
            />
          )}
        </div>
      </div>

      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent className="max-w-2xl">
          {openItem && <ItemDetail item={openItem} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewPanel({ tree, totalItems, hint }: { tree: MemoryTreeNode[]; totalItems: number; hint?: string }) {
  return (
    <Card className="p-6">
      <div className="text-center space-y-3">
        <Brain className="h-12 w-12 mx-auto text-primary opacity-60" />
        <div>
          <p className="text-3xl font-bold">{totalItems.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">פריטי זיכרון מסודרים ב-{tree.length} תיקיות</p>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-6">
        {tree.map(n => {
          const meta = CATEGORY_META[n.category] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          return (
            <div key={n.category} className="flex items-center gap-2 p-2 rounded-md border">
              <Icon className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm">{meta.label}</span>
              <Badge variant="secondary">{n.count}</Badge>
            </div>
          );
        })}
        {tree.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground text-center py-6">אין זיכרונות עדיין.</p>
        )}
      </div>
    </Card>
  );
}

function ItemsPanel({
  category, subcategory, search, setSearch, useItems, canDelete, agentId, onOpenItem,
}: {
  category: string;
  subcategory: string | null | undefined;
  search: string;
  setSearch: (s: string) => void;
  useItems: LibraryProps["useItems"];
  canDelete: boolean;
  agentId?: string;
  onOpenItem: (i: MemoryItem) => void;
}) {
  const { data, isLoading } = useItems(category, subcategory);
  const del = useDeleteAgentMemory(agentId ?? null);

  const filtered = search
    ? data.filter(m => (m.title || "").includes(search) || (m.summary || "").includes(search))
    : data;

  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const subLabel = subcategory ? (SUBCATEGORY_LABELS[subcategory] ?? subcategory) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{meta.label}{subLabel && ` / ${subLabel}`}</h4>
        <Badge variant="secondary">{filtered.length}</Badge>
        <div className="flex-1" />
        <div className="relative w-56">
          <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש בתיקייה..."
            className="pr-8 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="h-[520px] pl-2">
        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
          {filtered.map(m => (
            <Card
              key={m.id}
              className="p-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => onOpenItem(m)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h5 className="text-sm font-medium truncate">{m.title}</h5>
                    {m.importance > 0 && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                        ★ {m.importance}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ms-auto whitespace-nowrap">
                      {m.ref_date
                        ? format(new Date(m.ref_date), "dd/MM/yy")
                        : formatDistanceToNow(new Date(m.created_at), { locale: he, addSuffix: true })}
                    </span>
                  </div>
                  {m.summary && <p className="text-xs text-muted-foreground line-clamp-2">{m.summary}</p>}
                </div>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); del.mutate(m.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "אין תוצאות לחיפוש" : "התיקייה ריקה"}
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

function ItemDetail({ item }: { item: MemoryItem }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{item.title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{item.category}</Badge>
          {item.subcategory && <Badge variant="secondary">{item.subcategory}</Badge>}
          <Badge>★ {item.importance}</Badge>
          {item.ref_date && (
            <Badge variant="outline">
              {format(new Date(item.ref_date), "dd/MM/yyyy")}
            </Badge>
          )}
        </div>
        {item.summary && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">סיכום</p>
            <p className="whitespace-pre-wrap">{item.summary}</p>
          </div>
        )}
        {item.path && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">נתיב</p>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">{item.path}</code>
          </div>
        )}
        {(item.entity_type || item.entity_id) && (
          <div className="flex gap-3 text-xs">
            {item.entity_type && <span><span className="text-muted-foreground">סוג:</span> {item.entity_type}</span>}
            {item.entity_id && <span><span className="text-muted-foreground">מזהה:</span> {item.entity_id}</span>}
          </div>
        )}
        {item.metadata && Object.keys(item.metadata).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">מטא-דאטה</summary>
            <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          </details>
        )}
        <p className="text-[10px] text-muted-foreground">
          נוצר {formatDistanceToNow(new Date(item.created_at), { locale: he, addSuffix: true })}
        </p>
      </div>
    </>
  );
}
