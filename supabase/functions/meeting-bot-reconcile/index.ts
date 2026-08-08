// Safety net for Carmen's meeting bots.
//
// `bot.done` fires when the bot leaves, but the transcript artifact is often
// still processing, and copying a long meeting's video can outlive the webhook
// invocation. Both cases leave a session stuck in `processing`. This runs on a
// schedule, re-checks those sessions against Recall, and finishes them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { finalizeMeetingBotSession } from "../_shared/meeting-bot-finalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Give Recall a moment to finish the transcript before the first retry.
const MIN_AGE_SECONDS = 90;
const BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let sessionId: string | null = null;
  try {
    const body = await req.json();
    sessionId = body?.session_id ?? null;
  } catch { /* scheduled invocation sends no body */ }

  let query = admin
    .from("meeting_bot_sessions")
    .select(
      "id, tenant_id, client_id, lead_id, agency_id, campaigner_ids, summary_scope, platform, meeting_topic, external_bot_id, zoom_recording_id, scheduled_start, joined_at, ended_at, created_by, status",
    )
    .not("external_bot_id", "is", null);

  if (sessionId) {
    query = query.eq("id", sessionId);
  } else {
    const cutoff = new Date(Date.now() - MIN_AGE_SECONDS * 1000).toISOString();
    // Only `processing` — a bot still in the call must not be finalized early.
    query = query
      .eq("status", "processing")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(BATCH_SIZE);
  }

  const { data: sessions, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!sessions?.length) return json({ processed: 0, results: [] });

  const results: Record<string, unknown>[] = [];
  for (const session of sessions) {
    try {
      const result = await finalizeMeetingBotSession(admin, session);
      results.push({ session_id: session.id, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[meeting-bot-reconcile] failed", session.id, msg);
      await admin.from("meeting_bot_sessions")
        .update({ error: msg, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      results.push({ session_id: session.id, outcome: "error", detail: msg });
    }
  }

  return json({ processed: results.length, results });
});
