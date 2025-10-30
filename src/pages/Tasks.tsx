import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, Building2, Users, Megaphone, AlertCircle, GripVertical, LayoutGrid, Table as TableIcon, MessageSquare } from "lucide-react";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Tasks() {
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");
  const [activeTask, setActiveTask] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [hideCompleted, setHideCompleted] = useState(false);
  const { selectedAgency } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { campaignerId, isCampaigner, isTeamManager, isOwner } = useUserRole();
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
      let query = supabase
        .from("tasks")
        .select(`
          *,
          agencies (name),
          clients (agency_id, name),
          campaigners (full_name),
          task_updates (id)
        `)
        .order("due_date", { ascending: true });

      const { data, error } = await query;
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

  // Get client IDs for the campaigner
  const { data: campaignerClientIds } = useQuery({
    queryKey: ["campaigner-client-ids", campaignerId],
    queryFn: async () => {
      if (!campaignerId) return null;
      const { data } = await supabase
        .from("client_team")
        .select("client_id")
        .eq("campaigner_id", campaignerId);
      return data?.map(ct => ct.client_id) || [];
    },
    enabled: !!campaignerId && isCampaigner,
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

  // Filter logic: Role-based access, then global agency filter
  const getTaskAgencyId = (t: any) => t?.clients?.agency_id ?? t?.agency_id;
  let accessibleTasks = tasks;

  if (!isOwner) {
    if (isTeamManager && userAgencyIds && userAgencyIds.length > 0) {
      // Team managers see all tasks in their agencies (including all team members)
      accessibleTasks = tasks?.filter(task => 
        userAgencyIds.includes(getTaskAgencyId(task))
      );
    } else if (isCampaigner && campaignerId) {
      // Pure campaigners see tasks assigned to them OR tasks for their assigned clients
      accessibleTasks = tasks?.filter(task => 
        task.campaigner_id === campaignerId || 
        (campaignerClientIds && campaignerClientIds.includes(task.client_id))
      );
    } else if (userAgencyIds && userAgencyIds.length > 0) {
      // Fallback: users with agency access see tasks in their agencies
      accessibleTasks = tasks?.filter(task => 
        userAgencyIds.includes(getTaskAgencyId(task))
      );
    }
  }

  // Then apply agency filter (works for all roles including campaigners)
  if (selectedAgency && selectedAgency !== "all") {
    console.log('🔍 Filtering by agency:', selectedAgency);
    console.log('📋 Tasks before agency filter:', accessibleTasks?.map(t => ({
      title: t.title,
      agency_id: t.agency_id,
      client_agency_id: t.clients?.agency_id,
      agency_name: t.agencies?.name
    })));
    accessibleTasks = accessibleTasks?.filter(
      (task) => getTaskAgencyId(task) === selectedAgency
    );
    console.log('📋 Tasks after agency filter:', accessibleTasks?.map(t => ({
      title: t.title,
      agency_id: t.agency_id,
      client_agency_id: t.clients?.agency_id,
      agency_name: t.agencies?.name
    })));
  }

  // Then filter by campaigner
  let filteredTasks = accessibleTasks?.filter(t => {
    const matchesCampaigner = selectedCampaigner === "all" || t.campaigner_id === selectedCampaigner;
    return matchesCampaigner;
  }) || [];

  // Apply hide completed filter
  if (hideCompleted) {
    filteredTasks = filteredTasks.filter(t => t.status !== "done");
  }

  console.log('✅ Final filteredTasks:', filteredTasks?.map(t => ({
    title: t.title,
    agency_id: t.agency_id,
    client_agency_id: t.clients?.agency_id,
    agency_name: t.agencies?.name,
    status: t.status
  })));

  const tasksByStatus = {
    open: filteredTasks?.filter(t => t.status === "open") || [],
    in_progress: filteredTasks?.filter(t => t.status === "in_progress") || [],
    done: filteredTasks?.filter(t => t.status === "done") || [],
  };

  console.log('📊 Tasks by status:', {
    open: tasksByStatus.open.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id })),
    in_progress: tasksByStatus.in_progress.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id })),
    done: tasksByStatus.done.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id }))
  });

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

    // Determine destination status:
    // - If dropped on a column, over.id is the column id (open | in_progress | done)
    // - If dropped over another task card, over.id is that task id → use its status (column)
    let targetStatus: "open" | "in_progress" | "done" | undefined;
    if (over.id === "open" || over.id === "in_progress" || over.id === "done") {
      targetStatus = over.id as "open" | "in_progress" | "done";
    } else {
      const overTask = tasks?.find((t) => t.id === over.id);
      targetStatus = overTask?.status as "open" | "in_progress" | "done" | undefined;
    }

    const task = tasks?.find((t) => t.id === taskId);
    if (task && targetStatus && task.status !== targetStatus) {
      updateTaskStatusMutation.mutate({ taskId, status: targetStatus });
    }
    
    setActiveTask(null);
  };

  const DroppableColumn = ({ status, children }: { status: "open" | "in_progress" | "done", children: React.ReactNode }) => {
    const { setNodeRef } = useDroppable({
      id: status,
    });

    return (
      <div ref={setNodeRef} className="space-y-4 min-h-[400px] p-4 rounded-lg bg-muted/20">
        {children}
      </div>
    );
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
          className="shadow-card hover:shadow-lg transition-all cursor-pointer relative"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[role='combobox']")) return;
            setEditingTask(task);
          }}
        >
          {/* Updates badge - positioned absolutely in top left corner */}
          {task.task_updates && task.task_updates.length > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-2 -left-2 h-6 min-w-6 flex items-center justify-center gap-1 px-2 bg-primary text-primary-foreground shadow-md z-10"
            >
              <MessageSquare className="h-3 w-3" />
              <span className="text-xs font-semibold">{task.task_updates.length}</span>
            </Badge>
          )}
          
          <CardContent className="p-4" dir="rtl">
            {/* Agency name at top */}
            {task.agencies && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate font-medium">{task.agencies.name}</span>
              </div>
            )}
            
            {/* Client name */}
            {task.clients && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="truncate font-medium">{task.clients.name}</span>
              </div>
            )}
            
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-medium text-sm truncate">{task.title}</h4>
              </div>
              <Badge variant="outline" className={`text-xs flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                {getPriorityText(task.priority)}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Megaphone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{task.campaigners?.full_name}</span>
            </div>
            
            {task.due_date && (
              <div className={`flex items-center gap-1.5 text-xs mb-2 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {isOverdue(task.due_date) && task.status !== 'done' && <AlertCircle className="h-3 w-3" />}
                <Calendar className="h-3 w-3" />
                <span>{new Date(task.due_date).toLocaleDateString("he-IL")}</span>
              </div>
            )}

            <div className="pt-2 border-t mt-2" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-muted-foreground mb-1">שנה סטטוס:</p>
              <Select
                value={task.status}
                onValueChange={(value: "open" | "in_progress" | "done") => 
                  updateTaskStatusMutation.mutate({ taskId: task.id, status: value })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      פתוח
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                      בתהליך
                    </div>
                  </SelectItem>
                  <SelectItem value="done">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      בוצע
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
      <div className="space-y-4 md:space-y-6 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">משימות</h2>
          </div>
          
          <div className="flex gap-3 flex-wrap md:flex-nowrap w-full md:w-auto items-stretch">
            {/* View mode toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="h-8 w-px bg-border"></div>
            
            {/* Hide completed toggle */}
            <div className="flex items-center gap-2" dir="ltr">
              <Label htmlFor="hide-completed" className="cursor-pointer whitespace-nowrap">
                הסתר הושלמו
              </Label>
              <Switch
                id="hide-completed"
                checked={hideCompleted}
                onCheckedChange={setHideCompleted}
              />
            </div>
            
            <div className="h-8 w-px bg-border"></div>
            
            {/* Hide campaigner filter for pure campaigners */}
            {!(isCampaigner && !isTeamManager && !isOwner) && (
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

        {viewMode === "kanban" ? (
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
          <DroppableColumn status="open">
            <SortableContext items={tasksByStatus.open.map(t => t.id)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </DroppableColumn>

          <DroppableColumn status="in_progress">
            <SortableContext items={tasksByStatus.in_progress.map(t => t.id)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </DroppableColumn>

          <DroppableColumn status="done">
            <SortableContext items={tasksByStatus.done.map(t => t.id)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </DroppableColumn>
        </div>
        ) : (
          /* Table View */
          <Card className="shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>סוכנות</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>משימה</TableHead>
                  <TableHead>קמפיינר</TableHead>
                  <TableHead>עדיפות</TableHead>
                  <TableHead>תאריך יעד</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks?.map((task) => (
                  <TableRow 
                    key={task.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setEditingTask(task)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{task.agencies?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{task.clients?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{task.title}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                        <span>{task.campaigners?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {getPriorityText(task.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={`flex items-center gap-2 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-destructive font-medium' : ''}`}>
                          {isOverdue(task.due_date) && task.status !== 'done' && <AlertCircle className="h-4 w-4" />}
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.due_date).toLocaleDateString("he-IL")}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status}
                        onValueChange={(value: "open" | "in_progress" | "done") => 
                          updateTaskStatusMutation.mutate({ taskId: task.id, status: value })
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
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
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              הושלם
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {getStatusText(task.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

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