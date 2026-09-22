export type ClientOperationRecommendation = {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name?: string | null;
  recommendation_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body?: string | null;
  evidence?: Record<string, unknown>;
  suggested_tool?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-operations-center`;

async function headers(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listClientOperationRecommendations(
  token: string,
  tenantId: string,
  filters?: { severity?: string; client_id?: string },
): Promise<ClientOperationRecommendation[]> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await headers(token),
    body: JSON.stringify({
      action: "list_recommendations",
      tenant_id: tenantId,
      limit: 80,
      ...filters,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "list failed");
  return json.recommendations || [];
}

export async function scanTenantClientOperations(
  token: string,
  tenantId: string,
  opts?: { client_limit?: number },
): Promise<{ scanned: number; summary: { open_recommendations: number }; errors: unknown[] }> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await headers(token),
    body: JSON.stringify({
      action: "scan_tenant",
      tenant_id: tenantId,
      only_with_whatsapp_group: false,
      ...opts,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "scan failed");
  return json;
}

export async function clientOpsAction(
  token: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(FN, {
    method: "POST",
    headers: await headers(token),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "action failed");
  return json;
}

export const SEVERITY_LABELS: Record<string, string> = {
  critical: "קריטי",
  warning: "אזהרה",
  info: "מידע",
};
