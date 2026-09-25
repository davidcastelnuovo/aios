import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { requireAuth } from "../_shared/security.ts";
import {
  getOperationRunDetail,
  listOperationRuns,
  syncDevTaskRunsFromTable,
} from "../_shared/operation-control.ts";

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
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const tenantId = String(body.tenant_id || "").trim();
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "list_plans") {
      let q = supabase
        .from("operation_plans")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("slug", { ascending: true });
      if (body.enabled_only !== false) q = q.eq("enabled", true);
      const { data, error } = await q;
      if (error) throw error;
      return json({ plans: data || [] });
    }

    if (action === "list_runs") {
      const sinceIso = body.since_hours
        ? new Date(Date.now() - Number(body.since_hours) * 3600_000).toISOString()
        : body.since_iso;
      const runs = await listOperationRuns(supabase, {
        tenantId,
        limit: body.limit,
        exceptionOnly: !!body.exception_only,
        sinceIso: sinceIso ? String(sinceIso) : undefined,
        operationType: body.operation_type,
      });
      const needsAttention = runs.filter(
        (r: { rollup_status?: string }) => r.rollup_status === "needs_attention",
      ).length;
      return json({ runs, summary: { count: runs.length, needs_attention: needsAttention } });
    }

    if (action === "get_run") {
      const runId = String(body.run_id || "");
      if (!runId) return json({ error: "run_id required" }, 400);
      const detail = await getOperationRunDetail(supabase, tenantId, runId);
      if (!detail) return json({ error: "not_found" }, 404);
      return json(detail);
    }

    if (action === "sync_dev_task_runs") {
      const result = await syncDevTaskRunsFromTable(supabase, tenantId, body.limit);
      return json(result);
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/operation_runs|operation_plans/.test(msg)) {
      return json({ error: "schema_pending", note: "הריצו מיגרציה 20260922240000_operation_control_layer.sql" }, 503);
    }
    console.error("[operation-control-center]", e);
    return json({ error: msg }, 500);
  }
});
