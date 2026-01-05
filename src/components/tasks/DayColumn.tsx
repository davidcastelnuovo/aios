import { useDroppable } from "@dnd-kit/core";
import { format, isToday, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { QuickTaskInput } from "./QuickTaskInput";
import { TaskItem } from "./TaskItem";
import { cn } from "@/lib/utils";

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
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onAddTask: (title: string, date: Date) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
  isCurrentDay?: boolean;
}

export function DayColumn({
  date,
  tasks,
  onAddTask,
  onToggleComplete,
  onTaskClick,
  isLoading,
  isCurrentDay,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: date.toISOString(),
  });

  const dayTasks = tasks.filter(
    (task) => task.due_date && isSameDay(new Date(task.due_date), date)
  );

  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/30",
        isCurrentDay ? "min-w-[300px] flex-[1.5]" : "min-w-[200px] flex-1",
        today && "ring-2 ring-primary/50 bg-primary/5",
        isOver && "bg-accent/50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b text-center",
          today && "bg-primary/10"
        )}
      >
        <p className="text-xs text-muted-foreground">
          {format(date, "EEEE", { locale: he })}
        </p>
        <p
          className={cn(
            "text-lg font-bold",
            today && "text-primary"
          )}
        >
          {format(date, "dd/MM")}
        </p>
      </div>

      {/* Quick Add Input */}
      <div className="p-2 border-b">
        <QuickTaskInput
          onAddTask={(title) => onAddTask(title, date)}
          disabled={isLoading}
        />
      </div>

      {/* Tasks List - no scroll, grows with content */}
      <div className="p-2 space-y-2">
        {dayTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            אין משימות
          </p>
        ) : (
          dayTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}
