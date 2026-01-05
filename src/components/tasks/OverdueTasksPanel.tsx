import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, MessageSquare, Users, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { setNodeRef, isOver } = useDroppable({
    id: "overdue",
  });

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null;
  }

  const overdueCount = tasks.filter(t => t.due_date !== null).length;
  const unscheduledCount = tasks.filter(t => t.due_date === null).length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-destructive/5 border-destructive/30 transition-all duration-200 shrink-0",
        isExpanded ? "min-w-[220px] w-[220px]" : "w-[60px]",
        isOver && "bg-destructive/10"
      )}
    >
      {/* Header */}
      <div 
        className={cn(
          "p-3 border-b border-destructive/30 bg-destructive/10 rounded-t-xl cursor-pointer",
          isExpanded ? "text-center" : "flex flex-col items-center"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-bold text-destructive">באיחור</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueCount > 0 && `${overdueCount} באיחור`}
              {overdueCount > 0 && unscheduledCount > 0 && " | "}
              {unscheduledCount > 0 && `${unscheduledCount} ללא תאריך`}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-bold text-destructive">{tasks.length}</span>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Tasks List - only show when expanded */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {tasks.map((task) => (
            <DraggableOverdueTask
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
