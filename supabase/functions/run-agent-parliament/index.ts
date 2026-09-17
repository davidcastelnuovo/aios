import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";
import {
  cancelParliament,
  clarifyParliamentSeat,
  forceContinueParliament,
  forceSynthesizeParliament,
  startParliament,
} from "../_shared/agent-channel/parliament.ts";
import {
  ensureConversation,
  loadAuthorizedConversation,
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
  const conversationId = String(body.conversation_id || "");
  const claimedAgentId = body.agent_id ? String(body.agent_id) : null;
  if (action === "cancel") {
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    const authz = await loadAuthorizedConversation(sb, { conversationId, tenantId, claimedAgentId });
    if (!authz.ok) return json(authz.status, { error: authz.status === 404 ? "Not found" : "Forbidden" });
    await cancelParliament(conversationId, tenantId);
    return json(200, { ok: true, status: "idle" });
  }
  if (action === "continue") {
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    const authz = await loadAuthorizedConversation(sb, { conversationId, tenantId, claimedAgentId, claimedRunId: body.run_id ? String(body.run_id) : null });
    if (!authz.ok) return json(authz.status, { error: authz.status === 404 ? "Not found" : "Forbidden" });
    try {
      return json(200, await forceContinueParliament(conversationId, tenantId, body.run_id ? String(body.run_id) : null));
    } catch (e: any) {
      if (String(e?.message || e).includes("no running parliament")) return json(404, { error: "Not found" });
      throw e;
    }
  }
  if (action === "synthesize") {
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    const authz = await loadAuthorizedConversation(sb, { conversationId, tenantId, claimedAgentId, claimedRunId: body.run_id ? String(body.run_id) : null });
    if (!authz.ok) return json(authz.status, { error: authz.status === 404 ? "Not found" : "Forbidden" });
    try {
      return json(200, await forceSynthesizeParliament(conversationId, tenantId, body.run_id ? String(body.run_id) : null));
    } catch (e: any) {
      if (String(e?.message || e).includes("no running parliament")) return json(404, { error: "Not found" });
      throw e;
    }
  }
  if (action === "clarify") {
    const provider = String(body.provider || "");
    const question = String(body.content || body.question || "").trim();
    if (!conversationId || !question) return json(400, { error: "conversation_id and content are required" });
    if (provider !== "cursor" && provider !== "grok") return json(400, { error: "clarify only supports cursor or grok" });
    const authz = await loadAuthorizedConversation(sb, { conversationId, tenantId, claimedAgentId });
    if (!authz.ok) return json(authz.status, { error: authz.status === 404 ? "Not found" : "Forbidden" });
    try {
      return json(200, await clarifyParliamentSeat(conversationId, provider, question, tenantId, body.run_id ? String(body.run_id) : null));
    } catch (e: any) {
      if (String(e?.message || e).includes("no running parliament")) return json(404, { error: "Not found" });
      throw e;
    }
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
