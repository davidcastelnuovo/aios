import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const flattenDeploymentFiles = (nodes: Array<Record<string, unknown>>, prefix = ""): Array<{ file: string; uid: string }> => nodes.flatMap((node) => {
  const name = String(node.name ?? "");
  const path = prefix ? `${prefix}/${name}` : name;
  if (node.type === "directory" && Array.isArray(node.children)) return flattenDeploymentFiles(node.children as Array<Record<string, unknown>>, path);
  return node.type === "file" && typeof node.uid === "string" ? [{ file: path, uid: node.uid }] : [];
});

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

type MagazineTheme = {
  id: number;
  name: string;
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  paper: string;
  surface: string;
  displayFont: string;
  bodyFont: string;
  radius: string;
};

const magazineThemes: MagazineTheme[] = [
  { id: 1, name: "editorial", accent: "#b42318", accentSoft: "#f9e7e4", ink: "#171717", muted: "#66605b", paper: "#f4f0e8", surface: "#fffdf9", displayFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", radius: "0px" },
  { id: 2, name: "tech", accent: "#38f2b1", accentSoft: "#132d29", ink: "#eefcf8", muted: "#9bb8af", paper: "#071411", surface: "#0d201b", displayFont: "Arial Black, Arial, sans-serif", bodyFont: "Arial, sans-serif", radius: "18px" },
  { id: 3, name: "culture", accent: "#5b3df5", accentSoft: "#ece8ff", ink: "#241b35", muted: "#746a80", paper: "#fbf8ff", surface: "#ffffff", displayFont: "Georgia, serif", bodyFont: "Trebuchet MS, Arial, sans-serif", radius: "28px" },
  { id: 4, name: "business", accent: "#b88a32", accentSoft: "#f4ead5", ink: "#172033", muted: "#667085", paper: "#eef1f5", surface: "#ffffff", displayFont: "Arial, sans-serif", bodyFont: "Arial, sans-serif", radius: "6px" },
  { id: 5, name: "nature", accent: "#315c43", accentSoft: "#dfeadd", ink: "#233126", muted: "#657066", paper: "#edf1e8", surface: "#fafcf7", displayFont: "Georgia, serif", bodyFont: "Verdana, Arial, sans-serif", radius: "34px" },
  { id: 6, name: "pop", accent: "#f0448b", accentSoft: "#ffe0ee", ink: "#21162a", muted: "#786b80", paper: "#fff7bd", surface: "#ffffff", displayFont: "Arial Black, Arial, sans-serif", bodyFont: "Trebuchet MS, Arial, sans-serif", radius: "20px" },
  { id: 7, name: "minimal", accent: "#111111", accentSoft: "#eeeeee", ink: "#111111", muted: "#717171", paper: "#ffffff", surface: "#ffffff", displayFont: "Helvetica Neue, Arial, sans-serif", bodyFont: "Helvetica Neue, Arial, sans-serif", radius: "0px" },
  { id: 8, name: "travel", accent: "#d9602b", accentSoft: "#fae4d5", ink: "#17324a", muted: "#617487", paper: "#eaf4f5", surface: "#fffaf4", displayFont: "Georgia, serif", bodyFont: "Arial, sans-serif", radius: "16px" },
  { id: 9, name: "news", accent: "#0047ab", accentSoft: "#e0ebf8", ink: "#101828", muted: "#667085", paper: "#f2f4f7", surface: "#ffffff", displayFont: "Arial, sans-serif", bodyFont: "Arial, sans-serif", radius: "4px" },
  { id: 10, name: "studio", accent: "#ff5a36", accentSoft: "#ffe4dc", ink: "#262117", muted: "#756e62", paper: "#e9e1d4", surface: "#fffaf0", displayFont: "Courier New, monospace", bodyFont: "Arial, sans-serif", radius: "12px" },
];

const themeForSite = (siteKey: string) => {
  const numericSuffix = Number(siteKey.match(/(\d+)(?!.*\d)/)?.[1] ?? 1);
  return magazineThemes[(Math.max(1, numericSuffix) - 1) % magazineThemes.length];
};

const themeVariables = (theme: MagazineTheme) =>
  `--accent:${theme.accent};--accent-soft:${theme.accentSoft};--ink:${theme.ink};--muted:${theme.muted};--paper:${theme.paper};--surface:${theme.surface};--display:${theme.displayFont};--body:${theme.bodyFont};--radius:${theme.radius};`;

const homeFunction = (siteId: string, theme: MagazineTheme) => `
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const articleUrl = (slug) => "/articles/" + encodeURIComponent(slug);

module.exports = async (request, response) => {
  const feedUrl = process.env.PUBLISHING_FEED_URL ||
    "https://zvoijyneresvkadpprel.supabase.co/functions/v1/publishing-feed";
  const feedResponse = await fetch(feedUrl + "?site_id=${siteId}", {
    headers: process.env.PUBLISHING_FEED_TOKEN ? { "x-publishing-token": process.env.PUBLISHING_FEED_TOKEN } : {}
  });
  if (!feedResponse.ok) return response.status(502).send("Magazine feed unavailable");
  const payload = await feedResponse.json();
  const site = payload.site || {};
  const articles = payload.articles || [];
  const featured = articles[0];
  const cards = articles.slice(featured ? 1 : 0).map((article) => \`
    <article class="card">
      <a class="image" href="\${articleUrl(article.slug)}">
        \${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '" loading="lazy">' : '<span class="placeholder"></span>'}
      </a>
      <div class="card-copy"><span class="category">\${escapeHtml(article.category || "מגזין")}</span>
      <h2><a href="\${articleUrl(article.slug)}">\${escapeHtml(article.title)}</a></h2>
      <p>\${escapeHtml(article.excerpt || "")}</p><a class="read" href="\${articleUrl(article.slug)}">לקריאת הכתבה ←</a></div>
    </article>\`).join("");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response.status(200).send(\`<!doctype html><html lang="he" dir="rtl"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>\${escapeHtml(site.name || "מגזין")}</title>
  <meta name="description" content="כתבות, מדריכים ותוכן שימושי מבית \${escapeHtml(site.name || "המגזין")}">
  <style>
  :root{${themeVariables(theme)}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body)}
  header{background:var(--surface);border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}.nav{max-width:1180px;margin:auto;padding:24px;display:flex;align-items:center;justify-content:space-between}
  .brand{font-family:var(--display);font-size:clamp(24px,4vw,38px);font-weight:900;color:var(--ink);text-decoration:none}.tag{color:var(--muted)}
  main{max-width:1180px;margin:auto;padding:34px 24px 70px}.eyebrow,.category{color:var(--accent);font-size:13px;font-weight:800;letter-spacing:.04em}
  .featured{display:grid;grid-template-columns:1.25fr 1fr;background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:0 12px 45px #17203312;margin-bottom:34px}
  .featured img{width:100%;height:100%;min-height:390px;object-fit:cover}.featured-copy{padding:clamp(28px,5vw,64px);align-self:center}
  h1,h2{font-family:var(--display)}h1{font-size:clamp(34px,5vw,60px);line-height:1.12;margin:.25em 0}h1 a,h2 a{color:inherit;text-decoration:none}
  .featured p,.card p{color:var(--muted);line-height:1.75}.read{display:inline-block;margin-top:14px;color:var(--accent);font-weight:800;text-decoration:none}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.card{background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:0 8px 28px #1720330d}
  .image{display:block;aspect-ratio:16/10;background:var(--accent-soft)}.image img{width:100%;height:100%;object-fit:cover}.placeholder{display:block;width:100%;height:100%}
  .card-copy{padding:22px}.card h2{font-size:22px;line-height:1.35;margin:.35em 0}.empty{text-align:center;padding:90px 20px;color:#64748b}
  footer{border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);padding:28px;text-align:center;color:var(--muted)}
  body.layout-1 header{border-top:7px solid var(--accent)}body.layout-1 .featured{box-shadow:none;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}
  body.layout-2 .nav{border:1px solid var(--accent);margin-top:18px}body.layout-2 .featured{grid-template-columns:1fr 1.25fr;border:1px solid var(--accent)}body.layout-2 .grid{grid-template-columns:repeat(2,1fr)}
  body.layout-3 .brand{font-style:italic}body.layout-3 .featured{grid-template-columns:1fr;text-align:center}body.layout-3 .featured img{max-height:520px}body.layout-3 .grid{gap:34px}
  body.layout-4 header{background:var(--ink)}body.layout-4 .brand,body.layout-4 .tag{color:white}body.layout-4 .featured{border-right:9px solid var(--accent);box-shadow:none}
  body.layout-5 .featured{grid-template-columns:.9fr 1.2fr}body.layout-5 .featured img{border-radius:50% 0 0 50%}body.layout-5 .card:nth-child(even){transform:translateY(24px)}
  body.layout-6 header{transform:rotate(-.4deg)}body.layout-6 .featured{border:4px solid var(--ink);box-shadow:10px 10px 0 var(--accent)}body.layout-6 .card{border:3px solid var(--ink);box-shadow:6px 6px 0 var(--accent)}
  body.layout-7 .nav{padding-inline:0}body.layout-7 .featured{display:block;border-block:1px solid var(--ink);box-shadow:none}body.layout-7 .featured-copy{max-width:760px}body.layout-7 .grid{grid-template-columns:1fr}.layout-7 .card{display:grid;grid-template-columns:280px 1fr;border-top:1px solid var(--ink);box-shadow:none}
  body.layout-8 .featured{grid-template-columns:1fr;background:var(--ink);color:white}body.layout-8 .featured img{height:520px}body.layout-8 .featured-copy{margin-top:-190px;position:relative;background:linear-gradient(transparent,#17324add)}
  body.layout-9 .nav{padding-block:14px}body.layout-9 .featured{border-radius:0;box-shadow:none;border-bottom:5px solid var(--accent)}body.layout-9 .grid{grid-template-columns:2fr 1fr}.layout-9 .card:first-child{grid-row:span 2}
  body.layout-10 .featured{grid-template-columns:1fr 1fr;border:2px dashed var(--ink);box-shadow:none}.layout-10 .card{border:1px solid var(--ink);box-shadow:none}.layout-10 .category{text-transform:uppercase}
  @media(max-width:800px){.featured{grid-template-columns:1fr}.featured img{min-height:240px}.grid{grid-template-columns:1fr}.tag{display:none}}
  @media(max-width:800px){body[class*="layout-"] .featured,body.layout-9 .grid{grid-template-columns:1fr}.layout-7 .card{display:block}.layout-5 .card:nth-child(even){transform:none}}
  </style></head><body class="layout-${theme.id} theme-${theme.name}"><header><div class="nav"><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a><span class="tag">תוכן, רעיונות ומדריכים שימושיים</span></div></header>
  <main>\${featured ? \`<section class="featured">
    \${featured.hero_image_url ? '<a href="' + articleUrl(featured.slug) + '"><img src="' + escapeHtml(featured.hero_image_url) + '" alt="' + escapeHtml(featured.image_alt || featured.title) + '"></a>' : ''}
    <div class="featured-copy"><span class="eyebrow">\${escapeHtml(featured.category || "כתבה נבחרת")}</span>
    <h1><a href="\${articleUrl(featured.slug)}">\${escapeHtml(featured.title)}</a></h1><p>\${escapeHtml(featured.excerpt || "")}</p>
    <a class="read" href="\${articleUrl(featured.slug)}">לקריאת הכתבה ←</a></div></section><section class="grid">\${cards}</section>\` : '<div class="empty"><h1>בקרוב כאן</h1><p>כתבות חדשות נמצאות בעריכה ויעלו בקרוב.</p></div>'}</main>
  <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")}</footer></body></html>\`);
};`;

const articleFunction = (siteId: string, theme: MagazineTheme) => `
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

module.exports = async (request, response) => {
  const slug = String(request.query?.slug ?? "").replace(/^\\/+|\\/+$/g, "");
  const feedUrl = process.env.PUBLISHING_FEED_URL ||
    "https://zvoijyneresvkadpprel.supabase.co/functions/v1/publishing-feed";
  const feedResponse = await fetch(feedUrl + "?site_id=${siteId}", {
    headers: process.env.PUBLISHING_FEED_TOKEN ? { "x-publishing-token": process.env.PUBLISHING_FEED_TOKEN } : {}
  });
  if (!feedResponse.ok) return response.status(502).send("Article feed unavailable");
  const payload = await feedResponse.json();
  const article = (payload.articles || []).find((item) => item.slug === slug);
  if (!article) return response.status(404).send("Article not found");
  const site = payload.site || {};
  const published = article.article_date || article.published_at;
  const date = published ? new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(published)) : "";
  const linked = { used: false };
  const content = article.content || [];
  let imageInserted = false;
  let parts = content.map((part, index) => {
    const text = String(part);
    if (text.startsWith("## ")) return "<h2>" + escapeHtml(text.slice(3)) + "</h2>";
    if (text.startsWith("LIST: ")) return '<ul>' + text.slice(6).split("|").map((item) => '<li>' + escapeHtml(item.trim()) + '</li>').join("") + '</ul>';
    if (text.startsWith("TIP: ")) return '<aside class="tip"><strong>כדאי לדעת</strong><p>' + escapeHtml(text.slice(5).trim()) + '</p></aside>';
    let html = escapeHtml(text);
    if (!linked.used && article.anchor_text && article.target_url) {
      const escapedAnchor = escapeHtml(article.anchor_text);
      if (html.includes(escapedAnchor)) {
        html = html.replace(escapedAnchor, '<a href="' + escapeHtml(article.target_url) +
          '" target="_blank" rel="noopener">' + escapedAnchor + "</a>");
        linked.used = true;
      }
    }
    let result = "<p>" + html + "</p>";
    if (!imageInserted && article.inline_image_url && index >= Math.floor(content.length / 2)) {
      result += '<figure><img src="' + escapeHtml(article.inline_image_url) + '" alt="' +
        escapeHtml(article.image_alt || article.title) + '" loading="lazy"></figure>';
      imageInserted = true;
    }
    return result;
  }).join("");
  if (!linked.used && article.anchor_text && article.target_url) {
    parts += '<p><a href="' + escapeHtml(article.target_url) + '" target="_blank" rel="noopener">' +
      escapeHtml(article.anchor_text) + "</a></p>";
  }
  const infographic = article.infographic || {};
  const infoItems = Array.isArray(infographic.items) ? infographic.items : [];
  const infographicHtml = infoItems.length ? '<section class="infographic"><h2>' + escapeHtml(infographic.title || "הדברים החשובים בקצרה") +
    '</h2><div class="info-grid">' + infoItems.map((item) => '<div class="info-item"><span>' +
    escapeHtml(item.value || "•") + '</span><h3>' + escapeHtml(item.label || "") + '</h3><p>' +
    escapeHtml(item.description || "") + '</p></div>').join("") + '</div></section>' : "";
  const faq = Array.isArray(article.faq) ? article.faq : [];
  const faqHtml = faq.length ? '<section class="faq"><h2>שאלות נפוצות</h2>' + faq.map((item) =>
    '<details><summary>' + escapeHtml(item.question || "") + '</summary><p>' + escapeHtml(item.answer || "") + '</p></details>'
  ).join("") + '</section>' : "";
  const faqSchema = faq.length ? '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } }))
  }).replace(/</g, "\\\\u003c") + '</script>' : "";
  const canonical = "https://" + request.headers.host + "/articles/" + encodeURIComponent(slug);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response.status(200).send(\`<!doctype html><html lang="he" dir="rtl"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>\${escapeHtml(article.title)} | \${escapeHtml(site.name)}</title>
    <meta name="description" content="\${escapeHtml(article.excerpt || "")}">
    <meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="\${canonical}">
    <meta property="og:type" content="article"><meta property="og:title" content="\${escapeHtml(article.title)}">
    <meta property="og:description" content="\${escapeHtml(article.excerpt || "")}"><meta property="og:url" content="\${canonical}">
    <meta name="twitter:card" content="summary_large_image">
    \${article.hero_image_url ? '<meta property="og:image" content="' + escapeHtml(article.hero_image_url) + '">' : ''}
    \${faqSchema}
    <style>:root{${themeVariables(theme)}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);line-height:1.8}
    header,main,footer{max-width:940px;margin:auto;padding:24px}header{border-bottom:1px solid #dbe3ea}
    header a{color:var(--accent);text-decoration:none;font:800 24px var(--display)}main{background:var(--surface);margin-top:32px;
    margin-bottom:32px;border-radius:var(--radius);box-shadow:0 8px 30px #0f172a12;padding:clamp(24px,5vw,58px)}
    h1,h2,h3{font-family:var(--display)}h1{font-size:clamp(30px,5vw,48px);line-height:1.2;margin:.3em 0}h2{font-size:26px;margin-top:1.6em}
    .meta{color:var(--muted)}.lead{font-size:20px;color:var(--muted)}p,li{font-size:17px}a{color:var(--accent);font-weight:700}
    .hero{width:calc(100% + clamp(48px,10vw,116px));margin:28px calc(clamp(24px,5vw,58px)*-1) 34px;max-height:520px;object-fit:cover}
    figure{margin:38px 0}figure img{width:100%;border-radius:16px;max-height:480px;object-fit:cover}
    ul{background:var(--accent-soft);border-radius:var(--radius);padding:20px 42px}.tip{margin:30px 0;padding:22px 26px;border-right:5px solid var(--accent);background:var(--accent-soft);border-radius:var(--radius)}.tip p{margin:.3em 0}
    .infographic{margin:42px 0;padding:30px;background:var(--ink);color:var(--surface);border-radius:var(--radius)}.infographic h2{margin-top:0}.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    .info-item{padding:18px;background:#ffffff10;border:1px solid #ffffff1f;border-radius:var(--radius)}.info-item span{font-size:30px;font-weight:900;color:var(--accent)}.info-item h3{margin:.15em 0}.info-item p{font-size:14px;margin:0}
    .faq{margin-top:46px;border-top:1px solid #dbe3ea}.faq details{border-bottom:1px solid #dbe3ea;padding:16px 0}.faq summary{cursor:pointer;font-size:18px;font-weight:800}.faq details p{color:#526071}
    @media(max-width:650px){.info-grid{grid-template-columns:1fr}.hero{max-height:300px}}
    footer{color:var(--muted);border-top:1px solid #dbe3ea}
    body.layout-1 main{border-block:1px solid var(--ink);box-shadow:none}
    body.layout-2 main{border:1px solid var(--accent)}
    body.layout-3 main{text-align:right}.layout-3 h1{text-align:center;font-style:italic}
    body.layout-4 main{border-right:9px solid var(--accent);border-radius:0}
    body.layout-5 .hero,body.layout-5 figure img{border-radius:40% 8% 40% 8%}
    body.layout-6 main{border:4px solid var(--ink);box-shadow:10px 10px 0 var(--accent)}
    body.layout-7 main{box-shadow:none;padding-inline:0}.layout-7 .hero{width:100%;margin-inline:0}
    body.layout-8 .hero{border-radius:var(--radius)}body.layout-8 main{max-width:1080px}
    body.layout-9 main{border-top:6px solid var(--accent);border-radius:0}
    body.layout-10 main{border:2px dashed var(--ink);box-shadow:none}
    </style></head><body class="layout-${theme.id} theme-${theme.name}">
    <header><a href="/">\${escapeHtml(site.name || "מגזין")}</a></header><main><div class="meta">\${escapeHtml(article.category || "")}
    \${date ? " · " + escapeHtml(date) : ""}</div><h1>\${escapeHtml(article.title)}</h1>
    <p class="lead">\${escapeHtml(article.excerpt || "")}</p>
    \${article.hero_image_url ? '<img class="hero" src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '">' : ''}
    \${parts}\${infographicHtml}\${faqHtml}</main>
    <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")}</footer></body></html>\`);
};`;

const articleRouting = {
  rewrites: [
    { source: "/", destination: "/api/home" },
    { source: "/articles/:slug", destination: "/api/article?slug=:slug" },
  ],
};

Deno.serve(async (request) => {
  try {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !supabaseUrl || !serviceKey) return reply({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : "";
  const action = typeof body?.action === "string" ? body.action : "test";
  if (!tenantId) return reply({ error: "tenant_id_required" }, 400);

  const [{ data: membership }, { data: superAdmin }] = await Promise.all([
    admin.from("tenant_users").select("user_id").eq("tenant_id", tenantId).eq("user_id", authData.user.id).maybeSingle(),
    admin.rpc("is_super_admin", { _user_id: authData.user.id }),
  ]);
  if (!membership && superAdmin !== true) return reply({ error: "forbidden" }, 403);

  const ionosKey = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const vercelToken = (Deno.env.get("VERCEL_TOKEN") ?? "").trim();
  const teamId = "team_anYCth1AhJ3ZrgT0tJGvv63t";
  const templateProjectId = "prj_rNR7SGvwcSFTMDTauQQlNqabmZLD";
  const result: Record<string, unknown> = {
    ionos: { configured: Boolean(ionosKey), connected: false },
    vercel: { configured: Boolean(vercelToken), connected: false, project_access: false },
  };

  if (ionosKey) {
    const response = await fetch("https://api.hosting.ionos.com/dns/v1/zones", {
      headers: { "X-API-Key": ionosKey, Accept: "application/json" },
    });
    const responseText = await response.text();
    let zones: unknown = [];
    if (response.ok && responseText.trim()) {
      try {
        zones = JSON.parse(responseText);
      } catch {
        zones = [];
      }
    }
    result.ionos = {
      configured: true,
      connected: response.ok,
      status: response.status,
      error: response.ok ? null : responseText.slice(0, 300),
      response_format: response.ok && responseText.trim() && !Array.isArray(zones) ? "unexpected" : "ok",
      paperlief_found: Array.isArray(zones) && zones.some((zone) => String(zone?.zoneName ?? zone?.name ?? "").replace(/\.$/, "").toLowerCase() === "paperlief.com"),
      zone_count: Array.isArray(zones) ? zones.length : 0,
    };
  }

  if (vercelToken) {
    const headers = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" };
    const [accountResponse, projectResponse] = await Promise.all([
      fetch("https://api.vercel.com/v2/user", { headers }),
      fetch("https://api.vercel.com/v9/projects/prj_rNR7SGvwcSFTMDTauQQlNqabmZLD?teamId=team_anYCth1AhJ3ZrgT0tJGvv63t", { headers }),
    ]);
    result.vercel = {
      configured: true,
      connected: accountResponse.ok,
      status: accountResponse.status,
      project_access: projectResponse.ok,
      project_status: projectResponse.status,
    };
  }

  if (action === "list_projects") {
    if (!vercelToken) return reply({ success: false, error: "vercel_credentials_missing" }, 400);
    const response = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return reply({ success: false, error: "vercel_projects_failed", status: response.status }, 400);
    const projects = await Promise.all((payload?.projects ?? []).map(async (project: Record<string, unknown>) => {
      const projectId = String(project.id ?? "");
      const [domainsResponse, deploymentsResponse] = await Promise.all([
        fetch(`https://api.vercel.com/v9/projects/${projectId}/domains?teamId=${teamId}&limit=100`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } }),
        fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } }),
      ]);
      const domainsPayload = await domainsResponse.json().catch(() => ({}));
      const deploymentsPayload = await deploymentsResponse.json().catch(() => ({}));
      const deployment = deploymentsPayload?.deployments?.[0] ?? null;
      return {
        id: project.id,
        name: project.name,
        framework: project.framework,
        updated_at: project.updatedAt,
        domains: (domainsPayload?.domains ?? []).map((domain: Record<string, unknown>) => ({ name: domain.name, verified: domain.verified })),
        deployment: deployment ? { id: deployment.uid, url: deployment.url, state: deployment.state, created_at: deployment.created } : null,
      };
    }));
    return reply({ success: true, projects });
  }

  if (action === "create_site") {
    if (!vercelToken) return reply({ success: false, error: "vercel_credentials_missing" }, 400);
    const requestedName = String(body?.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!requestedName) return reply({ success: false, error: "site_name_required" }, 400);
    const headers = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json", "Content-Type": "application/json" };
    const existingResponse = await fetch(`https://api.vercel.com/v9/projects/${requestedName}?teamId=${teamId}`, { headers });
    let project = existingResponse.ok ? await existingResponse.json().catch(() => ({})) : null;
    if (!project) {
      // The template deployment contains the already-built static output. These
      // projects must not run Astro again: the deployment file API returns the
      // template artifacts, not an installable Astro source checkout.
      const projectResponse = await fetch(`https://api.vercel.com/v10/projects?teamId=${teamId}`, { method: "POST", headers, body: JSON.stringify({ name: requestedName, framework: null }) });
      project = await projectResponse.json().catch(() => ({}));
      if (!projectResponse.ok) return reply({ success: false, error: "vercel_create_project_failed", status: projectResponse.status, detail: project?.error?.message }, 400);
    }
    if (project.framework !== null) {
      const updateProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${project.id}?teamId=${teamId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ framework: null }),
      });
      const updatedProject = await updateProjectResponse.json().catch(() => ({}));
      if (!updateProjectResponse.ok) {
        return reply({
          success: false,
          error: "vercel_update_project_failed",
          status: updateProjectResponse.status,
          detail: updatedProject?.error?.message,
        }, 400);
      }
      project = updatedProject;
    }
    const { data: publishingSite } = await admin.from("publishing_sites")
      .select("id,site_key").eq("tenant_id", tenantId).eq("connection_id", project.id).maybeSingle();
    if (!publishingSite?.id) return reply({ success: false, error: "publishing_site_not_found", project_id: project.id }, 404);
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${templateProjectId}&teamId=${teamId}&limit=1&state=READY`, { headers });
    const deployments = await deploymentsResponse.json().catch(() => ({}));
    const templateDeploymentId = deployments?.deployments?.[0]?.uid;
    if (!templateDeploymentId) return reply({ success: false, error: "template_deployment_missing", project }, 400);
    const filesResponse = await fetch(`https://api.vercel.com/v6/deployments/${templateDeploymentId}/files?teamId=${teamId}`, { headers });
    const fileTree = await filesResponse.json().catch(() => []);
    if (!filesResponse.ok || !Array.isArray(fileTree)) return reply({ success: false, error: "template_files_failed", status: filesResponse.status }, 400);
    const templateFiles = flattenDeploymentFiles(fileTree);
    if (!templateFiles.length) return reply({ success: false, error: "template_files_missing" }, 400);
    const files = await Promise.all(templateFiles
      .filter(({ file }) => file !== "api/article.js" && file !== "api/home.js" && file !== "vercel.json")
      .map(async ({ file, uid }) => {
      const contentResponse = await fetch(`https://api.vercel.com/v8/deployments/${templateDeploymentId}/files/${uid}?teamId=${teamId}`, { headers });
      if (!contentResponse.ok) throw new Error(`template_file_read_failed:${file}:${contentResponse.status}`);
      return { file, data: toBase64(new Uint8Array(await contentResponse.arrayBuffer())), encoding: "base64" };
    }));
    const theme = themeForSite(String(publishingSite.site_key ?? requestedName));
    files.push(
      { file: "api/home.js", data: btoa(unescape(encodeURIComponent(homeFunction(publishingSite.id, theme)))), encoding: "base64" },
      { file: "api/article.js", data: btoa(unescape(encodeURIComponent(articleFunction(publishingSite.id, theme)))), encoding: "base64" },
      { file: "vercel.json", data: btoa(JSON.stringify(articleRouting)), encoding: "base64" },
    );
    // Vercel associates a deployment to an existing project by `name`.
    // Sending the response-only `project` field causes the API to retain the
    // source/template project association even when `name` is different.
    const deployResponse = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}&forceNew=1`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: requestedName,
        files,
        target: "production",
        projectSettings: { framework: null },
      }),
    });
    const deployment = await deployResponse.json().catch(() => ({}));
    if (!deployResponse.ok) return reply({ success: false, error: "vercel_deploy_site_failed", status: deployResponse.status, detail: deployment?.error?.message, project }, 400);
    if (deployment?.projectId !== project.id) {
      return reply({
        success: false,
        error: "vercel_deployment_project_mismatch",
        expected_project_id: project.id,
        actual_project_id: deployment?.projectId ?? null,
        deployment_id: deployment?.id ?? null,
      }, 502);
    }
    return reply({ success: true, existing: false, project: { id: project.id, name: project.name }, deployment: { id: deployment.id, url: deployment.url, status: deployment.status ?? deployment.readyState } });
  }

  if (action === "connect") {
    if (!ionosKey || !vercelToken) return reply({ success: false, error: "provider_credentials_missing", ...result }, 400);

    const domain = String(body?.domain ?? "paperlief.com").trim().replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const projectId = String(body?.project_id ?? templateProjectId);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) return reply({ success: false, error: "invalid_domain" }, 400);
    const vercelHeaders = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json", "Content-Type": "application/json" };
    const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`, {
      method: "POST",
      headers: vercelHeaders,
      body: JSON.stringify({ name: domain }),
    });
    const addDomainText = await addDomainResponse.text();
    if (!addDomainResponse.ok && addDomainResponse.status !== 409) {
      return reply({ success: false, error: "vercel_add_domain_failed", status: addDomainResponse.status, detail: addDomainText.slice(0, 500), ...result }, 400);
    }

    const configResponse = await fetch(`https://api.vercel.com/v6/domains/${domain}/config?projectIdOrName=${projectId}&teamId=${teamId}`, {
      headers: vercelHeaders,
    });
    const configText = await configResponse.text();
    if (!configResponse.ok) return reply({ success: false, error: "vercel_domain_config_failed", status: configResponse.status, detail: configText.slice(0, 500), ...result }, 400);
    const config = JSON.parse(configText);
    const rankedIps = Array.isArray(config?.recommendedIPv4) ? [...config.recommendedIPv4].sort((a, b) => Number(a?.rank ?? 99) - Number(b?.rank ?? 99)) : [];
    const ipValue = Array.isArray(rankedIps[0]?.value) ? rankedIps[0].value[0] : rankedIps[0]?.value;
    if (typeof ipValue !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ipValue)) {
      return reply({ success: false, error: "vercel_dns_recommendation_missing", detail: "No recommended IPv4 was returned", ...result }, 400);
    }

    const ionosHeaders = { "X-API-Key": ionosKey, Accept: "application/json", "Content-Type": "application/json" };
    const zonesResponse = await fetch("https://api.hosting.ionos.com/dns/v1/zones", { headers: ionosHeaders });
    const zonesText = await zonesResponse.text();
    if (!zonesResponse.ok) return reply({ success: false, error: "ionos_zones_failed", status: zonesResponse.status, detail: zonesText.slice(0, 500), ...result }, 400);
    const zones = JSON.parse(zonesText);
    const zone = Array.isArray(zones) ? zones.find((item) => String(item?.name ?? item?.zoneName ?? "").replace(/\.$/, "").toLowerCase() === domain) : null;
    if (!zone?.id) return reply({ success: false, error: "ionos_zone_not_found", detail: domain, ...result }, 404);

    const record = { name: domain, type: "A", content: ipValue, ttl: 3600, prio: 0, disabled: false };
    const recordsResponse = await fetch(`https://api.hosting.ionos.com/dns/v1/zones/${zone.id}?recordName=${encodeURIComponent(domain)}&recordType=A`, { headers: ionosHeaders });
    const recordsText = await recordsResponse.text();
    if (!recordsResponse.ok) return reply({ success: false, error: "ionos_records_read_failed", status: recordsResponse.status, detail: recordsText.slice(0, 500), ...result }, 400);
    const zoneDetails = recordsText.trim() ? JSON.parse(recordsText) : {};
    const currentRecords = Array.isArray(zoneDetails?.records) ? zoneDetails.records : [];
    const alreadyConfigured = currentRecords.some((item) => String(item?.name ?? "").replace(/\.$/, "").toLowerCase() === domain && item?.type === "A" && item?.content === ipValue && item?.disabled !== true);

    let dnsStatus = 200;
    if (!alreadyConfigured) {
      const hasApexA = currentRecords.some((item) => String(item?.name ?? "").replace(/\.$/, "").toLowerCase() === domain && item?.type === "A");
      const dnsResponse = await fetch(`https://api.hosting.ionos.com/dns/v1/zones/${zone.id}${hasApexA ? "" : "/records"}`, {
        method: hasApexA ? "PATCH" : "POST",
        headers: ionosHeaders,
        body: JSON.stringify([record]),
      });
      dnsStatus = dnsResponse.status;
      const dnsText = await dnsResponse.text();
      if (!dnsResponse.ok) return reply({ success: false, error: "ionos_dns_write_failed", status: dnsResponse.status, detail: dnsText.slice(0, 500), ...result }, 400);
    }

    return reply({
      success: true,
      connected: true,
      domain,
      vercel: { added: addDomainResponse.ok, already_added: addDomainResponse.status === 409, config_status: configResponse.status },
      ionos: { zone_id: zone.id, record_type: "A", record_value: ipValue, already_configured: alreadyConfigured, write_status: dnsStatus },
      propagation: "pending",
    });
  }

  return reply({ success: true, ...result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    console.error("domain-connections failed", detail);
    return reply({
      success: false,
      error: "domain_connection_check_failed",
      detail,
      ionos: { configured: Boolean((Deno.env.get("IONOS_API_KEY") ?? "").trim()), connected: false, error: detail },
      vercel: { configured: Boolean((Deno.env.get("VERCEL_TOKEN") ?? "").trim()), connected: false, project_access: false },
    });
  }
});
