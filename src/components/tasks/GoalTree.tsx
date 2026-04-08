import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Target, ChevronDown, ChevronLeft, Plus, CheckCircle2, Pause, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  parent_goal_id: string | null;
  status: string;
  progress_percent: number;
  due_date: string | null;
  owner_type: string;
  owner_id: string | null;
}

export function GoalTree() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("goals")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Goal[];
    },
    enabled: !!tenantId,
  });

  // Count tasks per goal
  const { data: goalTaskCounts = {} } = useQuery({
    queryKey: ["goal-task-counts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("goal_id, status" as any)
        .eq("tenant_id", tenantId!)
        .not("goal_id" as any, "is", null);
      if (error) return {};
      const counts: Record<string, { total: number; done: number }> = {};
      (data as any[])?.forEach((t: any) => {
        if (!t.goal_id) return;
        if (!counts[t.goal_id]) counts[t.goal_id] = { total: 0, done: 0 };
        counts[t.goal_id].total++;
        if (t.status === "done") counts[t.goal_id].done++;
      });
      return counts;
    },
    enabled: !!tenantId,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (parentId?: string) => {
      if (!newGoalTitle.trim() || !tenantId) return;
      const { error } = await (supabase as any)
        .from("goals")
        .insert({
          tenant_id: tenantId,
          title: newGoalTitle.trim(),
          parent_goal_id: parentId || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setNewGoalTitle("");
      setAddingGoal(false);
      toast.success("יעד נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת יעד"),
  });

  const updateGoalStatusMutation = useMutation({
    mutationFn: async ({ goalId, status }: { goalId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("goals")
        .update({ status })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("סטטוס היעד עודכן");
    },
  });

  const toggleExpand = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      next.has(goalId) ? next.delete(goalId) : next.add(goalId);
      return next;
    });
  };

  // Build tree
  const rootGoals = goals.filter(g => !g.parent_goal_id);
  const getChildren = (parentId: string) => goals.filter(g => g.parent_goal_id === parentId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "paused": return <Pause className="h-4 w-4 text-yellow-500" />;
      case "cancelled": return <X className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-primary" />;
    }
  };

  const GoalNode = ({ goal, depth = 0 }: { goal: Goal; depth?: number }) => {
    const children = getChildren(goal.id);
    const isExpanded = expandedGoals.has(goal.id);
    const taskCount = goalTaskCounts[goal.id];
    const progress = taskCount ? Math.round((taskCount.done / taskCount.total) * 100) : goal.progress_percent || 0;

    return (
      <div className={cn("space-y-1", depth > 0 && "mr-4 border-r-2 border-muted pr-3")}>
        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 group">
          {children.length > 0 ? (
            <button onClick={() => toggleExpand(goal.id)} className="shrink-0">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          {getStatusIcon(goal.status)}
          
          <span className={cn("text-sm font-medium flex-1", goal.status === "completed" && "line-through text-muted-foreground")}>
            {goal.title}
          </span>

          <div className="flex items-center gap-2">
            {taskCount && (
              <Badge variant="outline" className="text-[10px] h-5">
                {taskCount.done}/{taskCount.total}
              </Badge>
            )}
            <div className="w-16">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-[10px] text-muted-foreground w-8">{progress}%</span>
            
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
              {goal.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateGoalStatusMutation.mutate({ goalId: goal.id, status: "completed" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </Button>
              )}
              {goal.status === "completed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateGoalStatusMutation.mutate({ goalId: goal.id, status: "active" })}
                >
                  <Target className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {isExpanded && children.length > 0 && (
          <div className="space-y-1">
            {children.map(child => (
              <GoalNode key={child.id} goal={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            יעדים
            <Badge variant="secondary" className="text-xs">{goals.filter(g => g.status === "active").length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddingGoal(!addingGoal)}>
            <Plus className="h-4 w-4 ml-1" />
            יעד חדש
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {addingGoal && (
          <div className="flex gap-2 mb-3">
            <Input
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="שם היעד..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && createGoalMutation.mutate()}
            />
            <Button size="sm" onClick={() => createGoalMutation.mutate()} disabled={!newGoalTitle.trim()}>
              צור
            </Button>
          </div>
        )}

        {rootGoals.length === 0 && !addingGoal && (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין יעדים עדיין. צור יעד ראשון כדי להתחיל.
          </p>
        )}

        {rootGoals.map(goal => (
          <GoalNode key={goal.id} goal={goal} />
        ))}
      </CardContent>
    </Card>
  );
}
