// Dispatch Carmen meeting bot to Zoom / Google Meet / Teams (Recall.ai).
// Supports ad-hoc join via pasted meeting URL (no calendar required).
// deploy: ensure dispatch-meeting-bot is live on prod (2026-08-04)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRecallBot, recallApiKey } from "../_shared/recall.ts";
import {
  detectMeetingPlatform,
  isSupportedMeetingUrl,
  normalizeMeetingUrl,
  platformLabel,
} from "../_shared/meeting-url.ts";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace(/^Bearer\s+/i, "");

    let userId: string | null = null;
    let tenantId: string | null = null;
    const isServiceCall = token === SERVICE_ROLE_KEY;

    const body = await req.json();
    const {
      meeting_url: rawUrl,
      client_id,
      lead_id,
      agency_id: requestedAgencyId,
      campaigner_ids: requestedCampaignerIds,
      summary_scope: requestedSummaryScope,
      meeting_topic,
      join_at,
      tenant_id: bodyTenantId,
    } = body;

    if (isServiceCall) {
      tenantId = bodyTenantId || null;
      userId = body.created_by || null;
    } else {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
      tenantId = bodyTenantId || null;

      if (!tenantId) {
        const { data: active } = await userClient
          .from("user_active_tenant")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();
        tenantId = active?.tenant_id || null;
      }
    }

    if (!tenantId) return json({ error: "tenant_id is required" }, 400);
    if (!rawUrl?.trim()) return json({ error: "meeting_url is required" }, 400);
    if (!recallApiKey()) return json({ error: "Meeting bot is not configured (RECALL_API_KEY)" }, 503);

    const meeting_url = normalizeMeetingUrl(rawUrl);
    const platform = detectMeetingPlatform(meeting_url);
    if (!isSupportedMeetingUrl(meeting_url)) {
      return json({
        error: "קישור לא נתמך. נא להדביק קישור Zoom, Google Meet או Microsoft Teams.",
        platform,
      }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const campaignerIds = Array.isArray(requestedCampaignerIds)
      ? [...new Set(requestedCampaignerIds.filter((id): id is string => typeof id === "string" && !!id))]
      : [];
    const validScopes = new Set(["auto", "client", "lead", "campaigner", "agency"]);
    const summaryScope = validScopes.has(requestedSummaryScope)
      ? requestedSummaryScope
      : client_id
      ? "client"
      : lead_id
      ? "lead"
      : campaignerIds.length > 0
      ? "campaigner"
      : requestedAgencyId
      ? "agency"
      : "auto";

    if (summaryScope === "campaigner" && campaignerIds.length === 0) {
      return json({ error: "נא לבחור איש צוות אחד לפחות" }, 400);
    }

    let agencyId = requestedAgencyId || null;
    if (agencyId) {
      const { data: agency } = await admin
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!agency) return json({ error: "הסוכנות אינה שייכת לארגון הפעיל" }, 403);
    } else if (summaryScope === "agency" || summaryScope === "campaigner") {
      const { data: agency } = await admin
        .from("agencies")
        .select("id")
        .eq("tenant_id", tenantId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      agencyId = agency?.id || null;
      if (!agencyId) return json({ error: "לא נמצאה סוכנות לשיוך הסיכום" }, 400);
    }

    if (campaignerIds.length > 0) {
      const { data: team } = await admin
        .from("campaigners")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("id", campaignerIds);
      if ((team || []).length !== campaignerIds.length) {
        return json({ error: "אחד מאנשי הצוות אינו שייך לארגון הפעיל" }, 403);
      }
    }

    const { data: session, error: insertError } = await admin
      .from("meeting_bot_sessions")
      .insert({
        tenant_id: tenantId,
        client_id: client_id || null,
        lead_id: lead_id || null,
        agency_id: agencyId,
        campaigner_ids: campaignerIds,
        summary_scope: summaryScope,
        meeting_url,
        platform,
        meeting_topic: meeting_topic || `${platformLabel(platform)} — כרמן`,
        status: "scheduled",
        scheduled_start: join_at || new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertError || !session) {
      console.error("[dispatch-meeting-bot] insert failed", insertError);
      return json({ error: insertError?.message || "Failed to create session" }, 500);
    }

    let bot;
    try {
      bot = await createRecallBot({
        meeting_url,
        join_at: join_at || null,
        metadata: {
          session_id: session.id,
          tenant_id: tenantId,
        },
      });
    } catch (botErr) {
      const msg = botErr instanceof Error ? botErr.message : String(botErr);
      await admin.from("meeting_bot_sessions").update({
        status: "failed",
        error: msg,
      }).eq("id", session.id);
      return json({ error: msg }, 502);
    }

    await admin.from("meeting_bot_sessions").update({
      external_bot_id: bot.id,
      status: "joining",
      joined_at: new Date().toISOString(),
    }).eq("id", session.id);

    return json({
      success: true,
      session_id: session.id,
      bot_id: bot.id,
      platform,
      platform_label: platformLabel(platform),
      bot_name: "כרמן AI — מסייעת תמלול",
      message: `כרמן מצטרפת ל${platformLabel(platform)}. אשרו אותה בחדר ההמתנה אם נדרש.`,
    });
  } catch (error) {
    console.error("[dispatch-meeting-bot] error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
