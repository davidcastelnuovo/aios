/**
 * Hard dedup gate before opening a new Cursor Cloud Agent for dev work.
 * Checks dev_tasks, cursor_dispatches, and active cursor_task_sessions.
 */

import {
  findDuplicateDevTasks,
  OPEN_DEV_STATUSES,
  titleSimilarity,
  type DevTaskRow,
} from "./dev-tasks.ts";

export type InFlightCursorDevMatch = {
  source: "dev_task" | "cursor_dispatch" | "cursor_session";
  id: string;
  title: string;
  score: number;
  status?: string | null;
  session_url?: string | null;
  cursor_agent_id?: string | null;
};

const SESSION_ACTIVE_STATUSES = new Set(["running", "busy"]);

function bestScore(title: string, candidate: string): number {
  return titleSimilarity(title, candidate);
}

function pushMatch(
  out: InFlightCursorDevMatch[],
  match: InFlightCursorDevMatch,
  threshold: number,
): void {
  if (match.score >= threshold) out.push(match);
}

/** Collect similar in-flight Cursor dev work for a tenant + title. */
export async function findInFlightCursorDevWork(
  supabase: { from: (t: string) => any },
  tenantId: string,
  title: string,
  opts?: { threshold?: number; excludeDevTaskId?: string | null },
): Promise<InFlightCursorDevMatch[]> {
  const threshold = opts?.threshold ?? 0.5;
  const trimmed = title.trim();
  if (!trimmed || !tenantId) return [];

  const matches: InFlightCursorDevMatch[] = [];

  const devDupes = await findDuplicateDevTasks(supabase, tenantId, trimmed, threshold);
  for (const { task, score } of devDupes) {
    if (opts?.excludeDevTaskId && task.id === opts.excludeDevTaskId) continue;
    matches.push({
      source: "dev_task",
      id: task.id,
      title: task.title,
      score,
      status: task.status,
      session_url: task.cursor_session_url,
      cursor_agent_id: task.cursor_session_id,
    });
  }

  const { data: dispatches, error: dispErr } = await supabase
    .from("cursor_dispatches")
    .select("id, request_text, status, session_url, cursor_agent_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("tool", "request_dev_task")
    .order("created_at", { ascending: false })
    .limit(40);
  if (dispErr) throw dispErr;

  for (const row of dispatches || []) {
    const status = String(row.status || "dispatched");
    if (status === "completed" || status === "cancelled") continue;
    const requestText = String(row.request_text || "").trim();
    if (!requestText) continue;
    pushMatch(matches, {
      source: "cursor_dispatch",
      id: String(row.id),
      title: requestText.slice(0, 200),
      score: bestScore(trimmed, requestText),
      status,
      session_url: row.session_url,
      cursor_agent_id: row.cursor_agent_id,
    }, threshold);
  }

  const { data: sessions, error: sessErr } = await supabase
    .from("cursor_task_sessions")
    .select("id, task_title, display_name, status, session_url, cursor_agent_id, source_tool")
    .eq("tenant_id", tenantId)
    .in("status", [...SESSION_ACTIVE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(40);
  if (sessErr) throw sessErr;

  for (const row of sessions || []) {
    const sourceTool = String(row.source_tool || "");
    if (sourceTool && sourceTool !== "request_dev_task" && sourceTool !== "dev-task-center") continue;
    const candidate = String(row.task_title || row.display_name || "").trim();
    if (!candidate) continue;
    pushMatch(matches, {
      source: "cursor_session",
      id: String(row.id),
      title: candidate.slice(0, 200),
      score: bestScore(trimmed, candidate),
      status: row.status,
      session_url: row.session_url,
      cursor_agent_id: row.cursor_agent_id,
    }, threshold);
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id && x.source === m.source) === i);
}

export function formatInFlightDuplicateError(matches: InFlightCursorDevMatch[]): string {
  const top = matches.slice(0, 3);
  const lines = top.map((m) => {
    const where =
      m.source === "dev_task" ? "dev_tasks" :
      m.source === "cursor_dispatch" ? "cursor_dispatches" :
      "cursor_task_sessions";
    const url = m.session_url || (m.cursor_agent_id ? `https://cursor.com/agents/${m.cursor_agent_id}` : "");
    return (
      `• ${Math.round(m.score * 100)}% דומה — ${m.title.slice(0, 120)}` +
      (m.status ? ` [${m.status}]` : "") +
      (url ? `\n  ${url}` : "") +
      ` (${where}/${m.id})`
    );
  });
  return (
    "DUPLICATE_DEV_TASK_BLOCKED: כבר יש משימת פיתוח דומה בתהליך — לא נפתח Cursor Agent חדש.\n" +
    "השתמשי ב-update_dev_task / attach_dev_task_session / reply_to_cursor_session על המשימה הקיימת.\n\n" +
    lines.join("\n")
  );
}

/** Throws if similar dev work is already in flight (unless explicitly updating same dev_task). */
export async function assertNoInFlightCursorDevWork(
  supabase: { from: (t: string) => any },
  tenantId: string,
  title: string,
  opts?: { threshold?: number; excludeDevTaskId?: string | null },
): Promise<void> {
  const matches = await findInFlightCursorDevWork(supabase, tenantId, title, opts);
  if (matches.length > 0) {
    throw new Error(formatInFlightDuplicateError(matches));
  }
}

export { OPEN_DEV_STATUSES, titleSimilarity, type DevTaskRow };
