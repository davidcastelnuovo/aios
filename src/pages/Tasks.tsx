import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar as CalendarIcon, Building2, Users, Megaphone, AlertCircle, GripVertical, LayoutGrid, Table as TableIcon, MessageSquare } from "lucide-react";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserRole } from "@/hooks/useUserRole";
import { CalendarIframeSettings } from "@/components/CalendarIframeSettings";
import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor, useDroppable } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import confetti from "canvas-confetti";
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
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

// Faster bubble pop animation for task completion
const playBubbleAnimation = () => {
  // Create bubble sound using Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Bubble pop sound - high freq that drops quickly
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.08);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.08);

  // Faster bubble confetti animation
  const count = 25;
  const defaults = {
    origin: { y: 0.7 },
    shapes: ['circle'],
    gravity: 0.7,
    scalar: 1.1,
    drift: 0,
    ticks: 80,
  };

  function fire(particleRatio: number, opts: any) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: ['#4ade80', '#22c55e', '#16a34a', '#86efac', '#bbf7d0'],
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 50,
  });

  fire(0.2, {
    spread: 55,
  });

  fire(0.35, {
    spread: 90,
    decay: 0.92,
    scalar: 0.75,
  });

  fire(0.1, {
    spread: 110,
    startVelocity: 22,
    decay: 0.93,
    scalar: 1.1,
  });

  fire(0.1, {
    spread: 110,
    startVelocity: 40,
  });
};

export default function Tasks() {
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [activeTask, setActiveTask] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table" | "calendar">("kanban");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<"priority" | "due_date" | "status">("priority");
  const { selectedAgency } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { campaignerId, isCampaigner, isTeamManager, isOwner, isSeo } = useUserRole();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", tenantId, selectedAgency],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      let query = supabase
        .from("tasks")
        .select(`
          *,
          agencies (name),
          clients (agency_id, name, is_seo_client),
          campaigners (full_name, role),
          task_updates (id)
        `)
        .order("due_date", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!tenantId,
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!tenantId,
  });

  // Get current user's campaigner role
  const { data: currentUserRole } = useQuery({
    queryKey: ["current-user-campaigner-role", campaignerId],
    queryFn: async () => {
      if (!campaignerId) return null;
      const { data } = await supabase
        .from("campaigners")
        .select("role")
        .eq("id", campaignerId)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!campaignerId && isCampaigner,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: "open" | "in_progress" | "done" }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", taskId);
      if (error) throw error;
      
      // Trigger bubble animation when status changes to "done"
      if (status === "done") {
        playBubbleAnimation();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("סטטוס המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  const updateTaskPriorityMutation = useMutation({
    mutationFn: async ({ taskId, priority }: { taskId: string; priority: number }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ priority })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("דחיפות המשימה עודכנה");
    },
    onError: () => {
      toast.error("שגיאה בעדכון הדחיפות");
    },
  });

  // Filter logic: Role-based access, then global agency filter
  const getTaskAgencyId = (t: any) => t?.clients?.agency_id ?? t?.agency_id;
  let accessibleTasks = tasks;

  if (!isOwner) {
    if (isSeo && campaignerId) {
      // SEO users see only tasks where BOTH the assigned campaigner is SEO AND the client is SEO
      accessibleTasks = tasks?.filter(task => 
        task.campaigners?.role?.includes('SEO') &&
        task.clients?.is_seo_client === true
      );
    } else if (isTeamManager && userAgencyIds && userAgencyIds.length > 0) {
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

  // Apply agency filter - always filter by client's agency or task's agency
  if (selectedAgency && selectedAgency !== "all") {
    console.log('🔍 Filtering by agency:', selectedAgency);
    console.log('📋 Tasks before agency filter:', accessibleTasks?.map(t => ({
      title: t.title,
      agency_id: t.agency_id,
      client_agency_id: t.clients?.agency_id,
      agency_name: t.agencies?.name
    })));
    
    // Always filter by agency - show tasks only from selected agency
    // This uses client's agency_id first, then task's agency_id as fallback
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

  // Then filter by campaigner and role
  let filteredTasks = accessibleTasks?.filter(t => {
    const matchesCampaigner = selectedCampaigner === "all" || t.campaigner_id === selectedCampaigner;
    
    console.log('🎯 Task filtering:', {
      taskTitle: t.title,
      selectedRole,
      campaignerRole: t.campaigners?.role,
      isArrayRole: Array.isArray(t.campaigners?.role),
      isSeoClient: t.clients?.is_seo_client
    });
    
    // For SEO filter: BOTH campaigner must be SEO AND client must be SEO client
    let matchesRole = false;
    if (selectedRole === "all") {
      matchesRole = true;
    } else if (selectedRole === "SEO") {
      matchesRole = (t.campaigners?.role?.includes('SEO')) && (t.clients?.is_seo_client === true);
    } else if (selectedRole === "קמפיינר") {
      // For "קמפיינר" tab: show tasks where campaigner has קמפיינר role
      // OR campaigner has any non-SEO role
      // OR campaigner role is null/empty (treat as regular campaigner)
      const hasRole = t.campaigners?.role;
      if (!hasRole || (Array.isArray(hasRole) && hasRole.length === 0)) {
        matchesRole = true; // No role = regular campaigner
      } else {
        matchesRole = hasRole.includes('קמפיינר') || !hasRole.includes('SEO');
      }
    } else {
      matchesRole = (t.campaigners?.role && t.campaigners.role.includes(selectedRole));
    }
    
    console.log('🎯 Match result:', { matchesCampaigner, matchesRole });
    
    return matchesCampaigner && matchesRole;
  }) || [];

  // Apply hide completed filter
  if (hideCompleted) {
    filteredTasks = filteredTasks.filter(t => t.status !== "done");
  }

  // Sort tasks based on selected sort option
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case "priority":
        // Higher priority first (10 -> 1)
        return (b.priority || 5) - (a.priority || 5);
      case "due_date":
        // Earlier due dates first, null dates last
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      case "status":
        // Order: open -> in_progress -> done
        const statusOrder = { open: 0, in_progress: 1, done: 2 };
        return (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
               (statusOrder[b.status as keyof typeof statusOrder] || 0);
      default:
        return 0;
    }
  });

  console.log('✅ Final filteredTasks:', sortedTasks?.map(t => ({
    title: t.title,
    agency_id: t.agency_id,
    client_agency_id: t.clients?.agency_id,
    agency_name: t.agencies?.name,
    status: t.status
  })));

  const tasksByStatus = {
    open: sortedTasks?.filter(t => t.status === "open") || [],
    in_progress: sortedTasks?.filter(t => t.status === "in_progress") || [],
    done: sortedTasks?.filter(t => t.status === "done") || [],
  };

  console.log('📊 Tasks by status:', {
    open: tasksByStatus.open.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id })),
    in_progress: tasksByStatus.in_progress.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id })),
    done: tasksByStatus.done.map(t => ({ title: t.title, agency: t.agencies?.name, client_agency_id: t.clients?.agency_id }))
  });

  const getPriorityColor = (priority: number) => {
    // Blue (low) to Red (high) gradient
    const hue = 240 - ((priority - 1) / 9) * 240; // 240 (blue) to 0 (red)
    return `hsl(${hue}, 70%, 50%)`;
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 8) return "דחיפות גבוהה";
    if (priority >= 5) return "דחיפות בינונית";
    return "דחיפות נמוכה";
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
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Megaphone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{task.campaigners?.full_name}</span>
            </div>
            
            {task.due_date && (
              <div className={`flex items-center gap-1.5 text-xs mb-3 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {isOverdue(task.due_date) && task.status !== 'done' && <AlertCircle className="h-3 w-3" />}
                <CalendarIcon className="h-3 w-3" />
                <span>{new Date(task.due_date).toLocaleDateString("he-IL")}</span>
              </div>
            )}

            {/* Priority Slider */}
            <div className="space-y-2 mb-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{getPriorityText(task.priority)}</span>
                <span className="text-xs font-medium" style={{ color: getPriorityColor(task.priority) }}>
                  {task.priority}/10
                </span>
              </div>
              <Slider
                value={[task.priority]}
                onValueChange={(value) => {
                  updateTaskPriorityMutation.mutate({ 
                    taskId: task.id, 
                    priority: value[0] 
                  });
                }}
                min={1}
                max={10}
                step={1}
                className="cursor-pointer"
              />
            </div>

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
        {/* Header with tabs on right, filters on left */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Right side: Title and tabs */}
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl md:text-3xl font-bold">משימות</h2>
            <Tabs value={selectedRole} onValueChange={setSelectedRole} dir="rtl">
              <TabsList className="bg-muted">
                <TabsTrigger value="all">כל המשימות</TabsTrigger>
                <TabsTrigger value="SEO">משימות SEO</TabsTrigger>
                <TabsTrigger value="קמפיינר">משימות קמפיינים</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Left side: Filters and controls */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:mr-auto">
            <div className="flex gap-3 flex-wrap md:flex-nowrap w-full md:w-auto items-stretch">
              {/* View mode toggle */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  title="תצוגת לוח"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  title="תצוגת טבלה"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("calendar")}
                  title="יומן"
                >
                  <CalendarIcon className="h-4 w-4" />
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
              
              {/* Hide campaigner filter for pure campaigners */}
              {!(isCampaigner && !isTeamManager && !isOwner) && (
                <div className="w-full md:w-48">
                  <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="כל הקמפיינרים" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">כל הקמפיינרים</SelectItem>
                      {campaigners
                        ?.filter((campaigner) => {
                          // Filter by selected role tab (SEO / קמפיינר)
                          if (selectedRole !== "all" && campaigner.role) {
                            // If SEO tab is selected, show only SEO campaigners
                            // If קמפיינר tab is selected, show only קמפיינר campaigners
                            if (!campaigner.role.includes(selectedRole)) {
                              return false;
                            }
                          }
                          
                          // If user is a campaigner with roles, show only campaigners with overlapping roles
                          if (isCampaigner && currentUserRole && currentUserRole.length > 0 && campaigner.role) {
                            return currentUserRole.some(userRole => campaigner.role?.includes(userRole));
                          }
                          
                          // Otherwise show all
                          return true;
                        })
                        .map((campaigner) => (
                          <SelectItem key={campaigner.id} value={campaigner.id}>
                            {campaigner.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Sort by dropdown */}
              <div className="w-full md:w-48">
                <Select value={sortBy} onValueChange={(value: "priority" | "due_date" | "status") => setSortBy(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="מיין לפי" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="priority">מיין לפי דחיפות</SelectItem>
                    <SelectItem value="due_date">מיין לפי תאריך יעד</SelectItem>
                    <SelectItem value="status">מיין לפי סטטוס</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-auto"><AddTaskForm /></div>
            </div>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <CalendarIframeSettings />
        ) : viewMode === "kanban" ? (
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
                {sortedTasks?.map((task) => (
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: getPriorityColor(task.priority) }}>
                            {task.priority}/10
                          </span>
                        </div>
                      </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={`flex items-center gap-2 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-destructive font-medium' : ''}`}>
                          {isOverdue(task.due_date) && task.status !== 'done' && <AlertCircle className="h-4 w-4" />}
                          <CalendarIcon className="h-4 w-4" />
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