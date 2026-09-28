import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);
    const { item_id, prompt = "", mode = "autopilot", horizon_months = 3 } = await req.json();
    if (!item_id) return respond({ error: "item_id required" }, 400);

    const { data: item } = await admin.from("marketing_work_items").select("*").eq("id", item_id).single();
    if (!item) return respond({ error: "Work item not found" }, 404);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const [{ data: client }, { data: reports }, { data: projects }, skinBlock] = await Promise.all([
      admin.from("clients").select("name,website,business_description,industry,ahrefs_domain").eq("id", item.client_id).maybeSingle(),
      admin.from("ahrefs_reports").select("report_type,report_data,comparison_data,report_date").eq("tenant_id", item.tenant_id).eq("client_id", item.client_id).order("report_date", { ascending: false }).limit(8),
      admin.from("rank_tracking_projects").select("id,domain,country,language").eq("tenant_id", item.tenant_id).eq("client_id", item.client_id).eq("is_active", true),
      buildSkillsBlockBySlug(["seo_geo", "seo"], item.tenant_id),
    ]);
    const projectIds = (projects ?? []).map((project) => project.id);
    const { data: trackedKeywords } = projectIds.length ? await admin.from("rank_tracking_keywords").select("keyword,current_position,position_change,search_volume,found_url").in("project_id", projectIds).eq("is_active", true).limit(150) : { data: [] };

    const { data: integration } = await admin.from("tenant_integrations").select("settings,shared_from_integration_id").eq("tenant_id", item.tenant_id).eq("integration_type", "llm").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin.from("tenant_integrations").select("settings").eq("id", integration.shared_from_integration_id).maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key חסר בהגדרות האינטגרציות");

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const months = Math.max(1, Math.min(Number(horizon_months) || 3, 12));
    const minArticles = Math.min(16, Math.max(8, months * 4));
    const minKeywords = 12;
    const minClusters = 4;
    const modeInstruction = mode === "fill" ? "שמור על מה שכבר אושר, השלם פערים עד המינימום, ואל תמחק כותרות טובות בלי סיבה." : mode === "brief" ? "בנה תוכנית מלאה מהבריף ומהנתונים המחוברים." : "פעל כמנהלת מחלקת SEO/GEO ובנה אסטרטגיה מלאה.";
    const context = {
      client,
      brief: payload.brief_text ?? payload.brief,
      copy: payload.copy_text,
      existing_plan: mode === "fill" ? payload.seo_plan : undefined,
      ahrefs_report_count: reports?.length ?? 0,
      ahrefs_reports: (reports ?? []).slice(0, 4),
      tracked_keyword_count: trackedKeywords?.length ?? 0,
      tracked_keywords: trackedKeywords ?? [],
      user_prompt: prompt,
      horizon_months: months,
    };
    const system = `${skinBlock}\n\nאת כרמן בתפקיד מנהלת SEO/GEO. הפרידי בין נתון שמופיע בהקשר לבין המלצה. אסור להמציא volume, difficulty, ranking או traffic. אם הנתון לא בהקשר — אל תזכירי אותו. כתבי בעברית. החזירי JSON תקין בלבד.`;
    const schema = `{"strategy":{"objective":"","audience":"","market":"","currentState":"","opportunity":""},"clusters":[{"name":"","intent":"informational|commercial|transactional|navigational","pillarKeyword":"","supportingKeywords":[""],"priority":"high|medium|low","evidence":""}],"contentPlan":[{"title":"","contentType":"pillar|article|comparison|landing|faq|case_study","primaryKeyword":"","cluster":"","intent":"","angle":"","geoQuestions":[""],"priority":"high|medium|low","status":"idea"}],"geo":{"entities":[""],"questions":[""],"citationTargets":[""],"schemaRecommendations":[""]},"technicalPriorities":[{"issue":"","impact":"","action":"","priority":"high|medium|low"}],"dataNotes":[""]}`;
    const requirements = `חובה מספרית:
- לפחות ${minClusters} אשכולות נושא.
- לפחות ${minKeywords} ביטויי מפתח ייחודיים בעברית (pillarKeyword + supportingKeywords).
- לפחות ${minArticles} פריטי contentPlan ל-${months} חודשים: pillar אחד לכל אשכול, ואז מאמרי תמיכה, השוואה ו-FAQ.
- לכל פריט: title, primaryKeyword, cluster, angle, ולפחות 2 geoQuestions.
- dataNotes רק על מה שבאמת הגיע בהקשר.`;
    const askModel = async (extra: string) => {
      const user = `${modeInstruction}\n${requirements}\n${extra}\n\nהקשר:\n${JSON.stringify(context)}\n\nהחזירי בדיוק:\n${schema}`;
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 8000,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!ai.ok) throw new Error(`SEO planning failed: ${ai.status} ${await ai.text()}`);
      const data = await ai.json();
      return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    };
    const keywordCount = (plan: Record<string, unknown>) => {
      const seen = new Set<string>();
      const clusters = Array.isArray(plan.clusters) ? plan.clusters : [];
      for (const cluster of clusters) {
        const row = cluster as Record<string, unknown>;
        const pillar = String(row.pillarKeyword ?? "").trim();
        if (pillar) seen.add(pillar);
        const supporting = Array.isArray(row.supportingKeywords) ? row.supportingKeywords : [];
        for (const keyword of supporting) {
          const value = String(keyword ?? "").trim();
          if (value) seen.add(value);
        }
      }
      const articles = Array.isArray(plan.contentPlan) ? plan.contentPlan.length : 0;
      return { keywords: seen.size, articles, clusters: clusters.length };
    };
    let plan = await askModel("");
    let stats = keywordCount(plan);
    if (stats.articles < minArticles || stats.keywords < minKeywords || stats.clusters < minClusters) {
      plan = await askModel(`הטיוטה הקודמת קצרה מדי (${stats.clusters} אשכולות, ${stats.keywords} ביטויים, ${stats.articles} מאמרים). החזירי תוכנית חדשה שממלאת את המינימום, בלי לקצר.`);
      stats = keywordCount(plan);
    }
    if (stats.articles < minArticles || stats.keywords < minKeywords) {
      throw new Error(`התוכנית עדיין חלקית: ${stats.articles} מאמרים ו-${stats.keywords} ביטויים (נדרש ${minArticles} / ${minKeywords})`);
    }
    const nextPayload = {
      ...payload,
      seo_plan: plan,
      seo_prompt: prompt,
      seo_horizon_months: months,
      seo_plan_status: mode === "fill" && payload.seo_plan_status === "approved" ? "approved" : "pending",
      department: "seo",
      last_skin_slug: "seo_geo",
    };
    await admin.from("marketing_work_items").update({ payload: nextPayload, status: "draft" }).eq("id", item.id);
    await admin.from("marketing_assets").insert({ tenant_id: item.tenant_id, item_id: item.id, stage_id: item.current_stage_id, type: "seo_plan", content: JSON.stringify(plan), meta: { source: `carmen_${mode}`, skin_slug: "seo", horizon_months } });
    return respond({ plan, skin_slug: "seo", data_sources: { ahrefs_reports: reports?.length ?? 0, tracked_keywords: trackedKeywords?.length ?? 0 } });
  } catch (error) {
    console.error("marketing-seo-plan error", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
