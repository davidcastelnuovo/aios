import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Play, CheckCircle2, XCircle, Clock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { format } from "date-fns";

import agentGeneral from "@/assets/agents/agent-general.png";
import agentCreative from "@/assets/agents/agent-creative.png";
import agentCeo from "@/assets/agents/agent-ceo.png";
import agentSeo from "@/assets/agents/agent-seo.png";
import agentGithub from "@/assets/agents/agent-github.png";

const AGENT_AVATARS: Record<string, string> = {
  "סוכן כללי": agentGeneral,
  "סוכן קריאייטיב": agentCreative,
  "ceo": agentCeo,
  "CEO": agentCeo,
  "SEO": agentSeo,
  "seo": agentSeo,
};
const DEFAULT_AVATAR = agentGeneral;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "ממתין", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="h-3.5 w-3.5" /> },
  running: { label: "רץ", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed: { label: "נכשל", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
};

export default function AgentTasksPage() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({ title: "", description: "", agent_id: "", priority: 5 });

  const { data: agents = [] } = useQuery({
    queryKey: ["ai_agents", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["agent_tasks", tenantId, filterAgent, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("agent_tasks")
        .select("*, ai_agents(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (filterAgent !== "all") query = query.eq("agent_id", filterAgent);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      const { data } = await query;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("agent_tasks").insert({
        tenant_id: tenantId!,
        agent_id: form.agent_id,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        created_by: user?.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      setDialogOpen(false);
      setForm({ title: "", description: "", agent_id: "", priority: 5 });
      toast.success("משימה נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת משימה"),
  });

  const runTask = useMutation({
    mutationFn: async (task: any) => {
      await supabase.from("agent_tasks").update({ status: "running", started_at: new Date().toISOString() }).eq("id", task.id);
      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          agent_id: task.agent_id,
          command_text: `${task.title}\n${task.description || ""}`,
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
      await supabase.from("agent_tasks").update({
        status: data?.success ? "completed" : "failed",
        result: data,
        completed_at: new Date().toISOString(),
      }).eq("id", task.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      toast.success("המשימה הושלמה");
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      toast.error("שגיאה בהרצת המשימה: " + err.message);
    },
  });

  // Agent stats
  const agentStats = agents.map((agent) => {
    const agentTasks = tasks.filter((t) => t.agent_id === agent.id);
    return {
      ...agent,
      total: agentTasks.length,
      completed: agentTasks.filter((t) => t.status === "completed").length,
      failed: agentTasks.filter((t) => t.status === "failed").length,
      running: agentTasks.filter((t) => t.status === "running").length,
      pending: agentTasks.filter((t) => t.status === "pending").length,
    };
  });

  const avatarFor = (name: string) => AGENT_AVATARS[name] || DEFAULT_AVATAR;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath("agents"))}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">ניהול משימות סוכנים</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-[#36d399] hover:bg-[#2fbf87] text-black">
          <Plus className="h-4 w-4" />
          משימה חדשה
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl border bg-background">
          {/* Right panel - Tasks */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col p-4">
              {/* Filters */}
              <div className="flex gap-2 mb-4 shrink-0">
                <Select value={filterAgent} onValueChange={setFilterAgent}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="כל הסוכנים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסוכנים</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="כל הסטטוסים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="running">רץ</SelectItem>
                    <SelectItem value="completed">הושלם</SelectItem>
                    <SelectItem value="failed">נכשל</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Task list */}
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">טוען...</div>
                  ) : tasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-lg mb-2">אין משימות עדיין</p>
                      <p className="text-sm">צור משימה חדשה כדי להתחיל</p>
                    </div>
                  ) : (
                    tasks.map((task) => {
                      const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                      const agentName = (task as any).ai_agents?.name || "—";
                      return (
                        <div key={task.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <img src={avatarFor(agentName)} className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm truncate">{task.title}</h3>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <span>{agentName}</span>
                                  <span>·</span>
                                  <span>{format(new Date(task.created_at), "dd/MM HH:mm")}</span>
                                  {task.completed_at && (
                                    <>
                                      <span>·</span>
                                      <span>הסתיים {format(new Date(task.completed_at), "HH:mm")}</span>
                                    </>
                                  )}
                                </div>
                                {task.status === "completed" && task.result?.output && (
                                  <div className="mt-2 p-2 bg-green-50 rounded-lg text-xs text-green-900 line-clamp-3 whitespace-pre-wrap">
                                    {task.result.output}
                                  </div>
                                )}
                                {task.status === "failed" && task.result?.error && (
                                  <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-900">
                                    {task.result.error}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={`${status.color} text-xs gap-1`}>
                                {status.icon}
                                {status.label}
                              </Badge>
                              {task.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 text-xs"
                                  onClick={() => runTask.mutate(task)}
                                  disabled={runTask.isPending}
                                >
                                  <Play className="h-3 w-3" />
                                  הרץ
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Left panel - Agents in action */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="h-full flex flex-col p-4 bg-muted/30">
              <h2 className="font-bold text-base mb-4">סוכנים בפעולה</h2>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {agentStats.map((agent) => (
                    <div key={agent.id} className="bg-white rounded-xl border p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <img src={avatarFor(agent.name)} className="w-10 h-10 rounded-xl object-cover" />
                          {agent.running > 0 && (
                            <span className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{agent.name}</h3>
                          <p className="text-xs text-muted-foreground">{agent.engine}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-muted/50 rounded-lg p-1.5">
                          <div className="text-sm font-bold">{agent.total}</div>
                          <div className="text-[10px] text-muted-foreground">סה״כ</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-1.5">
                          <div className="text-sm font-bold text-green-700">{agent.completed}</div>
                          <div className="text-[10px] text-green-600">הושלם</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-1.5">
                          <div className="text-sm font-bold text-blue-700">{agent.running}</div>
                          <div className="text-[10px] text-blue-600">רץ</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-1.5">
                          <div className="text-sm font-bold text-red-700">{agent.failed}</div>
                          <div className="text-[10px] text-red-600">נכשל</div>
                        </div>
                      </div>
                      {/* Recent completed tasks */}
                      {tasks
                        .filter((t) => t.agent_id === agent.id && (t.status === "completed" || t.status === "failed"))
                        .slice(0, 3)
                        .map((t) => (
                          <div key={t.id} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            {t.status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                            )}
                            <span className="truncate">{t.title}</span>
                            {t.completed_at && (
                              <span className="shrink-0 mr-auto">{format(new Date(t.completed_at), "dd/MM HH:mm")}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* New task dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>משימה חדשה לסוכן</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>סוכן</Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוכן" />
                </SelectTrigger>
                <SelectContent>
                  {agents.filter((a) => a.active).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <img src={avatarFor(a.name)} className="w-5 h-5 rounded" />
                        {a.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>כותרת המשימה</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="מה הסוכן צריך לעשות?" />
            </div>
            <div>
              <Label>תיאור (אופציונלי)</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="פרטים נוספים..." rows={3} />
            </div>
            <div>
              <Label>עדיפות (1-10)</Label>
              <Input type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 5 }))} />
            </div>
            <Button
              className="w-full bg-[#36d399] hover:bg-[#2fbf87] text-black"
              disabled={!form.agent_id || !form.title || createTask.isPending}
              onClick={() => createTask.mutate()}
            >
              {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "צור משימה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
