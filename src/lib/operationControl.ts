export type OperationRunRow = {
  id: string;
  title?: string | null;
  status: string;
  rollup_status: string;
  summary?: string | null;
  planned_at: string;
  exception_count: number;
  dev_task_id?: string | null;
  metadata?: { session_url?: string | null };
  operation_plans?: { operation_type?: string; slug?: string; name?: string } | null;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/operation-control-center`;

async function headers(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listOperationRuns(
  token: string,
  tenantId: string,
  opts?: { since_hours?: number; exception_only?: boolean; limit?: number },
): Promise<{ runs: OperationRunRow[]; summary: { count: number; needs_attention: number } }> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await headers(token),
    body: JSON.stringify({
      action: "list_runs",
      tenant_id: tenantId,
      since_hours: opts?.since_hours ?? 168,
      exception_only: opts?.exception_only,
      limit: opts?.limit ?? 50,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.note || "list_runs failed");
  return { runs: json.runs || [], summary: json.summary || { count: 0, needs_attention: 0 } };
}

export async function syncDevTaskOperationRuns(
  token: string,
  tenantId: string,
): Promise<{ synced: number }> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await headers(token),
    body: JSON.stringify({
      action: "sync_dev_task_runs",
      tenant_id: tenantId,
      limit: 40,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "sync failed");
  return json;
}

export const ROLLUP_LABELS: Record<string, string> = {
  on_track: "במסלול",
  needs_attention: "דורש טיפול",
  complete: "הושלם",
};

export const OP_TYPE_LABELS: Record<string, string> = {
  dev_dispatch: "Dispatch Cursor",
  pulse_check: "דופק",
  campaign_action: "קמפיין",
  client_ops_scan: "סריקת לקוחות",
};
