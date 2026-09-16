import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";
import { dispatchSend } from "../_shared/agent-channel/adapters.ts";
import type { InputMode, SendResult } from "../_shared/agent-channel/types.ts";
import { cancelParliament, clarifyParliamentSeat, forceContinueParliament, forceSynthesizeParliament } from "../_shared/agent-channel/parliament.ts";
import {
  duplicateSendResult,
  ensureConversation,
  ensureDefaultRoutes,
  findMessageByIdempotency,
  insertMessage,
  loadRoute,
  resolveCarmenAgent,
  serviceClient,
  setConversationStatus,
  userHasTenantAccess,
} from "../_shared/agent-channel/store.ts";

function parseAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return [] as Array<{ name: string; url: string; type: "image" | "file"; size?: number; path?: string }>;
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name = String((item as any).name || "").trim();
      const url = String((item as any).url || "").trim();
      const type = (item as any).type === "image" ? "image" : "file";
      if (!name || !url.startsWith("http")) return null;
      return {
        name,
        url,
        type,
        size: typeof (item as any).size === "number" ? (item as any).size : undefined,
        path: typeof (item as any).path === "string" ? (item as any).path : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 6) as Array<{ name: string; url: string; type: "image" | "file"; size?: number; path?: string }>;
}

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
  const allowed = await userHasTenantAccess(sb, auth.userId, tenantId);
  if (!allowed) return json(403, { error: "Not a member of this tenant" });

  const action = String(body.action || "send");
  const carmen = await resolveCarmenAgent(sb, tenantId);
  const agentId = String(body.agent_id || carmen?.id || "");
  if (!agentId) return json(400, { error: "No Carmen agent for this tenant" });
  await ensureDefaultRoutes(sb, tenantId, agentId);

  if (action === "list_routes") {
    const routes = await ensureDefaultRoutes(sb, tenantId, agentId);
    return json(200, { ok: true, routes, agent_id: agentId });
  }

  if (action === "channel_health") {
    const { probeCursorApiKey, cursorApiKey } = await import("../_shared/agent-channel/cursor-api.ts");
    const { collectOpenChatIds } = await import("../_shared/agent-channel/sticky-agent.ts");
    const { probeWorkspaceAgent } = await import("../_shared/agent-channel/workspace-agent.ts");
    let env: Record<string, string | undefined> = {};
    try { env = Deno.env.toObject(); } catch { /* ignore */ }
    const cursor = await probeCursorApiKey(cursorApiKey());
    const codex = await probeWorkspaceAgent("codex", env);
    const appEnv = Deno.env.get("APP_ENV") || Deno.env.get("VITE_APP_ENV") || "";
    const cursorChats = await collectOpenChatIds(sb, { tenantId, provider: "cursor", env });
    const canCreate = cursor.ok;
    return json(200, {
      ok: cursor.ok,
      cursor,
      codex,
      app_env: appEnv || null,
      seats: {
        cursor: { bill: "cursor_cloud", open_chat: canCreate, chats: cursorChats.length },
        codex: {
          bill: "chatgpt_workspace",
          open_chat: codex.ok,
          probe: codex,
        },
        grok: { bill: "grok_webhook" },
        carmen: { bill: "openai_api" },
        chatgpt: { bill: "chatgpt_workspace" },
      },
      message: cursor.ok
        ? "Cursor Direct פותח סוכן Cursor חדש לכל הודעה (סשנים מקבילים מותרים)."
        : "CURSOR_API_KEY on this project is missing or rejected (401). Preview uses Staging — set a valid User key there.",
    });
  }

  if (action === "cancel_parliament") {
    const conversationId = String(body.conversation_id || "");
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    await cancelParliament(conversationId);
    return json(200, { ok: true, status: "idle" });
  }

  if (action === "parliament_continue") {
    const conversationId = String(body.conversation_id || "");
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    return json(200, await forceContinueParliament(conversationId));
  }

  if (action === "parliament_synthesize") {
    const conversationId = String(body.conversation_id || "");
    if (!conversationId) return json(400, { error: "conversation_id is required" });
    return json(200, await forceSynthesizeParliament(conversationId));
  }

  if (action === "parliament_clarify") {
    const conversationId = String(body.conversation_id || "");
    const provider = String(body.provider || "");
    const question = String(body.content || body.question || "").trim();
    if (!conversationId || !question) return json(400, { error: "conversation_id and content are required" });
    if (provider !== "cursor" && provider !== "grok" && provider !== "codex") {
      return json(400, { error: "clarify only supports cursor, grok, or codex" });
    }
    return json(200, await clarifyParliamentSeat(conversationId, provider, question));
  }

  if (action === "persist_assistant") {
    const conversationId = String(body.conversation_id || "");
    const content = String(body.content || "").trim();
    if (!conversationId || !content) return json(400, { error: "conversation_id and content are required" });
    const { row, duplicate } = await insertMessage(sb, {
      tenant_id: tenantId,
      conversation_id: conversationId,
      role: "assistant",
      speaker: "carmen",
      channel: "internal",
      content,
      idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
      metadata: { origin: "internal", input_mode: body.input_mode || "typed", delivery_mode: "text" },
    });
    await setConversationStatus(sb, conversationId, "idle");
    return json(200, { ok: true, duplicate, message_id: row.id });
  }

  const content = String(body.content || body.command_text || "").trim();
  const attachments = parseAttachments(body.attachments);
  if (action === "send" && !content && attachments.length === 0) {
    return json(400, { error: "content or attachments are required" });
  }

  const route = await loadRoute(sb, tenantId, {
    routeId: body.brain_route_id ? String(body.brain_route_id) : null,
    slug: body.brain_slug ? String(body.brain_slug) : null,
  });
  if (!route) return json(400, { error: "brain route not found" });

  if (action === "select_route") {
    if (body.conversation_id) {
      await sb.from("ai_conversations").update({
        brain_route_id: route.id,
        routing_mode: route.route_type,
        agent_id: agentId,
      }).eq("id", body.conversation_id).eq("tenant_id", tenantId);
    }
    await sb.from("ai_agents").update({
      brain_mode: route.route_type,
      brain_route_id: route.id,
    }).eq("id", agentId).eq("tenant_id", tenantId);
    return json(200, { ok: true, route });
  }

  const conv = await ensureConversation(sb, {
    conversationId: body.conversation_id || null,
    tenantId,
    userId: auth.userId,
    agentId,
    route,
    title: content,
  });

  const idempotencyKey = String(body.idempotency_key || crypto.randomUUID());
  const existing = await findMessageByIdempotency(sb, tenantId, idempotencyKey);
  if (existing) {
    const reused = duplicateSendResult(existing);
    if (reused) return json(200, { ...reused, duplicate: true });
  }

  if (conv.status === "debating" && route.route_type !== "parliament") {
    return json(409, { error: "conversation is locked while parliament is running" });
  }

  const { duplicate } = await insertMessage(sb, {
    tenant_id: tenantId,
    conversation_id: conv.id,
    role: "user",
    speaker: "user",
    channel: route.provider || route.slug,
    content,
    idempotency_key: idempotencyKey,
    metadata: {
      input_mode: body.input_mode || "typed",
      delivery_mode: body.input_mode === "realtime_voice" ? "realtime" : "text",
      ...(attachments.length ? { attachments } : {}),
      ...(body.context_metadata && typeof body.context_metadata === "object"
        ? { context: body.context_metadata }
        : {}),
    },
  });
  if (duplicate) {
    const prev = await findMessageByIdempotency(sb, tenantId, idempotencyKey);
    const reused = prev ? duplicateSendResult(prev) : null;
    if (reused) return json(200, { ...reused, duplicate: true });
  }

  try {
    const result: SendResult = await dispatchSend({
      tenantId,
      userId: auth.userId,
      agentId,
      conversationId: conv.id,
      route,
      content,
      attachments,
      inputMode: (body.input_mode || "typed") as InputMode,
      idempotencyKey,
      history: Array.isArray(body.conversation_history) ? body.conversation_history : [],
    });
    await setConversationStatus(sb, conv.id, result.status);
    await sb.from("ai_conversation_messages").update({
      metadata: { dispatch: result, input_mode: body.input_mode || "typed" },
    }).eq("tenant_id", tenantId).eq("idempotency_key", idempotencyKey);
    return json(200, result);
  } catch (e: any) {
    await setConversationStatus(sb, conv.id, "error");
    console.error("[agent-channel-send]", e?.message ?? e);
    return json(500, { error: String(e?.message ?? e) });
  }
});
