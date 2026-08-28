import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";
import { cancelParliament, startParliament } from "../_shared/agent-channel/parliament.ts";
import {
  ensureConversation,
  loadRoute,
  resolveCarmenAgent,
  serviceClient,
  userHasTenantAccess,
} from "../_shared/agent-channel/store.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const auth = await requireAuth(req);
  if (!auth || auth.kind !== "user" || !auth.userId) return json(401, { error: "Unauthorized" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const tenantId = String(body.tenant_id || "").trim();
  if (!tenantId) return json(400, { error: "tenant_id is required" });
  const sb = serviceClient();
  if (!(await userHasTenantAccess(sb, auth.userId, tenantId))) return json(403, { error: "Forbidden" });

  const action = String(body.action || "start");
  if (action === "cancel") {
    const conversationId = String(body.conversation_id || "");
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    await cancelParliament(conversationId);
    return json(200, { ok: true, status: "idle" });
  }

  const content = String(body.content || body.goal || "").trim();
  if (!content) return json(400, { error: "content is required" });
  const carmen = await resolveCarmenAgent(sb, tenantId);
  if (!carmen) return json(400, { error: "No Carmen agent" });
  const route = await loadRoute(sb, tenantId, { slug: "parliament", routeId: body.brain_route_id });
  if (!route) return json(400, { error: "parliament route missing" });
  const conv = await ensureConversation(sb, {
    conversationId: body.conversation_id || null,
    tenantId,
    userId: auth.userId,
    agentId: carmen.id,
    route,
    title: content,
  });
  const result = await startParliament({
    tenantId,
    userId: auth.userId,
    agentId: carmen.id,
    conversationId: conv.id,
    route,
    content,
    inputMode: "typed",
    idempotencyKey: String(body.idempotency_key || crypto.randomUUID()),
    history: Array.isArray(body.conversation_history) ? body.conversation_history : [],
  });
  return json(200, result);
});
