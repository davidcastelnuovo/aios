import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, MessageSquare, Search, UserRound } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { QuickTaskInput, type QuickTaskPayload } from "./QuickTaskInput";
import { isTaskOverdue } from "@/lib/taskDeadline";
import { embedCount } from "@/lib/embedCount";
import { filterTasksForChatSearch, sortTasksForChatList } from "@/lib/taskBoardQuery";

export const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "פתוח", color: "hsl(217, 91%, 60%)" },
  in_progress: { label: "בתהליך", color: "hsl(45, 93%, 47%)" },
  done: { label: "הושלם", color: "hsl(142, 71%, 45%)" },
};

function priorityClass(priority: number) {
  if (priority >= 8) return "text-destructive border-destructive/40 bg-destructive/10";
  if (priority >= 6) return "text-amber-800 dark:text-amber-200 border-amber-500/40 bg-amber-500/10";
  return "text-muted-foreground";
}

export type ChatTask = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  target_date?: string | null;
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
  created_at?: string;
  created_by?: string | null;
  creator_name?: string | null;
  google_calendar_event_id?: string | null;
  duration_minutes?: number | null;
  clients?: { name: string; agency_id?: string | null } | null;
  campaigners?: { full_name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
};

type StatusFilter = "all" | "open" | "in_progress" | "done";

interface TasksChatViewProps {
  tasks: ChatTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: ChatTask | null) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onDelete: (taskId: string, googleCalendarEventId?: string | null) => void;
  onMoveToBacklog?: (taskId: string) => void;
  onAddTask?: (payload: QuickTaskPayload) => void;
  isLoading?: boolean;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  defaultCampaignerId?: string | null;
}

export function TasksChatView({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleComplete,
  onDelete,
  onMoveToBacklog,
  onAddTask,
  isLoading,
  clientsList,
  campaignersList,
  defaultCampaignerId,
}: TasksChatViewProps) {
  const isMobile = useIsMobile();
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const filteredTasks = useMemo(() => {
    const searched = filterTasksForChatSearch(tasks, listSearch);
    const byStatus =
      statusFilter === "all"
        ? searched
        : searched.filter((task) => task.status === statusFilter);
    return sortTasksForChatList(byStatus, today);
  }, [tasks, listSearch, statusFilter, today]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  useEffect(() => {
    if (isMobile) return;
    const stillPresent = Boolean(selectedTaskId && tasks.some((task) => task.id === selectedTaskId));
    if (!stillPresent && filteredTasks.length > 0) {
      onSelectTask(filteredTasks[0]);
    }
  }, [isMobile, selectedTaskId, tasks, filteredTasks, onSelectTask]);

  const handleSelect = useCallback(
    (task: ChatTask) => {
      onSelectTask(task);
    },
    [onSelectTask],
  );

  const statusCounts = useMemo(() => {
    const searched = filterTasksForChatSearch(tasks, listSearch);
    return {
      all: searched.length,
      open: searched.filter((task) => task.status === "open").length,
      in_progress: searched.filter((task) => task.status === "in_progress").length,
      done: searched.filter((task) => task.status === "done").length,
    };
  }, [tasks, listSearch]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 max-h-full overflow-hidden bg-background w-full",
        isMobile ? "border-0 rounded-none" : "border rounded-lg",
      )}
      dir="rtl"
    >
      {(!isMobile || !selectedTaskId) && (
        <div
          className={cn(
            "border-s flex flex-col bg-muted/20 overflow-hidden min-h-0",
            isMobile ? "w-full flex-1" : "w-[28%] min-w-[260px] max-w-[28%]",
          )}
          dir="rtl"
        >
          <div className={cn("border-b bg-background/80 backdrop-blur-sm shrink-0", isMobile ? "p-2" : "p-3")}>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש משימה, לקוח או קמפיינר..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="pr-9 h-9 text-sm"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {([
                ["all", "הכל"],
                ["open", "פתוח"],
                ["in_progress", "בתהליך"],
                ["done", "הושלם"],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={statusFilter === value ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                  <span className="mr-1 text-[10px] opacity-80">{statusCounts[value]}</span>
                </Button>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {filteredTasks.length} משימות
            </div>
          </div>

          {onAddTask && (
            <div className="p-2 border-b shrink-0 bg-background">
              <QuickTaskInput
                onAddTask={onAddTask}
                disabled={isLoading}
                clientsList={clientsList}
                campaignersList={campaignersList}
                defaultCampaignerId={defaultCampaignerId}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" dir="rtl">
            <div className="divide-y">
              {filteredTasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                const overdue = isTaskOverdue(task, today);
                const statusInfo = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.open;
                const updatesCount = embedCount(task.task_updates);

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelect(task)}
                    className={cn(
                      "w-full text-right p-3 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/10 border-e-4 border-e-primary",
                      overdue && !isSelected && "bg-destructive/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="pt-0.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={(checked) =>
                            onToggleComplete(task.id, Boolean(checked))
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p
                            className={cn(
                              "text-sm font-semibold whitespace-normal break-words flex-1",
                              task.status === "done" && "line-through text-muted-foreground",
                            )}
                          >
                            {task.title}
                          </p>
                          {overdue && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-0 text-white"
                            style={{ backgroundColor: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", priorityClass(task.priority))}>
                            דחיפות {task.priority}
                          </Badge>
                          {task.clients?.name && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                              {task.clients.name}
                            </span>
                          )}
                          {task.campaigners?.full_name && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                              {task.campaigners.full_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={cn("inline-flex items-center gap-0.5 text-[10px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(task.due_date), "dd/MM", { locale: he })}
                              {task.due_time ? ` ${String(task.due_time).substring(0, 5)}` : ""}
                            </span>
                          )}
                          {updatesCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />
                              {updatesCount}
                            </span>
                          )}
                          {task.creator_name && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <UserRound className="h-3 w-3" />
                              {task.creator_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredTasks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {isLoading ? "טוען משימות..." : "לא נמצאו משימות"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(!isMobile || selectedTaskId) && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          {isMobile && selectedTask && (
            <div className="flex items-center gap-2 p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => onSelectTask(null)}
                aria-label="חזרה לרשימה"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <h2 className="font-bold text-sm truncate flex-1">{selectedTask.title}</h2>
            </div>
          )}
          <TaskDetailDialog
            key={selectedTask?.id ?? "empty"}
            task={selectedTask}
            open={Boolean(selectedTask)}
            variant="panel"
            onOpenChange={(open) => {
              if (!open) onSelectTask(null);
            }}
            onDelete={(taskId) => {
              const idx = filteredTasks.findIndex((task) => task.id === taskId);
              const next = filteredTasks[idx + 1] || filteredTasks[idx - 1] || null;
              onDelete(taskId, selectedTask?.google_calendar_event_id);
              onSelectTask(next);
            }}
            onMoveToBacklog={onMoveToBacklog}
          />
        </div>
      )}
    </div>
  );
}
