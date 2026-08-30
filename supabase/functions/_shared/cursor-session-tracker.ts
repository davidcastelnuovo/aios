/** Persist Cursor Cloud Agent bc-… sessions linked to AIOS tasks. */

export type CursorSessionStatus = "running" | "completed" | "failed" | "busy";

export type TrackCursorSessionInput = {
  tenantId: string;
  cursorAgentId: string;
  sessionUrl?: string | null;
  displayName: string;
  taskTitle?: string | null;
  humanTaskId?: string | null;
  sourceTool: string;
  appEnv?: string | null;
  status?: CursorSessionStatus;
};

export function resolveAppEnv(): string {
  return (
    Deno.env.get("APP_ENV") ||
    Deno.env.get("VITE_APP_ENV") ||
    Deno.env.get("ENVIRONMENT") ||
    "unknown"
  );
}

export function cursorSessionDisplayName(args: {
  taskTitle?: string | null;
  requestText?: string | null;
  sourceTool?: string | null;
}): string {
  const title = String(args.taskTitle || "").trim();
  if (title) return `AIOS · ${title}`.slice(0, 100);
  const request = String(args.requestText || "").trim();
  if (request) return `AIOS · ${request}`.slice(0, 100);
  const tool = String(args.sourceTool || "cursor").trim();
  return `AIOS · ${tool}`.slice(0, 100);
}

export async function fetchHumanTaskTitle(
  supabase: { from: (t: string) => any },
  tenantId: string,
  taskId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", taskId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return String(data?.title || "").trim() || null;
  } catch {
    return null;
  }
}

export async function trackCursorTaskSession(
  supabase: { from: (t: string) => any },
  input: TrackCursorSessionInput,
): Promise<void> {
  const agentId = String(input.cursorAgentId || "").trim();
  if (!agentId.startsWith("bc-")) return;

  const now = new Date().toISOString();
  const row = {
    tenant_id: input.tenantId,
    cursor_agent_id: agentId,
    session_url: input.sessionUrl || `https://cursor.com/agents/${agentId}`,
    display_name: input.displayName.slice(0, 200),
    human_task_id: input.humanTaskId || null,
    task_title: input.taskTitle || null,
    source_tool: input.sourceTool,
    app_env: input.appEnv || resolveAppEnv(),
    status: input.status || "running",
    updated_at: now,
    last_seen_at: now,
  };

  const { error } = await supabase
    .from("cursor_task_sessions")
    .upsert(row, { onConflict: "cursor_agent_id" });
  if (error) throw error;

  if (input.humanTaskId) {
    await supabase
      .from("tasks")
      .update({
        cursor_session_id: agentId,
        cursor_session_url: row.session_url,
      })
      .eq("id", input.humanTaskId)
      .eq("tenant_id", input.tenantId);
  }

  console.log(
    `[cursor-session-tracker] tracked session_id=${agentId} task=${input.humanTaskId || "none"} ` +
      `name="${row.display_name}" env=${row.app_env} tool=${input.sourceTool}`,
  );
}

export async function touchCursorTaskSession(
  supabase: { from: (t: string) => any },
  cursorAgentId: string,
  status?: CursorSessionStatus,
): Promise<void> {
  const id = String(cursorAgentId || "").trim();
  if (!id.startsWith("bc-")) return;
  const now = new Date().toISOString();
  const patch: Record<string, string> = { updated_at: now, last_seen_at: now };
  if (status) patch.status = status;
  await supabase.from("cursor_task_sessions").update(patch).eq("cursor_agent_id", id);
}

export async function completeCursorSessionsForTask(
  supabase: { from: (t: string) => any },
  tenantId: string,
  humanTaskId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("cursor_task_sessions")
    .update({ status: "completed", updated_at: now, last_seen_at: now })
    .eq("tenant_id", tenantId)
    .eq("human_task_id", humanTaskId)
    .in("status", ["running", "busy"]);

  await supabase
    .from("tasks")
    .update({ cursor_session_id: null, cursor_session_url: null })
    .eq("id", humanTaskId)
    .eq("tenant_id", tenantId);
}

export type CursorTaskSessionRow = {
  id: string;
  tenant_id: string;
  cursor_agent_id: string;
  session_url: string | null;
  display_name: string;
  human_task_id: string | null;
  task_title: string | null;
  source_tool: string;
  app_env: string | null;
  status: CursorSessionStatus;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

export async function listCursorTaskSessions(
  supabase: { from: (t: string) => any },
  tenantId: string,
  opts?: { status?: CursorSessionStatus | "active"; limit?: number },
): Promise<CursorTaskSessionRow[]> {
  let query = supabase
    .from("cursor_task_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(opts?.limit ?? 20);
  if (opts?.status === "active") {
    query = query.in("status", ["running", "busy"]);
  } else if (opts?.status) {
    query = query.eq("status", opts.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CursorTaskSessionRow[];
}

export async function findCursorSessionForTask(
  supabase: { from: (t: string) => any },
  tenantId: string,
  taskId: string,
): Promise<CursorTaskSessionRow | null> {
  const { data, error } = await supabase
    .from("cursor_task_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("human_task_id", taskId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CursorTaskSessionRow | null) ?? null;
}

export function formatCursorSessionsForAgent(rows: CursorTaskSessionRow[]): string {
  if (!rows.length) return "No Cursor task sessions found.";
  return rows.map((r) => {
    const task = r.human_task_id ? `task=${r.human_task_id}` : "task=—";
    const title = r.task_title || r.display_name;
    return (
      `• ${title}\n` +
      `  session_id: ${r.cursor_agent_id}\n` +
      `  url: ${r.session_url || `https://cursor.com/agents/${r.cursor_agent_id}`}\n` +
      `  ${task} · status=${r.status} · env=${r.app_env || "?"} · tool=${r.source_tool}`
    );
  }).join("\n\n");
}
