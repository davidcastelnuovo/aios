/** Client API + shared dedup helpers for Dev Task Command Center. */

import { normalizeTitle, titleSimilarity } from "./devTasksDedup.ts";

export { normalizeTitle, titleSimilarity };

export type DevTaskPriority = "urgent" | "high" | "normal" | "low";
export type DevTaskStatus =
  | "draft" | "approved" | "sent_to_cursor" | "in_progress" | "blocked"
  | "pr_opened" | "ready_for_review" | "done" | "cancelled";

export type DevTask = {
  id: string;
  tenant_id: string;
  title: string;
  problem?: string | null;
  expected_behavior?: string | null;
  current_behavior?: string | null;
  scope?: string | null;
  affected_areas?: string | null;
  constraints?: string | null;
  acceptance_criteria?: string | null;
  base_branch: string;
  environment: string;
  requested_by?: string | null;
  priority: DevTaskPriority;
  status: DevTaskStatus;
  assigned_agent: string;
  cursor_session_id?: string | null;
  cursor_session_url?: string | null;
  pr_url?: string | null;
  dispatch_error?: string | null;
  created_at: string;
  updated_at: string;
};

export type DevTaskEvent = {
  id: string;
  event_type: string;
  actor?: string | null;
  detail?: Record<string, unknown>;
  created_at: string;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-task-center`;

async function authHeader(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listDevTasks(
  token: string,
  tenantId: string,
  filters?: { status?: DevTaskStatus; priority?: DevTaskPriority },
): Promise<DevTask[]> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await authHeader(token),
    body: JSON.stringify({ action: "list", tenant_id: tenantId, ...filters, limit: 80 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "list failed");
  return json.tasks || [];
}

export async function devTaskAction(
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

export const STATUS_LABELS: Record<DevTaskStatus, string> = {
  draft: "טיוטה",
  approved: "מאושר",
  sent_to_cursor: "נשלח ל-Cursor",
  in_progress: "בעבודה",
  blocked: "חסום",
  pr_opened: "PR פתוח",
  ready_for_review: "מוכן לבדיקה",
  done: "הושלם",
  cancelled: "בוטל",
};

export const PRIORITY_LABELS: Record<DevTaskPriority, string> = {
  urgent: "דחוף",
  high: "גבוה",
  normal: "רגיל",
  low: "נמוך",
};
