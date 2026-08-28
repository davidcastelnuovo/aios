import { corsHeaders } from "../_shared/cors.ts";
import { ingestChannelReply } from "../_shared/agent-channel/ingest.ts";
import { verifyCallbackToken } from "../_shared/agent-channel/hmac.ts";
import { loadSession, serviceClient } from "../_shared/agent-channel/store.ts";
import type { CallbackPayload, ChannelProvider } from "../_shared/agent-channel/types.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request): string {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const conversationId = String(body.conversation_id || "").trim();
  const sessionId = String(body.session_id || "").trim();
  const origin = String(body.origin || "").trim() as ChannelProvider;
  const content = String(body.content || "").trim();
  if (!conversationId || !content) return json(400, { error: "conversation_id and content are required" });

  const token = bearerFrom(req);
  if (!token) return json(401, { error: "Missing callback token" });

  const sb = serviceClient();
  const session = sessionId ? await loadSession(sb, sessionId) : null;
  const tenantId = String(body.tenant_id || session?.tenant_id || "").trim();
  if (!tenantId || !sessionId) return json(401, { error: "session_id and tenant_id are required" });

  const ok = await verifyCallbackToken({
    token,
    sessionId,
    conversationId,
    tenantId,
  });
  if (!ok) return json(401, { error: "Invalid callback token" });

  const payload: CallbackPayload = {
    tenant_id: tenantId,
    conversation_id: conversationId,
    session_id: sessionId,
    origin: origin || (session?.provider as ChannelProvider) || "cursor",
    content,
    event_type: body.event_type || "message",
    speaker: body.speaker,
    idempotency_key: req.headers.get("Idempotency-Key") || body.idempotency_key || null,
    external_message_id: body.external_message_id || null,
    parliament_round: body.parliament_round ?? session?.parliament_round ?? null,
    metadata: body.metadata || {},
  };

  try {
    const result = await ingestChannelReply(payload);
    return json(200, { ok: true, ...result });
  } catch (e: any) {
    console.error("[agent-channel-callback]", e?.message ?? e);
    return json(400, { error: String(e?.message ?? e) });
  }
});
