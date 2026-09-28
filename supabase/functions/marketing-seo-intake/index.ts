import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";
import { fetchPublicWebsiteSnippet, gatherSeoClientContext } from "../_shared/gather-seo-client-context.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MANUAL_QUESTIONS = [
  "מי הלקוח / מה העסק?",
  "מי קהל היעד (הלקוחות של הלקוח)?",
  "מי המתחרים העיקריים?",
  "מה המטרות השיווקיות וה-SEO?",
  "דגשים, אזורים, מגבלות או מה אסור להמציא?",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      work_item_id,
      mode,
      website_override,
      manual_answers,
      selected_brief_id,
      run_research = true,
      user_prompt = "",
    } = body as Record<string, unknown>;

    if (!work_item_id || !mode) return respond({ error: "work_item_id and mode required" }, 400);

    const { data: item } = await admin.from("marketing_work_items").select("*").eq("id", work_item_id).single();
    if (!item?.client_id) return respond({ error: "Work item must have a client" }, 400);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const context = await gatherSeoClientContext(admin, item.tenant_id, item.client_id);
    const website = String(website_override ?? context.client?.website ?? "").trim();
    const wpSite = (context.wordpress_sites ?? []).find((s) => s.is_active !== false) ?? context.wordpress_sites?.[0];

    let briefText = "";
    let intakeSource = mode;
    let seoResearch: Record<string, unknown> | undefined;

    if (mode === "existing_brief" && selected_brief_id) {
      const { data: source } = await admin.from("marketing_work_items").select("payload,title").eq("id", selected_brief_id).maybeSingle();
      const payload = (source?.payload ?? {}) as Record<string, unknown>;
      briefText = String(payload.brief_text ?? payload.brief ?? "").trim();
      intakeSource = "existing_brief";
    } else if (mode === "manual_five") {
      const answers = (manual_answers ?? {}) as Record<string, string>;
      briefText = MANUAL_QUESTIONS.map((q, i) => `**${q}**\n${String(answers[`q${i + 1}`] ?? answers[q] ?? "").trim()}`).join("\n\n");
      intakeSource = "manual_five";
    } else if (mode === "carmen_full") {
      const websiteSnippet = website ? await fetchPublicWebsiteSnippet(website) : null;
      const skinBlock = await buildSkillsBlockBySlug(["seo"], item.tenant_id);
      const { data: integration } = await admin.from("tenant_integrations").select("settings,shared_from_integration_id").eq("tenant_id", item.tenant_id).eq("integration_type", "llm").eq("is_active", true).limit(1).maybeSingle();
      let settings = (integration?.settings ?? {}) as Record<string, string>;
      if (integration?.shared_from_integration_id && !settings.openai_api_key) {
        const { data: source } = await admin.from("tenant_integrations").select("settings").eq("id", integration.shared_from_integration_id).maybeSingle();
        settings = (source?.settings ?? settings) as Record<string, string>;
      }
      if (!settings.openai_api_key) throw new Error("OpenAI API key missing");

      const system = `${skinBlock}\n\nאת כרמן — מנהלת SEO/GEO. בני בריף עבודה מנתונים אמיתיים בלבד; סמני מה חסר. החזירי JSON:
{"brief_text":"","competitors":[""],"keyword_seeds":[""],"ai_visibility_notes":[""],"data_gaps":[""]}`;
      const user = JSON.stringify({
        client: context.client,
        website,
        website_snippet: websiteSnippet,
        connections: {
          wordpress: wpSite,
          ahrefs_reports: context.ahrefs_reports,
          tracked_keywords: context.tracked_keywords,
        },
        communications: context.communications,
        meetings: context.meetings,
        user_prompt,
      });

      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.45,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!ai.ok) throw new Error(`Intake AI failed: ${ai.status}`);
      const parsed = JSON.parse((await ai.json()).choices?.[0]?.message?.content ?? "{}");
      briefText = String(parsed.brief_text ?? "").trim();
      seoResearch = {
        competitors: parsed.competitors ?? [],
        keyword_seeds: parsed.keyword_seeds ?? [],
        ai_visibility_notes: parsed.ai_visibility_notes ?? [],
        data_gaps: parsed.data_gaps ?? [],
      };
      intakeSource = "carmen_full";
    } else {
      return respond({ error: "Invalid mode" }, 400);
    }

    if (!briefText) return respond({ error: "Brief is empty" }, 400);

    const nextPayload = {
      ...(item.payload as Record<string, unknown>),
      ...(seoResearch ? { seo_research: seoResearch } : {}),
      brief_text: briefText,
      department: "seo",
      intake_source: intakeSource,
      client_website: website || null,
      wordpress_site_id: wpSite?.id ?? null,
    };

    await admin.from("marketing_work_items").update({ payload: nextPayload }).eq("id", item.id);

    await admin.from("seo_geo_programs").upsert({
      tenant_id: item.tenant_id,
      client_id: item.client_id,
      work_item_id: item.id,
      wordpress_site_id: wpSite?.id ?? null,
    }, { onConflict: "work_item_id" });

    let planResult: unknown = null;
    if (run_research && mode === "carmen_full") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const planRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/marketing-seo-plan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item_id: item.id,
          mode: "brief",
          prompt: user_prompt || "מחקר ביטויים, מתחרים ו-GEO מהבריף והנתונים המחוברים",
          horizon_months: 3,
        }),
      });
      planResult = await planRes.json();
    }

    return respond({
      ok: true,
      brief_length: briefText.length,
      website,
      wordpress_site_id: wpSite?.id ?? null,
      prior_briefs: context.prior_briefs,
      plan: planResult,
    });
  } catch (error) {
    console.error("marketing-seo-intake", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
