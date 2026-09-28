import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";
import { renderSeoGeoArticleHtml } from "../_shared/seo-geo-article-render.ts";
import { extractSiteTheme, NEUTRAL_SITE_THEME } from "../_shared/seo-geo-site-theme.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type GeneratedArticle = {
  title?: string;
  excerpt?: string;
  content?: string[];
  faq?: Array<{ question?: string; answer?: string }>;
  infographic?: { title?: string; items?: Array<{ value?: string; label?: string; description?: string }> };
  meta_description?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let entryIdForStatus: string | null = null;
  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const entry_id = body?.entry_id as string | undefined;
    if (!entry_id) return respond({ error: "entry_id required" }, 400);
    entryIdForStatus = entry_id;

    const { data: entry } = await admin.from("seo_geo_calendar_entries").select("*").eq("id", entry_id).single();
    if (!entry) return respond({ error: "Entry not found" }, 404);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", entry.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const approved = entry.approval_status === "approved" || entry.approval_status === "auto_approved";
    if (!approved) return respond({ error: "Entry must be approved before generation" }, 400);

    await admin.from("seo_geo_calendar_entries").update({ generation_status: "generating" }).eq("id", entry_id);

    const [{ data: client }, { data: item }, skinBlock] = await Promise.all([
      admin.from("clients").select("name,website,industry").eq("id", entry.client_id).maybeSingle(),
      admin.from("marketing_work_items").select("payload").eq("id", entry.work_item_id).maybeSingle(),
      buildSkillsBlockBySlug(["seo_geo", "seo", "content_writer"], entry.tenant_id),
    ]);

    const { data: integration } = await admin.from("tenant_integrations").select("settings,shared_from_integration_id").eq("tenant_id", entry.tenant_id).eq("integration_type", "llm").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin.from("tenant_integrations").select("settings").eq("id", integration.shared_from_integration_id).maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key missing");

    const payload = (item?.payload ?? {}) as Record<string, unknown>;
    const keyword = String(entry.primary_keyword ?? "").trim();
    const geoQuestions = Array.isArray(entry.geo_questions) ? entry.geo_questions : [];

    const { data: program } = await admin.from("seo_geo_programs").select("wordpress_site_id").eq("work_item_id", entry.work_item_id).maybeSingle();
    let siteUrl = String(client?.website ?? "").trim();
    if (program?.wordpress_site_id) {
      const { data: site } = await admin.from("social_media_wordpress_sites").select("site_url").eq("id", program.wordpress_site_id).maybeSingle();
      if (site?.site_url) siteUrl = String(site.site_url).trim();
    }
    const themePromise = siteUrl ? extractSiteTheme(siteUrl) : Promise.resolve(NEUTRAL_SITE_THEME);

    const system = `${skinBlock}\n\nאת כרמן — כותבת מאמר SEO/GEO לעלייה באתר הלקוח (לא PBN). המאמר מעוצב כמו במגזין: LIST, TIP, FAQ, אינפוגרפיקה. הצבעים והפונט מגיעים מערכת האתר בזמן הרינדור — אל תמציאי צבעים. החזירי JSON בלבד.`;
    const user = `הקשר:
${JSON.stringify({
  client,
  brief: payload.brief_text,
  article: {
    title: entry.title,
    keyword,
    angle: entry.angle,
    intent: entry.intent,
    cluster: entry.cluster,
    geo_questions: geoQuestions,
  },
})}

דרישות:
- לפחות 850 מילים בעברית בגוף (מערך content).
- 12+ פריטי content: פתיחה, כותרות, רשימה, טיפ, סיכום.
- כותרת משנה היא מחרוזת שמתחילה ב-"## " בלבד.
- רשימה היא מחרוזת אחת: "LIST: פריט | פריט | פריט" — בלי סולמיות ובלי מספור.
- טיפ הוא מחרוזת אחת שמתחילה ב-"TIP: ".
- 4–6 FAQ; אינפוגרפיקה 3–5 פריטים.
- הביטוי "${keyword}" פעם אחת בדיוק בפסקת גוף.
- meta_description עד 160 תווים.
- GEO: ענה על שאלות geo_questions בתוך התוכן/FAQ.
- המאמר הוא לעמוד באתר הלקוח, לקהל שמופיע בבריף, על השירות שמתואר בבריף.
- אסור להמציא חברות, סטטיסטיקות, או נתוני דירוג שלא נמסרו בהקשר.

JSON:
{"title":"","excerpt":"","meta_description":"","content":[],"faq":[{"question":"","answer":""}],"infographic":{"title":"","items":[{"value":"01","label":"","description":""}]}}`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.55,
        max_tokens: 8000,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!ai.ok) throw new Error(`OpenAI ${ai.status}: ${await ai.text()}`);
    const parsed = JSON.parse((await ai.json()).choices?.[0]?.message?.content ?? "{}") as GeneratedArticle;

    const content = Array.isArray(parsed.content) ? parsed.content.map((p) => String(p).trim()).filter(Boolean) : [];
    const faq = Array.isArray(parsed.faq)
      ? parsed.faq.map((f) => ({
        question: String(f.question ?? "").trim(),
        answer: String(f.answer ?? "").trim(),
      })).filter((f) => f.question && f.answer)
      : [];
    const infoItems = Array.isArray(parsed.infographic?.items)
      ? parsed.infographic!.items!.map((i) => ({
        value: String(i.value ?? "•"),
        label: String(i.label ?? "").trim(),
        description: String(i.description ?? "").trim(),
      })).filter((i) => i.label && i.description)
      : [];

    const title = String(parsed.title ?? entry.title).trim();
    const excerpt = String(parsed.excerpt ?? "").trim();
    const meta = String(parsed.meta_description ?? "").trim();
    const theme = await themePromise;
    const html = renderSeoGeoArticleHtml({
      title,
      excerpt,
      content,
      faq,
      infographic: { title: parsed.infographic?.title, items: infoItems },
    }, theme);

    await admin.from("seo_geo_calendar_entries").update({
      title_draft: title,
      excerpt,
      meta_description: meta,
      content_html: html,
      generation_status: "draft",
      publish_error: null,
    }).eq("id", entry_id);

    return respond({ ok: true, entry_id });
  } catch (error) {
    console.error("marketing-seo-generate-entry", error);
    const message = error instanceof Error ? error.message : String(error);
    if (entryIdForStatus) {
      await admin.from("seo_geo_calendar_entries").update({ generation_status: "failed", publish_error: message }).eq("id", entryIdForStatus);
    }
    return respond({ error: message }, 500);
  }
});
