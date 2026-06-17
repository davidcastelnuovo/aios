import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Bot, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const CARMEN_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-agents-avatar_17945787.png";

export interface AgentListItem {
  id: string;
  name: string;
  active: boolean;
  engine: string | null;
}

interface Props {
  agents: AgentListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function isCarmen(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

export function AgentSidebar({ agents, selectedId, onSelect, onCreate }: Props) {
  // Sort: Carmen first, then by name
  const sorted = [...agents].sort((a, b) => {
    const ac = isCarmen(a.name) ? 0 : 1;
    const bc = isCarmen(b.name) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.name.localeCompare(b.name, "he");
  });

  return (
    <aside className="w-full md:w-64 shrink-0 md:border-l bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={onCreate} className="w-full" size="sm">
          <Plus className="h-4 w-4 me-1" /> סוכן חדש
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sorted.map(a => {
            const carmen = isCarmen(a.name);
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md p-2 text-right text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {carmen ? (
                  <img src={CARMEN_AVATAR} alt="כרמן" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <span className="flex-1 truncate">{a.name}</span>
                {carmen && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                {!a.active && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">כבוי</Badge>
                )}
              </button>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">אין סוכנים</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
