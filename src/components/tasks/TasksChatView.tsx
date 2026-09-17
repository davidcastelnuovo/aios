import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bookmark, Building2, CalendarDays, CheckCircle2, CircleDot, LayoutList, MessageSquare, Search, UserRound, Users, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { QuickTaskInput, type QuickTaskPayload } from "./QuickTaskInput";
import { isTaskOverdue } from "@/lib/taskDeadline";
import { embedCount } from "@/lib/embedCount";
import { filterTasksForChatSearch, sortTasksForChatList } from "@/lib/taskBoardQuery";
import { useTerminology } from "@/hooks/useTerminology";
import type { OpenClosedFilter } from "@/lib/taskFilters";

function formatDueShort(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "dd/MM", { locale: he });
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
  clients?: { name: string; agency_id?: string | null } | null;
  campaigners?: { full_name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
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
    active: "bg-violet-600 text-white shadow-lg shadow-violet-600/35",
    idle: "bg-violet-50 text-violet-800 hover:bg-violet-100",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-violet-200/80 text-violet-900",
  },
  {
    value: "open",
    label: "פתוחות",
    icon: CircleDot,
    active: "bg-sky-500 text-white shadow-lg shadow-sky-500/40",
    idle: "bg-sky-50 text-sky-800 hover:bg-sky-100",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-sky-200/80 text-sky-900",
  },
  {
    value: "done",
    label: "סגורות",
    icon: CheckCircle2,
    active: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40",
    idle: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    countActive: "bg-white/25 text-white",
    countIdle: "bg-emerald-200/80 text-emerald-900",
  },
];

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
  campaignerFilter?: string;
  onCampaignerFilterChange?: (value: string) => void;
  campaignerFilterDisabled?: boolean;
  startDate?: Date;
  endDate?: Date;
  onDateRangeChange?: (range: { startDate?: Date; endDate?: Date }) => void;
  openClosedFilter?: OpenClosedFilter;
  onOpenClosedFilterChange?: (value: OpenClosedFilter) => void;
  clientFilter?: string;
  onClientFilterChange?: (value: string) => void;
  onSaveFilterPreset?: () => void;
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
  campaignerFilter = "all",
  onCampaignerFilterChange,
  campaignerFilterDisabled,
  startDate,
  endDate,
  onDateRangeChange,
  openClosedFilter = "open",
  onOpenClosedFilterChange,
  clientFilter = "all",
  onClientFilterChange,
  onSaveFilterPreset,
}: TasksChatViewProps) {
  const isMobile = useIsMobile();
  const { t } = useTerminology();
  const [listSearch, setListSearch] = useState("");
  const setOpenClosedFilter = onOpenClosedFilterChange ?? (() => undefined);
  const setClientFilter = onClientFilterChange ?? (() => undefined);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const searchedTasks = useMemo(
    () => filterTasksForChatSearch(tasks, listSearch),
    [tasks, listSearch],
  );

  const clientFilteredTasks = useMemo(() => {
    if (clientFilter === "all") return searchedTasks;
    if (clientFilter === "none") return searchedTasks.filter((task) => !task.client_id);
    return searchedTasks.filter((task) => task.client_id === clientFilter);
  }, [searchedTasks, clientFilter]);

  const tabCounts = useMemo(() => ({
    all: clientFilteredTasks.length,
    open: clientFilteredTasks.filter((task) => task.status !== "done").length,
    done: clientFilteredTasks.filter((task) => task.status === "done").length,
  }), [clientFilteredTasks]);

  const filteredTasks = useMemo(() => {
    const byOpenClosed =
      openClosedFilter === "all"
        ? clientFilteredTasks
        : openClosedFilter === "done"
          ? clientFilteredTasks.filter((task) => task.status === "done")
          : clientFilteredTasks.filter((task) => task.status !== "done");
    return sortTasksForChatList(byOpenClosed, today);
  }, [clientFilteredTasks, openClosedFilter, today]);

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
      {(!isMobile || !selectedTaskId) && (
        <div
          className={cn(
            "flex flex-col bg-muted/20 overflow-hidden min-h-0",
            isMobile ? "w-full flex-1" : "w-[28%] min-w-[260px] max-w-[28%] border-s",
          )}
          dir="rtl"
        >
          <div className={cn("border-b bg-card shrink-0 space-y-2", isMobile ? "p-2" : "p-3")}>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש משימה, לקוח או קמפיינר..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="pr-9 h-9 text-sm bg-card"
              />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {OPEN_CLOSED_TABS.map((tab) => {
                const active = openClosedFilter === tab.value;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setOpenClosedFilter(tab.value)}
                    className={cn(
                      "h-12 rounded-lg text-[11px] font-extrabold transition-all inline-flex flex-col items-center justify-center gap-0.5 px-1 leading-tight",
                      active ? tab.active : tab.idle,
                    )}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {tab.label}
                    </span>
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 text-[10px] leading-4 font-bold",
                        active ? tab.countActive : tab.countIdle,
                      )}
                    >
                      {tabCounts[tab.value]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-2 space-y-2">
              <div className={cn("grid gap-2", onCampaignerFilterChange ? "grid-cols-2" : "grid-cols-1")}>
                {onCampaignerFilterChange && (
                  <label className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-violet-800 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {t("role_campaigner")}
                    </span>
                    <Select
                      value={campaignerFilter}
                      onValueChange={onCampaignerFilterChange}
                      disabled={campaignerFilterDisabled}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card border-violet-200 gap-1.5">
                        <SelectValue placeholder={t("role_campaigner")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mine_assigned">שלי וששייכתי</SelectItem>
                        <SelectItem value="mine">שלי בלבד</SelectItem>
                        <SelectItem value="all">כל ה{t("role_campaigner", true)}</SelectItem>
                        <SelectItem value="none">ללא שיוך</SelectItem>
                        {campaignersList?.map((campaigner) => (
                          <SelectItem key={campaigner.id} value={campaigner.id}>
                            {campaigner.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                <label className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    לקוח
                  </span>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="h-9 text-xs bg-card border-amber-200 gap-1.5">
                      <SelectValue placeholder="לקוח" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הלקוחות</SelectItem>
                      <SelectItem value="none">ללא לקוח</SelectItem>
                      {clientsList?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              {onDateRangeChange && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    תאריך יעד
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 flex-1 justify-start text-xs bg-card border-rose-200 font-normal",
                            !startDate && "text-muted-foreground",
                          )}
                        >
                          {startDate ? format(startDate, "dd/MM", { locale: he }) : "מתאריך"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) =>
                            onDateRangeChange({ startDate: date, endDate })
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 flex-1 justify-start text-xs bg-card border-rose-200 font-normal",
                            !endDate && "text-muted-foreground",
                          )}
                        >
                          {endDate ? format(endDate, "dd/MM", { locale: he }) : "עד תאריך"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) =>
                            onDateRangeChange({ startDate, endDate: date })
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    {(startDate || endDate) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-rose-700 hover:text-rose-900"
                        onClick={() => onDateRangeChange({ startDate: undefined, endDate: undefined })}
                        aria-label="נקה תאריך"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {onSaveFilterPreset && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs gap-1.5 bg-card"
                  onClick={onSaveFilterPreset}
                  disabled={campaignerFilterDisabled}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  שמור כברירת מחדל
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-center">
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

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 [scrollbar-width:thin]" dir="rtl">
            <div className="divide-y" dir="rtl">
              {filteredTasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                const overdue = isTaskOverdue(task, today);
                const updatesCount = embedCount(task.task_updates);
                const dueLabel = task.due_date ? formatDueShort(task.due_date) : null;

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
      )}

      {(!isMobile || selectedTaskId) && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-muted/20" dir="rtl">
          {isMobile && selectedTask && (
            <div className="flex items-center gap-2 p-2 border-b shrink-0 bg-background">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => onSelectTask(null)}
                aria-label="חזרה לרשימה"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
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
