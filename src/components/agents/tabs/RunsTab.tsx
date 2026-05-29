import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Brain, Wrench, Eye, CheckCircle2, AlertCircle, Clock, Shield, RotateCw, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  running: { label: "רץ", color: "bg-blue-500/10 text-blue-700", icon: Activity },
  waiting_approval: { label: "ממתין לאישור", color: "bg-amber-500/10 text-amber-700", icon: Shield },
  completed: { label: "הסתיים", color: "bg-emerald-500/10 text-emerald-700", icon: CheckCircle2 },
  failed: { label: "נכשל", color: "bg-destructive/10 text-destructive", icon: AlertCircle },
  cancelled: { label: "בוטל", color: "bg-muted text-muted-foreground", icon: Clock },
};

const STEP_ICON: Record<string, any> = {
  plan: Brain,
  tool: Wrench,
  observation: Eye,
  approval_pending: Shield,
  reflection: Brain,
  final: CheckCircle2,
};

export function RunsTab({ agent }: { agent: any }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs = [] } = useQuery({
    queryKey: ["agent-runs", agent.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("agent_id", agent.id)
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["agent-run-steps", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_action_log")
        .select("*")
        .eq("run_id", selectedRunId)
        .order("step_index", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
      <Card className="p-2 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-2 py-1">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">ריצות אחרונות</h3>
          <Badge variant="outline">{runs.length}</Badge>
        </div>
        <ScrollArea className="flex-1 mt-2">
          <div className="space-y-1">
            {runs.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                עדיין אין ריצות. הפעל את הסוכן דרך run-ai-agent-v2.
              </div>
            )}
            {runs.map((r: any) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.failed;
              const Icon = meta.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={`w-full text-right p-2 rounded text-xs hover:bg-accent transition ${
                    selectedRunId === r.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3 w-3" />
                    <Badge className={meta.color} variant="outline">{meta.label}</Badge>
                    <span className="text-muted-foreground text-[10px] mr-auto">
                      {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: he })}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-right">{r.goal}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {r.current_step}/{r.max_steps} צעדים · {r.total_tokens_in + r.total_tokens_out} tokens
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-3 overflow-hidden flex flex-col">
        {!selectedRunId ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            בחר ריצה כדי לראות את הצעדים
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {steps.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center">אין צעדים מתועדים</div>
              )}
              {steps.map((s: any) => {
                const Icon = STEP_ICON[s.step_kind] ?? Activity;
                return (
                  <Card key={s.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <Badge variant="outline">צעד {s.step_index}</Badge>
                      <Badge variant="secondary">{s.step_kind}</Badge>
                      {s.action_details?.tool_name && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {s.action_details.tool_name}
                        </code>
                      )}
                      {s.status === "error" && <Badge variant="destructive">שגיאה</Badge>}
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        {s.duration_ms ? `${s.duration_ms}ms` : ""}
                        {s.tokens_in ? ` · ${s.tokens_in}↓${s.tokens_out ?? 0}↑` : ""}
                      </span>
                    </div>
                    {s.thought && (
                      <div className="text-sm bg-muted/50 p-2 rounded mb-2 whitespace-pre-wrap">
                        💭 {s.thought}
                      </div>
                    )}
                    {s.action_details?.tool_input && (
                      <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto mb-2">
                        {JSON.stringify(s.action_details.tool_input, null, 2)}
                      </pre>
                    )}
                    {s.observation && (
                      <pre className="text-[10px] bg-emerald-500/5 border border-emerald-500/20 p-2 rounded overflow-x-auto">
                        {typeof s.observation === "string" ? s.observation : JSON.stringify(s.observation, null, 2)}
                      </pre>
                    )}
                    {s.error_message && (
                      <div className="text-xs text-destructive mt-1">⚠️ {s.error_message}</div>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
