import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type GeneratedArticle = {
  title?: unknown;
  excerpt?: unknown;
  content?: unknown;
  faq?: unknown;
  infographic?: unknown;
  hero_image_prompt?: unknown;
  inline_image_prompt?: unknown;
  image_alt?: unknown;
};

type ArticleImage = { url: string; prompt: string };

async function generateArticleImage(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  tenantId: string,
  articleId: string,
  kind: "hero" | "inline",
  prompt: string,
): Promise<ArticleImage | null> {
  if (!prompt) return null;
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${prompt}. Editorial magazine photography, natural and credible, landscape composition, no text, no logos, no watermarks.`,
      n: 1,
      size: "1536x1024",
      quality: kind === "hero" ? "medium" : "low",
      output_format: "webp",
      output_compression: 82,
    }),
  });
  if (!response.ok) {
    console.error("article image generation failed", kind, response.status, await response.text());
    return null;
  }
  const payload = await response.json();
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) return null;
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const path = `${tenantId}/publishing/${articleId}/${kind}.webp`;
  const { error } = await admin.storage.from("entity-attachments").upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) {
    console.error("article image upload failed", kind, error.message);
    return null;
  }
  const { data } = admin.storage.from("entity-attachments").getPublicUrl(path);
  return { url: data.publicUrl, prompt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const articleIds = Array.isArray(body.article_ids)
      ? [...new Set(body.article_ids.filter((id: unknown) => typeof id === "string"))].slice(0, 10)
      : [];
    if (!articleIds.length) return respond({ error: "article_ids required" }, 400);

    const { data: articles, error: articlesError } = await admin
      .from("publishing_articles")
      .select("id,tenant_id,client_id,customer_name,primary_keyword,proposed_topic,target_url,category,site_id,status")
      .in("id", articleIds);
    if (articlesError) throw articlesError;
    if (!articles?.length) return respond({ error: "Articles not found" }, 404);
    if (new Set(articles.map((article) => article.tenant_id)).size !== 1) {
      return respond({ error: "Articles must belong to one tenant" }, 400);
    }

    const tenantId = articles[0].tenant_id;
    if (auth.kind === "user") {
      const { data: membership } = await admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const [{ data: integration }, skinBlock] = await Promise.all([
      admin
        .from("tenant_integrations")
        .select("settings,shared_from_integration_id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "llm")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      buildSkillsBlockBySlug(["seo", "content_writer"], tenantId),
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
    if (!settings.openai_api_key) {
      return respond({ error: "OpenAI API key חסר בהגדרות האינטגרציות" }, 400);
    }

    const clientIds = [...new Set(articles.map((article) => article.client_id).filter(Boolean))];
    const siteIds = [...new Set(articles.map((article) => article.site_id).filter(Boolean))];
    const [{ data: clients }, { data: sites }] = await Promise.all([
      clientIds.length
        ? admin.from("clients").select("id,name,website,business_description,industry").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      siteIds.length
        ? admin.from("publishing_sites").select("id,name,categories,base_url").in("id", siteIds)
        : Promise.resolve({ data: [] }),
    ]);
    const clientById = new Map((clients ?? []).map((client) => [client.id, client]));
    const siteById = new Map((sites ?? []).map((site) => [site.id, site]));

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const article of articles) {
      try {
        const client = article.client_id ? clientById.get(article.client_id) : null;
        const site = article.site_id ? siteById.get(article.site_id) : null;
        const system = `${skinBlock}

את כרמן עם Skin משולב של SEO/GEO וכותבת תוכן. כתבי מאמר עברי מקורי, שימושי, טבעי ומדויק.
שלבי העבודה הפנימיים: הבנת כוונת החיפוש, בניית מבנה, כתיבה, ובדיקת עריכה סופית.
אל תמציאי נתונים, מחקרים, ציטוטים, לקוחות או הבטחות. אל תכתבי טקסט גנרי או דחיסת מילות מפתח.
הביטוי לקידום צריך להופיע פעם אחת בדיוק ובצורה טבעית בתוך אחת הפסקאות. אין להוסיף URL גלוי לגוף.
כתבי כמו עורכת מגזין: פתיחה שמכניסה לנושא, דוגמאות שימושיות, משפטים באורכים משתנים והיררכיה ויזואלית ברורה.
האינפוגרפיקה תציג תהליך, צ'קליסט או השוואה מתוך המאמר. אין להמציא אחוזים, מחירים, מחקרים או נתונים כמותיים.
השאלות והתשובות צריכות לענות בקצרה על שאלות חיפוש אמיתיות שאינן חוזרות מילה במילה על גוף המאמר.
החזירי JSON תקין בלבד.`;
        const context = {
          customer_name: article.customer_name,
          client,
          topic: article.proposed_topic,
          primary_keyword: article.primary_keyword,
          target_url: article.target_url,
          publishing_site: site,
          category: article.category,
        };
        const user = `כתבי מאמר מלא על סמך הנתונים הבאים:
${JSON.stringify(context)}

 דרישות:
- 900–1300 מילים בעברית.
- כותרת ברורה ומושכת, ללא קליקבייט.
- תקציר של 1–2 משפטים.
- פתיחה, 5–8 חלקים הגיוניים וסיכום שימושי.
- גוף המאמר יוחזר כמערך פסקאות. כותרות משנה יהיו פריטים נפרדים שמתחילים ב-"## ".
- רשימה תוחזר כפריט שמתחיל ב-"LIST: " ולאחריו פריטים מופרדים ב-" | ".
- תיבת מידע אחת תוחזר כפריט שמתחיל ב-"TIP: ".
- 4–6 שאלות ותשובות קצרות.
- אינפוגרפיקה אחת עם 3–5 פריטים. value יהיה מספר שלב קצר כמו "01" או מילה קצרה, לא נתון מומצא.
- שתי הנחיות תמונה מפורטות באנגלית: תמונת שער ותמונה משלימה. ללא טקסט או לוגו בתוך התמונה.
- אל תציגי את הלקוח כמקור אובייקטיבי ואל תהפכי את המאמר לפרסומת.
- אל תוסיפי Markdown מלבד "## " לכותרות משנה.

החזירי בדיוק:
{"title":"","excerpt":"","content":["פסקה, כותרת משנה, LIST או TIP"],"faq":[{"question":"","answer":""}],"infographic":{"title":"","items":[{"value":"01","label":"","description":""}]},"hero_image_prompt":"","inline_image_prompt":"","image_alt":""}`;

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.openai_api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.55,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
        if (!aiResponse.ok) {
          throw new Error(`OpenAI ${aiResponse.status}: ${await aiResponse.text()}`);
        }
        const aiData = await aiResponse.json();
        const generated = JSON.parse(
          aiData.choices?.[0]?.message?.content ?? "{}",
        ) as GeneratedArticle;
        const title = String(generated.title ?? "").trim();
        const excerpt = String(generated.excerpt ?? "").trim();
        const content = Array.isArray(generated.content)
          ? generated.content.map((part) => String(part).trim()).filter(Boolean)
          : [];
        const faq = Array.isArray(generated.faq)
          ? generated.faq.slice(0, 6).map((item) => ({
            question: String((item as Record<string, unknown>)?.question ?? "").trim(),
            answer: String((item as Record<string, unknown>)?.answer ?? "").trim(),
          })).filter((item) => item.question && item.answer)
          : [];
        const rawInfographic = generated.infographic as Record<string, unknown> | null;
        const infographicItems = Array.isArray(rawInfographic?.items)
          ? rawInfographic.items.slice(0, 5).map((item) => ({
            value: String((item as Record<string, unknown>)?.value ?? "").trim(),
            label: String((item as Record<string, unknown>)?.label ?? "").trim(),
            description: String((item as Record<string, unknown>)?.description ?? "").trim(),
          })).filter((item) => item.label && item.description)
          : [];
        const infographic = {
          title: String(rawInfographic?.title ?? "").trim(),
          items: infographicItems,
        };
        if (!title || !excerpt || content.length < 8 || faq.length < 3 || infographicItems.length < 3) {
          throw new Error("כרמן לא החזירה מאמר מלא ותקין");
        }
        const heroPrompt = String(generated.hero_image_prompt ?? "").trim();
        const inlinePrompt = String(generated.inline_image_prompt ?? "").trim();
        const [heroImage, inlineImage] = await Promise.all([
          generateArticleImage(admin, settings.openai_api_key, tenantId, article.id, "hero", heroPrompt),
          generateArticleImage(admin, settings.openai_api_key, tenantId, article.id, "inline", inlinePrompt),
        ]);

        const { error: updateError } = await admin
          .from("publishing_articles")
          .update({
            title,
            excerpt,
            content,
            faq,
            infographic,
            hero_image_url: heroImage?.url ?? null,
            inline_image_url: inlineImage?.url ?? null,
            image_alt: String(generated.image_alt ?? title).trim(),
            status: "review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id)
          .eq("tenant_id", tenantId);
        if (updateError) throw updateError;
        results.push({ id: article.id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("generate-publishing-article item error", article.id, message);
        results.push({ id: article.id, ok: false, error: message });
      }
    }

    return respond({
      generated: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
      skin_slugs: ["seo", "content_writer"],
    });
  } catch (error) {
    console.error("generate-publishing-articles error", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
