import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ListTodo, MessageSquare, Users, CalendarDays, Clock, ChevronLeft, ChevronRight, AlertTriangle, GripVertical, Megaphone, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  created_at?: string;
  clients?: { name: string } | null;
  campaigners?: { full_name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface TaskBacklogPanelProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  onAddTask?: (title: string) => void;
  isLoading?: boolean;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  onUpdateClient?: (taskId: string, clientId: string | null) => void;
  onUpdateCampaigner?: (taskId: string, campaignerId: string | null) => void;
}

function DraggableBacklogTask({
  task,
  onToggleComplete,
  onClick,
  isOverdue,
  clientsList,
  campaignersList,
  onUpdateClient,
  onUpdateCampaigner,
}: {
  task: Task;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
  isOverdue: boolean;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  onUpdateClient?: (taskId: string, clientId: string | null) => void;
  onUpdateCampaigner?: (taskId: string, campaignerId: string | null) => void;
}) {
  const [clientOpen, setClientOpen] = useState(false);
  const [campaignerOpen, setCampaignerOpen] = useState(false);
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
      className={cn(
        "p-2 rounded-lg border bg-card transition-all",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) =>
              onToggleComplete(task.id, checked as boolean)
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <div onClick={onClick}>
            <p
              className={cn(
                "text-sm font-medium whitespace-normal break-words",
                isCompleted && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </p>
          </div>

          {/* Inline client & campaigner selectors */}
          {(onUpdateClient || onUpdateCampaigner) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {onUpdateClient && clientsList && (
                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 h-6 text-[11px] w-[110px] px-1.5 rounded-md border bg-background hover:bg-accent/50 truncate">
                      <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{task.client_id ? clientsList.find(c => c.id === task.client_id)?.name || "לקוח" : "ללא לקוח"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 z-50" align="start">
                    <Command>
                      <CommandInput placeholder="חיפוש לקוח..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>לא נמצא</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => { onUpdateClient(task.id, null); setClientOpen(false); }}>
                            <Check className={cn("h-3 w-3 mr-1", !task.client_id ? "opacity-100" : "opacity-0")} />
                            ללא לקוח
                          </CommandItem>
                          {clientsList.map((c) => (
                            <CommandItem key={c.id} onSelect={() => { onUpdateClient(task.id, c.id); setClientOpen(false); }}>
                              <Check className={cn("h-3 w-3 mr-1", task.client_id === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              {onUpdateCampaigner && campaignersList && (
                <Popover open={campaignerOpen} onOpenChange={setCampaignerOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 h-6 text-[11px] w-[110px] px-1.5 rounded-md border bg-background hover:bg-accent/50 truncate">
                      <Megaphone className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{task.campaigner_id ? campaignersList.find(c => c.id === task.campaigner_id)?.full_name || "קמפיינר" : "ללא קמפיינר"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 z-50" align="start">
                    <Command>
                      <CommandInput placeholder="חיפוש קמפיינר..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>לא נמצא</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => { onUpdateCampaigner(task.id, null); setCampaignerOpen(false); }}>
                            <Check className={cn("h-3 w-3 mr-1", !task.campaigner_id ? "opacity-100" : "opacity-0")} />
                            ללא קמפיינר
                          </CommandItem>
                          {campaignersList.map((c) => (
                            <CommandItem key={c.id} onSelect={() => { onUpdateCampaigner(task.id, c.id); setCampaignerOpen(false); }}>
                              <Check className={cn("h-3 w-3 mr-1", task.campaigner_id === c.id ? "opacity-100" : "opacity-0")} />
                              {c.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 mt-1 flex-wrap" onClick={onClick}>
            {task.clients?.name && !onUpdateClient && (
              <Badge variant="secondary" className="text-xs">
                {task.clients.name}
              </Badge>
            )}
            {task.campaigners?.full_name && (
              <Badge variant="outline" className="text-xs">
                <Megaphone className="h-3 w-3 mr-1" />
                {task.campaigners.full_name}
              </Badge>
            )}
            {task.created_at && (
              <span className="text-[11px] text-muted-foreground">
                נוצר {new Date(task.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
            {task.due_date && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  isOverdue
                    ? "text-destructive border-destructive/50"
                    : "text-muted-foreground"
                )}
              >
                <CalendarDays className="h-3 w-3 mr-1" />
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
  clientsList,
  campaignersList,
  onUpdateClient,
  onUpdateCampaigner,
}: TaskBacklogPanelProps) {
  // Start collapsed if no tasks, expanded if there are tasks
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

  // Always render the panel, even when empty - so user can add tasks

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border transition-all duration-200 shrink-0 h-fit shadow-lg",
        overdueCount > 0 
          ? "bg-destructive/5 border-destructive/30" 
          : "bg-background border-border",
        isExpanded ? "min-w-[33vw] w-[33vw]" : "w-[60px]",
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
        <div className="p-2 space-y-2 overflow-y-auto max-h-[200px] md:max-h-[calc(100vh-250px)]">
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
                  clientsList={clientsList}
                  campaignersList={campaignersList}
                  onUpdateClient={onUpdateClient}
                  onUpdateCampaigner={onUpdateCampaigner}
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
                  clientsList={clientsList}
                  campaignersList={campaignersList}
                  onUpdateClient={onUpdateClient}
                  onUpdateCampaigner={onUpdateCampaigner}
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
                  clientsList={clientsList}
                  campaignersList={campaignersList}
                  onUpdateClient={onUpdateClient}
                  onUpdateCampaigner={onUpdateCampaigner}
                />
              ))}
            </>
          )}
          
          {/* Empty state message */}
          {totalCount === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              אין משימות ממתינות
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Keep old export for backwards compatibility
export const OverdueTasksPanel = TaskBacklogPanel;
