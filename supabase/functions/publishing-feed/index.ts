import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60, s-maxage=300",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: jsonHeaders });

  const siteId = new URL(request.url).searchParams.get("site_id");
  if (!siteId) return new Response(JSON.stringify({ error: "site_id_required" }), { status: 400, headers: jsonHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ error: "server_not_configured" }), { status: 500, headers: jsonHeaders });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: site, error: siteError } = await admin.from("publishing_sites").select("id,site_key,name,base_url,categories,status").eq("id", siteId).eq("status", "active").maybeSingle();
  if (siteError) return new Response(JSON.stringify({ error: "site_lookup_failed" }), { status: 500, headers: jsonHeaders });
  if (!site) return new Response(JSON.stringify({ error: "site_not_found" }), { status: 404, headers: jsonHeaders });

  const { data: articles, error } = await admin.from("publishing_articles")
    .select("id,slug,title,excerpt,category,source_month,published_at,content,sources,internal_links,target_url,anchor_text,hero_image_url,inline_image_url,image_alt,faq,infographic")
    .eq("site_id", site.id).eq("status", "published").not("slug", "is", null).not("title", "is", null)
    .order("source_month", { ascending: false, nullsFirst: false });
  if (error) return new Response(JSON.stringify({ error: "article_lookup_failed" }), { status: 500, headers: jsonHeaders });

  const datedArticles = (articles ?? []).map((article) => ({
    ...article,
    article_date: article.source_month ?? article.published_at,
    actual_published_at: article.published_at,
    published_at: article.source_month ?? article.published_at,
  }));

  return new Response(JSON.stringify({ site, articles: datedArticles, generatedAt: new Date().toISOString() }), { status: 200, headers: jsonHeaders });
});
