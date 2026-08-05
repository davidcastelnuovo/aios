// redeploy trigger: rebundle _shared/meeting-summary.ts (rich summary structure + summary_md persistence)
// Post-upload orchestrator for Chrome-extension screen recordings.
// The extension uploads video + low-bitrate audio to the `recordings` bucket,
// inserts a zoom_recordings row (source='chrome_extension'), then calls this
// function. It responds 202 immediately and continues in the background:
//   transcribe (from audio_file_path) → if client assigned: Hebrew summary →
//   DOCX → client attachments → auto marketing brief (draft).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runRecordingPipeline } from "../_shared/recording-pipeline.ts";

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
      .select("id, tenant_id, client_id, lead_id, agency_id, campaigner_ids, summary_scope, meeting_topic, start_time, duration, host_email, file_path, audio_file_path, audio_file_paths, transcription")
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
        await runRecordingPipeline(admin, {
          recording,
          createdByUserId: user.id,
          briefSource: "chrome_extension",
        });
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
