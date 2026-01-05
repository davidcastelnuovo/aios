import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { addDays, startOfWeek, format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
import { DayColumn } from "./DayColumn";
import { TaskDetailDialog } from "./TaskDetailDialog";
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
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

export function WeeklyTaskBoard() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", tenantId, format(currentWeekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const weekEnd = addDays(currentWeekStart, 6);
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients (name),
          task_updates (id),
          task_collaborators (id)
        `)
        .eq("tenant_id", tenantId)
        .gte("due_date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("due_date", format(weekEnd, "yyyy-MM-dd"))
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as FullTask[];
    },
    enabled: !!tenantId,
  });

  // Fetch user's campaigner info and first agency
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
    }: {
      taskId: string;
      newDate: string;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: newDate })
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

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newDate = over.id as string;

    // Parse the ISO date string from droppable id
    try {
      const parsedDate = parseISO(newDate);
      updateDueDate.mutate({
        taskId,
        newDate: format(parsedDate, "yyyy-MM-dd"),
      });
    } catch {
      // Invalid date, ignore
    }
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const goToPrevWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday} className="gap-2">
            <CalendarDays className="h-4 w-4" />
            היום
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {format(currentWeekStart, "MMMM yyyy", { locale: he })}
        </h2>
      </div>

      {/* Week Board */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-4 flex-1">
          {weekDays.map((date) => (
            <DayColumn
              key={date.toISOString()}
              date={date}
              tasks={tasks}
              onAddTask={(title, date) => addTask.mutate({ title, date })}
              onToggleComplete={(taskId, completed) =>
                toggleComplete.mutate({ taskId, completed })
              }
              onTaskClick={(task) => {
                setSelectedTask(task);
                setDialogOpen(true);
              }}
              isLoading={isLoading || addTask.isPending}
            />
          ))}
        </div>
      </DndContext>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDelete={(taskId) => deleteTask.mutate(taskId)}
      />
    </div>
  );
}
