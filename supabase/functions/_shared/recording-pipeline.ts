// Shared post-recording pipeline: transcribe → match client → summary → brief.
import {
  generateMeetingSummary,
  maybeCreateMarketingBrief,
  saveSummaryForTarget,
} from "./meeting-summary.ts";
import { matchRecordingToClient } from "./recording-match.ts";

export interface RecordingRow {
  id: string;
  tenant_id: string;
  client_id: string | null;
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

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.error("[recording-pipeline] OPENAI_API_KEY not configured");
    return;
  }

  let clientId = recording.client_id;
  if (!clientId) {
    const match = await matchRecordingToClient(admin, OPENAI_API_KEY, {
      tenant_id: recording.tenant_id,
      meeting_topic: recording.meeting_topic,
      transcription,
      host_email: recording.host_email,
    });
    if (match.matchType === "client" && match.clientId) {
      if (match.autoAssign) {
        clientId = match.clientId;
        const { data: matchedClient } = await admin
          .from("clients")
          .select("agency_id")
          .eq("id", clientId)
          .maybeSingle();
        await admin.from("zoom_recordings")
          .update({
            client_id: clientId,
            agency_id: matchedClient?.agency_id || null,
            suggested_client_id: null,
            campaigner_ids: [],
          })
          .eq("id", recording_id);
      } else {
        await admin.from("zoom_recordings")
          .update({ suggested_client_id: match.clientId })
          .eq("id", recording_id);
      }
    } else if (match.matchType === "internal" && match.campaignerIds.length > 0) {
      await admin.from("zoom_recordings")
        .update({ client_id: null, agency_id: null, campaigner_ids: match.campaignerIds })
        .eq("id", recording_id);
    }
  }

  if (!clientId) {
    console.log("[recording-pipeline] no client assigned, transcription only");
    return;
  }

  const recordingInfo = `נושא הפגישה: ${recording.meeting_topic || "לא צוין"}
תאריך: ${recording.start_time ? new Date(recording.start_time).toLocaleDateString("he-IL") : "לא צוין"}
משך: ${recording.duration ? recording.duration + " דקות" : "לא צוין"}
מארח: ${recording.host_email || "לא צוין"}`;

  const summary = await generateMeetingSummary(OPENAI_API_KEY, transcription, recordingInfo, "");

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  const { fileUrl } = await saveSummaryForTarget(admin, {
    tenant_id: recording.tenant_id,
    target_type: "client",
    target_id: clientId,
    target_name: client?.name || "client",
    summary,
    recording_id,
    created_by: createdByUserId ?? null,
  });

  await maybeCreateMarketingBrief(admin, OPENAI_API_KEY, {
    summary,
    tenant_id: recording.tenant_id,
    client_id: clientId,
    recording_id,
    fileUrl,
    source: briefSource,
  });
}
