/**
 * Goal Execution Mode — Carmen manages goals, milestones, tasks, dev work.
 * No Cursor concurrency limits — priority, dedup, status, links, reporting only.
 */

import { titleSimilarity } from "./dev-tasks.ts";

export const EXECUTION_GOAL_STATUSES = [
  "active", "in_progress", "blocked", "completed", "cancelled", "paused",
] as const;

export type ExecutionGoalStatus = typeof EXECUTION_GOAL_STATUSES[number];

export const OPEN_GOAL_STATUSES: ExecutionGoalStatus[] = [
  "active", "in_progress", "blocked", "paused",
];

export type ExecutionGoalRow = {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  status: ExecutionGoalStatus;
  priority: string;
  due_date?: string | null;
  next_action?: string | null;
  completion_criteria?: string | null;
  owner_type: string;
  owner_id?: string | null;
  owner_user_id?: string | null;
  progress_percent?: number | null;
  execution_mode: boolean;
  autonomous_mode?: boolean;
  engine_status?: string | null;
  objective?: string | null;
  iteration_count?: number | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type UnifiedGoalCreateArgs = {
  tenantId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  completionCriteria?: string;
  nextAction?: string;
  ownerUserId?: string | null;
  actorUserId?: string | null;
  /** When true, enables autonomous worker loop + structured success criteria. */
  autonomous?: boolean;
  objective?: string;
  constraints?: Record<string, unknown>;
  scope?: Record<string, unknown>;
  riskLevel?: string;
  successCriteria?: Array<{
    key?: string;
    description: string;
    required?: boolean;
    verification_type?: string;
    evidence_required?: string;
  }>;
  agentId?: string | null;
};

export async function logGoalEvent(
  supabase: { from: (t: string) => any },
  args: {
    goalId: string;
    tenantId: string;
    eventType: string;
    actor?: string;
    actorUserId?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("goal_events").insert({
    goal_id: args.goalId,
    tenant_id: args.tenantId,
    event_type: args.eventType,
    actor: args.actor ?? "system",
    actor_user_id: args.actorUserId ?? null,
    detail: args.detail ?? {},
  });
}

export async function findDuplicateGoals(
  supabase: { from: (t: string) => any },
  tenantId: string,
  title: string,
  threshold = 0.5,
): Promise<Array<{ goal: ExecutionGoalRow; score: number }>> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("execution_mode", true)
    .in("status", OPEN_GOAL_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data || [])
    .map((row: ExecutionGoalRow) => ({ goal: row, score: titleSimilarity(title, row.title) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function isAutonomousSchemaError(error: unknown): boolean {
  const row = error as { message?: string; code?: string };
  const msg = String(row?.message || error || "").toLowerCase();
  const code = String(row?.code || "");
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("unknown column") ||
    msg.includes("autonomous_mode") ||
    msg.includes("goal_success_criteria")
  );
}

function buildExecutionGoalRow(
  args: UnifiedGoalCreateArgs,
  autonomous: boolean,
  now: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    tenant_id: args.tenantId,
    title: args.title.trim(),
    description: args.description ?? null,
    due_date: args.dueDate ?? null,
    priority: args.priority ?? "normal",
    completion_criteria: args.completionCriteria ?? null,
    next_action: args.nextAction ?? null,
    owner_user_id: args.ownerUserId ?? null,
    owner_type: "agent",
    owner_id: autonomous ? "carmen" : null,
    status: autonomous ? "in_progress" : "active",
    execution_mode: true,
    progress_percent: 0,
  };
  if (!autonomous) return row;
  return {
    ...row,
    autonomous_mode: true,
    objective: args.objective?.trim() || args.title.trim(),
    engine_status: "PLANNING",
    constraints: args.constraints ?? {},
    scope: args.scope ?? {},
    risk_level: args.riskLevel ?? "READ",
    agent_id: args.agentId ?? null,
    next_run_at: now,
    plan: [],
  };
}

/** Single entry point for Command Center goals — manual execution or autonomous engine. */
export async function createUnifiedGoal(
  supabase: { from: (t: string) => any },
  args: UnifiedGoalCreateArgs,
): Promise<{
  goal: ExecutionGoalRow;
  criteria?: unknown[];
  autonomous_deferred?: boolean;
  notice?: string;
}> {
  const now = new Date().toISOString();
  const wantsAutonomous = !!args.autonomous;

  if (wantsAutonomous) {
    const { data, error } = await supabase.from("goals")
      .insert(buildExecutionGoalRow(args, true, now))
      .select("*")
      .single();

    if (!error) {
      let criteriaRows: unknown[] = [];
      try {
        const { seedSuccessCriteria } = await import("./autonomous-goal-engine.ts");
        criteriaRows = await seedSuccessCriteria(supabase, {
          tenantId: args.tenantId,
          goalId: data.id,
          title: args.title,
          completionCriteria: args.completionCriteria,
          successCriteria: args.successCriteria,
        });
      } catch (criteriaError) {
        if (!isAutonomousSchemaError(criteriaError)) throw criteriaError;
        await supabase.from("goals").delete().eq("id", data.id);
        return await createUnifiedGoal(supabase, { ...args, autonomous: false });
      }

      await logGoalEvent(supabase, {
        goalId: data.id,
        tenantId: args.tenantId,
        eventType: "autonomous_goal_created",
        actorUserId: args.actorUserId,
        detail: { engine_status: "PLANNING", criteria_count: criteriaRows.length },
      });
      return { goal: data as ExecutionGoalRow, criteria: criteriaRows };
    }

    if (!isAutonomousSchemaError(error)) throw error;
  }

  const { data, error } = await supabase.from("goals")
    .insert(buildExecutionGoalRow(args, false, now))
    .select("*")
    .single();
  if (error) throw error;

  await logGoalEvent(supabase, {
    goalId: data.id,
    tenantId: args.tenantId,
    eventType: "created",
    actorUserId: args.actorUserId,
    detail: wantsAutonomous ? { autonomous_requested: true, autonomous_deferred: true } : {},
  });

  return {
    goal: data as ExecutionGoalRow,
    criteria: [],
    autonomous_deferred: wantsAutonomous,
    notice: wantsAutonomous
      ? "היעד נוצר במצב ידני — מנוע אוטונומי יופעל אחרי עדכון Staging (מיגרציה)."
      : undefined,
  };
}

export async function createExecutionGoal(
  supabase: { from: (t: string) => any },
  args: Omit<UnifiedGoalCreateArgs, "autonomous">,
): Promise<ExecutionGoalRow> {
  const { goal } = await createUnifiedGoal(supabase, { ...args, autonomous: false });
  return goal;
}

export async function addGoalMilestone(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    goalId: string;
    title: string;
    description?: string;
    dueDate?: string;
    sortOrder?: number;
    actorUserId?: string | null;
  },
) {
  const { data, error } = await supabase.from("goal_milestones").insert({
    tenant_id: args.tenantId,
    goal_id: args.goalId,
    title: args.title.trim(),
    description: args.description ?? null,
    due_date: args.dueDate ?? null,
    sort_order: args.sortOrder ?? 0,
    status: "pending",
  }).select("*").single();
  if (error) throw error;
  await logGoalEvent(supabase, {
    goalId: args.goalId,
    tenantId: args.tenantId,
    eventType: "milestone_added",
    actorUserId: args.actorUserId,
    detail: { milestone_id: data.id, title: data.title },
  });
  return data;
}

export async function addGoalBlocker(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    goalId: string;
    title: string;
    description?: string;
    actorUserId?: string | null;
  },
) {
  const { data, error } = await supabase.from("goal_blockers").insert({
    tenant_id: args.tenantId,
    goal_id: args.goalId,
    title: args.title.trim(),
    description: args.description ?? null,
    status: "open",
  }).select("*").single();
  if (error) throw error;
  await supabase.from("goals").update({ status: "blocked", updated_at: new Date().toISOString() })
    .eq("id", args.goalId).eq("tenant_id", args.tenantId);
  await logGoalEvent(supabase, {
    goalId: args.goalId,
    tenantId: args.tenantId,
    eventType: "blocker_added",
    actorUserId: args.actorUserId,
    detail: { blocker_id: data.id },
  });
  return data;
}

export async function linkTaskToGoal(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; goalId: string; taskId: string; actorUserId?: string | null },
) {
  const { data, error } = await supabase.from("tasks")
    .update({ goal_id: args.goalId, updated_at: new Date().toISOString() })
    .eq("id", args.taskId)
    .eq("tenant_id", args.tenantId)
    .select("id, title, goal_id")
    .single();
  if (error) throw error;
  await logGoalEvent(supabase, {
    goalId: args.goalId,
    tenantId: args.tenantId,
    eventType: "task_linked",
    actorUserId: args.actorUserId,
    detail: { task_id: args.taskId },
  });
  return data;
}

export async function getGoalExecutionReport(
  supabase: { from: (t: string) => any },
  tenantId: string,
  goalId: string,
  sinceHours = 24,
): Promise<Record<string, unknown>> {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  const { data: goal } = await supabase.from("goals").select("*")
    .eq("id", goalId).eq("tenant_id", tenantId).maybeSingle();

  const { data: milestones } = await supabase.from("goal_milestones").select("*")
    .eq("goal_id", goalId).order("sort_order");

  const { data: blockers } = await supabase.from("goal_blockers").select("*")
    .eq("goal_id", goalId).order("created_at", { ascending: false });

  const { data: events } = await supabase.from("goal_events").select("*")
    .eq("goal_id", goalId).gte("created_at", since).order("created_at", { ascending: false }).limit(30);

  const { data: tasks } = await supabase.from("tasks").select("id, title, status, assigned_agent")
    .eq("goal_id", goalId).eq("tenant_id", tenantId);

  const { data: devTasks } = await supabase.from("dev_tasks").select("id, title, status, cursor_session_url, pr_url")
    .eq("goal_id", goalId).eq("tenant_id", tenantId);

  const { data: pendingApprovals } = await supabase.from("agent_approval_queue")
    .select("id, tool_name, status, created_at, title, description")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  const openBlockers = (blockers || []).filter((b: { status: string }) => b.status === "open");
  const doneMilestones = (milestones || []).filter((m: { status: string }) => m.status === "done").length;
  const totalMilestones = (milestones || []).length;
  const progress = totalMilestones ? Math.round((doneMilestones / totalMilestones) * 100) : Number(goal?.progress_percent || 0);

  const nextActions: string[] = [];
  if (goal?.next_action) nextActions.push(goal.next_action);
  const pendingMilestone = (milestones || []).find((m: { status: string }) => m.status === "pending" || m.status === "in_progress");
  if (pendingMilestone) nextActions.push(`אבן דרך: ${pendingMilestone.title}`);
  const openTask = (tasks || []).find((t: { status: string }) => t.status !== "done");
  if (openTask) nextActions.push(`משימה: ${openTask.title}`);

  const report: Record<string, unknown> = {
    goal,
    progress_percent: progress,
    milestones: milestones || [],
    open_blockers: openBlockers,
    changes_since: events || [],
    linked_tasks: tasks || [],
    linked_dev_tasks: devTasks || [],
    pending_approvals: pendingApprovals || [],
    needs_david_approval: (pendingApprovals || []).length,
    next_three_actions: nextActions.slice(0, 3),
  };

  if (goal?.autonomous_mode) {
    try {
      const { getAutonomousGoalStatus } = await import("./autonomous-goal-engine.ts");
      report.autonomous_engine = await getAutonomousGoalStatus(supabase, tenantId, goalId);
    } catch {
      report.autonomous_engine = null;
    }
  }

  return report;
}
