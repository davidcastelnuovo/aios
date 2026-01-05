import { useDraggable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, GripVertical, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

interface UnscheduledTasksPanelProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
}

function DraggableUnscheduledTask({
  task,
  onToggleComplete,
  onClick,
}: {
  task: Task;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isCompleted = task.status === "done";
  const updatesCount = task.task_updates?.length || 0;
  const collaboratorsCount = task.task_collaborators?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Checkbox
          checked={isCompleted}
          onCheckedChange={(checked) => onToggleComplete(task.id, checked === true)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0" onClick={onClick}>
          <p
            className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>
          <div className="flex gap-1 flex-wrap mt-1">
            {task.clients?.name && (
              <Badge variant="secondary" className="text-xs py-0">
                {task.clients.name}
              </Badge>
            )}
            {updatesCount > 0 && (
              <Badge variant="outline" className="text-xs py-0 gap-1">
                <MessageSquare className="h-3 w-3" />
                {updatesCount}
              </Badge>
            )}
            {collaboratorsCount > 0 && (
              <Badge variant="outline" className="text-xs py-0 gap-1">
                <Users className="h-3 w-3" />
                {collaboratorsCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnscheduledTasksPanel({
  tasks,
  onToggleComplete,
  onTaskClick,
}: UnscheduledTasksPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="w-64 shrink-0 border rounded-lg bg-card/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">ללא תאריך</span>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="p-2 space-y-2">
            {tasks.map((task) => (
              <DraggableUnscheduledTask
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
