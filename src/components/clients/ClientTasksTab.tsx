import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Calendar, User, Plus, Clock, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";

interface ClientTasksTabProps {
  clientId: string;
  clientName: string;
}

type DateFilter = "week" | "month" | "all";

export function ClientTasksTab({ clientId, clientName }: ClientTasksTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
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

      // Apply date filter
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
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">{task.title}</h4>
          {isCompleted ? (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              <CheckCheck className="h-3 w-3 mr-1" />
              הושלמה
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
              דחיפות: {getPriorityBadge(task.priority)}
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

        {task.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
        )}

        {!isCompleted && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              updateStatusMutation.mutate({ taskId: task.id, status: "done" });
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            סיים משימה
          </Button>
        )}

        {isCompleted && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              updateStatusMutation.mutate({ taskId: task.id, status: "open" });
            }}
          >
            <Circle className="h-4 w-4 mr-2" />
            פתח שוב
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">טוען משימות...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Task button and Date Filter */}
      <div className="flex items-center justify-between gap-4">
        <Button onClick={() => setShowAddTask(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          הוסף משימה
        </Button>

        <RadioGroup value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)} className="flex gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="week" id="week" />
            <Label htmlFor="week" className="cursor-pointer">שבוע אחרון</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="month" id="month" />
            <Label htmlFor="month" className="cursor-pointer">חודש אחרון</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="cursor-pointer">כל הזמן</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Two Columns Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* In Progress Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">
              בביצוע
              <Badge variant="secondary" className="mr-2">
                {inProgressTasks.length}
              </Badge>
            </h3>
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {inProgressTasks.length > 0 ? (
              inProgressTasks.map(task => (
                <TaskCard key={task.id} task={task} isCompleted={false} />
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>אין משימות פתוחות כרגע</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">
              הושלמו
              <Badge variant="secondary" className="mr-2">
                {completedTasks.length}
              </Badge>
            </h3>
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {completedTasks.length > 0 ? (
              completedTasks.map(task => (
                <TaskCard key={task.id} task={task} isCompleted={true} />
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>טרם הושלמו משימות</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showAddTask && (
        <AddTaskForm
          clientId={clientId}
          triggerButton={<div />}
        />
      )}

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
