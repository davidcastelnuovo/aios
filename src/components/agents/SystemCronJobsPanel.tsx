import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play, Pencil, History as HistoryIcon, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { getCronMeta, describeCronExpression } from "@/lib/cronJobsCatalog";

const CRON_PRESETS = [
  { label: "כל דקה", value: "* * * * *" },
  { label: "כל 5 דקות", value: "*/5 * * * *" },
  { label: "כל שעה", value: "0 * * * *" },
  { label: "כל 6 שעות", value: "0 */6 * * *" },
  { label: "כל יום ב-04:00", value: "0 4 * * *" },
  { label: "כל יום ב-05:00", value: "0 5 * * *" },
  { label: "כל יום ב-08:00", value: "0 8 * * *" },
  { label: "כל יום ב-09:00", value: "0 9 * * *" },
  { label: "פעמיים ביום (05:00, 14:00)", value: "0 5,14 * * *" },
  { label: "מותאם אישית...", value: "__custom" },
];

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  last_return_message: string | null;
  success_count_7d: number;
  fail_count_7d: number;
}

export function SystemCronJobsPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CronJob | null>(null);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [editPreset, setEditPreset] = useState("__custom");
  const [editCustom, setEditCustom] = useState("");
  const [editActive, setEditActive] = useState(true);

  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ["system-cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_system_cron_jobs");
      if (error) throw error;
      return (data as CronJob[]) || [];
    },
    refetchInterval: 30000,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ jobid, active }: { jobid: number; active: boolean }) => {
      const { error } = await supabase.rpc("update_system_cron_job", {
        p_jobid: jobid, p_schedule: null, p_active: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הסטטוס עודכן");
      qc.invalidateQueries({ queryKey: ["system-cron-jobs"] });
    },
    onError: (e: any) => toast.error(e.message || "שגיאה"),
  });

  const updateJob = useMutation({
    mutationFn: async (payload: { jobid: number; schedule: string; active: boolean }) => {
      const { error } = await supabase.rpc("update_system_cron_job", {
        p_jobid: payload.jobid,
        p_schedule: payload.schedule,
        p_active: payload.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הג'וב עודכן");
      qc.invalidateQueries({ queryKey: ["system-cron-jobs"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "שגיאה"),
  });

  const runNow = useMutation({
    mutationFn: async (jobid: number) => {
      const { error } = await supabase.rpc("run_system_cron_job_now", { p_jobid: jobid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הג'וב הופעל");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["system-cron-jobs"] }), 2000);
    },
    onError: (e: any) => toast.error(e.message || "שגיאה בהפעלה"),
  });

  const openEdit = (job: CronJob) => {
    const preset = CRON_PRESETS.find(p => p.value === job.schedule);
    setEditPreset(preset ? preset.value : "__custom");
    setEditCustom(job.schedule);
    setEditActive(job.active);
    setEditing(job);
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-muted-foreground">
          אין הרשאה לצפייה באוטומציות מערכת (super admin בלבד)
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
        <strong>אוטומציות מערכת</strong> — אלה הג'ובים המתוזמנים שרצים אוטומטית במסד הנתונים.
        ניתן להפעיל ולכבות, לערוך לוח זמנים, להפעיל ידנית ולצפות בהיסטוריה.
      </div>

      {jobs.map(job => {
        const meta = getCronMeta(job.jobname);
        const isOk = job.last_status === "succeeded";
        const isFail = job.last_status === "failed";
        return (
          <div
            key={job.jobid}
            className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${!job.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="text-2xl shrink-0">{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{meta.label}</h3>
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                      {describeCronExpression(job.schedule)}
                    </Badge>
                    {!job.active && (
                      <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600">
                        כבוי
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
                    {job.jobname}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                    {job.last_run_at ? (
                      <span className={`flex items-center gap-1 ${isOk ? "text-green-700" : isFail ? "text-red-700" : "text-muted-foreground"}`}>
                        {isOk ? <CheckCircle2 className="h-3 w-3" /> : isFail ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        הרצה אחרונה: {formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true, locale: he })}
                        {job.last_duration_ms != null && ` · ${job.last_duration_ms}ms`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">לא רץ עדיין</span>
                    )}
                    <span className="text-green-700">✓ {job.success_count_7d} (7 ימים)</span>
                    {job.fail_count_7d > 0 && (
                      <span className="text-red-700">✗ {job.fail_count_7d}</span>
                    )}
                  </div>

                  {isFail && job.last_return_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-800 font-mono line-clamp-2">
                      {job.last_return_message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <Switch
                  checked={job.active}
                  onCheckedChange={(v) => toggleActive.mutate({ jobid: job.jobid, active: v })}
                />
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="הפעל עכשיו"
                    disabled={runNow.isPending}
                    onClick={() => runNow.mutate(job.jobid)}
                  >
                    {runNow.isPending && runNow.variables === job.jobid
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5 text-green-600" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="ערוך"
                    onClick={() => openEdit(job)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="היסטוריה"
                    onClick={() => setHistoryJob(job)}
                  >
                    <HistoryIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת לוח זמנים</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">ג'וב</Label>
                <p className="text-sm font-medium">{getCronMeta(editing.jobname).label}</p>
              </div>
              <div>
                <Label className="text-xs">לוח זמנים</Label>
                <Select
                  value={editPreset}
                  onValueChange={(v) => {
                    setEditPreset(v);
                    if (v !== "__custom") setEditCustom(v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRON_PRESETS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cron expression</Label>
                <Input
                  value={editCustom}
                  onChange={(e) => setEditCustom(e.target.value)}
                  placeholder="0 9 * * *"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {describeCronExpression(editCustom)}
                </p>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <Label className="text-sm">פעיל</Label>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button
              onClick={() => editing && updateJob.mutate({
                jobid: editing.jobid,
                schedule: editCustom,
                active: editActive,
              })}
              disabled={updateJob.isPending || !editCustom.trim()}
            >
              {updateJob.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History sheet */}
      <Sheet open={!!historyJob} onOpenChange={(o) => !o && setHistoryJob(null)}>
        <SheetContent side="left" className="w-full sm:max-w-lg" dir="rtl">
          <SheetHeader>
            <SheetTitle>
              היסטוריה — {historyJob && getCronMeta(historyJob.jobname).label}
            </SheetTitle>
          </SheetHeader>
          {historyJob && <HistoryList jobid={historyJob.jobid} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HistoryList({ jobid }: { jobid: number }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cron-history", jobid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_job_history", {
        p_jobid: jobid, p_limit: 50,
      });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">טוען...</div>;
  if (rows.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">אין הרצות</div>;

  return (
    <ScrollArea className="h-[calc(100vh-120px)] mt-4">
      <div className="space-y-2 pl-2">
        {rows.map((r: any) => {
          const ok = r.status === "succeeded";
          return (
            <div key={r.runid} className={`rounded-lg border p-3 text-xs ${ok ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                  <span className="font-medium">{format(new Date(r.start_time), "dd/MM HH:mm:ss")}</span>
                </div>
                {r.duration_ms != null && (
                  <span className="text-muted-foreground">{r.duration_ms}ms</span>
                )}
              </div>
              {r.return_message && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground line-clamp-3 break-all">
                  {r.return_message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
