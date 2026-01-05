import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { addDays, addMonths, format, parseISO, isToday, startOfDay, startOfMonth, endOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, CalendarDays, Filter, LayoutGrid, Calendar, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DayColumn } from "./DayColumn";
import { DailyView } from "./DailyView";
import { MonthlyView } from "./MonthlyView";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { TaskFiltersDialog, TaskFilterState, defaultTaskFilters } from "./TaskFiltersDialog";
import { TaskBacklogPanel } from "./OverdueTasksPanel";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
  sort_order?: number;
  duration_minutes?: number;
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  colorId?: string;
  calendarId?: string;
}

export type ViewMode = "daily" | "weekly" | "monthly";

export function WeeklyTaskBoard() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();

  // Start from today instead of week start
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);

  // Full task type from DB
  type FullTask = Task & {
    clients?: { name: string } | null;
    task_updates?: { id: string }[];
    task_collaborators?: { id: string }[];
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Generate 7 days starting from today
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentDate, i));
  }, [currentDate]);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "daily") {
      return { start: currentDate, end: currentDate };
    } else if (viewMode === "monthly") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = addDays(addMonths(monthStart, 1), -1);
      return { start: monthStart, end: monthEnd };
    } else {
      // Weekly - 7 days from current date
      return { start: currentDate, end: addDays(currentDate, 6) };
    }
  }, [currentDate, viewMode]);

  // Fetch user profile to get campaigner_id for "mine" filter
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-for-tasks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch Google Calendar events
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["calendar-events-weekly", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-calendar-events", {
          body: {
            timeMin: dateRange.start.toISOString(),
            timeMax: endOfDay(addDays(dateRange.end, 1)).toISOString(),
          },
        });
        if (error) throw error;
        
        // Transform Google Calendar API response to our CalendarEvent format
        // Only include timed events (with dateTime), skip all-day events (with date only)
        const events = (data?.events || [])
          .filter((event: any) => event.start?.dateTime && event.end?.dateTime)
          .map((event: any) => ({
            id: event.id,
            title: event.summary || "ללא כותרת",
            start: event.start.dateTime,
            end: event.end.dateTime,
            colorId: event.colorId,
            calendarId: event.calendarId,
          }));
        
        return events as CalendarEvent[];
      } catch {
        // User might not have connected calendar - that's ok
        return [];
      }
    },
    enabled: !!user?.id && viewMode !== "monthly",
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch tasks for the current view + overdue tasks
  const { data: fetchedTasks = [], isLoading } = useQuery({
    queryKey: ["tasks", tenantId, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd"), filters, viewMode],
    queryFn: async () => {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const rangeStartStr = format(dateRange.start, "yyyy-MM-dd");
      const rangeEndStr = format(dateRange.end, "yyyy-MM-dd");
      
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients (name),
          task_updates (id),
          task_collaborators (id)
        `)
        .eq("tenant_id", tenantId);

      // Include: current range OR overdue (past due_date with status != done) OR null due_date
      // Overdue = due_date < today AND status != 'done'
      if (filters.startDate && filters.endDate) {
        // Custom date range
        const customStart = format(filters.startDate, "yyyy-MM-dd");
        const customEnd = format(filters.endDate, "yyyy-MM-dd");
        query = query.or(
          `and(due_date.gte.${customStart},due_date.lte.${customEnd}),` +
          `and(due_date.lt.${today},status.neq.done),` +
          `due_date.is.null`
        );
      } else {
        // View range + overdue + unscheduled
        query = query.or(
          `and(due_date.gte.${rangeStartStr},due_date.lte.${rangeEndStr}),` +
          `and(due_date.lt.${today},status.neq.done),` +
          `due_date.is.null`
        );
      }

      // Apply campaigner filter
      if (filters.campaignerId === "mine" && userProfile?.campaigner_id) {
        query = query.eq("campaigner_id", userProfile.campaigner_id);
      } else if (filters.campaignerId === "none") {
        query = query.is("campaigner_id", null);
      } else if (filters.campaignerId !== "all") {
        query = query.eq("campaigner_id", filters.campaignerId);
      }

      // Apply task type filter
      if (filters.taskType !== "all") {
        query = query.eq("task_type", filters.taskType as "campaign" | "collection" | "creative" | "other");
      }

      // Apply association filter
      if (filters.association === "clients") {
        query = query.not("client_id", "is", null);
      } else if (filters.association === "leads") {
        query = query.not("lead_id", "is", null);
      } else if (filters.association === "general") {
        query = query.is("client_id", null).is("lead_id", null);
      }

      const { data, error } = await query
        .order("sort_order", { ascending: true })
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as FullTask[];
    },
    enabled: !!tenantId,
  });

  // Local tasks state for optimistic updates
  const [localTasks, setLocalTasks] = useState<FullTask[]>([]);
  
  useEffect(() => {
    setLocalTasks(fetchedTasks);
  }, [fetchedTasks]);
  
  // Use localTasks for rendering
  const tasks = localTasks;

  const { data: firstAgency } = useQuery({
    queryKey: ["first-agency", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!tenantId,
  });

  // Add task mutation
  const addTask = useMutation({
    mutationFn: async ({ title, date }: { title: string; date: Date }) => {
      const { error } = await supabase.from("tasks").insert({
        title,
        due_date: format(date, "yyyy-MM-dd"),
        status: "open",
        priority: 5,
        tenant_id: tenantId,
        agency_id: firstAgency?.id,
        campaigner_id: userProfile?.campaigner_id || null,
        client_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("משימה נוספה");
    },
    onError: () => {
      toast.error("שגיאה בהוספת משימה");
    },
  });

  // Toggle complete mutation
  const toggleComplete = useMutation({
    mutationFn: async ({
      taskId,
      completed,
    }: {
      taskId: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: completed ? "done" : "open" })
        .eq("id", taskId);
      if (error) throw error;
      return completed;
    },
    onSuccess: (completed) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (completed) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        toast.success("כל הכבוד! המשימה הושלמה 🎉");
      }
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  // Update due date mutation (for drag & drop)
  const updateDueDate = useMutation({
    mutationFn: async ({
      taskId,
      newDate,
      newTime,
    }: {
      taskId: string;
      newDate: string;
      newTime?: string | null;
    }) => {
      const updateData: { due_date: string; due_time?: string | null } = { due_date: newDate };
      if (newTime !== undefined) {
        updateData.due_time = newTime;
      }
      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("תאריך המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון התאריך");
    },
  });

  // Update sort order mutation (for reordering within a day)
  const updateSortOrder = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("tasks")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      toast.error("שגיאה בעדכון סדר המשימות");
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("המשימה נמחקה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת המשימה");
    },
  });

  // Update task duration mutation (for resize)
  const updateDuration = useMutation({
    mutationFn: async ({ taskId, duration }: { taskId: string; duration: number }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ duration_minutes: duration })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("משך המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון משך המשימה");
    },
  });

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  // Handle drag end with optimistic update
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const dropTarget = over.id as string;
    const draggedTask = localTasks.find((t) => t.id === taskId);
    
    if (!draggedTask) return;

    // Check if dropped on another task (reordering within same container)
    const targetTask = localTasks.find((t) => t.id === dropTarget);
    if (targetTask) {
      // Both tasks should be in the same day and same time slot for reordering
      if (
        draggedTask.due_date === targetTask.due_date &&
        draggedTask.due_time === targetTask.due_time
      ) {
        // Get tasks in the same container
        const containerTasks = localTasks
          .filter(
            (t) =>
              t.due_date === draggedTask.due_date &&
              t.due_time === draggedTask.due_time
          )
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const oldIndex = containerTasks.findIndex((t) => t.id === taskId);
        const newIndex = containerTasks.findIndex((t) => t.id === dropTarget);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(containerTasks, oldIndex, newIndex);
          const updates = reordered.map((t, idx) => ({
            id: t.id,
            sort_order: idx,
          }));
          
          // Optimistic update for reordering
          setLocalTasks(prev => {
            const updated = [...prev];
            updates.forEach(u => {
              const idx = updated.findIndex(t => t.id === u.id);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], sort_order: u.sort_order };
              }
            });
            return updated;
          });
          
          updateSortOrder.mutate(updates);
        }
      }
      return;
    }

    // Check if drop target includes time (format: ISO_DATE_TIME)
    if (dropTarget.includes("_")) {
      const [dateStr, time] = dropTarget.split("_");
      try {
        const parsedDate = parseISO(dateStr);
        const newDate = format(parsedDate, "yyyy-MM-dd");
        const newTime = time + ":00";
        
        // Optimistic update
        setLocalTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, due_date: newDate, due_time: newTime } : t
        ));
        
        updateDueDate.mutate({
          taskId,
          newDate,
          newTime,
        });
      } catch {
        // Invalid format
      }
    } else {
      // Just date - drop on untimed section
      try {
        const parsedDate = parseISO(dropTarget);
        const newDate = format(parsedDate, "yyyy-MM-dd");
        
        // Optimistic update
        setLocalTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, due_date: newDate, due_time: null } : t
        ));
        
        updateDueDate.mutate({
          taskId,
          newDate,
          newTime: null,
        });
      } catch {
        // Invalid date, ignore
      }
    }
  };

  const activeTask = activeTaskId
    ? tasks.find((t) => t.id === activeTaskId)
    : null;

  // Split tasks: backlog (overdue + unscheduled + untimed) vs scheduled in range
  const today = startOfDay(new Date());
  
  // Backlog includes: overdue, no due_date, or has due_date but no due_time
  const backlogTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    if (t.due_date === null) return true; // Unscheduled
    const dueDate = new Date(t.due_date);
    if (dueDate < today) return true; // Overdue
    if (!t.due_time) return true; // Has date but no time - goes to backlog
    return false;
  });

  // Current range tasks: only those with both due_date AND due_time in range
  const currentRangeTasks = tasks.filter((t) => {
    if (t.due_date === null) return false;
    if (!t.due_time) return false; // No time = goes to backlog
    const dueDate = new Date(t.due_date);
    if (dueDate < today && t.status !== "done") return false; // Overdue, show in backlog
    return dueDate >= dateRange.start && dueDate <= dateRange.end;
  });

  // For daily view - filter tasks for the specific day
  const dailyTasks = currentRangeTasks.filter((t) => {
    if (!t.due_date) return false;
    return format(new Date(t.due_date), "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");
  });

  // Count active filters
  const activeFiltersCount = [
    filters.campaignerId !== "all",
    filters.taskType !== "all",
    filters.association !== "all",
    filters.startDate !== undefined,
    filters.endDate !== undefined,
  ].filter(Boolean).length;

  const goToToday = () => {
    setCurrentDate(startOfDay(new Date()));
  };

  const goToPrev = () => {
    if (viewMode === "daily") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else if (viewMode === "weekly") {
      setCurrentDate((prev) => addDays(prev, -7));
    } else {
      setCurrentDate((prev) => addMonths(prev, -1));
    }
  };

  const goToNext = () => {
    if (viewMode === "daily") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (viewMode === "weekly") {
      setCurrentDate((prev) => addDays(prev, 7));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const handleViewModeChange = (value: string) => {
    if (value) {
      setViewMode(value as ViewMode);
    }
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode("daily");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrev}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday} className="gap-2">
            <CalendarDays className="h-4 w-4" />
            היום
          </Button>
          <Button
            variant="outline"
            onClick={() => setFiltersDialogOpen(true)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            פילטרים
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={handleViewModeChange}
            className="border rounded-lg"
          >
            <ToggleGroupItem value="daily" aria-label="תצוגה יומית" className="gap-1 px-3">
              <List className="h-4 w-4" />
              יומי
            </ToggleGroupItem>
            <ToggleGroupItem value="weekly" aria-label="תצוגה שבועית" className="gap-1 px-3">
              <LayoutGrid className="h-4 w-4" />
              שבועי
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" aria-label="תצוגה חודשית" className="gap-1 px-3">
              <Calendar className="h-4 w-4" />
              חודשי
            </ToggleGroupItem>
          </ToggleGroup>

          <h2 className="text-lg font-semibold">
            {viewMode === "daily" && format(currentDate, "EEEE, dd MMMM yyyy", { locale: he })}
            {viewMode === "weekly" && format(currentDate, "MMMM yyyy", { locale: he })}
            {viewMode === "monthly" && format(currentDate, "MMMM yyyy", { locale: he })}
          </h2>
        </div>
      </div>

      {/* Board with Overdue Panel */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-4 flex-1">
          {/* Task Backlog Panel - Always visible on the right */}
          <TaskBacklogPanel
            tasks={backlogTasks}
            onToggleComplete={(taskId, completed) =>
              toggleComplete.mutate({ taskId, completed })
            }
            onTaskClick={(task) => {
              setSelectedTask(task);
              setDialogOpen(true);
            }}
            onAddTask={(title) => addTask.mutate({ title, date: null })}
            isLoading={isLoading || addTask.isPending}
          />

          {/* Main View based on viewMode */}
          {viewMode === "daily" && (
            <DailyView
              date={currentDate}
              tasks={dailyTasks}
              onToggleComplete={(taskId, completed) =>
                toggleComplete.mutate({ taskId, completed })
              }
              onTaskClick={(task) => {
                setSelectedTask(task);
                setDialogOpen(true);
              }}
              onDropOnSlot={(taskId, time) => {
                updateDueDate.mutate({
                  taskId,
                  newDate: format(currentDate, "yyyy-MM-dd"),
                  newTime: time + ":00",
                });
              }}
            />
          )}

          {viewMode === "weekly" && weekDays.map((date) => (
            <DayColumn
              key={date.toISOString()}
              date={date}
              tasks={currentRangeTasks}
              onAddTask={(title, date) => addTask.mutate({ title, date })}
              onToggleComplete={(taskId, completed) =>
                toggleComplete.mutate({ taskId, completed })
              }
              onTaskClick={(task) => {
                setSelectedTask(task);
                setDialogOpen(true);
              }}
              onDurationChange={(taskId, duration) =>
                updateDuration.mutate({ taskId, duration })
              }
              isLoading={isLoading || addTask.isPending}
              isCurrentDay={isToday(date)}
              calendarEvents={calendarEvents}
            />
          ))}

          {viewMode === "monthly" && (
            <MonthlyView
              currentDate={currentDate}
              tasks={currentRangeTasks}
              onDayClick={handleDayClick}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setDialogOpen(true);
              }}
            />
          )}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="p-2 rounded-lg border bg-card shadow-lg">
              <p className="text-sm font-medium">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDelete={(taskId) => deleteTask.mutate(taskId)}
      />

      {/* Filters Dialog */}
      <TaskFiltersDialog
        open={filtersDialogOpen}
        onOpenChange={setFiltersDialogOpen}
        currentFilters={filters}
        onApply={setFilters}
      />
    </div>
  );
}
