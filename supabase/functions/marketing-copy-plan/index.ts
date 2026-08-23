import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CHANNEL_LIMITS: Record<string, { headline: number; primary: number }> = {
  Facebook: { headline: 40, primary: 125 },
  Instagram: { headline: 40, primary: 125 },
  TikTok: { headline: 90, primary: 150 },
  LinkedIn: { headline: 70, primary: 600 },
  "Google Ads": { headline: 30, primary: 90 },
  YouTube: { headline: 100, primary: 5000 },
};

const toMarkdown = (variant: {
  headline?: string;
  primary?: string;
  cta?: string;
  rationale?: string;
}) =>
  [
    variant.headline && `## ${variant.headline}`,
    variant.primary,
    variant.cta && `**CTA:** ${variant.cta}`,
    variant.rationale && `_${variant.rationale}_`,
  ]
    .filter(Boolean)
    .join("\n\n");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const { item_id, prompt = "", mode = "autopilot" } = await req.json();
    if (!item_id) return jsonResponse({ error: "item_id required" }, 400);

    const { data: item, error: itemError } = await admin
      .from("marketing_work_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (itemError || !item) return jsonResponse({ error: "Work item not found" }, 404);

    if (auth.kind === "user") {
      const { data: membership } = await admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", item.tenant_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (!membership) return jsonResponse({ error: "Forbidden" }, 403);
    }

    const [{ data: client }, { data: integration }, skinBlock] = await Promise.all([
      admin
        .from("clients")
        .select("name,website,business_description,industry")
        .eq("id", item.client_id)
        .maybeSingle(),
      admin
        .from("tenant_integrations")
        .select("settings,shared_from_integration_id")
        .eq("tenant_id", item.tenant_id)
        .eq("integration_type", "llm")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      buildSkillsBlockBySlug(["copywriter"], item.tenant_id),
    ]);

    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin
        .from("tenant_integrations")
        .select("settings")
        .eq("id", integration.shared_from_integration_id)
        .maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key חסר בהגדרות האינטגרציות");

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const channel = String(payload.channel ?? item.target_channel ?? "כללי");
    const limits = CHANNEL_LIMITS[channel] ?? { headline: 60, primary: 500 };
    const contentType = String(payload.content_type ?? "social_post");
    const existingCopy = String(payload.copy_text ?? "");

    const sourceContext = [
      `לקוח: ${client?.name ?? "—"}`,
      `תחום: ${client?.industry ?? "—"}`,
      `תיאור העסק: ${client?.business_description ?? "—"}`,
      `אתר: ${client?.website ?? "—"}`,
      `כותרת המשימה: ${item.title ?? "—"}`,
      `סוג תוצר: ${contentType}`,
      `ערוץ: ${channel}`,
      `מגבלות תווים: כותרת עד ${limits.headline}, גוף עד ${limits.primary}`,
      payload.brief_text && `בריף: ${payload.brief_text}`,
      payload.instructions && `הנחיות מיוחדות: ${payload.instructions}`,
      payload.notes && `הערות: ${payload.notes}`,
      prompt && `הנחיית המשתמש: ${prompt}`,
      mode === "improve" && existingCopy && `קופי קיים לשיפור:\n${existingCopy}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const taskByMode: Record<string, string> = {
      autopilot:
        "כתוב מאפס 3 וריאציות קופי מוכנות לפרסום. קבל החלטות מקצועיות בעצמך, אל תמציא עובדות עסקיות, ושמור על מגבלות הערוץ.",
      brief:
        "הפוך את הבריף וההנחיות ל-3 וריאציות קופי מדויקות. אל תוסיף הבטחות או נתונים שלא הופיעו בבריף.",
      improve:
        "שפר את הקופי הקיים: שמור על המסר המרכזי, חדד hook/CTA, וצור 3 וריאציות חזקות יותר במגבלות הערוץ.",
    };

    const systemPrompt = `${skinBlock}

את כרמן בתפקיד קופירייטרית המרה. את כותבת בעברית טבעית, ספציפית וממוקדת פעולה אחת. כל וריאציה היא היפותזה שונה (זווית/טון/הוכחה), לא אותו טקסט בניסוח מחדש. אל תמציאי מחירים, תוצאות או פיצ'רים. החזירי JSON תקין בלבד.`;

    const userPrompt = `${taskByMode[mode] ?? taskByMode.autopilot}

${sourceContext}

החזירי אובייקט במבנה הבא בדיוק:
{
  "angle": "הזווית האסטרטגית בקצרה",
  "audience": "למי זה מדובר",
  "promise": "ההבטחה המרכזית",
  "variants": [
    {
      "label": "A",
      "headline": "כותרת במגבלת התווים",
      "primary": "גוף הקופי",
      "cta": "קריאה לפעולה קצרה",
      "rationale": "למה הווריאציה הזו עובדת"
    }
  ]
}
חובה להחזיר בדיוק 3 וריאציות עם תוויות A, B, C.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!aiResponse.ok) throw new Error(`AI copy planning failed: ${aiResponse.status} ${await aiResponse.text()}`);
    const aiData = await aiResponse.json();
    const plan = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    const variants = (Array.isArray(plan.variants) ? plan.variants : [])
      .slice(0, 3)
      .map((variant: Record<string, unknown>, index: number) => ({
        label: String(variant.label || ["A", "B", "C"][index] || index + 1),
        headline: String(variant.headline || "").slice(0, limits.headline),
        primary: String(variant.primary || "").slice(0, Math.max(limits.primary, 8000)),
        cta: String(variant.cta || ""),
        rationale: String(variant.rationale || ""),
      }));
    if (variants.length === 0) throw new Error("כרמן לא החזירה וריאציות קופי תקינות");

    const fullCopy = toMarkdown(variants[0]);
    const nextPayload = {
      ...payload,
      copy_text: fullCopy,
      copy_variants: variants,
      copy_angle: plan.angle ?? "",
      copy_audience: plan.audience ?? "",
      copy_promise: plan.promise ?? "",
      copy_prompt: prompt,
      department: "copy",
      last_skin_slug: "copywriter",
    };

    const { error: updateError } = await admin
      .from("marketing_work_items")
      .update({ payload: nextPayload, status: "draft", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) throw updateError;

    await admin.from("marketing_assets").insert({
      tenant_id: item.tenant_id,
      item_id: item.id,
      stage_id: item.current_stage_id,
      type: "copy",
      content: fullCopy,
      meta: {
        source: `carmen_${mode}`,
        skin_slug: "copywriter",
        variants,
        angle: plan.angle ?? "",
        prompt,
      },
    });

    return jsonResponse({
      variants,
      copy_text: fullCopy,
      angle: plan.angle ?? "",
      audience: plan.audience ?? "",
      promise: plan.promise ?? "",
      skin_slug: "copywriter",
    });
  } catch (error) {
    console.error("marketing-copy-plan error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
