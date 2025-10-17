import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, Building2, Users, Megaphone, AlertCircle } from "lucide-react";
import AddTaskForm from "@/components/forms/AddTaskForm";

export default function Tasks() {
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

  const tasksByStatus = {
    open: tasks?.filter(t => t.status === "open") || [],
    in_progress: tasks?.filter(t => t.status === "in_progress") || [],
    done: tasks?.filter(t => t.status === "done") || [],
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

  const TaskCard = ({ task }: { task: any }) => (
    <Card className="shadow-card hover:shadow-lg transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{task.title}</CardTitle>
          <Badge variant="outline" className={getPriorityColor(task.priority)}>
            {getPriorityText(task.priority)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge variant="outline" className={getStatusColor(task.status)}>
          {getStatusText(task.status)}
        </Badge>
        
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {task.agencies?.name}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3 w-3" />
            {task.clients?.name}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Megaphone className="h-3 w-3" />
            {task.campaigners?.full_name}
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
  );

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">משימות</h2>
        <p className="text-muted-foreground mt-1">ניהול משימות וקמפיינים</p>
      </div>

      <AddTaskForm />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-primary"></div>
            <h3 className="text-lg font-semibold">פתוח ({tasksByStatus.open.length})</h3>
          </div>
          {tasksByStatus.open.map(task => (
            <TaskCard key={task.id} task={task} />
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

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-yellow-500"></div>
            <h3 className="text-lg font-semibold">בעבודה ({tasksByStatus.in_progress.length})</h3>
          </div>
          {tasksByStatus.in_progress.map(task => (
            <TaskCard key={task.id} task={task} />
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

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-success"></div>
            <h3 className="text-lg font-semibold">הושלם ({tasksByStatus.done.length})</h3>
          </div>
          {tasksByStatus.done.map(task => (
            <TaskCard key={task.id} task={task} />
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
      </div>
    </div>
  );
}