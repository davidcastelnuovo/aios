import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const { item_id, prompt, mode = "autopilot", frame_count = 4 } = await req.json();
    if (!item_id) return jsonResponse({ error: "item_id required" }, 400);

    const { data: item, error: itemError } = await admin
      .from("marketing_work_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (itemError || !item) return jsonResponse({ error: "Work item not found" }, 404);

    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id")
        .eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return jsonResponse({ error: "Forbidden" }, 403);
    }

    const [{ data: client }, { data: integration }, skinBlock] = await Promise.all([
      admin.from("clients").select("name,website,business_description,industry").eq("id", item.client_id).maybeSingle(),
      admin.from("tenant_integrations").select("settings,shared_from_integration_id")
        .eq("tenant_id", item.tenant_id).eq("integration_type", "llm").eq("is_active", true)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      buildSkillsBlockBySlug(["social_media"], item.tenant_id),
    ]);

    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin.from("tenant_integrations").select("settings")
        .eq("id", integration.shared_from_integration_id).maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key חסר בהגדרות האינטגרציות");

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const existingStoryboard = Array.isArray(payload.storyboard) ? payload.storyboard : [];
    const requestedCount = Math.max(1, Math.min(Number(frame_count) || 4, 10));
    const sourceContext = [
      `לקוח: ${client?.name ?? "—"}`,
      `תחום: ${client?.industry ?? "—"}`,
      `תיאור העסק: ${client?.business_description ?? "—"}`,
      `כותרת המשימה: ${item.title ?? "—"}`,
      payload.brief_text && `בריף: ${payload.brief_text}`,
      payload.copy_text && `קופי/תסריט: ${payload.copy_text}`,
      payload.format && `פורמט: ${payload.format}`,
      prompt && `הנחיית המשתמש: ${prompt}`,
      mode === "fill" && existingStoryboard.length > 0 && `Storyboard קיים להשלמה: ${JSON.stringify(existingStoryboard)}`,
    ].filter(Boolean).join("\n\n");

    const taskByMode: Record<string, string> = {
      autopilot: `בנה מאפס קונספט קריאייטיבי ו-storyboard מלא של ${requestedCount} סצנות. קבל החלטות מקצועיות בעצמך ואל תשאיר שדות ריקים.`,
      fill: "שמור על המבנה והרעיונות הקיימים, השלם ושפר רק שדות חסרים או חלשים. החזר את כל הסצנות במלואן.",
      brief: `הפוך את הבריף והקופי ל-storyboard מפורט של ${requestedCount} סצנות, בלי להמציא עובדות עסקיות.`,
    };

    const systemPrompt = `${skinBlock}\n\nאת כרמן בתפקיד מנהלת קריאייטיב. את חושבת בקונספט לפני ביצוע, מחפשת hook ויזואלי חזק, בונה רצף ברור ומכינה כל סצנה להפקה. החזירי JSON תקין בלבד.`;
    const userPrompt = `${taskByMode[mode] ?? taskByMode.autopilot}\n\n${sourceContext}\n\nהחזירי אובייקט במבנה הבא בדיוק:
{
  "concept": { "name": "", "bigIdea": "", "visualLanguage": "", "whyItWorks": "" },
  "frames": [
    { "title": "", "shot": "", "visualPrompt": "הנחיית יצירת תמונה מפורטת באנגלית", "overlayText": "", "voiceover": "", "duration": 3 }
  ]
}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.8,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    if (!aiResponse.ok) throw new Error(`AI planning failed: ${aiResponse.status} ${await aiResponse.text()}`);
    const aiData = await aiResponse.json();
    const plan = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    const frames = (Array.isArray(plan.frames) ? plan.frames : []).slice(0, 10).map((frame: Record<string, unknown>, index: number) => ({
      id: crypto.randomUUID(),
      order: index + 1,
      title: String(frame.title || `סצנה ${index + 1}`),
      shot: String(frame.shot || "Medium shot"),
      visualPrompt: String(frame.visualPrompt || ""),
      overlayText: String(frame.overlayText || ""),
      voiceover: String(frame.voiceover || ""),
      duration: Math.max(1, Math.min(Number(frame.duration) || 3, 30)),
      x: index * 300,
      y: 100,
    }));
    if (frames.length === 0) throw new Error("כרמן לא החזירה סצנות תקינות");

    const nextPayload = { ...payload, storyboard: frames, creative_concept: plan.concept ?? {}, creative_prompt: prompt ?? "", department: "creative", last_skin_slug: "social_media" };
    const { error: updateError } = await admin.from("marketing_work_items").update({ payload: nextPayload, status: "draft" }).eq("id", item.id);
    if (updateError) throw updateError;

    await admin.from("marketing_assets").insert({
      tenant_id: item.tenant_id,
      item_id: item.id,
      stage_id: item.current_stage_id,
      type: "storyboard",
      content: JSON.stringify({ concept: plan.concept ?? {}, frames }),
      meta: { source: `carmen_${mode}`, skin_slug: "social_media", frame_count: frames.length, prompt: prompt ?? "" },
    });

    return jsonResponse({ concept: plan.concept ?? {}, frames, skin_slug: "social_media" });
  } catch (error) {
    console.error("marketing-creative-plan error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
