import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Calendar, Plus, Clock, CheckCheck, Building2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import AddTaskForm from "@/components/forms/AddTaskForm";
import EditTaskDialog from "@/components/forms/EditTaskDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface CampaignerTasksTabProps {
  campaignerId: string;
  campaignerName: string;
}

type DateFilter = "week" | "month" | "all";

export function CampaignerTasksTab({ campaignerId, campaignerName }: CampaignerTasksTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [editingTask, setEditingTask] = useState<any>(null);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["campaigner-tasks", tenantId, campaignerId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          campaigners (full_name),
          agencies (name),
          clients (name),
          leads (company_name)
        `)
        .eq("campaigner_id", campaignerId)
        .eq("tenant_id", tenantId!)
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
    enabled: !!campaignerId && !!tenantId,
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
      queryClient.invalidateQueries({ queryKey: ["campaigner-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("סטטוס המשימה עודכן");
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  const inProgressTasks = tasks?.filter(t => t.status === "open" || t.status === "in_progress") || [];
  const completedTasks = tasks?.filter(t => t.status === "done") || [];

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return "גבוהה";
    if (priority >= 4) return "בינונית";
    return "נמוכה";
  };

  const TaskCard = ({ task, isCompleted }: { task: any; isCompleted: boolean }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setEditingTask(task)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">{task.title}</h4>
          {isCompleted ? (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <CheckCheck className="h-3 w-3 mr-1" />
              הושלמה
            </Badge>
          ) : (
            <Badge variant="outline">
              דחיפות: {getPriorityBadge(task.priority)}
            </Badge>
          )}
        </div>

        {(task.clients?.name || task.leads?.company_name) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {task.clients?.name || task.leads?.company_name}
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

        {!isCompleted ? (
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
        ) : (
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
      <div className="flex items-center justify-between gap-4">
        <AddTaskForm
          defaultCampaignerId={campaignerId}
          triggerButton={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              הוסף משימה
            </Button>
          }
        />

        <RadioGroup value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)} className="flex gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="week" id="camp-week" />
            <Label htmlFor="camp-week" className="cursor-pointer">שבוע אחרון</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="month" id="camp-month" />
            <Label htmlFor="camp-month" className="cursor-pointer">חודש אחרון</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value="all" id="camp-all" />
            <Label htmlFor="camp-all" className="cursor-pointer">כל הזמן</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
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

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-success" />
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
