/**
 * Dev Task Command Center — create, dedup, dispatch, track.
 * No concurrency / parallelism limits — only priority, status, dedup, and links.
 */

import { mcpRequestDevTask } from "./cursor-task-queue.ts";
import { trackCursorTaskSession, cursorSessionDisplayName } from "./cursor-session-tracker.ts";

export const DEV_TASK_STATUSES = [
  "draft", "approved", "sent_to_cursor", "in_progress", "blocked",
  "pr_opened", "ready_for_review", "done", "cancelled",
] as const;

export type DevTaskStatus = typeof DEV_TASK_STATUSES[number];

export const OPEN_DEV_STATUSES: DevTaskStatus[] = [
  "draft", "approved", "sent_to_cursor", "in_progress", "blocked", "pr_opened", "ready_for_review",
];

export type DevTaskBrief = {
  title: string;
  problem?: string;
  expected_behavior?: string;
  current_behavior?: string;
  scope?: string;
  affected_areas?: string;
  constraints?: string;
  acceptance_criteria?: string;
  base_branch?: string;
  environment?: string;
  requested_by?: string;
};

export type DevTaskRow = DevTaskBrief & {
  id: string;
  tenant_id: string;
  priority: string;
  status: DevTaskStatus;
  assigned_agent: string;
  requested_by_user_id?: string | null;
  owner_user_id?: string | null;
  source_conversation_id?: string | null;
  source_message?: string | null;
  cursor_session_id?: string | null;
  cursor_session_url?: string | null;
  pr_url?: string | null;
  dedup_of?: string | null;
  dispatch_error?: string | null;
  brief?: Record<string, unknown>;
  dispatched_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard word overlap — simple dedup without embeddings. */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return normalizeTitle(a) === normalizeTitle(b) ? 1 : 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}

export function buildDevTaskPrompt(task: DevTaskRow): { task: string; context: string } {
  const lines = [
    task.title,
    task.problem ? `Problem:\n${task.problem}` : "",
    task.current_behavior ? `Current behavior:\n${task.current_behavior}` : "",
    task.expected_behavior ? `Expected behavior:\n${task.expected_behavior}` : "",
    task.scope ? `Scope:\n${task.scope}` : "",
    task.affected_areas ? `Likely areas:\n${task.affected_areas}` : "",
    task.constraints ? `Constraints:\n${task.constraints}` : "",
    task.acceptance_criteria ? `Acceptance criteria:\n${task.acceptance_criteria}` : "",
  ].filter(Boolean);

  return {
    task: task.title,
    context: [
      `dev_task_id: ${task.id}`,
      task.source_conversation_id ? `conversation_id: ${task.source_conversation_id}` : "",
      `Base branch: ${task.base_branch || "develop"}`,
      `Environment: ${task.environment || "staging"}`,
      `Requested by: ${task.requested_by || "Carmen"}`,
      `Assigned agent: ${task.assigned_agent}`,
      "",
      lines.join("\n\n"),
      "",
      "Target develop/staging first — production is main only after review.",
      "When finished: update PR URL via dev task workflow; do not merge to main without approval.",
    ].join("\n"),
  };
}

export async function logDevTaskEvent(
  supabase: { from: (t: string) => any },
  args: {
    devTaskId: string;
    tenantId: string;
    eventType: string;
    actor?: string;
    actorUserId?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("dev_task_events").insert({
    dev_task_id: args.devTaskId,
    tenant_id: args.tenantId,
    event_type: args.eventType,
    actor: args.actor ?? "system",
    actor_user_id: args.actorUserId ?? null,
    detail: args.detail ?? {},
  });
}

export async function findDuplicateDevTasks(
  supabase: { from: (t: string) => any },
  tenantId: string,
  title: string,
  threshold = 0.5,
): Promise<Array<{ task: DevTaskRow; score: number }>> {
  const { data, error } = await supabase
    .from("dev_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", OPEN_DEV_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || [])
    .map((row: DevTaskRow) => ({ task: row, score: titleSimilarity(title, row.title) }))
    .filter((x: { score: number }) => x.score >= threshold)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
}

export async function createDevTask(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    brief: DevTaskBrief;
    priority?: string;
    assignedAgent?: string;
    requestedByUserId?: string | null;
    sourceConversationId?: string | null;
    sourceMessage?: string | null;
    dedupOf?: string | null;
    actorUserId?: string | null;
    goalId?: string | null;
  },
): Promise<DevTaskRow> {
  const row = {
    tenant_id: args.tenantId,
    title: args.brief.title.trim(),
    problem: args.brief.problem ?? null,
    expected_behavior: args.brief.expected_behavior ?? null,
    current_behavior: args.brief.current_behavior ?? null,
    scope: args.brief.scope ?? null,
    affected_areas: args.brief.affected_areas ?? null,
    constraints: args.brief.constraints ?? null,
    acceptance_criteria: args.brief.acceptance_criteria ?? null,
    base_branch: args.brief.base_branch ?? "develop",
    environment: args.brief.environment ?? "staging",
    requested_by: args.brief.requested_by ?? null,
    requested_by_user_id: args.requestedByUserId ?? null,
    priority: args.priority ?? "normal",
    assigned_agent: args.assignedAgent ?? "cursor",
    status: "draft" as DevTaskStatus,
    source_conversation_id: args.sourceConversationId ?? null,
    source_message: args.sourceMessage ?? null,
    dedup_of: args.dedupOf ?? null,
    goal_id: args.goalId ?? null,
    brief: args.brief,
  };
  const { data, error } = await supabase.from("dev_tasks").insert(row).select("*").single();
  if (error) throw error;
  await logDevTaskEvent(supabase, {
    devTaskId: data.id,
    tenantId: args.tenantId,
    eventType: args.dedupOf ? "created_as_update" : "created",
    actorUserId: args.actorUserId,
    detail: { dedup_of: args.dedupOf },
  });
  return data as DevTaskRow;
}

export async function approveDevTask(
  supabase: { from: (t: string) => any },
  tenantId: string,
  taskId: string,
  userId: string,
): Promise<DevTaskRow> {
  const { data, error } = await supabase
    .from("dev_tasks")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) throw error;
  await logDevTaskEvent(supabase, {
    devTaskId: taskId,
    tenantId,
    eventType: "approved",
    actorUserId: userId,
  });
  return data as DevTaskRow;
}

export async function dispatchDevTask(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; taskId: string; actorUserId?: string | null },
): Promise<{ task: DevTaskRow; sessionUrl: string; cursorAgentId: string; timedOut: boolean }> {
  const { data: task, error } = await supabase
    .from("dev_tasks")
    .select("*")
    .eq("id", args.taskId)
    .eq("tenant_id", args.tenantId)
    .single();
  if (error || !task) throw new Error("dev_task not found");

  if (task.cursor_session_id && task.cursor_session_url) {
    return {
      task: task as DevTaskRow,
      sessionUrl: task.cursor_session_url,
      cursorAgentId: task.cursor_session_id,
      timedOut: false,
    };
  }

  const agent = String(task.assigned_agent || "cursor").toLowerCase();
  if (agent !== "cursor") {
    throw new Error(`Dispatch for agent "${agent}" is not wired yet — use cursor or update manually.`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const bearer = Deno.env.get("CURSOR_MCP_BEARER") || "";
  if (!supabaseUrl || !bearer) throw new Error("SUPABASE_URL / CURSOR_MCP_BEARER missing");

  const { task: prompt, context } = buildDevTaskPrompt(task as DevTaskRow);
  let sessionUrl = "";
  let cursorAgentId = "";
  let dispatchError: string | null = null;
  let timedOut = false;

  try {
    const fired = await mcpRequestDevTask(supabaseUrl, bearer, {
      task: prompt,
      context,
      tenantId: args.tenantId,
    });
    sessionUrl = fired.sessionUrl;
    cursorAgentId = fired.cursorAgentId;
  } catch (e: unknown) {
    timedOut = true;
    dispatchError = e instanceof Error ? e.message : String(e);
    console.warn("[dev-tasks] dispatch error (may reconcile later):", dispatchError);
  }

  const patch: Record<string, unknown> = {
    status: cursorAgentId ? "sent_to_cursor" : "approved",
    dispatch_error: dispatchError,
    dispatched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (cursorAgentId) {
    patch.cursor_session_id = cursorAgentId;
    patch.cursor_session_url = sessionUrl || `https://cursor.com/agents/${cursorAgentId}`;
  }

  const { data: updated, error: upErr } = await supabase
    .from("dev_tasks")
    .update(patch)
    .eq("id", args.taskId)
    .eq("tenant_id", args.tenantId)
    .select("*")
    .single();
  if (upErr) throw upErr;

  if (cursorAgentId) {
    await trackCursorTaskSession(supabase, {
      tenantId: args.tenantId,
      cursorAgentId,
      sessionUrl: patch.cursor_session_url as string,
      displayName: cursorSessionDisplayName({ taskTitle: task.title, sourceTool: "dev-task-center" }),
      taskTitle: task.title,
      sourceTool: "dev-task-center",
    });
    await supabase
      .from("cursor_task_sessions")
      .update({ dev_task_id: args.taskId })
      .eq("cursor_agent_id", cursorAgentId)
      .eq("tenant_id", args.tenantId);
  }

  await logDevTaskEvent(supabase, {
    devTaskId: args.taskId,
    tenantId: args.tenantId,
    eventType: cursorAgentId ? "dispatched" : "dispatch_failed",
    actorUserId: args.actorUserId,
    detail: { sessionUrl, cursorAgentId, timedOut, error: dispatchError },
  });

  return {
    task: updated as DevTaskRow,
    sessionUrl: String(patch.cursor_session_url || ""),
    cursorAgentId,
    timedOut,
  };
}

export async function attachDevTaskSession(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    taskId: string;
    cursorSessionId: string;
    cursorSessionUrl?: string;
    actorUserId?: string | null;
  },
): Promise<DevTaskRow> {
  const url = args.cursorSessionUrl ||
    `https://cursor.com/agents/${args.cursorSessionId.replace(/^bc-/, "bc-")}`;
  const { data, error } = await supabase
    .from("dev_tasks")
    .update({
      cursor_session_id: args.cursorSessionId,
      cursor_session_url: url,
      status: "sent_to_cursor",
      dispatch_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.taskId)
    .eq("tenant_id", args.tenantId)
    .select("*")
    .single();
  if (error) throw error;
  await logDevTaskEvent(supabase, {
    devTaskId: args.taskId,
    tenantId: args.tenantId,
    eventType: "session_linked",
    actorUserId: args.actorUserId,
    detail: { cursor_session_id: args.cursorSessionId, session_url: url },
  });
  return data as DevTaskRow;
}
