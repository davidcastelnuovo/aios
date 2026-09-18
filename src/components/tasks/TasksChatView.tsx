import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDot, Clock, LayoutList, MessageSquare, Repeat, Search, UserRound } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
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
import type { OpenClosedFilter } from "@/lib/taskFilters";
import { describeRecurrence } from "@/lib/taskRecurrence";

function formatDueShort(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "dd/MM", { locale: he });
}

function formatCreatedShort(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return format(parsed, sameYear ? "dd/MM" : "dd/MM/yy", { locale: he });
}

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
  recurrence_frequency?: "daily" | "weekly" | "monthly" | null;
  recurrence_weekday?: number | null;
  recurrence_monthday?: number | null;
  clients?: { name: string; agency_id?: string | null } | null;
  leads?: { company_name?: string | null; contact_name?: string | null } | null;
  campaigners?: { full_name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id?: string; campaigner_id?: string }[];
};

const OPEN_CLOSED_TABS: {
  value: OpenClosedFilter;
  label: string;
  icon: typeof LayoutList;
  active: string;
  idle: string;
  countActive: string;
  countIdle: string;
}[] = [
  {
    value: "all",
    label: "הכל",
    icon: LayoutList,
    active: "bg-violet-600 text-white",
    idle: "text-violet-800 hover:bg-violet-50",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-violet-200/80 text-violet-900",
  },
  {
    value: "open",
    label: "פתוחות",
    icon: CircleDot,
    active: "bg-sky-500 text-white",
    idle: "text-sky-800 hover:bg-sky-50",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-sky-200/80 text-sky-900",
  },
  {
    value: "done",
    label: "סגורות",
    icon: CheckCircle2,
    active: "bg-emerald-500 text-white",
    idle: "text-emerald-800 hover:bg-emerald-50",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-emerald-200/80 text-emerald-900",
  },
];

export function TasksChatSearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="חיפוש משימה או לקוח..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full pr-7 text-xs bg-card"
      />
    </div>
  );
}

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
  openClosedFilter?: OpenClosedFilter;
  onOpenClosedFilterChange?: (value: OpenClosedFilter) => void;
  listSearch?: string;
  onListSearchChange?: (value: string) => void;
  hideListSearch?: boolean;
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
  openClosedFilter = "open",
  onOpenClosedFilterChange,
  listSearch: listSearchProp,
  onListSearchChange,
  hideListSearch = false,
}: TasksChatViewProps) {
  const isMobile = useIsMobile();
  const [uncontrolledSearch, setUncontrolledSearch] = useState("");
  const listSearch = onListSearchChange ? (listSearchProp ?? "") : uncontrolledSearch;
  const setListSearch = onListSearchChange ?? setUncontrolledSearch;
  const setOpenClosedFilter = onOpenClosedFilterChange ?? (() => undefined);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const searchedTasks = useMemo(
    () => filterTasksForChatSearch(tasks, listSearch),
    [tasks, listSearch],
  );

  const tabCounts = useMemo(() => ({
    all: searchedTasks.length,
    open: searchedTasks.filter((task) => task.status !== "done").length,
    done: searchedTasks.filter((task) => task.status === "done").length,
  }), [searchedTasks]);

  const filteredTasks = useMemo(() => {
    const byOpenClosed =
      openClosedFilter === "all"
        ? searchedTasks
        : openClosedFilter === "done"
          ? searchedTasks.filter((task) => task.status === "done")
          : searchedTasks.filter((task) => task.status !== "done");
    return sortTasksForChatList(byOpenClosed, today);
  }, [searchedTasks, openClosedFilter, today]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  useEffect(() => {
    if (isMobile) return;
    const stillPresent = Boolean(selectedTaskId && tasks.some((task) => task.id === selectedTaskId));
    const nextTask = filteredTasks[0];
    if (!stillPresent && nextTask && nextTask.id !== selectedTaskId) {
      onSelectTask(nextTask);
    }
  }, [isMobile, selectedTaskId, tasks, filteredTasks, onSelectTask]);

  const handleSelect = useCallback(
    (task: ChatTask) => {
      onSelectTask(task);
    },
    [onSelectTask],
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 max-h-full overflow-hidden bg-background w-full",
        isMobile ? "border-0 rounded-none" : "border rounded-lg",
      )}
      dir="rtl"
    >
      <div
        className={cn(
          "flex flex-col bg-muted/20 overflow-hidden min-h-0",
          isMobile ? "w-full flex-1" : "w-[28%] min-w-[260px] max-w-[28%] border-s",
        )}
        dir="rtl"
      >
          <div className={cn("border-b bg-card shrink-0 space-y-1.5", isMobile ? "p-1.5" : "px-2 py-1.5")}>
            {!hideListSearch && (
              <TasksChatSearchInput value={listSearch} onChange={setListSearch} className="w-full" />
            )}
            <div className="flex items-center gap-1 min-w-0">
              {OPEN_CLOSED_TABS.map((tab) => {
                const active = openClosedFilter === tab.value;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setOpenClosedFilter(tab.value)}
                    className={cn(
                      "h-7 flex-1 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-0.5 px-1 min-w-0",
                      active ? tab.active : tab.idle,
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    <span
                      className={cn(
                        "min-w-4 rounded-full px-1 text-[10px] leading-4 font-bold",
                        active ? tab.countActive : tab.countIdle,
                      )}
                    >
                      {tabCounts[tab.value]}
                    </span>
                  </button>
                );
              })}
            </div>
            {onAddTask && (
              <QuickTaskInput
                onAddTask={onAddTask}
                disabled={isLoading}
                clientsList={clientsList}
                campaignersList={campaignersList}
                defaultCampaignerId={defaultCampaignerId}
              />
            )}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 [scrollbar-width:thin]" dir="rtl">
            <div className="divide-y" dir="rtl">
              {filteredTasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                const overdue = isTaskOverdue(task, today);
                const updatesCount = embedCount(task.task_updates);
                const dueLabel = task.due_date ? formatDueShort(task.due_date) : null;
                const createdLabel = formatCreatedShort(task.created_at);

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
                      <div className="flex-1 min-w-0 text-right">
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
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap justify-end">
                          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", priorityClass(task.priority))}>
                            דחיפות {task.priority}
                          </Badge>
                          {task.recurrence_frequency && (
                            <Badge variant="outline" className="text-[10px] h-4 gap-0.5 px-1.5 border-violet-300 text-violet-700">
                              <Repeat className="h-2.5 w-2.5" />
                              {describeRecurrence({
                                frequency: task.recurrence_frequency,
                                weekday: task.recurrence_weekday,
                                monthday: task.recurrence_monthday,
                                time: task.due_time,
                              }) || "חוזרת"}
                            </Badge>
                          )}
                          {(task.clients?.name || task.leads?.company_name || task.leads?.contact_name) && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                              {task.clients?.name || task.leads?.company_name || task.leads?.contact_name}
                            </span>
                          )}
                          {task.campaigners?.full_name && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                              {task.campaigners.full_name}
                            </span>
                          )}
                          {createdLabel && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
                              title="נוצרה"
                            >
                              <Clock className="h-3 w-3" />
                              {createdLabel}
                            </span>
                          )}
                          {dueLabel && (
                            <span className={cn("inline-flex items-center gap-0.5 text-[10px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                              <CalendarDays className="h-3 w-3" />
                              {dueLabel}
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

      {!isMobile && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-muted/20" dir="rtl">
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

      {isMobile && (
        <TaskDetailDialog
          key={selectedTask?.id ?? "empty"}
          task={selectedTask}
          open={Boolean(selectedTask)}
          variant="dialog"
          onOpenChange={(open) => {
            if (!open) onSelectTask(null);
          }}
          onDelete={(taskId) => {
            onDelete(taskId, selectedTask?.google_calendar_event_id);
            onSelectTask(null);
          }}
          onMoveToBacklog={onMoveToBacklog}
        />
      )}
    </div>
  );
}
