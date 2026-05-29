import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Layer = "working" | "episodic" | "semantic" | "user_model";

const LAYER_META: Record<Layer, { label: string; cls: string }> = {
  working:    { label: "Working",    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  episodic:   { label: "Episodic",   cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  semantic:   { label: "Semantic",   cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40" },
  user_model: { label: "User-Model", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
};

export function MemoryLayersPanel({ agentId }: { agentId: string }) {
  const [active, setActive] = useState<Layer | null>(null);
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState("");

  const { data: counts } = useQuery({
    queryKey: ["memory-layer-counts", agentId],
    queryFn: async () => {
      const out: Record<string, number> = { working: 0, episodic: 0, semantic: 0, user_model: 0 };
      for (const layer of Object.keys(out) as Layer[]) {
        const { count } = await supabase
          .from("agent_memory" as any)
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .eq("memory_type", layer);
        out[layer] = count ?? 0;
      }
      return out;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["memory-layer-items", agentId, active, search, contact],
    enabled: !!active,
    queryFn: async () => {
      let q: any = supabase
        .from("agent_memory" as any)
        .select("id, title, summary, importance, created_at, contact_phone, memory_type")
        .eq("agent_id", agentId)
        .eq("memory_type", active)
        .order("created_at", { ascending: false })
        .limit(100);
      if (contact.trim()) q = q.ilike("contact_phone", `%${contact.trim()}%`);
      if (search.trim()) q = q.textSearch("fts", search.trim(), { type: "websearch", config: "simple" });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">שכבות זיכרון</span>
        <div className="flex-1" />
        {(Object.keys(LAYER_META) as Layer[]).map((l) => (
          <button
            key={l}
            onClick={() => setActive(active === l ? null : l)}
            className={cn(
              "text-xs px-2 py-1 rounded-md border transition",
              LAYER_META[l].cls,
              active === l && "ring-2 ring-offset-1 ring-primary"
            )}
          >
            {LAYER_META[l].label} · {counts?.[l] ?? 0}
          </button>
        ))}
      </div>

      {active && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש טקסט מלא..." className="pr-8 h-8 text-sm" />
            </div>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="טלפון" className="w-40 h-8 text-sm" dir="ltr" />
            <Button size="sm" variant="ghost" onClick={() => setActive(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-72">
            <div className="space-y-1.5 pl-2">
              {isLoading && <p className="text-xs text-muted-foreground">טוען...</p>}
              {!isLoading && items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">אין תוצאות</p>}
              {items.map((m: any) => (
                <div key={m.id} className="p-2 rounded border bg-card text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px]", LAYER_META[m.memory_type as Layer]?.cls)}>
                      {LAYER_META[m.memory_type as Layer]?.label ?? m.memory_type}
                    </Badge>
                    <span className="font-medium truncate">{m.title || "(ללא כותרת)"}</span>
                    {m.contact_phone && <span className="text-xs text-muted-foreground" dir="ltr">{m.contact_phone}</span>}
                  </div>
                  {m.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.summary}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
