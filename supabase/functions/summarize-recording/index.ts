import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Generate summary using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `אתה עוזר מקצועי לסיכום פגישות עסקיות. כתוב סיכומים מקצועיים, ברורים ומאורגנים בעברית.
הסיכום צריך להיות מובנה עם כותרות, נקודות מרכזיות, ופסקאות קצרות.
השתמש בפורמט Markdown.
אל תמציא מידע - סכם רק מה שמופיע בתמלול.`,
            },
            {
              role: "user",
              content: `סכם את הפגישה הבאה:

${recordingInfo ? "פרטי הפגישה:\n" + recordingInfo + "\n\n" : ""}תמלול/הערות:
${transcript}${focusPrompt}

אנא כתוב סיכום מקצועי ומובנה של הפגישה.`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "חריגה ממגבלת בקשות, נסה שוב בעוד כמה דקות" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "נדרש תשלום - נא להוסיף קרדיטים" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("שגיאה ביצירת סיכום AI");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content;
    if (!summary) throw new Error("לא התקבל סיכום מה-AI");

    // Get target name for the filename
    let targetName = "unknown";
    if (target_type === "client") {
      const { data } = await supabase.from("clients").select("name").eq("id", target_id).maybeSingle();
      targetName = data?.name || "client";
    } else {
      const { data } = await supabase.from("leads").select("company_name").eq("id", target_id).maybeSingle();
      targetName = data?.company_name || "lead";
    }

    // Create HTML document
    const dateStr = new Date().toLocaleDateString("he-IL");
    const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>סיכום פגישה - ${targetName} - ${dateStr}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; direction: rtl; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #2563eb; margin-top: 24px; }
    h3 { color: #4b5563; }
    ul, ol { padding-right: 20px; }
    li { margin-bottom: 6px; }
    .meta { background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; color: #6b7280; }
    strong { color: #1f2937; }
    blockquote { border-right: 3px solid #3b82f6; padding-right: 16px; margin: 16px 0; color: #4b5563; font-style: italic; }
  </style>
</head>
<body>
  <h1>סיכום פגישה - ${targetName}</h1>
  <div class="meta">
    <strong>תאריך הפקה:</strong> ${dateStr}<br>
    ${recording_id ? `<strong>מזהה הקלטה:</strong> ${recording_id}<br>` : ""}
  </div>
  ${markdownToHtml(summary)}
</body>
</html>`;

    // Save to storage
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `summaries/${tenant_id}/${target_type}_${target_id}/${Date.now()}_summary.html`;
    
    const { error: uploadError } = await admin.storage
      .from("recordings")
      .upload(fileName, new TextEncoder().encode(htmlContent), {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("שגיאה בשמירת הקובץ: " + uploadError.message);
    }

    // Get public URL
    const { data: urlData } = admin.storage.from("recordings").getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    // Add to client/lead attachments
    const table = target_type === "client" ? "clients" : "leads";
    const { data: targetData } = await admin
      .from(table)
      .select("attachments")
      .eq("id", target_id)
      .maybeSingle();

    const currentAttachments = (targetData?.attachments as any[]) || [];
    const newAttachment = {
      name: `סיכום פגישה - ${dateStr}.html`,
      url: fileUrl,
      type: "meeting_summary",
      created_at: new Date().toISOString(),
      created_by: user.id,
    };

    const { error: updateError } = await admin
      .from(table)
      .update({ attachments: [...currentAttachments, newAttachment] })
      .eq("id", target_id);

    if (updateError) {
      console.error("Update attachments error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        file_url: fileUrl,
        file_name: newAttachment.name,
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

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[123]>)/g, "$1");
  html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");

  return html;
}
