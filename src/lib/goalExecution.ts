/** Client API for Goal Execution Mode + Autonomous Goal Engine in Command Center. */

export type ExecutionGoalStatus =
  | "active" | "in_progress" | "blocked" | "completed" | "cancelled" | "paused";

export type EngineStatus =
  | "PLANNING" | "EXECUTING" | "VERIFYING" | "REPLANNING" | "BLOCKED" | "COMPLETED";

export type CriterionStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_TESTED";

export type ExecutionGoal = {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  status: ExecutionGoalStatus;
  priority: string;
  due_date?: string | null;
  next_action?: string | null;
  completion_criteria?: string | null;
  progress_percent?: number | null;
  execution_mode: boolean;
  autonomous_mode?: boolean;
  engine_status?: EngineStatus | null;
  objective?: string | null;
  iteration_count?: number | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalCriterion = {
  id: string;
  criterion_key: string;
  description: string;
  required: boolean;
  status: CriterionStatus;
};

export type AutonomousEngineSnapshot = {
  goal: ExecutionGoal;
  criteria: GoalCriterion[];
  completion_gate: { complete: boolean; pending: GoalCriterion[]; failed: GoalCriterion[] };
  recent_iterations: Array<{ iteration_number: number; phase: string; status: string; summary?: string | null }>;
  blockers: Array<{ title: string }>;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-execution-center`;

async function authHeader(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function listExecutionGoals(
  token: string,
  tenantId: string,
  filters?: { status?: ExecutionGoalStatus },
): Promise<ExecutionGoal[]> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await authHeader(token),
    body: JSON.stringify({ action: "list", tenant_id: tenantId, ...filters, limit: 80 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "list failed");
  return json.goals || [];
}

export async function getExecutionGoal(token: string, tenantId: string, id: string) {
  const res = await fetch(FN, {
    method: "POST",
    headers: await authHeader(token),
    body: JSON.stringify({ action: "get", tenant_id: tenantId, id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "get failed");
  return json;
}

export async function goalExecutionAction(
  token: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await authHeader(token),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "action failed");
  return json;
}

export async function runGoalIteration(token: string, tenantId: string, goalId: string) {
  return goalExecutionAction(token, {
    action: "run_iteration",
    tenant_id: tenantId,
    goal_id: goalId,
  });
}

export const GOAL_STATUS_LABELS: Record<ExecutionGoalStatus, string> = {
  active: "פעיל",
  in_progress: "בעבודה",
  blocked: "חסום",
  completed: "הושלם",
  cancelled: "בוטל",
  paused: "מושהה",
};

export const ENGINE_STATUS_LABELS: Record<EngineStatus, string> = {
  PLANNING: "תכנון",
  EXECUTING: "מבצע",
  VERIFYING: "מאמת",
  REPLANNING: "תכנון מחדש",
  BLOCKED: "חסום",
  COMPLETED: "הושלם",
};

export const CRITERION_STATUS_LABELS: Record<CriterionStatus, string> = {
  PASS: "עבר",
  FAIL: "נכשל",
  UNKNOWN: "לא ידוע",
  NOT_TESTED: "לא נבדק",
};

export const GOAL_PRIORITY_LABELS: Record<string, string> = {
  urgent: "דחוף",
  high: "גבוה",
  normal: "רגיל",
  low: "נמוך",
};
