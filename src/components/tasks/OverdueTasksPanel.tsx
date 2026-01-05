import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, MessageSquare, Users, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface OverdueTasksPanelProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
}

function DraggableOverdueTask({
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
  const isOverdue = task.due_date !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60",
        isOverdue && "border-destructive/50 bg-destructive/5"
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
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {task.due_date && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/50">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(task.due_date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
              </Badge>
            )}
            {!task.due_date && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                ללא תאריך
              </Badge>
            )}
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

export function OverdueTasksPanel({
  tasks,
  onToggleComplete,
  onTaskClick,
}: OverdueTasksPanelProps) {
  const overdueCount = tasks.filter(t => t.due_date !== null).length;
  const unscheduledCount = tasks.filter(t => t.due_date === null).length;

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] rounded-xl border bg-destructive/5 border-destructive/30">
      {/* Header */}
      <div className="p-3 border-b border-destructive/30 text-center bg-destructive/10 rounded-t-xl">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-bold text-destructive">באיחור</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {overdueCount > 0 && `${overdueCount} באיחור`}
          {overdueCount > 0 && unscheduledCount > 0 && " | "}
          {unscheduledCount > 0 && `${unscheduledCount} ללא תאריך`}
        </p>
      </div>

      {/* Tasks List */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-380px)]">
        <div className="p-2 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              אין משימות באיחור 🎉
            </p>
          ) : (
            tasks.map((task) => (
              <DraggableOverdueTask
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onClick={() => onTaskClick(task)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
