import type { CallbackPayload, ChannelProvider } from "./types.ts";
import { speakerForOrigin } from "./logic.ts";
import {
  completeSession,
  insertMessage,
  loadSession,
  logChannelAction,
  serviceClient,
  setConversationStatus,
} from "./store.ts";
import { onParliamentCallback } from "./parliament.ts";

const ORIGINS = new Set<ChannelProvider>(["cursor", "grok", "claude", "chatgpt", "internal", "parliament"]);

export async function ingestChannelReply(payload: CallbackPayload): Promise<{ duplicate: boolean; message_id: string }> {
  const origin = ORIGINS.has(payload.origin) ? payload.origin : "internal";
  const content = String(payload.content || "").trim();
  if (!content) throw new Error("content is required");
  if (!payload.conversation_id) throw new Error("conversation_id is required");

  const sb = serviceClient();
  const session = payload.session_id ? await loadSession(sb, payload.session_id) : null;
  const tenantId = payload.tenant_id || session?.tenant_id;
  if (!tenantId) throw new Error("tenant_id is required");
  if (session && session.conversation_id !== payload.conversation_id) {
    throw new Error("session does not belong to this conversation");
  }
  if (session && session.tenant_id !== tenantId) {
    throw new Error("session tenant mismatch");
  }

  const eventType = payload.event_type || "message";
  const { row, duplicate } = await insertMessage(sb, {
    tenant_id: tenantId,
    conversation_id: payload.conversation_id,
    role: eventType === "message" ? "assistant" : "system",
    speaker: payload.speaker || speakerForOrigin(origin),
    channel: origin,
    content,
    event_type: eventType,
    external_message_id: payload.external_message_id ?? null,
    correlation_id: session?.id ?? null,
    idempotency_key: payload.idempotency_key ?? payload.external_message_id ?? null,
    metadata: {
      origin,
      parliament_round: payload.parliament_round ?? session?.parliament_round ?? null,
      ...(payload.metadata || {}),
    },
  });

  if (duplicate) return { duplicate: true, message_id: row.id };

  if (eventType === "message") {
    const inParliament = !!session?.parliament_run_id || origin === "parliament";
    if (session) await completeSession(sb, session.id, "completed");
    if (inParliament) {
      await onParliamentCallback({
        tenantId,
        conversationId: payload.conversation_id,
        origin,
        content,
        parliamentRunId: session?.parliament_run_id || (payload.metadata?.parliament_run_id as string | undefined),
        round: payload.parliament_round ?? session?.parliament_round,
      });
    } else {
      await setConversationStatus(sb, payload.conversation_id, "idle");
    }
  }

  await logChannelAction(sb, {
    tenantId,
    agentId: null,
    action: eventType === "approval_request" ? "channel_approval_request" : "channel_callback",
    details: {
      conversation_id: payload.conversation_id,
      session_id: payload.session_id ?? null,
      origin,
      event_type: eventType,
    },
  });

  return { duplicate: false, message_id: row.id };
}
