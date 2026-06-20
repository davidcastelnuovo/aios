import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { AgentAvatar } from "./AgentAvatar";
import { ISLAND_TOKENS } from "../utils/glassTokens";
import type { IslandSummary } from "../types/visualWorkspaceTypes";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  island: IslandSummary | null;
  onClose: () => void;
  onOpenSheet: (kind: "client" | "task" | "agent", id: string) => void;
}

export function IslandPanel({ island, onClose, onOpenSheet }: Props) {
  const { tenantId } = useCurrentTenant();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    if (!island || !tenantId) return;
    setLoading(true);
    const sb = supabase as any;
    (async () => {
      const fetchTasks = sb.from("tasks").select("id,title,status,due_date,client_id").eq("tenant_id", tenantId).in("status", ["open", "in_progress"]).order("due_date", { ascending: true, nullsFirst: false }).limit(20);
      const fetchAgents = sb.from("ai_agents").select("id,name,role,model,active").eq("tenant_id", tenantId).limit(10);

      let itemsQ: any = null;
      switch (island.id) {
        case "marketing":
          itemsQ = sb.from("automations").select("id,name,is_active,trigger_type").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
          break;
        case "sales":
          itemsQ = sb.from("leads").select("id,name,phone,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
          break;
        case "creative":
          itemsQ = sb.from("social_publications").select("id,content,status,scheduled_at").eq("tenant_id", tenantId).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(15);
          break;
        case "finance":
          itemsQ = sb.from("supplier_invoices").select("id,supplier_name,amount,status,invoice_date").eq("tenant_id", tenantId).order("invoice_date", { ascending: false }).limit(15);
          break;
        case "development":
          itemsQ = sb.from("automation_executions").select("id,automation_id,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
          break;
        case "customer_success":
          itemsQ = sb.from("clients").select("id,name,status,mood_status,health_score").eq("tenant_id", tenantId).order("name").limit(20);
          break;
        case "system":
          itemsQ = sb.from("tenant_integrations").select("id,integration_name,is_active").eq("tenant_id", tenantId).limit(20);
          break;
        case "agents":
          itemsQ = sb.from("ai_agents").select("id,name,role,model,active").eq("tenant_id", tenantId).limit(20);
          break;
        case "management":
          itemsQ = sb.from("goals").select("id,title,status,progress").eq("tenant_id", tenantId).neq("status", "completed").limit(15);
          break;
      }

      const [it, tsk, ag] = await Promise.all([itemsQ, fetchTasks, fetchAgents]);
      setItems(it?.data ?? []);
      setTasks(tsk?.data ?? []);
      setAgents(ag?.data ?? []);
      setLoading(false);
    })();
  }, [island, tenantId]);

  if (!island) return null;
  const tokens = ISLAND_TOKENS[island.id];

  return (
    <Dialog open={!!island} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("max-w-4xl bg-gradient-to-br backdrop-blur-2xl", tokens.from, tokens.to)} dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AgentAvatar role={island.agentRole} state="idle" size={48} />
            <div>
              <div className={cn("text-xl font-bold", tokens.label)}>{island.name}</div>
              <div className="text-xs text-slate-500 font-normal">{island.description}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="bg-white/60">
            <TabsTrigger value="overview">סקירה</TabsTrigger>
            <TabsTrigger value="items">פריטים</TabsTrigger>
            <TabsTrigger value="tasks">משימות</TabsTrigger>
            <TabsTrigger value="agents">אייג׳נטים</TabsTrigger>
            <TabsTrigger value="analytics">אנליטיקה</TabsTrigger>
            <TabsTrigger value="settings">הגדרות</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {island.kpis.map((k, i) => (
              <Card key={i} className="bg-white/70 border-white/80">
                <CardContent className="pt-5">
                  <div className="text-xs text-slate-500">{k.label}</div>
                  <div className={cn(
                    "text-2xl font-bold mt-1",
                    k.tone === "danger" && "text-rose-600",
                    k.tone === "warning" && "text-amber-600",
                    k.tone === "success" && "text-emerald-600",
                  )}>{k.value}</div>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-white/70 border-white/80 col-span-full">
              <CardContent className="pt-5 flex items-center justify-between">
                <span className="text-sm text-slate-600">סטטוס כללי</span>
                <Badge variant={island.status === "good" ? "default" : island.status === "watch" ? "secondary" : "destructive"}>
                  {island.status === "good" ? "תקין" : island.status === "watch" ? "דורש מעקב" : "התראה"}
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            <ScrollArea className="h-[360px]">
              {loading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-center text-slate-500 py-8">אין פריטים</p>
              ) : (
                <div className="space-y-2">
                  {items.map((it: any) => (
                    <div
                      key={it.id}
                      onClick={() => {
                        if (island.id === "customer_success") onOpenSheet("client", it.id);
                        else if (island.id === "agents") onOpenSheet("agent", it.id);
                      }}
                      className="px-4 py-2 rounded-xl bg-white/70 border border-white/80 text-sm hover:bg-white cursor-pointer transition flex items-center justify-between"
                    >
                      <span className="truncate">{it.name || it.title || it.content || it.supplier_name || it.integration_name || it.id}</span>
                      {(it.status || it.active !== undefined) && (
                        <Badge variant="outline" className="text-[10px]">{it.status ?? (it.active ? "פעיל" : "כבוי")}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <ScrollArea className="h-[360px]">
              {tasks.length === 0 ? (
                <p className="text-sm text-center text-slate-500 py-8">אין משימות פתוחות</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => onOpenSheet("task", t.id)}
                      className="px-4 py-2 rounded-xl bg-white/70 border border-white/80 text-sm hover:bg-white cursor-pointer transition flex items-center justify-between"
                    >
                      <span className="truncate">{t.title}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {agents.map((a: any) => (
                <div
                  key={a.id}
                  onClick={() => onOpenSheet("agent", a.id)}
                  className="rounded-2xl bg-white/70 border border-white/80 p-3 text-center hover:bg-white cursor-pointer transition"
                >
                  <AgentAvatar role={(a.role as any) || "ceo"} state={a.active ? "idle" : "waiting"} size={48} className="mx-auto" />
                  <div className="text-xs font-semibold mt-2 truncate">{a.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{a.model}</div>
                </div>
              ))}
              {agents.length === 0 && <p className="col-span-full text-sm text-center text-slate-500 py-8">אין אייג׳נטים</p>}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <Card className="bg-white/70">
              <CardContent className="pt-6 text-sm text-slate-500 text-center py-12">
                גרפים וניתוחים מתקדמים יתווספו בשלב הבא
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="bg-white/70">
              <CardContent className="pt-6 text-sm text-slate-500 text-center py-12">
                הגדרות המחלקה — מתוכנן לשלב 2
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
