import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Plus, Clock, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { EntityTaskCard } from "@/components/tasks/EntityTaskCard";
import { withTaskCreatorNames } from "@/lib/taskCreators";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface ClientTasksTabProps {
  clientId: string;
  clientName: string;
}

type DateFilter = "week" | "month" | "all";

export function ClientTasksTab({ clientId, clientName }: ClientTasksTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [editingTask, setEditingTask] = useState<any>(null);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["client-tasks", clientId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          campaigners (full_name),
          agencies (name),
          clients (name)
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
      return withTaskCreatorNames(data || []);
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
      queryClient.invalidateQueries({ queryKey: ["client-tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", tenantId] });
      toast.success("סטטוס המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  const inProgressTasks = tasks?.filter(t => t.status === "open" || t.status === "in_progress") || [];
  const completedTasks = tasks?.filter(t => t.status === "done") || [];

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">טוען משימות...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Task button and Date Filter */}
      <div className="flex items-center justify-between gap-4">
        <AddTaskForm
          clientId={clientId}
          triggerButton={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              הוסף משימה
            </Button>
          }
        />

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <EntityTaskCard
                  key={task.id}
                  task={task}
                  isCompleted={false}
                  clientName={clientName}
                  tintByPriority
                  onEdit={() => setEditingTask(task)}
                  onToggleComplete={() => updateStatusMutation.mutate({ taskId: task.id, status: "done" })}
                />
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
                <EntityTaskCard
                  key={task.id}
                  task={task}
                  isCompleted
                  clientName={clientName}
                  tintByPriority
                  onEdit={() => setEditingTask(task)}
                  onToggleComplete={() => updateStatusMutation.mutate({ taskId: task.id, status: "open" })}
                />
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

      {editingTask && (
        <TaskDetailDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
        />
      )}
    </div>
  );
}
