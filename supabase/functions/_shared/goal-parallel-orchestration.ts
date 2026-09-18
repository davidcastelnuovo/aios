/**
 * Parallel sub-project orchestration — multiple Cursor agents per goal (one per department/track).
 */

export type ParallelPlanStep = {
  id: string;
  title: string;
  status: string;
  action_type: string;
  priority: number;
  sort_order: number;
  parallel_track?: boolean;
  sub_project_key?: string | null;
  sub_project_label?: string | null;
  cursor_agent_id?: string | null;
  cursor_session_url?: string | null;
  metadata: Record<string, unknown>;
};

export const MAX_PARALLEL_CURSOR_DISPATCH = 6;

export function isParallelCursorStep(step: ParallelPlanStep): boolean {
  return step.action_type === "cursor" && (
    step.parallel_track === true ||
    !!(step.metadata as Record<string, unknown>)?.parallel_track ||
    !!step.sub_project_key
  );
}

/** Pending parallel cursor steps ready to dispatch together. */
export function selectParallelDispatchBatch(steps: ParallelPlanStep[]): ParallelPlanStep[] {
  const pending = steps
    .filter((s) => s.status === "pending" && isParallelCursorStep(s))
    .sort((a, b) => a.sort_order - b.sort_order);
  if (pending.length < 2) return [];
  return pending.slice(0, MAX_PARALLEL_CURSOR_DISPATCH);
}

/** In-progress cursor tracks awaiting completion (monitor, do not re-dispatch). */
export function selectInProgressCursorTracks(steps: ParallelPlanStep[]): ParallelPlanStep[] {
  return steps.filter((s) =>
    s.status === "in_progress" && s.action_type === "cursor" && (s.cursor_agent_id || s.sub_project_key),
  );
}

/** Next sequential step when not in parallel batch mode. */
export function selectNextSequentialStep(steps: ParallelPlanStep[]): ParallelPlanStep | undefined {
  return steps
    .filter((s) => s.status === "pending" && !isParallelCursorStep(s))
    .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)[0];
}

export async function notifyDavidStagingReady(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error?: unknown }> },
  args: {
    tenantId: string;
    goalId: string;
    goalTitle: string;
    subProjects?: Array<{ label: string; sessionUrl?: string | null; status: string }>;
  },
): Promise<void> {
  const staging = "https://staging.aios.co.il";
  const tracks = (args.subProjects || [])
    .map((t) => `• ${t.label}: ${t.status}${t.sessionUrl ? ` — ${t.sessionUrl}` : ""}`)
    .join("\n");

  const message = [
    `✅ יעד אוטונומי הושלם: ${args.goalTitle}`,
    "",
    tracks ? `מסלולים:\n${tracks}` : "",
    "",
    `בדיקה בסטייג'ינג: ${staging}`,
    `goal_id: ${args.goalId}`,
  ].filter(Boolean).join("\n");

  try {
    await supabase.rpc("claude_notify_david", {
      p_message: message.slice(0, 3500),
      p_tenant_id: args.tenantId,
    });
  } catch (e) {
    console.warn("[goal-parallel] notify david failed:", e);
  }
}
