import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { requireAuth } from "../_shared/security.ts";
import { buildClientOperationsPackage } from "../_shared/client-operations.ts";
import { scanTenantClientOperations } from "../_shared/client-operations-scan.ts";
import {
  createCommitmentFollowup,
  syncWeeklyUpdateFromGreenGroup,
} from "../_shared/client-green-group-monitor.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const tenantId = String(body.tenant_id || "").trim();
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = auth.kind === "user" ? auth.userId : null;

    if (action === "list_recommendations") {
      let q = supabase
        .from("client_operation_recommendations")
        .select("*, clients(name)")
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .order("updated_at", { ascending: false });
      if (body.severity) q = q.eq("severity", body.severity);
      if (body.client_id) q = q.eq("client_id", body.client_id);
      const lim = Math.min(Number(body.limit) || 50, 100);
      const { data, error } = await q.limit(lim);
      if (error) throw error;
      return json({
        recommendations: (data || []).map((r: any) => ({
          ...r,
          client_name: r.clients?.name ?? null,
          clients: undefined,
        })),
      });
    }

    if (action === "scan_tenant") {
      const result = await scanTenantClientOperations(supabase, {
        tenantId,
        clientLimit: body.client_limit,
        onlyWithWhatsappGroup: body.only_with_whatsapp_group !== false,
      });
      return json(result);
    }

    if (action === "get_package") {
      const clientId = String(body.client_id || "");
      if (!clientId) return json({ error: "client_id required" }, 400);
      const pkg = await buildClientOperationsPackage(supabase, {
        tenantId,
        clientId,
        accessibleTenantIds: [tenantId],
        refreshRecommendations: body.refresh_recommendations !== false,
      });
      return json({ package: pkg });
    }

    if (action === "update_recommendation") {
      const id = String(body.recommendation_id || "");
      const status = String(body.status || "");
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "dismissed" || status === "resolved") {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = userId;
      }
      const { data, error } = await supabase
        .from("client_operation_recommendations")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error) throw error;
      return json({ recommendation: data });
    }

    if (action === "sync_weekly_from_group") {
      const clientId = String(body.client_id || "");
      const result = await syncWeeklyUpdateFromGreenGroup(supabase, {
        tenantId,
        clientId,
        messageAt: body.message_at,
        dryRun: body.dry_run !== false,
        actorUserId: userId,
      });
      return json(result);
    }

    if (action === "create_commitment_followup") {
      const clientId = String(body.client_id || "");
      const result = await createCommitmentFollowup(supabase, {
        tenantId,
        clientId,
        messageAt: String(body.message_at),
        taskTitle: body.task_title,
        actorUserId: userId,
      });
      return json(result);
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: unknown) {
    console.error("[client-operations-center]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
