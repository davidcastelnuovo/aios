/**
 * Tenant-wide scan: refresh client operation recommendations (no LLM).
 */

import { buildClientOperationsPackage } from "./client-operations.ts";

export async function scanTenantClientOperations(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientLimit?: number;
    onlyWithWhatsappGroup?: boolean;
  },
): Promise<{
  scanned: number;
  errors: Array<{ client_id: string; error: string }>;
  summary: { open_recommendations: number };
}> {
  const limit = Math.min(args.clientLimit ?? 40, 100);

  let q = supabase
    .from("clients")
    .select("id, name, whatsapp_group_id")
    .eq("tenant_id", args.tenantId)
    .in("status", ["active", "onboarding"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (args.onlyWithWhatsappGroup) {
    q = q.not("whatsapp_group_id", "is", null);
  }

  const { data: clients, error } = await q;
  if (error) throw error;

  const errors: Array<{ client_id: string; error: string }> = [];
  let scanned = 0;

  for (const c of clients || []) {
    try {
      await buildClientOperationsPackage(supabase, {
        tenantId: args.tenantId,
        clientId: c.id,
        accessibleTenantIds: [args.tenantId],
        refreshRecommendations: true,
      });
      scanned++;
    } catch (e: unknown) {
      errors.push({
        client_id: c.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const { count } = await supabase
    .from("client_operation_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", args.tenantId)
    .eq("status", "open");

  return {
    scanned,
    errors,
    summary: { open_recommendations: count ?? 0 },
  };
}
