import { useDraggable } from "@dnd-kit/core";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Users, GripVertical, Calendar, CalendarClock, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    status: string;
    client_id: string | null;
    campaigner_id?: string | null;
    created_at?: string;
    due_date?: string | null;
    clients?: { name: string } | null;
    campaigners?: { full_name: string } | null;
    task_updates?: { id: string }[];
    task_collaborators?: { id: string }[];
  };
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  onUpdateClient?: (taskId: string, clientId: string | null) => void;
  onUpdateCampaigner?: (taskId: string, campaignerId: string | null) => void;
}

export function TaskItem({ task, onToggleComplete, onClick, clientsList, campaignersList, onUpdateClient, onUpdateCampaigner }: TaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isCompleted = task.status === "done";
  const updatesCount = task.task_updates?.length || 0;
  const collaboratorsCount = task.task_collaborators?.length || 0;

  const createdDate = task.created_at ? format(new Date(task.created_at), "dd/MM/yy") : null;
  const dueDate = task.due_date ? format(new Date(task.due_date), "dd/MM/yy") : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => {
          onToggleComplete(task.id, checked as boolean);
        }}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0" onClick={onClick}>
        <p
          className={cn(
            "text-sm font-medium leading-tight break-words",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        
        {/* Inline client & campaigner selectors */}
        {(onUpdateClient || onUpdateCampaigner) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {onUpdateClient && clientsList && (
              <Select
                value={task.client_id || "none"}
                onValueChange={(value) => onUpdateClient(task.id, value === "none" ? null : value)}
              >
                <SelectTrigger className="h-6 text-[11px] w-[120px] px-2">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="לקוח" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">ללא לקוח</SelectItem>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {onUpdateCampaigner && campaignersList && (
              <Select
                value={task.campaigner_id || "none"}
                onValueChange={(value) => onUpdateCampaigner(task.id, value === "none" ? null : value)}
              >
                <SelectTrigger className="h-6 text-[11px] w-[120px] px-2">
                  <Megaphone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="קמפיינר" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">ללא קמפיינר</SelectItem>
                  {campaignersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.clients?.name && !onUpdateClient && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {task.clients.name}
            </Badge>
          )}

          {task.campaigners?.full_name && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <Megaphone className="h-3 w-3" />
              {task.campaigners.full_name}
            </Badge>
          )}

          {createdDate && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {createdDate}
            </span>
          )}

          {dueDate && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {dueDate}
            </span>
          )}

          {updatesCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {updatesCount}
            </Badge>
          )}

          {collaboratorsCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <Users className="h-3 w-3" />
              {collaboratorsCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}