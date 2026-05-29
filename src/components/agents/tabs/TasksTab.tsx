import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ListTodo, Plus, Play, Trash2, Clock, CheckCircle2, XCircle, Loader2, Repeat, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "ממתין", icon: Clock, color: "text-muted-foreground" },
  scheduled: { label: "מתוזמן", icon: Calendar, color: "text-blue-500" },
  running: { label: "רץ", icon: Loader2, color: "text-amber-500" },
  completed: { label: "הושלם", icon: CheckCircle2, color: "text-green-500" },
  failed: { label: "נכשל", icon: XCircle, color: "text-destructive" },
};

const SCHEDULE_LABELS: Record<string, string> = {
  immediate: "מיידי",
  scheduled: "מתוזמן",
  recurring: "חוזר",
};

export function TasksTab({ agent }: { agent: any }) {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["agent-tasks", agent.id],
    enabled: !!agent.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = filter === "all"
    ? tasks
    : filter === "recurring"
      ? tasks.filter(t => t.schedule_type === "recurring")
      : tasks.filter(t => t.status === filter);

  const run = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.functions.invoke("run-agent-task", {
        body: { task_id: taskId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-tasks", agent.id] });
      toast.success("המשימה הופעלה");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("agent_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-tasks", agent.id] });
      toast.success("נמחק");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <ListTodo className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">משימות הסוכן</h3>
        <Badge variant="outline">{tasks.length}</Badge>
        <div className="flex-1" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="pending">ממתינות</SelectItem>
            <SelectItem value="scheduled">מתוזמנות</SelectItem>
            <SelectItem value="running">רצות</SelectItem>
            <SelectItem value="completed">הושלמו</SelectItem>
            <SelectItem value="failed">נכשלו</SelectItem>
            <SelectItem value="recurring">חוזרות</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => navigate(buildPath("/agent-tasks"))}>
          תצוגה מלאה
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 me-1" /> משימה חדשה</Button>
          </DialogTrigger>
          <NewTaskDialog
            agentId={agent.id}
            tenantId={tenantId}
            onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["agent-tasks", agent.id] }); }}
          />
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      <div className="grid gap-2">
        {filtered.map(t => {
          const meta = STATUS_META[t.status] ?? STATUS_META.pending;
          const Icon = meta.icon;
          return (
            <Card key={t.id} className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-1 shrink-0 ${meta.color} ${t.status === "running" ? "animate-spin" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-medium truncate">{t.title}</h4>
                    <Badge variant="outline" className="text-[10px] h-4">{meta.label}</Badge>
                    {t.schedule_type && t.schedule_type !== "immediate" && (
                      <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                        {t.schedule_type === "recurring" ? <Repeat className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {SCHEDULE_LABELS[t.schedule_type] ?? t.schedule_type}
                      </Badge>
                    )}
                    {t.cron_expression && (
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.cron_expression}</code>
                    )}
                    {typeof t.run_count === "number" && t.run_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">רץ {t.run_count}×</span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>נוצר {formatDistanceToNow(new Date(t.created_at), { locale: he, addSuffix: true })}</span>
                    {t.last_run && <span>הופעל לאחרונה {formatDistanceToNow(new Date(t.last_run), { locale: he, addSuffix: true })}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run.mutate(t.id)} disabled={run.isPending || t.status === "running"} title="הפעל">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(t.id)} title="מחק">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {filter === "all" ? "אין משימות לסוכן הזה" : "אין משימות מתאימות לסינון"}
          </p>
        )}
      </div>
    </div>
  );
}

function NewTaskDialog({ agentId, tenantId, onCreated }: { agentId: string; tenantId: string | null; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled" | "recurring">("immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!tenantId || !title.trim()) return;
    setSubmitting(true);
    try {
      const payload: any = {
        tenant_id: tenantId,
        agent_id: agentId,
        title: title.trim(),
        description: description.trim() || null,
        schedule_type: scheduleType,
        status: scheduleType === "immediate" ? "pending" : "scheduled",
      };
      if (scheduleType === "scheduled" && scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();
      if (scheduleType === "recurring") payload.cron_expression = cron;

      const { error } = await supabase.from("agent_tasks").insert(payload);
      if (error) throw error;
      toast.success("המשימה נוצרה");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>משימה חדשה לסוכן</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>כותרת</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה הסוכן צריך לעשות?" />
        </div>
        <div>
          <Label>הוראות מפורטות</Label>
          <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="פרט מה לבצע, על אילו לקוחות, איך לדווח..." />
        </div>
        <div>
          <Label>סוג הרצה</Label>
          <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">מיידי</SelectItem>
              <SelectItem value="scheduled">מתוזמן (פעם אחת)</SelectItem>
              <SelectItem value="recurring">חוזר (Cron)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scheduleType === "scheduled" && (
          <div>
            <Label>תאריך ושעה</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
        )}
        {scheduleType === "recurring" && (
          <div>
            <Label>ביטוי Cron</Label>
            <Input value={cron} onChange={e => setCron(e.target.value)} placeholder="0 9 * * *" className="font-mono" />
            <p className="text-[11px] text-muted-foreground mt-1">לדוגמה: <code>0 9 * * *</code> = כל יום ב-09:00</p>
          </div>
        )}
        <Button onClick={submit} disabled={!title || submitting} className="w-full">
          {submitting ? "יוצר..." : "צור משימה"}
        </Button>
      </div>
    </DialogContent>
  );
}
