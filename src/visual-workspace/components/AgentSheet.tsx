import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { AgentAvatar } from "./AgentAvatar";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  agentId: string | null;
  onClose: () => void;
}

export function AgentSheet({ agentId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    const sb = supabase as any;
    Promise.all([
      sb.from("ai_agents").select("*").eq("id", agentId).maybeSingle(),
      sb.from("agent_runs").select("id,status,started_at,completed_at").eq("agent_id", agentId).order("started_at", { ascending: false }).limit(5),
      sb.from("agent_action_log").select("id,action_type,status,created_at").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(5),
    ]).then(([a, r, ac]: any) => {
      setAgent(a.data);
      setRuns(r.data ?? []);
      setActions(ac.data ?? []);
      setLoading(false);
    });
  }, [agentId]);

  return (
    <Sheet open={!!agentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" dir="rtl" className="sm:max-w-lg bg-white/85 backdrop-blur-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {agent && <AgentAvatar role={(agent.role as any) || "ceo"} state={agent.active ? "idle" : "waiting"} size={40} />}
            {agent?.name || "טוען..."}
          </SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !agent ? null : (
          <ScrollArea className="h-[calc(100vh-100px)] pl-3 mt-3">
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{agent.role}</Badge>
                {agent.model && <Badge variant="secondary">{agent.model}</Badge>}
                <Badge>{agent.active ? "פעיל" : "כבוי"}</Badge>
              </div>
              {agent.description && <p className="text-xs text-slate-600">{agent.description}</p>}

              <div>
                <div className="text-xs text-slate-500 mb-1">5 ריצות אחרונות</div>
                {runs.length === 0 ? <p className="text-xs text-slate-400">אין ריצות</p> : (
                  <div className="space-y-1">
                    {runs.map((r: any) => (
                      <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs flex justify-between">
                        <span>{r.started_at && format(new Date(r.started_at), "d MMM HH:mm", { locale: he })}</span>
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">5 פעולות אחרונות</div>
                {actions.length === 0 ? <p className="text-xs text-slate-400">אין פעולות</p> : (
                  <div className="space-y-1">
                    {actions.map((a: any) => (
                      <div key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs flex justify-between">
                        <span>{a.action_type}</span>
                        <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
