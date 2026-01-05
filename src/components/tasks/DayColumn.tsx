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

// Generate time slots for the day (08:00 - 20:00)
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

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
        "flex items-start gap-2 py-1 px-2 border-b border-dashed border-muted min-h-[32px]",
        isOver && "bg-accent/50"
      )}
    >
      <span className="text-xs text-muted-foreground w-10 shrink-0 pt-1">
        {time}
      </span>
      <div className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {slotTasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onClick={() => onTaskClick(task)}
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

  const dayTasks = tasks.filter(
    (task) => task.due_date && isSameDay(new Date(task.due_date), date)
  );

  // Tasks without time go to "no time" section
  const untimedTasks = dayTasks
    .filter((t) => !t.due_time)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const untimedTaskIds = untimedTasks.map((t) => t.id);
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

      {/* Untimed Tasks Section */}
      <div className="p-2 border-b">
        <p className="text-xs text-muted-foreground mb-1">ללא שעה</p>
        <SortableContext items={untimedTaskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {untimedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-2">
                אין משימות
              </p>
            ) : (
              untimedTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onClick={() => onTaskClick(task)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>

      {/* Time Slots */}
      <div className="flex-1">
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
