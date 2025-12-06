import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  User, 
  Plus, 
  Clock, 
  CheckCheck, 
  MessageSquare,
  Send,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ClientUpdatesTabProps {
  clientId: string;
  clientName: string;
}

type DateFilter = "week" | "month" | "all";

export function ClientUpdatesTab({ clientId, clientName }: ClientUpdatesTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [newUpdate, setNewUpdate] = useState("");
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["client-tasks", clientId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          campaigners (full_name),
          agencies (name)
        `)
        .eq("client_id", clientId)
        .order("due_date", { ascending: false });

      if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      } else if (dateFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        query = query.gte("created_at", monthAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch updates
  const { data: updates, isLoading: updatesLoading } = useQuery({
    queryKey: ["client-updates", clientId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("client_updates")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      } else if (dateFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        query = query.gte("created_at", monthAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateContent, setEditingUpdateContent] = useState("");

  // Add update mutation
  const addUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!tenantId || !user?.id) throw new Error("Missing tenant or user");
      const { error } = await supabase
        .from("client_updates")
        .insert({
          client_id: clientId,
          tenant_id: tenantId,
          user_id: user.id,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-updates"] });
      setNewUpdate("");
      toast.success("העדכון נוסף בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה בהוספת העדכון");
    },
  });

  // Edit update mutation
  const editUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("client_updates")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-updates"] });
      setEditingUpdateId(null);
      setEditingUpdateContent("");
      toast.success("העדכון נערך בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה בעריכת העדכון");
    },
  });

  // Delete update mutation
  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-updates"] });
      toast.success("העדכון נמחק בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת העדכון");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: "open" | "in_progress" | "done" }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("סטטוס המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;
    addUpdateMutation.mutate(newUpdate.trim());
  };

  const inProgressTasks = tasks?.filter(t => t.status === "open" || t.status === "in_progress") || [];
  const completedTasks = tasks?.filter(t => t.status === "done") || [];

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-50 border-red-200 text-red-700";
    if (priority >= 4) return "bg-yellow-50 border-yellow-200 text-yellow-700";
    return "bg-green-50 border-green-200 text-green-700";
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return "גבוהה";
    if (priority >= 4) return "בינונית";
    return "נמוכה";
  };

  const TaskCard = ({ task, isCompleted }: { task: any; isCompleted: boolean }) => (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}
      onClick={() => setEditingTask(task)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">{task.title}</h4>
          {isCompleted ? (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              הושלמה
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
              {getPriorityBadge(task.priority)}
            </Badge>
          )}
        </div>

        {task.campaigners && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {task.campaigners.full_name}
          </div>
        )}

        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), "d בMMMM yyyy", { locale: he })}
          </div>
        )}

        {!isCompleted && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              updateStatusMutation.mutate({ taskId: task.id, status: "done" });
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            סיים
          </Button>
        )}

        {isCompleted && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              updateStatusMutation.mutate({ taskId: task.id, status: "open" });
            }}
          >
            <Circle className="h-3 w-3 mr-1" />
            פתח שוב
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const isLoading = tasksLoading || updatesLoading;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="space-y-4 overflow-x-hidden w-full">
      {/* Add Update Form */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="הוסף עדכון חדש..."
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              className="min-h-[60px] resize-none flex-1"
            />
            <Button 
              onClick={handleAddUpdate} 
              disabled={!newUpdate.trim() || addUpdateMutation.isPending}
              className="self-end shrink-0"
            >
              {addUpdateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <AddTaskForm
          clientId={clientId}
          triggerButton={
            <Button size="sm" variant="outline" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              הוסף משימה
            </Button>
          }
        />

        <RadioGroup 
          value={dateFilter} 
          onValueChange={(value) => setDateFilter(value as DateFilter)} 
          className="flex gap-3 flex-wrap"
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="week" id="week" />
            <Label htmlFor="week" className="cursor-pointer text-sm">שבוע</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="month" id="month" />
            <Label htmlFor="month" className="cursor-pointer text-sm">חודש</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="cursor-pointer text-sm">הכל</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Updates History */}
      {updates && updates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">היסטוריית עדכונים</h3>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {updates.map((update: any) => {
              const isEditing = editingUpdateId === update.id;
              const isOwner = user?.id === update.user_id;
              
              return (
                <Card key={update.id} className="bg-muted/50">
                  <CardContent className="p-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingUpdateContent}
                          onChange={(e) => setEditingUpdateContent(e.target.value)}
                          className="min-h-[60px] resize-none text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingUpdateId(null);
                              setEditingUpdateContent("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => editUpdateMutation.mutate({ id: update.id, content: editingUpdateContent })}
                            disabled={!editingUpdateContent.trim() || editUpdateMutation.isPending}
                          >
                            {editUpdateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{update.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <User className="h-3 w-3 shrink-0" />
                            <span>{update.profiles?.full_name || update.profiles?.email || "משתמש"}</span>
                            <span>•</span>
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{format(new Date(update.created_at), "d/M/yy HH:mm", { locale: he })}</span>
                          </div>
                          {isOwner && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingUpdateId(update.id);
                                  setEditingUpdateContent(update.content);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteUpdateMutation.mutate(update.id)}
                                disabled={deleteUpdateMutation.isPending}
                              >
                                {deleteUpdateMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* In Progress */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm">
              בביצוע
              <Badge variant="secondary" className="mr-2 text-xs">
                {inProgressTasks.length}
              </Badge>
            </h3>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {inProgressTasks.length > 0 ? (
              inProgressTasks.map(task => (
                <TaskCard key={task.id} task={task} isCompleted={false} />
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-4 text-center text-muted-foreground text-sm">
                  <Circle className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p>אין משימות פתוחות</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Completed */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm">
              הושלמו
              <Badge variant="secondary" className="mr-2 text-xs">
                {completedTasks.length}
              </Badge>
            </h3>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {completedTasks.length > 0 ? (
              completedTasks.map(task => (
                <TaskCard key={task.id} task={task} isCompleted={true} />
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-4 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p>טרם הושלמו משימות</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
        />
      )}
    </div>
  );
}