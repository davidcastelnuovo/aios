// Backfill/retry calendar matching for existing recordings.
// Defaults to dry_run=true; pass dry_run=false to apply the reported matches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  chooseCalendarRecordingMatch,
  enrichRecordingFromCalendar,
  loadCalendarMatchContext,
} from "../_shared/calendar-recording-match.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Supabase projects that migrated to sb_secret keys may expose a different
// SUPABASE_SERVICE_ROLE_KEY to functions than the still-valid legacy
// service_role JWT. The gateway verifies this JWT before invocation
// (verify_jwt=true in config.toml), so its signed role claim is authoritative.
function isServiceRoleJwt(token: string): boolean {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceCall = token === SERVICE_ROLE_KEY || isServiceRoleJwt(token);
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
    if (!tenantId) return json({ error: "tenant_id is required" }, 400);

    let preferredUserId: string | null = null;
    if (!isServiceCall) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      preferredUserId = user.id;
      const { data: membership } = await userClient
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership) return json({ error: "Forbidden" }, 403);
    } else if (typeof body.user_id === "string") {
      preferredUserId = body.user_id;
    }

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = new Date(body.from || defaultFrom.toISOString());
    const to = new Date(body.to || now.toISOString());
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
      return json({ error: "Invalid from/to range" }, 400);
    }
    const dryRun = body.dry_run !== false;
    const limit = Math.min(200, Math.max(1, Number(body.limit) || 100));

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await admin
      .from("zoom_recordings")
      .select("id, tenant_id, meeting_id, source, meeting_topic, start_time, duration, host_email, client_id, calendar_event_id")
      .eq("tenant_id", tenantId)
      .is("calendar_event_id", null)
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .limit(limit);
    if (error) return json({ error: error.message }, 500);

    // One representative row per Zoom/Recall meeting; enrichment updates every
    // recording variant with the same meeting_id.
    const grouped = new Map<string, NonNullable<typeof rows>[number]>();
    for (const row of rows || []) {
      const key = row.meeting_id || row.id;
      if (!grouped.has(key)) grouped.set(key, row);
    }

    const context = await loadCalendarMatchContext(admin, {
      tenantId,
      timeMin: new Date(from.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(to.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      preferredUserId,
    });

    const matches: Record<string, unknown>[] = [];
    for (const recording of grouped.values()) {
      const match = chooseCalendarRecordingMatch(recording, context.events, context.clients);
      if (!match) continue;
      matches.push({
        recording_id: recording.id,
        meeting_id: recording.meeting_id,
        previous_name: recording.meeting_topic,
        event_title: match.eventTitle,
        event_start: match.eventStart,
        start_delta_minutes: match.startDeltaMinutes,
        client_id: match.clientId,
        client_name: match.clientName,
      });
      if (!dryRun) {
        await enrichRecordingFromCalendar(admin, recording, { preferredUserId, context });
      }
    }

    return json({
      success: true,
      dry_run: dryRun,
      recordings_scanned: grouped.size,
      calendar_events_loaded: context.events.length,
      matches_found: matches.length,
      matches,
    });
  } catch (error) {
    console.error("[match-recordings-calendar] error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
