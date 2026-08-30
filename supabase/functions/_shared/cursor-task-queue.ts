// Human tasks (public.tasks) assigned to Cursor → Cloud Agent dispatch + queue advance.

export const CURSOR_ASSIGNEE_NAMES = ["cursor", "קרסר", "cursor cloud", "cursor agent"];

export type HumanTaskRow = {
  id: string;
  tenant_id: string;
  title: string;
  notes?: string | null;
  status: string;
  assigned_agent?: string | null;
  priority?: number | null;
};

export function isCursorAssignee(name: string | null | undefined): boolean {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  return CURSOR_ASSIGNEE_NAMES.some((x) => n === x || n.includes("cursor"));
}

export function extractHumanTaskId(context: string | null | undefined): string | null {
  const m = String(context || "").match(/human_task_id:\s*([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export async function countInProgressCursorTasks(supabase: any, tenantId: string): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .select("assigned_agent")
    .eq("tenant_id", tenantId)
    .eq("status", "in_progress");
  if (error) throw error;
  return (data || []).filter((t: { assigned_agent?: string | null }) =>
    isCursorAssignee(t.assigned_agent)
  ).length;
}

export async function claimNextOpenCursorTask(
  supabase: any,
  tenantId: string,
): Promise<HumanTaskRow | null> {
  const { data: open, error } = await supabase
    .from("tasks")
    .select("id, tenant_id, title, notes, status, assigned_agent, priority")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  const candidate = (open || []).find((t: HumanTaskRow) => isCursorAssignee(t.assigned_agent));
  if (!candidate) return null;

  const { data: claimed, error: claimErr } = await supabase
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", candidate.id)
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .select("id, tenant_id, title, notes, status, assigned_agent, priority")
    .maybeSingle();
  if (claimErr) throw claimErr;
  return claimed;
}

export function buildCursorTaskPrompt(task: HumanTaskRow): { task: string; context: string } {
  const notes = String(task.notes || "").trim();
  return {
    task: task.title,
    context: [
      `human_task_id: ${task.id}`,
      notes ? `Notes:\n${notes}` : "",
      "When finished: call MCP tool complete_human_task with this task_id and a short summary.",
      "Then open a PR. One task at a time — do not start unrelated work.",
    ].filter(Boolean).join("\n\n"),
  };
}

export async function mcpRequestDevTask(
  supabaseUrl: string,
  bearer: string,
  payload: { task: string; context: string; tenantId: string },
): Promise<{ sessionUrl: string; cursorAgentId: string; raw: string }> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/cursor-mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "request_dev_task",
        arguments: { task: payload.task, context: payload.context },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`cursor-mcp ${resp.status}: ${text.slice(0, 400)}`);
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { /* sse fallback below */ }
  const content = parsed?.result?.content;
  const flat = Array.isArray(content)
    ? content.map((c: any) => c?.text ?? "").join("\n")
    : String(parsed?.result ?? text);
  const urlMatch = flat.match(/https:\/\/cursor\.com\/agents\/(bc-[a-z0-9-]+)/i);
  const idMatch = flat.match(/\bbc-[a-z0-9-]+\b/i);
  return {
    sessionUrl: urlMatch ? urlMatch[0] : "",
    cursorAgentId: idMatch ? idMatch[0] : "",
    raw: flat,
  };
}

export async function completeHumanCursorTask(
  supabase: any,
  args: { tenantId: string; taskId: string; summary?: string },
): Promise<{ ok: boolean; advanced?: boolean }> {
  const { tenantId, taskId, summary } = args;
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_agent, status")
    .eq("id", taskId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!task) return { ok: false };

  await supabase
    .from("tasks")
    .update({ status: "done", assigned_agent: null })
    .eq("id", taskId)
    .eq("tenant_id", tenantId);

  await supabase.from("task_updates").insert({
    task_id: taskId,
    tenant_id: tenantId,
    user_id: null,
    content: summary || "Cursor סיים את המשימה",
    update_type: "agent_action",
  });

  await supabase
    .from("cursor_dispatches")
    .update({ status: "completed" })
    .eq("human_task_id", taskId)
    .eq("tenant_id", tenantId);

  const inProgress = await countInProgressCursorTasks(supabase, tenantId);
  if (inProgress > 0) return { ok: true, advanced: false };

  const next = await claimAndDispatchCursorTask(supabase, tenantId);
  return { ok: true, advanced: Boolean(next) };
}

export async function claimAndDispatchCursorTask(
  supabase: any,
  tenantId: string,
): Promise<{ taskId: string; sessionUrl: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const bearer = Deno.env.get("CURSOR_MCP_BEARER") || "";
  if (!supabaseUrl || !bearer) throw new Error("SUPABASE_URL / CURSOR_MCP_BEARER missing");

  const inProgress = await countInProgressCursorTasks(supabase, tenantId);
  if (inProgress > 0) return null;

  const task = await claimNextOpenCursorTask(supabase, tenantId);
  if (!task) return null;

  const { task: prompt, context } = buildCursorTaskPrompt(task);
  const fired = await mcpRequestDevTask(supabaseUrl, bearer, { task: prompt, context, tenantId });

  return { taskId: task.id, sessionUrl: fired.sessionUrl };
}
