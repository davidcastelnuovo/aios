import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { format, isToday, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { QuickTaskInput } from "./QuickTaskInput";
import { SortableTaskItem } from "./SortableTaskItem";
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
  sort_order?: number;
  duration_minutes?: number;
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onAddTask: (title: string, date: Date, time?: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
  isCurrentDay?: boolean;
}

// Generate half-hour time slots for the day (08:00 - 20:00)
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
];

const SLOT_HEIGHT = 40; // Height in pixels for each half-hour slot

function TimeSlotDroppable({
  date,
  time,
  tasks,
  onToggleComplete,
  onTaskClick,
}: {
  date: Date;
  time: string;
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
}) {
  const droppableId = `${date.toISOString()}_${time}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const slotTasks = tasks.filter((t) => {
    if (!t.due_time) return false;
    return t.due_time.startsWith(time);
  });

  const taskIds = slotTasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-start gap-1 py-0.5 px-1 border-b border-dashed border-muted relative",
        isOver && "bg-accent/50"
      )}
      style={{ minHeight: `${SLOT_HEIGHT}px` }}
    >
      <span className="text-[10px] text-muted-foreground w-8 shrink-0 pt-1">
        {time}
      </span>
      <div className="flex-1 min-w-0">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {slotTasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onClick={() => onTaskClick(task)}
              compact
              slotHeight={SLOT_HEIGHT}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
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

  // Only show tasks with time
  const dayTasks = tasks.filter(
    (task) => task.due_date && task.due_time && isSameDay(new Date(task.due_date), date)
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

      {/* Time Slots */}
      <div className="flex-1 overflow-y-auto">
        {TIME_SLOTS.map((time) => (
          <TimeSlotDroppable
            key={time}
            date={date}
            time={time}
            tasks={dayTasks}
            onToggleComplete={onToggleComplete}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
