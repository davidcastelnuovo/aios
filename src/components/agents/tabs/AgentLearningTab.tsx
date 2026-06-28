import { CarmenInsights } from "@/pages/CarmenInsights";
import { useAgentMemory, useAgentMemoryTree, useDeleteAgentMemory, type MemoryItem, type MemoryTreeNode } from "@/hooks/useAgentMemory";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Search, Trash2,
  Users, MessageSquare, UserCog, Map, FileText, BookOpen, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { he } from "date-fns/locale";

// Learning & self-improvement tab for any agent.
// Carmen gets her full CarmenInsights view (sessions, episodes, pointers).
// Every other agent gets the generic AgentMemoryLibrary.

function isCarmenName(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

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

function AgentMemoryLibrary({ agentId }: { agentId: string }) {
  const { data: tree = [], isLoading } = useAgentMemoryTree(agentId);
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null | undefined>(undefined);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<MemoryItem | null>(null);
  const [search, setSearch] = useState("");
  const q = useAgentMemory(agentId, cat ?? undefined, sub);
  const del = useDeleteAgentMemory(agentId);

  const filtered = (q.data ?? []).filter((m) =>
    !search || [m.title, m.summary, m.entity_id].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const toggleCat = (c: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Brain className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (tree.length === 0) return (
    <div className="text-center py-12 text-muted-foreground" dir="rtl">
      <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>אין זיכרונות עדיין. הסוכן ילמד מהאינטראקציות שלו.</p>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]" dir="rtl">
      {/* Tree */}
      <Card className="w-56 shrink-0 overflow-auto p-2 space-y-0.5">
        <button
          className={cn("w-full text-right text-sm px-2 py-1.5 rounded hover:bg-muted", !cat && "bg-accent font-medium")}
          onClick={() => { setCat(null); setSub(undefined); }}
        >
          הכל
        </button>
        {(tree as MemoryTreeNode[]).map((node) => {
          const meta = CATEGORY_META[node.category] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          const expanded = expandedCats.has(node.category);
          return (
            <div key={node.category}>
              <button
                className={cn("w-full text-right text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center gap-1.5",
                  cat === node.category && !sub && "bg-accent font-medium")}
                onClick={() => { setCat(node.category); setSub(undefined); toggleCat(node.category); }}
              >
                {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{meta.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{node.count}</Badge>
              </button>
              {expanded && node.subcategories?.map((s) => (
                <button
                  key={s.subcategory ?? "__root__"}
                  className={cn("w-full text-right text-xs px-2 py-1 rounded hover:bg-muted pr-6",
                    cat === node.category && sub === s.subcategory && "bg-accent")}
                  onClick={() => { setCat(node.category); setSub(s.subcategory); }}
                >
                  {s.subcategory ?? "—"}
                  <Badge variant="outline" className="text-[9px] px-1 mr-1">{s.count}</Badge>
                </button>
              ))}
            </div>
          );
        })}
      </Card>

      {/* List */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="חיפוש בזיכרון..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1.5">
            {filtered.map((m) => (
              <Card
                key={m.id}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedItem(m)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title || m.entity_id}</p>
                    {m.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.summary}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {m.category && <Badge variant="outline" className="text-[10px]">{m.category}</Badge>}
                      {m.importance && <Badge variant="secondary" className="text-[10px]">⭐ {m.importance}</Badge>}
                      {m.created_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: he })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={(e) => { e.stopPropagation(); del.mutate(m.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">אין תוצאות</div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title || selectedItem?.entity_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {selectedItem?.summary && <p>{selectedItem.summary}</p>}
            {selectedItem?.ref_date && (
              <p className="text-muted-foreground text-xs">
                תאריך: {format(new Date(selectedItem.ref_date), "d MMM yyyy", { locale: he })}
              </p>
            )}
            {selectedItem?.metadata && (
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(selectedItem.metadata, null, 2)}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AgentLearningTab({ agent }: { agent: any }) {
  if (isCarmenName(agent.name)) {
    return <CarmenInsights />;
  }
  return (
    <div className="space-y-3" dir="rtl">
      <div className="text-right">
        <h2 className="text-lg font-semibold flex items-center gap-2 justify-end">
          <Brain className="h-5 w-5 text-purple-500" />למידה והתפתחות
        </h2>
        <p className="text-sm text-muted-foreground">זיכרונות שהסוכן צבר מאינטראקציות ומשימות</p>
      </div>
      <AgentMemoryLibrary agentId={agent.id} />
    </div>
  );
}
