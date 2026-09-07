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
    const { item_id, prompt = "", mode = "autopilot", platform = "meta", monthly_budget = null } = await req.json();
    if (!item_id) return respond({ error: "item_id required" }, 400);
    const { data: item } = await admin.from("marketing_work_items").select("*").eq("id", item_id).single();
    if (!item) return respond({ error: "Work item not found" }, 404);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }
    const [{ data: client }, { data: integrations }, skinBlock] = await Promise.all([
      admin.from("clients").select("name,website,business_description,industry").eq("id", item.client_id).maybeSingle(),
      admin.from("tenant_integrations").select("integration_type,display_name,settings,shared_from_integration_id").eq("tenant_id", item.tenant_id).eq("is_active", true).in("integration_type", ["llm","facebook_ads","meta_ads","google_ads"]),
      buildSkillsBlockBySlug(["campaigner"], item.tenant_id),
    ]);
    const llm = integrations?.find((integration) => integration.integration_type === "llm");
    let settings = (llm?.settings ?? {}) as Record<string, string>;
    if (llm?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin.from("tenant_integrations").select("settings").eq("id", llm.shared_from_integration_id).maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key חסר בהגדרות האינטגרציות");
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const existing = mode === "fill" ? payload.campaign_plan : undefined;
    const system = `${skinBlock}\n\nאת כרמן בתפקיד Head of Paid Media. בחרי מבנה פשוט שניתן לבדוק, הפרידי הנחות מנתונים, אל תבטיחי תוצאות, ואל תמציאי benchmarks או ביצועים. החזירי JSON תקין בלבד. שום תוכנית אינה אישור לפרסום.`;
    const instruction = mode === "fill" ? "שמרי על המבנה הקיים, השלימי פערים ושפרי החלטות חלשות." : mode === "brief" ? "בני תוכנית מהבריף, הקופי והקריאייטיב המאושרים." : "בני תוכנית קמפיין מלאה מפרומפט המשתמש ומכל חומרי הפרויקט.";
    const context = { client, platform, monthly_budget, prompt, brief: payload.brief_text, copy: payload.copy_text, storyboard: payload.storyboard, image_url: payload.image_url, existing_plan: existing, connected_platforms: integrations?.filter((i) => i.integration_type !== "llm").map((i) => i.integration_type) ?? [] };
    const user = `${instruction}\n\n${JSON.stringify(context)}\n\nהחזירי בדיוק:
{"strategy":{"objective":"","offer":"","primaryKpi":"","funnelStage":"","budgetRationale":"","assumptions":[""]},"audiences":[{"name":"","type":"cold|warm|retargeting|lookalike|search","description":"","signals":[""],"exclusions":[""],"priority":"high|medium|low"}],"campaigns":[{"name":"","platform":"meta|google","objective":"","dailyBudget":0,"status":"draft","adSets":[{"name":"","audience":"","optimization":"","placements":[""],"ads":[{"name":"","format":"","hook":"","primaryText":"","headline":"","cta":"","creativeDirection":""}]}]}],"tests":[{"name":"","hypothesis":"","variable":"creative|copy|audience|offer|landing_page","variants":[""],"successMetric":"","minimumDecisionRule":""}],"guardrails":[""],"launchChecklist":[{"label":"","required":true,"completed":false}]}`;
    const ai = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, temperature: 0.55, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
    if (!ai.ok) throw new Error(`Campaign planning failed: ${ai.status} ${await ai.text()}`);
    const data = await ai.json();
    const plan = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    const nextPayload = { ...payload, campaign_plan: plan, campaign_prompt: prompt, campaign_platform: platform, department: "campaigns", last_skin_slug: "campaigner" };
    await admin.from("marketing_work_items").update({ payload: nextPayload, status: "draft" }).eq("id", item.id);
    await admin.from("marketing_assets").insert({ tenant_id: item.tenant_id, item_id: item.id, stage_id: item.current_stage_id, type: "campaign_plan", content: JSON.stringify(plan), meta: { source: `carmen_${mode}`, skin_slug: "campaigner", platform, requires_launch_approval: true } });
    return respond({ plan, skin_slug: "campaigner", connected_platforms: context.connected_platforms });
  } catch (error) {
    console.error("marketing-campaign-plan error", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
