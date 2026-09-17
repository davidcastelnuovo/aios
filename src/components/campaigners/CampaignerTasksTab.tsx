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
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";

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
  const { crossTenantAgencyIds } = useCrossTenantAgencyIds();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["campaigner-tasks", tenantId, campaignerId, dateFilter, crossTenantAgencyIds.join(",")],
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
        .order("due_date", { ascending: false });

      if (crossTenantAgencyIds.length > 0) {
        query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`);
      } else {
        query = query.eq("tenant_id", tenantId!);
      }

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
      queryClient.invalidateQueries({ queryKey: ["campaigner-tasks", tenantId, campaignerId] });
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <EntityTaskCard
                  key={task.id}
                  task={task}
                  isCompleted={false}
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
                <EntityTaskCard
                  key={task.id}
                  task={task}
                  isCompleted
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
