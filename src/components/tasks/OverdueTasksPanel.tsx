import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ListTodo, MessageSquare, Users, Clock, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { QuickTaskInput } from "./QuickTaskInput";

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

interface TaskBacklogPanelProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  onAddTask?: (title: string) => void;
  isLoading?: boolean;
}

function DraggableBacklogTask({
  task,
  onToggleComplete,
  onClick,
  isOverdue,
}: {
  task: Task;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
  isOverdue: boolean;
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
            {isOverdue && task.due_date && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/50">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(task.due_date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
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

export function TaskBacklogPanel({
  tasks,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  isLoading,
}: TaskBacklogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const { setNodeRef, isOver } = useDroppable({
    id: "backlog",
  });

  // Separate tasks by type:
  // 1. Overdue = has due_date in the past
  // 2. Untimed = has due_date but no due_time (for today or future)
  // 3. Unscheduled = no due_date at all
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate < today;
  });
  
  const untimedTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate >= today && !t.due_time;
  });
  
  const unscheduledTasks = tasks.filter(t => !t.due_date);
  
  const overdueCount = overdueTasks.length;
  const untimedCount = untimedTasks.length;
  const unscheduledCount = unscheduledTasks.length;
  const totalCount = tasks.length;

  // Don't render if no tasks
  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border transition-all duration-200 shrink-0",
        overdueCount > 0 
          ? "bg-destructive/5 border-destructive/30" 
          : "bg-muted/30 border-border",
        isExpanded ? "min-w-[260px] w-[260px]" : "w-[60px]",
        isOver && (overdueCount > 0 ? "bg-destructive/10" : "bg-accent/50")
      )}
    >
      {/* Header */}
      <div 
        className={cn(
          "p-3 border-b rounded-t-xl cursor-pointer",
          overdueCount > 0 
            ? "border-destructive/30 bg-destructive/10" 
            : "border-border bg-muted/50",
          isExpanded ? "text-center" : "flex flex-col items-center"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 justify-center">
                <ListTodo className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">רשימת משימות</p>
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
              {overdueCount > 0 && (
                <span className="text-destructive">{overdueCount} באיחור</span>
              )}
              {overdueCount > 0 && (untimedCount > 0 || unscheduledCount > 0) && " | "}
              {(untimedCount + unscheduledCount) > 0 && `${untimedCount + unscheduledCount} ללא זמן`}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <ListTodo className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">{totalCount}</span>
            {overdueCount > 0 && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Tasks List - only show when expanded */}
      {isExpanded && (
        <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-250px)]">
          {/* Quick Add Input */}
          {onAddTask && (
            <div className="pb-2 border-b border-border/50 mb-2">
              <QuickTaskInput
                onAddTask={onAddTask}
                disabled={isLoading}
              />
            </div>
          )}
          {/* Overdue section */}
          {overdueCount > 0 && (
            <>
              <div className="flex items-center gap-1 px-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-xs font-medium text-destructive">באיחור</span>
              </div>
              {overdueTasks.map((task) => (
                <DraggableBacklogTask
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onClick={() => onTaskClick(task)}
                  isOverdue
                />
              ))}
            </>
          )}
          
          {/* Untimed section - has date but no time */}
          {untimedCount > 0 && (
            <>
              <div className="flex items-center gap-1 px-1 mt-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">ממתין לזמן</span>
              </div>
              {untimedTasks.map((task) => (
                <DraggableBacklogTask
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onClick={() => onTaskClick(task)}
                  isOverdue={false}
                />
              ))}
            </>
          )}
          
          {/* Unscheduled section - no date at all */}
          {unscheduledCount > 0 && (
            <>
              <div className="flex items-center gap-1 px-1 mt-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">ללא תאריך</span>
              </div>
              {unscheduledTasks.map((task) => (
                <DraggableBacklogTask
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onClick={() => onTaskClick(task)}
                  isOverdue={false}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Keep old export for backwards compatibility
export const OverdueTasksPanel = TaskBacklogPanel;
