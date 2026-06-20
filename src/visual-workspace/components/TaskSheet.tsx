import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  taskId: string | null;
  onClose: () => void;
}

export function TaskSheet({ taskId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    const sb = supabase as any;
    Promise.all([
      sb.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      sb.from("task_updates").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(10),
    ]).then(([t, u]: any) => {
      setTask(t.data);
      setUpdates(u.data ?? []);
      setLoading(false);
    });
  }, [taskId]);

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" dir="rtl" className="sm:max-w-lg bg-white/85 backdrop-blur-2xl">
        <SheetHeader>
          <SheetTitle>{task?.title || "טוען..."}</SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !task ? null : (
          <ScrollArea className="h-[calc(100vh-100px)] pl-3 mt-3">
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                {task.status && <Badge variant="outline">{task.status}</Badge>}
                {task.priority && <Badge variant="secondary">{task.priority}</Badge>}
              </div>
              {task.description && (
                <div><div className="text-xs text-slate-500 mb-1">תיאור</div><p className="text-xs whitespace-pre-wrap">{task.description}</p></div>
              )}
              {task.due_date && (
                <div><div className="text-xs text-slate-500">תאריך יעד</div><div>{format(new Date(task.due_date), "d MMMM yyyy", { locale: he })}</div></div>
              )}
              <div>
                <div className="text-xs text-slate-500 mb-1">היסטוריה</div>
                {updates.length === 0 ? <p className="text-xs text-slate-400">אין עדכונים</p> : (
                  <div className="space-y-1">
                    {updates.map((u: any) => (
                      <div key={u.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="text-[10px] text-slate-500">{u.created_at && format(new Date(u.created_at), "d MMM HH:mm", { locale: he })}</div>
                        <div>{u.content || u.update_text || u.note}</div>
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
