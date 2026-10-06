/**
 * goal-brain-callback — Cursor Direct posts orchestration brain replies here.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { applyBrainResponse } from "../_shared/goal-brain-apply.ts";
import { verifyGoalBrainToken } from "../_shared/goal-cursor-brain.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request): string {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const requestId = String(body.request_id || "").trim();
  const goalId = String(body.goal_id || "").trim();
  const tenantId = String(body.tenant_id || "").trim();
  const content = String(body.content || "").trim();
  const token = bearerFrom(req);

  if (!requestId || !goalId || !tenantId || !content) {
    return json(400, { error: "request_id, goal_id, tenant_id, and content are required" });
  }
  if (!token) return json(401, { error: "Missing callback token" });

  const ok = await verifyGoalBrainToken({ token, requestId, tenantId, goalId });
  if (!ok) return json(401, { error: "Invalid callback token" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error } = await supabase.from("goal_brain_requests")
    .select("*")
    .eq("id", requestId)
    .eq("goal_id", goalId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!request) return json(404, { error: "brain_request_not_found" });
  if (request.status === "completed") {
    return json(200, { ok: true, duplicate: true });
  }
  if (!["sent", "pending", "busy"].includes(request.status)) {
    return json(409, { error: `invalid_status:${request.status}` });
  }

  try {
    const result = await applyBrainResponse(supabase, request, content);
    if (!result.ok) {
      await supabase.from("goal_brain_requests").update({
        status: "failed",
        error_message: result.error,
        updated_at: new Date().toISOString(),
      }).eq("id", requestId);
      await supabase.from("goals").update({
        engine_status: "EXECUTING",
        next_run_at: new Date(Date.now() + 60_000).toISOString(),
      }).eq("id", goalId);
      return json(422, { error: result.error });
    }

    await supabase.from("goal_events").insert({
      tenant_id: tenantId,
      goal_id: goalId,
      event_type: "brain_response_applied",
      actor: "cursor_direct_brain",
      detail: { request_id: requestId, request_type: request.request_type },
    });

    return json(200, { ok: true, request_id: requestId, request_type: request.request_type });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[goal-brain-callback]", msg);
    await supabase.from("goal_brain_requests").update({
      status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);
    return json(500, { error: msg });
  }
});
