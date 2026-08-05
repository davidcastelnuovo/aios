// Shared post-recording pipeline: transcribe → match client → summary → brief.
import {
  generateMeetingSummary,
  maybeCreateMarketingBrief,
  saveSummaryForTarget,
} from "./meeting-summary.ts";
import { matchRecordingToClient } from "./recording-match.ts";
import { resolveOpenAIKey } from "./ai.ts";

export interface RecordingRow {
  id: string;
  tenant_id: string;
  client_id: string | null;
  lead_id?: string | null;
  agency_id?: string | null;
  campaigner_ids?: string[] | null;
  summary_scope?: "auto" | "client" | "lead" | "campaigner" | "agency" | null;
  meeting_topic: string | null;
  start_time: string | null;
  duration: number | null;
  host_email: string | null;
  transcription: string | null;
}

export interface RunRecordingPipelineOpts {
  recording: RecordingRow;
  createdByUserId?: string | null;
  briefSource: string;
  skipTranscribe?: boolean;
}

// deno-lint-ignore no-explicit-any
export async function runRecordingPipeline(admin: any, opts: RunRecordingPipelineOpts): Promise<void> {
  const { recording, createdByUserId, briefSource, skipTranscribe } = opts;
  const recording_id = recording.id;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let transcription: string | null = recording.transcription;
  if (!transcription && !skipTranscribe) {
    const transcribeResponse = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-recording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ recording_id }),
    });
    if (!transcribeResponse.ok) {
      console.error("[recording-pipeline] transcription failed:", await transcribeResponse.text());
      return;
    }
    const transcribeResult = await transcribeResponse.json();
    transcription = transcribeResult.text || transcribeResult.transcription || null;
  }

  if (!transcription?.trim()) {
    console.log("[recording-pipeline] no transcription, stopping");
    return;
  }

  const OPENAI_API_KEY = await resolveOpenAIKey();
  if (!OPENAI_API_KEY) {
    console.error("[recording-pipeline] OPENAI_API_KEY not configured");
    return;
  }

  let clientId = recording.client_id;
  const leadId = recording.lead_id || null;
  let campaignerIds = recording.campaigner_ids || [];
  let agencyId = recording.agency_id || null;
  let summaryScope = recording.summary_scope || "auto";

  // Explicit internal/agency assignments must never be reclassified as client
  // meetings by the semantic matcher.
  if (!clientId && summaryScope === "auto") {
    const match = await matchRecordingToClient(admin, OPENAI_API_KEY, {
      tenant_id: recording.tenant_id,
      meeting_topic: recording.meeting_topic,
      transcription,
      host_email: recording.host_email,
    });
    if (match.matchType === "client" && match.clientId) {
      if (match.autoAssign) {
        clientId = match.clientId;
        summaryScope = "client";
        await admin.from("zoom_recordings")
          .update({ client_id: clientId, suggested_client_id: null, summary_scope: "client" })
          .eq("id", recording_id);
      } else {
        await admin.from("zoom_recordings")
          .update({ suggested_client_id: match.clientId })
          .eq("id", recording_id);
      }
    } else if (match.matchType === "internal" && match.campaignerIds.length > 0) {
      campaignerIds = match.campaignerIds;
      summaryScope = "campaigner";
      await admin.from("zoom_recordings")
        .update({ campaigner_ids: campaignerIds, summary_scope: "campaigner" })
        .eq("id", recording_id);
    }
  }

  // An unrecognized recording is still valuable: keep it as a general agency
  // meeting instead of dropping out after transcription.
  if (!clientId && campaignerIds.length === 0 && summaryScope === "auto") {
    summaryScope = "agency";
  }

  if (!clientId && (summaryScope === "agency" || summaryScope === "campaigner")) {
    if (!agencyId) {
      const { data: agency } = await admin
        .from("agencies")
        .select("id")
        .eq("tenant_id", recording.tenant_id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      agencyId = agency?.id || null;
    }
    await admin.from("zoom_recordings").update({
      agency_id: agencyId,
      campaigner_ids: campaignerIds,
      summary_scope: summaryScope,
    }).eq("id", recording_id);
  }

  const recordingInfo = `נושא הפגישה: ${recording.meeting_topic || "לא צוין"}
תאריך: ${recording.start_time ? new Date(recording.start_time).toLocaleDateString("he-IL") : "לא צוין"}
משך: ${recording.duration ? recording.duration + " דקות" : "לא צוין"}
מארח: ${recording.host_email || "לא צוין"}`;

  const summary = await generateMeetingSummary(OPENAI_API_KEY, transcription, recordingInfo, "");

  let targetType: "client" | "lead" | "campaigner" | "agency";
  let targetId: string;
  let targetName: string;

  if (clientId) {
    const { data: client } = await admin
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle();
    targetType = "client";
    targetId = clientId;
    targetName = client?.name || "client";
  } else if (leadId && summaryScope === "lead") {
    const { data: lead } = await admin
      .from("leads")
      .select("company_name")
      .eq("id", leadId)
      .maybeSingle();
    targetType = "lead";
    targetId = leadId;
    targetName = lead?.company_name || "lead";
  } else if (campaignerIds.length > 0) {
    const { data: team } = await admin
      .from("campaigners")
      .select("id, full_name")
      .in("id", campaignerIds);
    targetType = "campaigner";
    targetId = campaignerIds[0];
    targetName = (team || []).map((member: { full_name: string }) => member.full_name).join(", ")
      || "פגישה פנימית";
  } else {
    if (!agencyId) {
      console.error("[recording-pipeline] no agency available for general summary");
      return;
    }
    const { data: agency } = await admin
      .from("agencies")
      .select("name")
      .eq("id", agencyId)
      .maybeSingle();
    targetType = "agency";
    targetId = agencyId;
    targetName = agency?.name || "סוכנות";
  }

  const { fileUrl } = await saveSummaryForTarget(admin, {
    tenant_id: recording.tenant_id,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    summary,
    recording_id,
    created_by: createdByUserId ?? null,
  });

  if (clientId) {
    await maybeCreateMarketingBrief(admin, OPENAI_API_KEY, {
      summary,
      tenant_id: recording.tenant_id,
      client_id: clientId,
      recording_id,
      fileUrl,
      source: briefSource,
    });
  }
}
