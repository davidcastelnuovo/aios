import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, Building2, Users, Megaphone, AlertCircle, GripVertical } from "lucide-react";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Tasks() {
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");
  const [activeTask, setActiveTask] = useState<any>(null);
  const { isAdmin, isOwner } = useUserRole();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          agencies (name),
          clients (name),
          campaigners (full_name)
        `)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: "open" | "in_progress" | "done" }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("סטטוס המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  const filteredTasks = selectedCampaigner === "all" 
    ? tasks 
    : tasks?.filter(t => t.campaigner_id === selectedCampaigner);

  const tasksByStatus = {
    open: filteredTasks?.filter(t => t.status === "open") || [],
    in_progress: filteredTasks?.filter(t => t.status === "in_progress") || [],
    done: filteredTasks?.filter(t => t.status === "done") || [],
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "low":
        return "bg-success/10 text-success border-success/20";
      default:
        return "";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "high":
        return "גבוה";
      case "medium":
        return "בינוני";
      case "low":
        return "נמוך";
      default:
        return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-primary/10 text-primary border-primary/20";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "done":
        return "bg-success/10 text-success border-success/20";
      default:
        return "";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "פתוח";
      case "in_progress":
        return "בעבודה";
      case "done":
        return "הושלם";
      default:
        return status;
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks?.find(t => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveTask(null);
      return;
    }

    const taskId = active.id as string;
    const newStatus = over.id as "open" | "in_progress" | "done";

    const task = tasks?.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTaskStatusMutation.mutate({ taskId, status: newStatus });
    }
    
    setActiveTask(null);
  };

  const DraggableTaskCard = ({ task }: { task: any }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <Card 
          className="shadow-card hover:shadow-lg transition-all cursor-pointer min-w-0"
          onClick={() => setEditingTask(task)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-base truncate">{task.title}</CardTitle>
              </div>
              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                {getPriorityText(task.priority)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 min-w-0">
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={task.status}
                onValueChange={(value: "open" | "in_progress" | "done") => {
                  updateTaskStatusMutation.mutate({ taskId: task.id, status: value });
                }}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="open">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      פתוח
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                      בעבודה
                    </div>
                  </SelectItem>
                  <SelectItem value="done">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success"></div>
                      הושלם
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1 text-sm min-w-0">
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{task.agencies?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{task.clients?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Megaphone className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{task.campaigners?.full_name}</span>
              </div>
              {task.due_date && (
                <div className={`flex items-center gap-2 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {isOverdue(task.due_date) && task.status !== 'done' && <AlertCircle className="h-3 w-3" />}
                  <Calendar className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString("he-IL")}
                </div>
              )}
            </div>

            {task.notes && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                {task.notes}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">משימות</h2>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">ניהול משימות וקמפיינים - גרור משימות בין העמודות לשינוי סטטוס</p>
          </div>
          
          <div className="flex gap-3 flex-wrap md:flex-nowrap w-full md:w-auto items-stretch">
            {(isAdmin || isOwner) && (
              <div className="w-full md:w-48">
                <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="כל הקמפיינרים" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">כל הקמפיינרים</SelectItem>
                    {campaigners?.map((campaigner) => (
                      <SelectItem key={campaigner.id} value={campaigner.id}>
                        {campaigner.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-full md:w-auto"><AddTaskForm /></div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
          <SortableContext id="open" items={tasksByStatus.open.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 min-h-[400px] p-4 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-primary"></div>
                <h3 className="text-base md:text-lg font-semibold">פתוח ({tasksByStatus.open.length})</h3>
              </div>
              {tasksByStatus.open.map(task => (
                <DraggableTaskCard key={task.id} task={task} />
              ))}
              {tasksByStatus.open.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckSquare className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">אין משימות פתוחות</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </SortableContext>

          <SortableContext id="in_progress" items={tasksByStatus.in_progress.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 min-h-[400px] p-4 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-yellow-500"></div>
                <h3 className="text-base md:text-lg font-semibold">בעבודה ({tasksByStatus.in_progress.length})</h3>
              </div>
              {tasksByStatus.in_progress.map(task => (
                <DraggableTaskCard key={task.id} task={task} />
              ))}
              {tasksByStatus.in_progress.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckSquare className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">אין משימות בעבודה</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </SortableContext>

          <SortableContext id="done" items={tasksByStatus.done.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 min-h-[400px] p-4 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-success"></div>
                <h3 className="text-base md:text-lg font-semibold">הושלם ({tasksByStatus.done.length})</h3>
              </div>
              {tasksByStatus.done.map(task => (
                <DraggableTaskCard key={task.id} task={task} />
              ))}
              {tasksByStatus.done.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckSquare className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">אין משימות שהושלמו</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </SortableContext>
        </div>

        {editingTask && (
          <EditTaskDialog
            task={editingTask}
            open={!!editingTask}
            onOpenChange={(open) => !open && setEditingTask(null)}
          />
        )}

        <DragOverlay>
          {activeTask ? (
            <Card className="shadow-xl opacity-80 rotate-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{activeTask.title}</CardTitle>
              </CardHeader>
            </Card>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}