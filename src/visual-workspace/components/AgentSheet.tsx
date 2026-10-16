import type { AgentProfile } from "@/integrations/supabase/agentAccessClient";
import type { Tables } from "@/integrations/supabase/types";
import type { AgentRole } from "../types/visualWorkspaceTypes";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/agentAccessClient";
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
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [runs, setRuns] = useState<
    Pick<
      Tables<"agent_runs">,
      "id" | "status" | "started_at" | "completed_at"
    >[]
  >([]);
  const [actions, setActions] = useState<
    Pick<
      Tables<"agent_action_log">,
      "id" | "action_type" | "status" | "created_at"
    >[]
  >([]);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    const sb = supabase;
    Promise.all([
      sb.from("ai_agents").select("*").eq("id", agentId).maybeSingle(),
      sb
        .from("agent_runs")
        .select("id,status,started_at,completed_at")
        .eq("agent_id", agentId)
        .order("started_at", { ascending: false })
        .limit(5),
      sb
        .from("agent_action_log")
        .select("id,action_type,status,created_at")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([a, r, ac]) => {
      setAgent(a.data);
      setRuns(r.data ?? []);
      setActions(ac.data ?? []);
      setLoading(false);
    });
  }, [agentId]);

  const agentRole = agent && "role" in agent ? agent.role : undefined;
  const agentModel =
    agent && "model" in agent && typeof agent.model === "string"
      ? agent.model
      : undefined;
  const agentDescription =
    agent && "description" in agent && typeof agent.description === "string"
      ? agent.description
      : undefined;
  return (
    <Sheet open={!!agentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        dir="rtl"
        className="sm:max-w-lg bg-white/85 backdrop-blur-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {agent && (
              <AgentAvatar
                role={isAgentRole(agentRole) ? agentRole : "ceo"}
                state={agent.active ? "idle" : "waiting"}
                size={40}
              />
            )}
            {agent?.name || "טוען..."}
          </SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !agent ? null : (
          <ScrollArea className="h-[calc(100vh-100px)] pl-3 mt-3">
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {typeof agentRole === "string" ? agentRole : null}
                </Badge>
                {agentModel && <Badge variant="secondary">{agentModel}</Badge>}
                <Badge>{agent.active ? "פעיל" : "כבוי"}</Badge>
              </div>
              {agentDescription && (
                <p className="text-xs text-slate-600">{agentDescription}</p>
              )}

              <div>
                <div className="text-xs text-slate-500 mb-1">
                  5 ריצות אחרונות
                </div>
                {runs.length === 0 ? (
                  <p className="text-xs text-slate-400">אין ריצות</p>
                ) : (
                  <div className="space-y-1">
                    {runs.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-xs flex justify-between"
                      >
                        <span>
                          {r.started_at &&
                            format(new Date(r.started_at), "d MMM HH:mm", {
                              locale: he,
                            })}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">
                  5 פעולות אחרונות
                </div>
                {actions.length === 0 ? (
                  <p className="text-xs text-slate-400">אין פעולות</p>
                ) : (
                  <div className="space-y-1">
                    {actions.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-xs flex justify-between"
                      >
                        <span>{a.action_type}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {a.status}
                        </Badge>
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

function isAgentRole(role: unknown): role is AgentRole {
  return (
    role === "ceo" ||
    role === "marketing" ||
    role === "sales" ||
    role === "creative" ||
    role === "finance" ||
    role === "dev" ||
    role === "customer_success" ||
    role === "system"
  );
}
