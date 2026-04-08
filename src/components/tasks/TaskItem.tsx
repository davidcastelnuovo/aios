import { useDraggable } from "@dnd-kit/core";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, GripVertical, Calendar, CalendarClock, Megaphone, Search, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    status: string;
    client_id: string | null;
    campaigner_id?: string | null;
    assigned_agent?: string | null;
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
  const [clientSearch, setClientSearch] = useState("");
  const [campaignerSearch, setCampaignerSearch] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [campaignerOpen, setCampaignerOpen] = useState(false);

  const filteredClients = useMemo(() => {
    if (!clientsList) return [];
    if (!clientSearch) return clientsList;
    return clientsList.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientsList, clientSearch]);

  const filteredCampaigners = useMemo(() => {
    if (!campaignersList) return [];
    if (!campaignerSearch) return campaignersList;
    return campaignersList.filter(c => c.full_name.toLowerCase().includes(campaignerSearch.toLowerCase()));
  }, [campaignersList, campaignerSearch]);

  const selectedClientName = clientsList?.find(c => c.id === task.client_id)?.name;
  const selectedCampaignerName = campaignersList?.find(c => c.id === task.campaigner_id)?.full_name;

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
              <Popover open={clientOpen} onOpenChange={(open) => { setClientOpen(open); if (!open) setClientSearch(""); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-6 text-[11px] w-[120px] px-2 justify-start gap-1">
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedClientName || "לקוח"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2 z-50" align="start">
                  <div className="flex items-center gap-1 mb-2">
                    <Search className="h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש לקוח..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                    <button
                      className={cn("w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent", !task.client_id && "bg-accent")}
                      onClick={() => { onUpdateClient(task.id, null); setClientOpen(false); }}
                    >ללא לקוח</button>
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        className={cn("w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent", task.client_id === c.id && "bg-accent")}
                        onClick={() => { onUpdateClient(task.id, c.id); setClientOpen(false); }}
                      >{c.name}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {onUpdateCampaigner && campaignersList && (
              <Popover open={campaignerOpen} onOpenChange={(open) => { setCampaignerOpen(open); if (!open) setCampaignerSearch(""); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-6 text-[11px] w-[120px] px-2 justify-start gap-1">
                    <Megaphone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedCampaignerName || "קמפיינר"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2 z-50" align="start">
                  <div className="flex items-center gap-1 mb-2">
                    <Search className="h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש קמפיינר..."
                      value={campaignerSearch}
                      onChange={(e) => setCampaignerSearch(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                    <button
                      className={cn("w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent", !task.campaigner_id && "bg-accent")}
                      onClick={() => { onUpdateCampaigner(task.id, null); setCampaignerOpen(false); }}
                    >ללא קמפיינר</button>
                    {filteredCampaigners.map((c) => (
                      <button
                        key={c.id}
                        className={cn("w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent", task.campaigner_id === c.id && "bg-accent")}
                        onClick={() => { onUpdateCampaigner(task.id, c.id); setCampaignerOpen(false); }}
                      >{c.full_name}</button>
                    ))}
                  </div>
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

          {task.assigned_agent && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5 bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300">
              <Bot className="h-3 w-3" />
              {task.assigned_agent}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}