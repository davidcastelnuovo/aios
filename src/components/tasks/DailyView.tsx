import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Users } from "lucide-react";
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

interface DailyViewProps {
  date: Date;
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  onDropOnSlot: (taskId: string, time: string) => void;
}

// Generate time slots from 06:00 to 23:30
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

function DraggableTask({
  task,
  onToggleComplete,
  onClick,
}: {
  task: Task;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const isCompleted = task.status === "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) =>
              onToggleComplete(task.id, checked as boolean)
            }
          />
        </div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <p
            className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>
          {task.clients?.name && (
            <p className="text-xs text-muted-foreground truncate">
              {task.clients.name}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1">
            {(task.task_updates?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {task.task_updates?.length}
              </Badge>
            )}
            {(task.task_collaborators?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {task.task_collaborators?.length}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSlot({
  time,
  tasks,
  date,
  onToggleComplete,
  onTaskClick,
}: {
  time: string;
  tasks: Task[];
  date: Date;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
}) {
  const droppableId = `${date.toISOString()}_${time}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
  });

  const slotTasks = tasks.filter((t) => {
    if (!t.due_time) return false;
    // Format time to match HH:MM
    const taskTime = t.due_time.substring(0, 5);
    return taskTime === time;
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex border-b min-h-[50px] transition-colors",
        isOver && "bg-accent/50"
      )}
    >
      <div className="w-16 flex-shrink-0 p-2 border-l text-xs text-muted-foreground font-medium">
        {time}
      </div>
      <div className="flex-1 p-1 space-y-1">
        {slotTasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
}

export function DailyView({
  date,
  tasks,
  onToggleComplete,
  onTaskClick,
}: DailyViewProps) {
  // Tasks without a specific time
  const untimedTasks = tasks.filter((t) => !t.due_time);

  return (
    <div className="flex-1 flex flex-col rounded-xl border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-primary/10 text-center">
        <p className="text-lg font-bold">
          {format(date, "EEEE", { locale: he })}
        </p>
        <p className="text-sm text-muted-foreground">
          {format(date, "dd/MM/yyyy")}
        </p>
      </div>

      {/* Untimed tasks section */}
      {untimedTasks.length > 0 && (
        <div className="p-3 border-b bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            ללא שעה ({untimedTasks.length})
          </p>
          <div className="space-y-2">
            {untimedTasks.map((task) => (
              <DraggableTask
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time slots */}
      <ScrollArea className="flex-1">
        <div>
          {TIME_SLOTS.map((time) => (
            <TimeSlot
              key={time}
              time={time}
              tasks={tasks}
              date={date}
              onToggleComplete={onToggleComplete}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
