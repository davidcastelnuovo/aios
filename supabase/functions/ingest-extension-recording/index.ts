// redeploy trigger: rebundle _shared/meeting-summary.ts (rich summary structure + summary_md persistence)
// Post-upload orchestrator for Chrome-extension screen recordings.
// The extension uploads video + low-bitrate audio to the `recordings` bucket,
// inserts a zoom_recordings row (source='chrome_extension'), then calls this
// function. It responds 202 immediately and continues in the background:
//   transcribe (from audio_file_path) → if client assigned: Hebrew summary →
//   DOCX → client attachments → auto marketing brief (draft).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateMeetingSummary,
  maybeCreateMarketingBrief,
  saveSummaryForTarget,
} from "../_shared/meeting-summary.ts";
import { matchRecordingToClient } from "../_shared/recording-match.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { recording_id } = await req.json();
    if (!recording_id) return json({ error: "recording_id is required" }, 400);

    // RLS-scoped read: enforces that the caller belongs to the recording's tenant.
    const { data: recording, error: recError } = await userClient
      .from("zoom_recordings")
      .select("id, tenant_id, client_id, meeting_topic, start_time, duration, host_email, file_path, audio_file_path, audio_file_paths, transcription")
      .eq("id", recording_id)
      .maybeSingle();

    if (recError || !recording) return json({ error: "Recording not found" }, 404);
    if (!recording.file_path && !recording.audio_file_path && !(recording.audio_file_paths?.length)) {
      return json({ error: "Recording has no uploaded file" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Recovery healing: if the recorder window died before finalize, the row
    // has progressive audio parts but no playable file/duration — point
    // playback at the first part so the recording is usable end-to-end.
    if (!recording.file_path && recording.audio_file_paths?.length) {
      const parts: string[] = recording.audio_file_paths;
      const micParts = parts.filter((p: string) => /_mic_part\d+\./.test(p)).length;
      const healed = {
        file_path: parts[0],
        ...(recording.duration ? {} : { duration: Math.max(1, (micParts || parts.length) * 10) }),
      };
      await admin.from("zoom_recordings").update(healed).eq("id", recording_id);
    }

    await admin
      .from("zoom_recordings")
      .update({ transcription_status: "processing", transcription_error: null })
      .eq("id", recording_id);

    const background = (async () => {
      try {
        // 1. Transcribe (transcribe-recording prefers audio_file_path and
        //    manages transcription_status/transcription_error itself).
        let transcription: string | null = recording.transcription;
        if (!transcription) {
          const transcribeResponse = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-recording`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ recording_id }),
          });
          if (!transcribeResponse.ok) {
            console.error("[ingest-extension-recording] transcription failed:", await transcribeResponse.text());
            return;
          }
          const transcribeResult = await transcribeResponse.json();
          transcription = transcribeResult.text || transcribeResult.transcription || null;
        }

        if (!transcription || !transcription.trim()) {
          console.log("[ingest-extension-recording] no transcription produced, stopping");
          return;
        }

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
          console.error("[ingest-extension-recording] OPENAI_API_KEY not configured, skipping match/summary");
          return;
        }

        // 2. No client assigned → try AI matching (suggest-first: auto-assign
        //    only on high confidence; otherwise store a suggestion for the feed).
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
              await admin.from("zoom_recordings")
                .update({ client_id: clientId, suggested_client_id: null })
                .eq("id", recording_id);
              console.log(`[ingest-extension-recording] auto-assigned to client ${clientId} (high confidence)`);
            } else {
              await admin.from("zoom_recordings")
                .update({ suggested_client_id: match.clientId })
                .eq("id", recording_id);
              console.log(`[ingest-extension-recording] suggested client ${match.clientId} (awaiting confirmation)`);
            }
          } else if (match.matchType === "internal" && match.campaignerIds.length > 0) {
            await admin.from("zoom_recordings")
              .update({ campaigner_ids: match.campaignerIds })
              .eq("id", recording_id);
            console.log(`[ingest-extension-recording] tagged as internal (${match.campaignerIds.length} campaigners)`);
          }
        }

        // 3. Summary + attachments + marketing brief — only when a client is assigned.
        if (!clientId) {
          console.log("[ingest-extension-recording] no client assigned, transcription only");
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
          created_by: user.id,
        });

        // Brief lands as a draft in the strategy stage — human approval required.
        const brief = await maybeCreateMarketingBrief(admin, OPENAI_API_KEY, {
          summary,
          tenant_id: recording.tenant_id,
          client_id: clientId,
          recording_id,
          fileUrl,
          source: "chrome_extension",
        });
        console.log(`[ingest-extension-recording] done: summary saved, brief=${brief.created ? brief.workItemId : "none"}`);
      } catch (err) {
        console.error("[ingest-extension-recording] background error:", err);
        await admin
          .from("zoom_recordings")
          .update({ transcription_error: err instanceof Error ? err.message : String(err) })
          .eq("id", recording_id);
      }
    })();

    // @ts-ignore EdgeRuntime is available in Supabase edge functions
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      // @ts-ignore see above
      EdgeRuntime.waitUntil(background);
    } else {
      await background;
    }

    return json({ queued: true, recording_id }, 202);
  } catch (error) {
    console.error("[ingest-extension-recording] error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
