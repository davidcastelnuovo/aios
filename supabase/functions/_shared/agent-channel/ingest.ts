import type { CallbackPayload, ChannelProvider } from "./types.ts";
import { speakerForOrigin, resolveCallbackOrigin } from "./logic.ts";
import {
  completeSession,
  getRunningSession,
  insertMessage,
  loadSession,
  logChannelAction,
  serviceClient,
  setConversationStatus,
} from "./store.ts";
import { onParliamentCallback } from "./parliament.ts";
import { completeDevTaskFromAgentReply } from "../dev-tasks.ts";
import { persistMeetingSummaryReply } from "../meeting-summary-cursor.ts";
import { deliverWhatsAppReply } from "./whatsapp-direct.ts";

async function resolveSession(
  sb: ReturnType<typeof serviceClient>,
  payload: CallbackPayload,
  origin: ChannelProvider,
) {
  if (payload.session_id) {
    const byId = await loadSession(sb, payload.session_id);
    if (byId) return byId;
  }
  if (!payload.conversation_id || origin === "internal" || origin === "parliament") return null;
  return await getRunningSession(sb, payload.conversation_id, origin);
}

async function conversationTenant(
  sb: ReturnType<typeof serviceClient>,
  conversationId: string,
): Promise<string | null> {
  const { data } = await sb.from("ai_conversations").select("tenant_id").eq("id", conversationId).maybeSingle();
  return (data as { tenant_id?: string } | null)?.tenant_id || null;
}

export async function ingestChannelReply(payload: CallbackPayload): Promise<{ duplicate: boolean; message_id: string }> {
  const content = String(payload.content || "").trim();
  if (!content) throw new Error("content is required");
  if (!payload.conversation_id) throw new Error("conversation_id is required");

  const sb = serviceClient();
  const hinted = payload.session_id ? await loadSession(sb, payload.session_id) : null;
  const origin = resolveCallbackOrigin(payload.origin, hinted?.provider);
  const session = hinted || await resolveSession(sb, payload, origin);
  const tenantId = payload.tenant_id || session?.tenant_id || await conversationTenant(sb, payload.conversation_id);
  if (!tenantId) throw new Error(`conversation ${payload.conversation_id} not found in this AIOS environment`);
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

  if (!duplicate && eventType === "message" && session) {
    try {
      await persistMeetingSummaryReply(sb, session.metadata, content);
    } catch (e) {
      console.warn("[agent-channel] meeting summary save:", (e as Error)?.message ?? e);
    }
  }

  if (!duplicate && eventType === "message" && session) {
    try {
      await deliverWhatsAppReply(session.metadata, tenantId, origin, content);
    } catch (e) {
      console.warn("[agent-channel] whatsapp reply:", (e as Error)?.message ?? e);
    }
  }

  if (duplicate) return { duplicate: true, message_id: row.id };

  if (eventType === "message") {
    const codingOrigins = new Set<ChannelProvider>(["cursor", "claude", "codex", "grok"]);
    if (codingOrigins.has(origin)) {
      try {
        await completeDevTaskFromAgentReply(sb, {
          tenantId,
          conversationId: payload.conversation_id,
          content,
          devTaskIdHint: (payload.metadata?.dev_task_id as string | undefined) ?? null,
          actor: origin,
        });
      } catch (e) {
        console.warn("[agent-channel] dev task completion:", (e as Error)?.message ?? e);
      }
    }
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
