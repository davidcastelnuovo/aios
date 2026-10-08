// Meeting summaries go to the open Cursor Direct chat. The reply comes back
// through agent-channel-callback and is saved onto the recording.
import { launchCloudDirect } from "./agent-channel/direct.ts";
import { cursorApiKey } from "./agent-channel/cursor-api.ts";
import {
  ensureConversation,
  findMessageByIdempotency,
  insertMessage,
  loadRoute,
  resolveCarmenAgent,
} from "./agent-channel/store.ts";
import { resolveOpenAIKey } from "./ai.ts";
import {
  maybeCreateMarketingBrief,
  saveSummaryForTarget,
} from "./meeting-summary.ts";
import {
  buildMeetingSummaryCursorTask,
  meetingSummaryIdempotencyKey,
  meetingSummaryJobFromMetadata,
  type MeetingSummaryJob,
  type MeetingSummaryTargetType,
} from "./meeting-summary-prompts.ts";

export type SummaryDispatch =
  | {
      ok: true;
      conversation_id: string;
      session_id: string;
      external_url: string | null;
    }
  | {
      ok: false;
      reason: "not_configured" | "no_route" | "no_user" | "busy" | "error";
      detail?: string;
    };

export async function dispatchMeetingSummaryToCursor(
  // deno-lint-ignore no-explicit-any
  admin: any,
  args: {
    tenantId: string;
    userId?: string | null;
    recordingId: string;
    transcript: string;
    recordingInfo: string;
    focusPrompt?: string;
    targetType: MeetingSummaryTargetType;
    targetId: string;
    targetName: string;
    clientId?: string | null;
    briefSource?: string;
    createdBy?: string | null;
    /** A person asked again. Automatic ingest stays one send per recording. */
    manual?: boolean;
  },
): Promise<SummaryDispatch> {
  if (!cursorApiKey()) return { ok: false, reason: "not_configured" };

  const route = await loadRoute(admin, args.tenantId, { slug: "cursor" });
  if (!route || route.provider !== "cursor")
    return { ok: false, reason: "no_route" };

  const userId = await resolveSummaryUserId(
    admin,
    args.tenantId,
    args.userId || args.createdBy,
  );
  if (!userId) return { ok: false, reason: "no_user" };

  const carmen = route.agent_id
    ? { id: route.agent_id }
    : await resolveCarmenAgent(admin, args.tenantId);
  const title = `סיכום פגישה · ${args.targetName}`.slice(0, 60);
  const conversation = await ensureConversation(admin, {
    tenantId: args.tenantId,
    userId,
    agentId: carmen?.id ?? route.agent_id,
    route,
    title,
  });

  const job: MeetingSummaryJob = {
    recording_id: args.recordingId,
    target_type: args.targetType,
    target_id: args.targetId,
    target_name: args.targetName,
    tenant_id: args.tenantId,
    created_by: args.createdBy ?? userId,
    client_id:
      args.clientId ?? (args.targetType === "client" ? args.targetId : null),
    brief_source: args.briefSource || "zoom_meeting",
  };

  const claimKey = meetingSummaryIdempotencyKey(
    args.recordingId,
    !!args.manual,
  );
  const claimed = await claimSummarySend(admin, {
    tenantId: args.tenantId,
    conversationId: conversation.id,
    recordingId: args.recordingId,
    claimKey,
    manual: !!args.manual,
  });
  if (!claimed) {
    console.log(
      "[meeting-summary] skipped duplicate cursor dispatch",
      args.recordingId,
    );
    return {
      ok: true,
      conversation_id: conversation.id,
      session_id: "",
      external_url: null,
    };
  }

  try {
    const result = await launchCloudDirect(
      {
        tenantId: args.tenantId,
        userId,
        agentId: carmen?.id || "",
        conversationId: conversation.id,
        route,
        content: `סכם את הפגישה: ${args.targetName}`,
        inputMode: "external_channel_callback",
        idempotencyKey: claimKey,
        history: [],
      },
      "cursor",
      buildMeetingSummaryCursorTask(
        args.transcript,
        args.recordingInfo,
        args.focusPrompt || "",
      ),
      undefined,
      {
        callbackIntent: "meeting_summary",
        allowCreate: true,
        autoCreatePR: false,
        sessionMetadata: { purpose: "meeting_summary", ...job },
      },
    );
    return {
      ok: true,
      conversation_id: result.conversation_id,
      session_id: result.session_id || "",
      external_url: result.external_url ?? null,
    };
  } catch (error) {
    await admin
      .from("ai_conversation_messages")
      .update({ idempotency_key: null })
      .eq("tenant_id", args.tenantId)
      .eq("idempotency_key", claimKey);
    const detail = error instanceof Error ? error.message : String(error);
    const busy = /עדיין רץ|busy|409/i.test(detail);
    console.error("[meeting-summary] cursor direct dispatch failed:", detail);
    return { ok: false, reason: busy ? "busy" : "error", detail };
  }
}

const MANUAL_RESEND_WINDOW_MS = 90_000;

async function claimSummarySend(
  // deno-lint-ignore no-explicit-any
  admin: any,
  args: {
    tenantId: string;
    conversationId: string;
    recordingId: string;
    claimKey: string;
    manual: boolean;
  },
): Promise<boolean> {
  if (args.manual) {
    const existing = await findMessageByIdempotency(
      admin,
      args.tenantId,
      args.claimKey,
    );
    if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age < MANUAL_RESEND_WINDOW_MS) return false;
      await admin
        .from("ai_conversation_messages")
        .update({ idempotency_key: `${args.claimKey}:spent:${existing.id}` })
        .eq("id", existing.id);
    }
  }

  const { duplicate } = await insertMessage(admin, {
    tenant_id: args.tenantId,
    conversation_id: args.conversationId,
    role: "system",
    content: "סיכום פגישה נשלח לקרסר ישיר",
    event_type: "system",
    idempotency_key: args.claimKey,
    metadata: {
      purpose: "meeting_summary_claim",
      recording_id: args.recordingId,
    },
  });
  return !duplicate;
}

export async function persistMeetingSummaryReply(
  // deno-lint-ignore no-explicit-any
  admin: any,
  metadata: unknown,
  summary: string,
): Promise<boolean> {
  const job = meetingSummaryJobFromMetadata(metadata);
  if (!job || !summary.trim()) return false;

  const { fileUrl } = await saveSummaryForTarget(admin, {
    tenant_id: job.tenant_id,
    target_type: job.target_type,
    target_id: job.target_id,
    target_name: job.target_name,
    summary,
    recording_id: job.recording_id,
    created_by: job.created_by,
  });

  const { data: recording } = await admin
    .from("zoom_recordings")
    .select("meeting_id")
    .eq("id", job.recording_id)
    .maybeSingle();
  if (recording?.meeting_id) {
    await admin
      .from("zoom_recordings")
      .update({ summary_md: summary, summary_file_url: fileUrl })
      .eq("tenant_id", job.tenant_id)
      .eq("meeting_id", recording.meeting_id);
  }

  if (job.target_type === "client") {
    const openaiKey = await resolveOpenAIKey();
    if (openaiKey) {
      await maybeCreateMarketingBrief(admin, openaiKey, {
        summary,
        tenant_id: job.tenant_id,
        client_id: job.target_id,
        recording_id: job.recording_id,
        fileUrl,
        source: job.brief_source,
      });
    }
  }
  return true;
}

async function resolveSummaryUserId(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  preferred?: string | null,
): Promise<string | null> {
  if (preferred) return preferred;
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}
