// Recall.ai webhook: bot lifecycle + post-meeting ingest into zoom_recordings pipeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapRecallEventToStatus, verifyRecallWebhook } from "../_shared/recall.ts";
import { finalizeMeetingBotSession } from "../_shared/meeting-bot-finalize.ts";

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

  const verified = await verifyRecallWebhook(rawBody, req.headers);
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

  // `bot.done` only means the bot left — with a streaming transcript the artifact
  // is often still processing, so `transcript.done` is the other trigger to ingest.
  const isIngestEvent = event === "bot.done" || event === "transcript.done" ||
    event === "recording.done";

  const newStatus = mapRecallEventToStatus(event);
  if (newStatus && !isIngestEvent) {
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

  if (!isIngestEvent) return json({ received: true });
  if (session.status === "done") return json({ received: true, skipped: "already done" });

  const background = (async () => {
    try {
      await admin.from("meeting_bot_sessions").update({
        status: "processing",
        ended_at: session.ended_at ?? new Date().toISOString(),
      }).eq("id", session.id);

      const result = await finalizeMeetingBotSession(admin, session);
      console.log(`[meeting-bot-webhook] ${event} → ${result.outcome}: ${result.detail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[meeting-bot-webhook] processing error:", msg);
      // Leave it recoverable — meeting-bot-reconcile retries `processing` rows.
      await admin.from("meeting_bot_sessions").update({
        status: "processing",
        error: msg,
        updated_at: new Date().toISOString(),
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
