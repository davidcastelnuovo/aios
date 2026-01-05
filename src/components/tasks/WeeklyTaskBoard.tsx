import { useState, useMemo, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ChevronLeft, CalendarDays, Filter, LayoutGrid, Calendar, List, Plus } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DayColumn } from "./DayColumn";
import { DailyView } from "./DailyView";
import { MonthlyView } from "./MonthlyView";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { TaskFiltersDialog, TaskFilterState, defaultTaskFilters } from "./TaskFiltersDialog";
import { TaskBacklogPanel } from "./OverdueTasksPanel";
import { CalendarEventEditDialog } from "./CalendarEventEditDialog";
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
  const { state: sidebarState } = useSidebar();

  // Start from today instead of week start
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [calendarEventDialogOpen, setCalendarEventDialogOpen] = useState(false);
  const [quickAddSlot, setQuickAddSlot] = useState<{ date: Date; time: string } | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  // Full task type from DB
  type FullTask = Task & {
    clients?: { name: string } | null;
    task_updates?: { id: string }[];
    task_collaborators?: { id: string }[];
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
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
    if (fetchedTasks && fetchedTasks.length > 0) {
      setLocalTasks(fetchedTasks);
    }
  }, [JSON.stringify(fetchedTasks?.map(t => t.id))]);
  
  // Use localTasks for rendering, fallback to fetchedTasks if empty
  const tasks = localTasks.length > 0 ? localTasks : (fetchedTasks || []);

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
    mutationFn: async ({ title, date, time }: { title: string; date: Date | null; time?: string }) => {
      const insertData: any = {
        title,
        status: "open",
        priority: 5,
        tenant_id: tenantId,
        agency_id: firstAgency?.id,
        campaigner_id: userProfile?.campaigner_id || null,
        client_id: null,
      };
      if (date) {
        insertData.due_date = format(date, "yyyy-MM-dd");
      }
      if (time) {
        insertData.due_time = time + ":00";
      }
      const { error } = await supabase.from("tasks").insert(insertData);
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

  // Update calendar event mutation
  const updateCalendarEvent = useMutation({
    mutationFn: async ({ 
      eventId, 
      summary, 
      description, 
      start, 
      end 
    }: { 
      eventId: string; 
      summary?: string; 
      description?: string; 
      start: string; 
      end: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("update-calendar-event", {
        body: { eventId, summary, description, start, end },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events-weekly"] });
      toast.success("האירוע עודכן בהצלחה");
      setCalendarEventDialogOpen(false);
      setSelectedCalendarEvent(null);
    },
    onError: () => {
      toast.error("שגיאה בעדכון האירוע");
    },
  });

  // Delete calendar event mutation
  const deleteCalendarEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-calendar-event", {
        body: { eventId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events-weekly"] });
      toast.success("האירוע נמחק בהצלחה");
      setCalendarEventDialogOpen(false);
      setSelectedCalendarEvent(null);
    },
    onError: () => {
      toast.error("שגיאה במחיקת האירוע");
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

    const activeId = active.id as string;
    const dropTarget = over.id as string;

    // Check if this is a calendar event drag
    if (activeId.startsWith('calendar-event-')) {
      const eventId = activeId.replace('calendar-event-', '');
      const draggedEvent = calendarEvents.find((e) => e.id === eventId);
      
      if (!draggedEvent) return;

      // Check if drop target includes time (format: ISO_DATE_TIME)
      if (dropTarget.includes("_")) {
        const [dateStr, time] = dropTarget.split("_");
        try {
          const parsedDate = parseISO(dateStr);
          const newDateStr = format(parsedDate, "yyyy-MM-dd");
          
          // Calculate duration from original event
          const originalStart = new Date(draggedEvent.start);
          const originalEnd = new Date(draggedEvent.end);
          const durationMs = originalEnd.getTime() - originalStart.getTime();
          
          // Create new start time
          const [hours, minutes] = time.split(":").map(Number);
          const newStart = new Date(parsedDate);
          newStart.setHours(hours, minutes, 0, 0);
          
          // Create new end time based on original duration
          const newEnd = new Date(newStart.getTime() + durationMs);
          
          updateCalendarEvent.mutate({
            eventId,
            start: newStart.toISOString(),
            end: newEnd.toISOString(),
          });
        } catch {
          // Invalid format
        }
      }
      return;
    }

    // Regular task drag
    const taskId = activeId;
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

  // For daily view - filter tasks for the specific day (include tasks with OR without time)
  const dailyTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    if (t.status === "done") return false;
    const dueDate = new Date(t.due_date);
    const isToday = format(dueDate, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");
    // For daily view, include all tasks for that day regardless of time
    return isToday;
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

  // Handle double-click on time slot to add task
  const handleSlotDoubleClick = (date: Date, time: string) => {
    setQuickAddSlot({ date, time });
    setQuickAddTitle("");
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddTitle.trim() && quickAddSlot) {
      addTask.mutate({ 
        title: quickAddTitle.trim(), 
        date: quickAddSlot.date, 
        time: quickAddSlot.time 
      });
      setQuickAddSlot(null);
      setQuickAddTitle("");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header - Desktop only */}
      <div className="hidden md:flex md:items-center md:justify-between mb-4 gap-3">
        {/* Navigation controls */}
        <div className="flex items-center gap-2 flex-wrap">
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
        
        {/* View mode and date */}
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {viewMode === "daily" && format(currentDate, "EEEE, dd MMMM yyyy", { locale: he })}
            {viewMode === "weekly" && format(currentDate, "MMMM yyyy", { locale: he })}
            {viewMode === "monthly" && format(currentDate, "MMMM yyyy", { locale: he })}
          </h2>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={handleViewModeChange}
            className="border rounded-lg"
          >
            <ToggleGroupItem value="daily" aria-label="תצוגה יומית" className="gap-1 px-3">
              <List className="h-4 w-4" />
              <span>יומי</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="weekly" aria-label="תצוגה שבועית" className="gap-1 px-3">
              <LayoutGrid className="h-4 w-4" />
              <span>שבועי</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" aria-label="תצוגה חודשית" className="gap-1 px-3">
              <Calendar className="h-4 w-4" />
              <span>חודשי</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Board with Overdue Panel */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Mobile Layout */}
        <div className="flex flex-col md:hidden gap-2">
          {/* Row 1: Task Panel RIGHT, Title + Filters LEFT */}
          <div className="flex gap-2 items-start justify-between">
            {/* RIGHT: Task Backlog Panel - first in DOM for RTL */}
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
            
            {/* LEFT: Title + Navigation + Filters - second in DOM for RTL */}
            <div className="flex flex-col gap-2">
              {/* Title + Navigation */}
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">משימות</h1>
                <Button variant="outline" size="icon" onClick={goToPrev}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToToday}>
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Filters row */}
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold truncate">
                  {viewMode === "daily" && format(currentDate, "EEEE, dd/MM", { locale: he })}
                  {viewMode === "weekly" && format(currentDate, "MMMM yyyy", { locale: he })}
                  {viewMode === "monthly" && format(currentDate, "MMMM yyyy", { locale: he })}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFiltersDialogOpen(true)}
                  className="relative"
                >
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={handleViewModeChange}
                  className="border rounded-lg"
                >
                  <ToggleGroupItem value="daily" aria-label="תצוגה יומית" className="px-2">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="weekly" aria-label="תצוגה שבועית" className="px-2">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="monthly" aria-label="תצוגה חודשית" className="px-2">
                    <Calendar className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>
          
          {/* Bottom: Calendar/Tasks - takes remaining height with scroll */}
          <div className="min-h-[300px] overflow-x-auto">
            <div className="flex gap-2 pb-4 min-w-max">
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
                  onCalendarEventClick={(event) => {
                    setSelectedCalendarEvent(event);
                    setCalendarEventDialogOpen(true);
                  }}
                  onSlotDoubleClick={handleSlotDoubleClick}
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
          </div>
        </div>

        {/* Desktop: Side by side with fixed panel */}
        <div className="hidden md:flex gap-2 flex-1 relative min-h-0">
          {/* Scrollable days container - with padding for fixed panel */}
          <div className="flex gap-2 overflow-x-auto pb-4 flex-1 pr-[280px] min-h-0">
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
                onCalendarEventClick={(event) => {
                  setSelectedCalendarEvent(event);
                  setCalendarEventDialogOpen(true);
                }}
                onSlotDoubleClick={handleSlotDoubleClick}
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

          {/* Task Backlog Panel - Fixed on desktop */}
          <div className={`fixed top-[200px] z-20 transition-all duration-200 ${
            sidebarState === "collapsed" 
              ? "right-[calc(var(--sidebar-width-icon,3rem)+1rem)]" 
              : "right-[calc(var(--sidebar-width,16rem)+1rem)]"
          }`}>
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
          </div>
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

      {/* Calendar Event Edit Dialog */}
      <CalendarEventEditDialog
        event={selectedCalendarEvent}
        open={calendarEventDialogOpen}
        onOpenChange={setCalendarEventDialogOpen}
        onSave={(eventId, data) => {
          updateCalendarEvent.mutate({
            eventId,
            summary: data.summary,
            description: data.description,
            start: data.start,
            end: data.end,
          });
        }}
        onDelete={(eventId) => deleteCalendarEvent.mutate(eventId)}
        isLoading={updateCalendarEvent.isPending || deleteCalendarEvent.isPending}
      />

      {/* Filters Dialog */}
      <TaskFiltersDialog
        open={filtersDialogOpen}
        onOpenChange={setFiltersDialogOpen}
        currentFilters={filters}
        onApply={setFilters}
      />

      {/* Quick Add Task Dialog (double-click on slot) */}
      <Dialog open={!!quickAddSlot} onOpenChange={(open) => !open && setQuickAddSlot(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-right">
              הוספת משימה ל-{quickAddSlot?.time}
              {quickAddSlot && (
                <span className="block text-sm font-normal text-muted-foreground">
                  {format(quickAddSlot.date, "EEEE, dd/MM", { locale: he })}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickAddSubmit} className="flex gap-2">
            <Input
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              placeholder="שם המשימה..."
              autoFocus
              enterKeyHint="send"
              className="flex-1"
            />
            <Button type="submit" disabled={!quickAddTitle.trim() || addTask.isPending}>
              <Plus className="h-4 w-4 ml-1" />
              הוסף
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
