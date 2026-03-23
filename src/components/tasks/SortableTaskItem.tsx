import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MessageSquare, Users, GripVertical, Calendar, CalendarClock, Megaphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SortableTaskItemProps {
  task: {
    id: string;
    title: string;
    status: string;
    client_id: string | null;
    campaigner_id?: string | null;
    created_at?: string;
    due_date?: string | null;
    duration_minutes?: number;
    clients?: { name: string } | null;
    campaigners?: { full_name: string } | null;
    task_updates?: { id: string }[];
    task_collaborators?: { id: string }[];
  };
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
  compact?: boolean;
  slotHeight?: number;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  onUpdateClient?: (taskId: string, clientId: string | null) => void;
  onUpdateCampaigner?: (taskId: string, campaignerId: string | null) => void;
}

export function SortableTaskItem({ task, onToggleComplete, onClick, compact = false, slotHeight = 40, clientsList, campaignersList, onUpdateClient, onUpdateCampaigner }: SortableTaskItemProps) {
  const [clientOpen, setClientOpen] = useState(false);
  const [campaignerOpen, setCampaignerOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  // Calculate height based on duration (30 min = 1 slot)
  const durationMinutes = task.duration_minutes || 30;
  const taskHeight = compact ? (durationMinutes / 30) * slotHeight : undefined;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(compact && taskHeight && durationMinutes > 30 ? { height: `${taskHeight - 4}px` } : {}),
  };

  const isCompleted = task.status === "done";
  const updatesCount = task.task_updates?.length || 0;
  const collaboratorsCount = task.task_collaborators?.length || 0;

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex items-start gap-1 px-1 py-0.5 rounded border bg-card hover:bg-accent/50 cursor-pointer transition-all text-[11px]",
          isDragging && "opacity-50 shadow-lg z-50",
          isCompleted && "opacity-60",
          durationMinutes > 30 && "flex-col"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity shrink-0 touch-none"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        
        <Checkbox
          checked={isCompleted}
          onCheckedChange={(checked) => {
            onToggleComplete(task.id, checked as boolean);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3 shrink-0"
        />
        
        <div className="flex-1 min-w-0 whitespace-normal break-words" onClick={onClick}>
          <span
            className={cn(
              "font-medium",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          {task.clients?.name && (
            <span className="text-muted-foreground mx-1">•</span>
          )}
          {task.clients?.name && (
            <span className="text-muted-foreground">{task.clients.name}</span>
          )}
        </div>

        {(updatesCount > 0 || collaboratorsCount > 0) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {updatesCount > 0 && (
              <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />
            )}
            {collaboratorsCount > 0 && (
              <Users className="h-2.5 w-2.5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all",
        isDragging && "opacity-50 shadow-lg z-50",
        isCompleted && "opacity-60"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
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
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 h-6 text-[11px] w-[120px] px-2 rounded-md border bg-background hover:bg-accent/50 truncate">
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
                  <button className="flex items-center gap-1 h-6 text-[11px] w-[120px] px-2 rounded-md border bg-background hover:bg-accent/50 truncate">
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

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.clients?.name && !onUpdateClient && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {task.clients.name}
            </Badge>
          )}

          {task.campaigners?.full_name && !onUpdateCampaigner && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <Megaphone className="h-3 w-3" />
              {task.campaigners.full_name}
            </Badge>
          )}

          {task.created_at && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.created_at), "dd/MM/yy")}
            </span>
          )}

          {task.due_date && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {format(new Date(task.due_date), "dd/MM/yy")}
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
