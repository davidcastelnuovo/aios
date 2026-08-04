// Recall.ai webhook: bot lifecycle + post-meeting ingest into zoom_recordings pipeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractRecallDownloads,
  mapRecallEventToStatus,
  recallTranscriptToText,
  retrieveRecallBot,
  verifyRecallWebhook,
} from "../_shared/recall.ts";
import { runRecordingPipeline } from "../_shared/recording-pipeline.ts";
import { platformLabel } from "../_shared/meeting-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature, webhook-id, webhook-timestamp, webhook-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();

  const verified = verifyRecallWebhook(rawBody, req.headers);
  if (!verified) {
    console.error("[meeting-bot-webhook] invalid signature");
    return json({ error: "Invalid signature" }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = String(payload.event || "");
  const data = (payload.data as Record<string, unknown>) || {};
  const inner = (data.data as Record<string, unknown>) || {};
  const bot = (data.bot as Record<string, unknown>) || {};
  const botId = String(bot.id || "");
  const subCode = inner.sub_code ? String(inner.sub_code) : null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (!botId) return json({ received: true });

  const { data: session } = await admin
    .from("meeting_bot_sessions")
    .select("*")
    .eq("external_bot_id", botId)
    .maybeSingle();

  if (!session) {
    console.warn("[meeting-bot-webhook] no session for bot", botId);
    return json({ received: true });
  }

  const newStatus = mapRecallEventToStatus(event);
  if (newStatus && event !== "bot.done") {
    const update: Record<string, unknown> = {
      status: event === "bot.fatal" ? "failed" : newStatus,
      status_detail: subCode,
      updated_at: new Date().toISOString(),
    };
    if (event === "bot.fatal") update.error = subCode || "bot_fatal";
    if (newStatus === "in_meeting" && !session.joined_at) update.joined_at = new Date().toISOString();
    await admin.from("meeting_bot_sessions").update(update).eq("id", session.id);
    return json({ received: true });
  }

  if (event !== "bot.done") return json({ received: true });

  // bot.done — download media, create recording, run pipeline (async).
  const background = (async () => {
    try {
      await admin.from("meeting_bot_sessions").update({
        status: "processing",
        ended_at: new Date().toISOString(),
      }).eq("id", session.id);

      const botData = await retrieveRecallBot(botId);
      const { videoUrl, transcriptUrl, durationSeconds } = extractRecallDownloads(botData);

      let transcription: string | null = null;
      if (transcriptUrl) {
        try {
          const trRes = await fetch(transcriptUrl);
          if (trRes.ok) {
            const trJson = await trRes.json();
            transcription = recallTranscriptToText(trJson);
          }
        } catch (trErr) {
          console.error("[meeting-bot-webhook] transcript download failed", trErr);
        }
      }

      let filePath: string | null = null;
      if (videoUrl) {
        const vidRes = await fetch(videoUrl);
        if (vidRes.ok) {
          const blob = await vidRes.blob();
          filePath = `${session.tenant_id}/meeting_bot/${session.id}.mp4`;
          const { error: upErr } = await admin.storage.from("recordings").upload(filePath, blob, {
            contentType: "video/mp4",
            upsert: true,
          });
          if (upErr) {
            console.error("[meeting-bot-webhook] video upload failed", upErr);
            filePath = null;
          }
        }
      }

      const durationMin = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;
      const topic = session.meeting_topic || `${platformLabel(session.platform)} — כרמן`;

      const { data: recording, error: recErr } = await admin
        .from("zoom_recordings")
        .insert({
          tenant_id: session.tenant_id,
          client_id: session.client_id,
          lead_id: session.lead_id,
          meeting_id: botId,
          meeting_topic: topic,
          start_time: session.joined_at || session.scheduled_start || new Date().toISOString(),
          duration: durationMin,
          source: "meeting_bot",
          file_path: filePath,
          recording_url: videoUrl,
          transcription: transcription,
          transcription_status: transcription ? "completed" : "pending",
        })
        .select("id, tenant_id, client_id, meeting_topic, start_time, duration, host_email, transcription")
        .single();

      if (recErr || !recording) {
        throw new Error(recErr?.message || "Failed to create zoom_recordings row");
      }

      await admin.from("meeting_bot_sessions").update({
        zoom_recording_id: recording.id,
      }).eq("id", session.id);

      await runRecordingPipeline(admin, {
        recording,
        createdByUserId: session.created_by,
        briefSource: "meeting_bot",
        skipTranscribe: !!transcription,
      });

      await admin.from("meeting_bot_sessions").update({
        status: "done",
        updated_at: new Date().toISOString(),
      }).eq("id", session.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[meeting-bot-webhook] processing error:", msg);
      await admin.from("meeting_bot_sessions").update({
        status: "failed",
        error: msg,
      }).eq("id", session.id);
    }
  })();

  // @ts-ignore EdgeRuntime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(background);
  } else {
    await background;
  }

  return json({ received: true });
});
