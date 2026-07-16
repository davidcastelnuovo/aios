// redeploy trigger: rebundle _shared/meeting-summary.ts (rich summary structure + summary_md persistence)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AiHttpError,
  generateMeetingSummary,
  maybeCreateMarketingBrief,
  saveSummaryForTarget,
} from "../_shared/meeting-summary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const {
      recording_id,
      transcript,
      focus_points,
      custom_focus,
      target_type,
      target_id,
      tenant_id,
    } = await req.json();

    if (!transcript || !transcript.trim()) {
      throw new Error("נא להזין תמלול או הערות מהפגישה");
    }

    if (!target_type || !target_id) {
      throw new Error("נא לבחור לקוח או ליד לשיוך הסיכום");
    }

    // Get recording info
    let recordingInfo = "";
    if (recording_id) {
      const { data: rec } = await supabase
        .from("zoom_recordings")
        .select("meeting_topic, start_time, duration, host_email")
        .eq("id", recording_id)
        .maybeSingle();
      if (rec) {
        recordingInfo = `נושא הפגישה: ${rec.meeting_topic || "לא צוין"}
תאריך: ${rec.start_time ? new Date(rec.start_time).toLocaleDateString("he-IL") : "לא צוין"}
משך: ${rec.duration ? rec.duration + " דקות" : "לא צוין"}
מארח: ${rec.host_email || "לא צוין"}`;
      }
    }

    // Build focus points prompt
    const focusLabels: Record<string, string> = {
      decisions: "החלטות שהתקבלו",
      action_items: "משימות ופעולות נדרשות",
      pain_points: "נקודות כאב של הלקוח",
      pricing: "הצעות מחיר ותמחור",
      next_steps: "שלבים הבאים",
      key_quotes: "ציטוטים מרכזיים",
    };

    let focusPrompt = "";
    if (focus_points && focus_points.length > 0) {
      const labels = focus_points.map((fp: string) => focusLabels[fp] || fp).join(", ");
      focusPrompt = `\n\nדגשים מיוחדים שיש להתמקד בהם: ${labels}`;
    }
    if (custom_focus && custom_focus.trim()) {
      focusPrompt += `\nדגשים נוספים מהמשתמש: ${custom_focus}`;
    }

    // Generate summary using OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    let summary: string;
    try {
      summary = await generateMeetingSummary(OPENAI_API_KEY, transcript, recordingInfo, focusPrompt);
    } catch (err) {
      if (err instanceof AiHttpError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // Get target name for the filename
    let targetName = "unknown";
    if (target_type === "client") {
      const { data } = await supabase.from("clients").select("name").eq("id", target_id).maybeSingle();
      targetName = data?.name || "client";
    } else {
      const { data } = await supabase.from("leads").select("company_name").eq("id", target_id).maybeSingle();
      targetName = data?.company_name || "lead";
    }

    // Save to storage + attachments + summary_file_url
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { fileUrl, fileName } = await saveSummaryForTarget(admin, {
      tenant_id,
      target_type,
      target_id,
      target_name: targetName,
      summary,
      recording_id: recording_id ?? null,
      created_by: user.id,
    });

    // Auto-detect marketing needs and create a brief work item
    let marketingBriefCreated = false;
    let marketingWorkItemId: string | null = null;
    if (target_type === "client" && target_id && tenant_id) {
      const brief = await maybeCreateMarketingBrief(admin, OPENAI_API_KEY, {
        summary,
        tenant_id,
        client_id: target_id,
        recording_id: recording_id ?? null,
        fileUrl,
        source: "zoom_meeting",
      });
      marketingBriefCreated = brief.created;
      marketingWorkItemId = brief.workItemId;
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        file_url: fileUrl,
        file_name: fileName,
        marketing_brief_created: marketingBriefCreated,
        marketing_work_item_id: marketingWorkItemId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
