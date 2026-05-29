import { useState } from "react";
import { useAgentMemory, useDeleteAgentMemory, useCarmenMemoryPointers } from "@/hooks/useAgentMemory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Trash2, Search, Crown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

function isCarmenName(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

export function MemoryTab({ agent }: { agent: any }) {
  const isCarmen = isCarmenName(agent.name);

  if (isCarmen) return <CarmenMemoryView />;
  return <AgentMemoryView agentId={agent.id} />;
}

function AgentMemoryView({ agentId }: { agentId: string }) {
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useAgentMemory(agentId, category === "all" ? undefined : category);
  const del = useDeleteAgentMemory(agentId);

  const filtered = data.filter(m =>
    !search || (m.title?.includes(search) || m.summary?.includes(search))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">זיכרון אוטומטי</h3>
        <Badge variant="secondary">{data.length} פריטים</Badge>
        <div className="flex-1" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            <SelectItem value="conversation">שיחות</SelectItem>
            <SelectItem value="instruction">הנחיות</SelectItem>
            <SelectItem value="fact">עובדות</SelectItem>
            <SelectItem value="task">משימות</SelectItem>
            <SelectItem value="preference">העדפות</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="חיפוש בזיכרון..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      <p className="text-xs text-muted-foreground">
        💡 הזיכרון נבנה אוטומטית בסוף כל אינטראקציה. הסוכן ישלוף את הזיכרונות הרלוונטיים בריצות הבאות.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      <div className="space-y-2 max-h-[500px] overflow-auto">
        {filtered.map(m => (
          <Card key={m.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">{m.title}</h4>
                  <Badge variant="outline" className="text-[10px] h-4">{m.category}</Badge>
                  <Badge variant="secondary" className="text-[10px] h-4">חשיבות {m.importance}</Badge>
                  <span className="text-xs text-muted-foreground mr-auto">
                    {formatDistanceToNow(new Date(m.created_at), { locale: he, addSuffix: true })}
                  </span>
                </div>
                {m.summary && <p className="text-sm text-muted-foreground">{m.summary}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(m.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">אין זיכרונות עדיין. הם ייווצרו אחרי האינטראקציה הבאה.</p>
        )}
      </div>
    </div>
  );
}

function CarmenMemoryView() {
  const { data = [], isLoading } = useCarmenMemoryPointers();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">ממלכת הידע של כרמן</h3>
        <Badge variant="secondary">{data.length} מצביעים</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        זיכרון כרמן מנוהל בנפרד דרך carmen_memory_pointers. תצוגה בלבד.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      <div className="space-y-2 max-h-[500px] overflow-auto">
        {(data as any[]).map(m => (
          <Card key={m.id} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{m.title}</h4>
              <Badge variant="outline" className="text-[10px] h-4">{m.category}</Badge>
              {m.subcategory && <Badge variant="secondary" className="text-[10px] h-4">{m.subcategory}</Badge>}
              <span className="text-xs text-muted-foreground mr-auto">{m.path}</span>
            </div>
            {m.summary && <p className="text-sm text-muted-foreground">{m.summary}</p>}
          </Card>
        ))}
        {!isLoading && data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">אין מצביעי זיכרון.</p>
        )}
      </div>
    </div>
  );
}
