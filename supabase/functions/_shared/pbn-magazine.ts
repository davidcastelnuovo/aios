/** PBN magazine HTML generators — baked into Vercel api/home.js + api/article.js at deploy time. */

export type MagazineTheme = {
  id: number;
  name: string;
  studio: string;
  tagline: string;
  layout: "signal" | "ledger" | "atelier" | "classic";
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  paper: string;
  surface: string;
  displayFont: string;
  bodyFont: string;
  googleFonts: string;
  radius: string;
};

export const magazineThemes: MagazineTheme[] = [
  {
    id: 1,
    name: "signal",
    studio: "Signal Atelier",
    tagline: "חדשנות, טכנולוגיה והעתיד שכבר כאן",
    layout: "signal",
    accent: "#3DDC97",
    accentSoft: "#12352C",
    ink: "#E8F1F7",
    muted: "#8FA6B5",
    paper: "#071018",
    surface: "#0E1C28",
    displayFont: "'Rubik', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Rubik:wght@500;700;800&family=Heebo:wght@400;500;700",
    radius: "4px",
  },
  {
    id: 2,
    name: "ledger",
    studio: "North Ledger",
    tagline: "חדשות, חברה וכלכלה בגובה העיניים",
    layout: "ledger",
    accent: "#0B6E4F",
    accentSoft: "#D7EDE4",
    ink: "#121A24",
    muted: "#5C6B7A",
    paper: "#EEF2F6",
    surface: "#FFFFFF",
    displayFont: "'Frank Ruhl Libre', serif",
    bodyFont: "'Assistant', sans-serif",
    googleFonts: "Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@400;600;700",
    radius: "0px",
  },
  {
    id: 3,
    name: "atelier",
    studio: "Copper Room",
    tagline: "עסקים, קריירה וצמיחה מקצועית",
    layout: "atelier",
    accent: "#A86B32",
    accentSoft: "#F3E7D8",
    ink: "#152033",
    muted: "#6A7382",
    paper: "#F2F4F7",
    surface: "#FFFFFF",
    displayFont: "'Secular One', sans-serif",
    bodyFont: "'IBM Plex Sans Hebrew', sans-serif",
    googleFonts: "Secular+One&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700",
    radius: "18px",
  },
  {
    id: 4,
    name: "business",
    studio: "Boardroom",
    tagline: "תובנות לניהול ולצמיחה",
    layout: "classic",
    accent: "#1F4B99",
    accentSoft: "#E4ECF8",
    ink: "#172033",
    muted: "#667085",
    paper: "#F4F6FA",
    surface: "#FFFFFF",
    displayFont: "'Assistant', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Assistant:wght@600;700&family=Heebo:wght@400;500;700",
    radius: "8px",
  },
  {
    id: 5,
    name: "nature",
    studio: "Grove Press",
    tagline: "בית, חומרים ואורח חיים",
    layout: "classic",
    accent: "#2F5D3A",
    accentSoft: "#DCE8DD",
    ink: "#1E2A20",
    muted: "#667266",
    paper: "#F3F5EF",
    surface: "#FBFCFA",
    displayFont: "'Frank Ruhl Libre', serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Frank+Ruhl+Libre:wght@600;700&family=Heebo:wght@400;500;700",
    radius: "28px",
  },
  {
    id: 6,
    name: "pop",
    studio: "Pulse Desk",
    tagline: "תרבות, סגנון ורעיונות טריים",
    layout: "classic",
    accent: "#D7266B",
    accentSoft: "#FCE0EC",
    ink: "#1C1524",
    muted: "#74687C",
    paper: "#FFF8F2",
    surface: "#FFFFFF",
    displayFont: "'Rubik', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Rubik:wght@700;800&family=Heebo:wght@400;500;700",
    radius: "22px",
  },
  {
    id: 7,
    name: "minimal",
    studio: "Plain Type",
    tagline: "מידע ברור, בלי רעש",
    layout: "classic",
    accent: "#111111",
    accentSoft: "#EFEFEF",
    ink: "#111111",
    muted: "#6F6F6F",
    paper: "#FFFFFF",
    surface: "#FFFFFF",
    displayFont: "'Heebo', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Heebo:wght@400;500;700;800",
    radius: "0px",
  },
  {
    id: 8,
    name: "travel",
    studio: "Horizon Line",
    tagline: "מסלולים, ים ושטח",
    layout: "classic",
    accent: "#C45C26",
    accentSoft: "#F7E4D6",
    ink: "#17324A",
    muted: "#617487",
    paper: "#EAF3F4",
    surface: "#FFF9F3",
    displayFont: "'Frank Ruhl Libre', serif",
    bodyFont: "'Assistant', sans-serif",
    googleFonts: "Frank+Ruhl+Libre:wght@600;700&family=Assistant:wght@400;600;700",
    radius: "16px",
  },
  {
    id: 9,
    name: "news",
    studio: "Daily Mark",
    tagline: "עדכונים ותובנות ליום העבודה",
    layout: "classic",
    accent: "#0A4C8C",
    accentSoft: "#DCE8F5",
    ink: "#101828",
    muted: "#667085",
    paper: "#F2F4F7",
    surface: "#FFFFFF",
    displayFont: "'Assistant', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Assistant:wght@700&family=Heebo:wght@400;500;700",
    radius: "4px",
  },
  {
    id: 10,
    name: "studio",
    studio: "Workshop",
    tagline: "ידע שימושי שנשאר איתך",
    layout: "classic",
    accent: "#E4572E",
    accentSoft: "#FFE3D9",
    ink: "#262117",
    muted: "#756E62",
    paper: "#EDE6DB",
    surface: "#FFFBF4",
    displayFont: "'Rubik', sans-serif",
    bodyFont: "'Heebo', sans-serif",
    googleFonts: "Rubik:wght@600;700&family=Heebo:wght@400;500;700",
    radius: "12px",
  },
];

export const themeForSite = (siteKey: string) => {
  const numericSuffix = Number(siteKey.match(/(\d+)(?!.*\d)/)?.[1] ?? 1);
  return magazineThemes[(Math.max(1, numericSuffix) - 1) % magazineThemes.length];
};

const themeVariables = (theme: MagazineTheme) =>
  `--accent:${theme.accent};--accent-soft:${theme.accentSoft};--ink:${theme.ink};--muted:${theme.muted};--paper:${theme.paper};--surface:${theme.surface};--display:${theme.displayFont};--body:${theme.bodyFont};--radius:${theme.radius};`;

const fontLinks = (theme: MagazineTheme) =>
  `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${theme.googleFonts}&display=swap" rel="stylesheet">`;

const sharedHelpers = `const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const articleUrl = (slug) => "/articles/" + encodeURIComponent(slug);
`;

const homeShell = (siteId: string, theme: MagazineTheme, css: string, bodyHtml: string) => `
${sharedHelpers}
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
  const rest = articles.slice(featured ? 1 : 0);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response.status(200).send(\`<!doctype html><html lang="he" dir="rtl"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>\${escapeHtml(site.name || "מגזין")}</title>
  <meta name="description" content="\${escapeHtml(site.name || "המגזין")} — ${theme.tagline}">
  ${fontLinks(theme)}
  <style>
  :root{${themeVariables(theme)}}
  *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);-webkit-font-smoothing:antialiased}
  a{color:inherit}img{display:block;max-width:100%}
  ${css}
  </style></head><body class="layout-${theme.layout} theme-${theme.name}" data-studio="${theme.studio}">
  ${bodyHtml}
  </body></html>\`);
};`;

const signalHomeCss = `
@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.hero{min-height:100vh;display:grid;grid-template-rows:auto 1fr;position:relative;overflow:hidden;background:radial-gradient(120% 80% at 80% 0%,#134e3a55,transparent 55%),linear-gradient(160deg,#040a10 0%,#0b1a26 55%,#071018 100%)}
.hero-media{position:absolute;inset:0;z-index:0}.hero-media img{width:100%;height:100%;object-fit:cover;opacity:.42;filter:saturate(.85) contrast(1.05)}
.hero-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#071018ee 0%,#07101866 40%,#071018f0 100%)}
.top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;padding:28px clamp(20px,4vw,56px);animation:rise .7s ease both}
.brand{font-family:var(--display);font-weight:800;font-size:clamp(28px,5vw,48px);letter-spacing:-.03em;text-decoration:none;color:var(--ink)}
.studio{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-top:8px}
.tag{max-width:220px;text-align:left;color:var(--muted);font-size:13px;line-height:1.5}
.hero-copy{position:relative;z-index:1;align-self:end;padding:0 clamp(20px,4vw,56px) clamp(40px,8vw,90px);max-width:920px;animation:rise .9s .1s ease both}
.eyebrow{display:inline-block;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px}
h1{font-family:var(--display);font-size:clamp(36px,7vw,72px);line-height:1.05;margin:0 0 18px;font-weight:800;letter-spacing:-.03em}
h1 a{text-decoration:none}.lede{font-size:clamp(16px,2vw,20px);color:var(--muted);max-width:38rem;line-height:1.7;margin:0 0 28px}
.cta{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;background:var(--accent);color:#04130e;font-weight:800;text-decoration:none;border-radius:999px;transition:transform .2s ease}
.cta:hover{transform:translateY(-2px)}
.rail{padding:56px clamp(20px,4vw,56px) 80px;max-width:1180px;margin:0 auto}
.rail-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px;border-bottom:1px solid #ffffff18;padding-bottom:16px}
.rail-head h2{font-family:var(--display);font-size:28px;margin:0}.rail-head span{color:var(--muted);font-size:13px}
.story{display:grid;grid-template-columns:160px 1fr;gap:22px;padding:22px 0;border-bottom:1px solid #ffffff14;text-decoration:none;transition:background .2s}
.story:hover{background:#ffffff06}.story img,.ph{width:160px;height:110px;object-fit:cover;border-radius:var(--radius);background:var(--accent-soft)}
.story .cat{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.08em}.story h3{font-family:var(--display);font-size:22px;margin:6px 0;line-height:1.25}.story p{margin:0;color:var(--muted);line-height:1.6}
.empty{min-height:70vh;display:grid;place-items:center;text-align:center;padding:40px}.empty h1{font-family:var(--display)}
footer{padding:28px;text-align:center;color:var(--muted);border-top:1px solid #ffffff14;font-size:13px}
@media(max-width:720px){.tag{display:none}.story{grid-template-columns:1fr}.story img,.ph{width:100%;height:180px}}
`;

const signalHomeBody = `
\${featured ? \`
<section class="hero">
  <div class="hero-media">\${featured.hero_image_url ? '<img src="' + escapeHtml(featured.hero_image_url) + '" alt="' + escapeHtml(featured.image_alt || featured.title) + '">' : ''}</div>
  <div class="top"><div><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a><div class="studio">${"Signal Atelier"}</div></div><p class="tag">${"חדשנות, טכנולוגיה והעתיד שכבר כאן"}</p></div>
  <div class="hero-copy">
    <span class="eyebrow">\${escapeHtml(featured.category || "כתבה נבחרת")}</span>
    <h1><a href="\${articleUrl(featured.slug)}">\${escapeHtml(featured.title)}</a></h1>
    <p class="lede">\${escapeHtml(featured.excerpt || "")}</p>
    <a class="cta" href="\${articleUrl(featured.slug)}">לקריאת הכתבה</a>
  </div>
</section>
<section class="rail">
  <div class="rail-head"><h2>עוד מהמגזין</h2><span>\${rest.length} כתבות</span></div>
  \${rest.map((article) => \`
    <a class="story" href="\${articleUrl(article.slug)}">
      \${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '" loading="lazy">' : '<span class="ph"></span>'}
      <div><div class="cat">\${escapeHtml(article.category || "מגזין")}</div><h3>\${escapeHtml(article.title)}</h3><p>\${escapeHtml(article.excerpt || "")}</p></div>
    </a>\`).join("")}
</section>\` : \`
<header class="top" style="position:relative"><div><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a><div class="studio">Signal Atelier</div></div></header>
<div class="empty"><div><h1>בקרוב כאן</h1><p style="color:var(--muted)">כתבות חדשות נמצאות בעריכה ויעלו בקרוב.</p></div></div>\`}
<footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")} · Signal Atelier</footer>
`;

const ledgerHomeCss = `
@keyframes fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
body{background:linear-gradient(180deg,#e8eef5 0%,var(--paper) 220px)}
.mast{padding:34px clamp(18px,4vw,48px) 18px;max-width:1120px;margin:0 auto;animation:fadeup .6s ease both}
.brand{display:block;font-family:var(--display);font-size:clamp(42px,8vw,78px);line-height:.95;font-weight:700;text-decoration:none;color:var(--ink);letter-spacing:-.02em}
.meta-row{display:flex;justify-content:space-between;gap:16px;margin-top:18px;padding-top:14px;border-top:3px solid var(--ink);font-size:13px;color:var(--muted)}
.meta-row strong{color:var(--accent);font-weight:700}
.feature{max-width:1120px;margin:10px auto 0;padding:0 clamp(18px,4vw,48px);animation:fadeup .7s .05s ease both}
.feature-visual{width:100%;aspect-ratio:21/9;background:var(--accent-soft);overflow:hidden}
.feature-visual img{width:100%;height:100%;object-fit:cover}
.feature-copy{padding:28px 0 8px;max-width:760px}
.eyebrow{color:var(--accent);font-weight:700;font-size:13px;letter-spacing:.06em}.feature h1{font-family:var(--display);font-size:clamp(32px,5vw,54px);line-height:1.12;margin:10px 0 14px}.feature h1 a{text-decoration:none}
.feature p{color:var(--muted);font-size:18px;line-height:1.7;margin:0 0 18px}.read{color:var(--accent);font-weight:700;text-decoration:none;border-bottom:2px solid var(--accent)}
.list{max-width:1120px;margin:36px auto 70px;padding:0 clamp(18px,4vw,48px)}
.list h2{font-family:var(--display);font-size:28px;margin:0 0 8px;padding-bottom:12px;border-bottom:1px solid #c5ced8}
.row{display:grid;grid-template-columns:64px 1fr 200px;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid #d5dde6;text-decoration:none;transition:background .2s}
.row:hover{background:#ffffff88}.num{font-family:var(--display);font-size:28px;color:var(--accent);font-weight:700}
.row h3{font-family:var(--display);font-size:24px;margin:0 0 6px;line-height:1.25}.row p{margin:0;color:var(--muted);line-height:1.55}.row img,.ph{width:200px;height:130px;object-fit:cover;background:var(--accent-soft)}
.empty{text-align:center;padding:100px 20px;color:var(--muted)}
footer{max-width:1120px;margin:0 auto;padding:24px clamp(18px,4vw,48px) 48px;color:var(--muted);font-size:13px;border-top:1px solid #c5ced8}
@media(max-width:800px){.row{grid-template-columns:48px 1fr}.row img,.ph{display:none}.feature-visual{aspect-ratio:16/10}}
`;

const ledgerHomeBody = `
\${featured ? \`
<header class="mast">
  <a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a>
  <div class="meta-row"><span><strong>North Ledger</strong> · ${"חדשות, חברה וכלכלה בגובה העיניים"}</span><span>\${new Date().toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}</span></div>
</header>
<article class="feature">
  <a class="feature-visual" href="\${articleUrl(featured.slug)}">\${featured.hero_image_url ? '<img src="' + escapeHtml(featured.hero_image_url) + '" alt="' + escapeHtml(featured.image_alt || featured.title) + '">' : ''}</a>
  <div class="feature-copy">
    <div class="eyebrow">\${escapeHtml(featured.category || "כתבה נבחרת")}</div>
    <h1><a href="\${articleUrl(featured.slug)}">\${escapeHtml(featured.title)}</a></h1>
    <p>\${escapeHtml(featured.excerpt || "")}</p>
    <a class="read" href="\${articleUrl(featured.slug)}">המשך קריאה</a>
  </div>
</article>
<section class="list">
  <h2>בראש העמוד</h2>
  \${rest.map((article, index) => \`
    <a class="row" href="\${articleUrl(article.slug)}">
      <div class="num">\${String(index + 1).padStart(2,"0")}</div>
      <div><h3>\${escapeHtml(article.title)}</h3><p>\${escapeHtml(article.excerpt || "")}</p></div>
      \${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '" loading="lazy">' : '<span class="ph"></span>'}
    </a>\`).join("")}
</section>\` : \`
<header class="mast"><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a></header>
<div class="empty"><h1>בקרוב כאן</h1><p>כתבות חדשות נמצאות בעריכה ויעלו בקרוב.</p></div>\`}
<footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")} · North Ledger</footer>
`;

const atelierHomeCss = `
@keyframes softin{from{opacity:0}to{opacity:1}}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.side{background:var(--ink);color:#f4efe7;padding:36px 28px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:28px;animation:softin .8s ease both}
.brand{font-family:var(--display);font-size:34px;line-height:1.05;text-decoration:none;color:#f4efe7}
.studio{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.side p{color:#c9c2b6;font-size:14px;line-height:1.65;margin:0}
.side .rule{height:1px;background:#ffffff22;margin:8px 0}
.main{padding:36px clamp(18px,3vw,42px) 70px;animation:softin .9s .05s ease both}
.feature{display:grid;gap:0;margin-bottom:36px;background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:0 18px 50px #15203314}
.feature-visual{aspect-ratio:16/9;background:var(--accent-soft)}.feature-visual img{width:100%;height:100%;object-fit:cover}
.feature-copy{padding:clamp(24px,4vw,42px)}
.eyebrow{color:var(--accent);font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
.feature h1{font-family:var(--display);font-size:clamp(30px,4.5vw,48px);line-height:1.15;margin:12px 0}.feature h1 a{text-decoration:none}
.feature p{color:var(--muted);font-size:17px;line-height:1.7;margin:0 0 18px}
.cta{display:inline-block;padding:12px 20px;background:var(--ink);color:#f4efe7;border-radius:999px;text-decoration:none;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
.card{background:var(--surface);border-radius:var(--radius);overflow:hidden;text-decoration:none;box-shadow:0 10px 30px #15203310;transition:transform .25s ease,box-shadow .25s ease}
.card:hover{transform:translateY(-4px);box-shadow:0 18px 40px #15203318}
.card .image{aspect-ratio:16/10;background:var(--accent-soft)}.card img{width:100%;height:100%;object-fit:cover}
.card-copy{padding:22px}.card .cat{color:var(--accent);font-size:12px;font-weight:700}.card h3{font-family:var(--display);font-size:22px;margin:8px 0;line-height:1.3}.card p{margin:0;color:var(--muted);line-height:1.6}
.empty{padding:80px 20px;text-align:center;color:var(--muted)}
footer{grid-column:1/-1;padding:20px 28px;border-top:1px solid #d8dee6;color:var(--muted);font-size:13px;background:var(--paper)}
@media(max-width:900px){.shell{grid-template-columns:1fr}.side{position:relative;height:auto}.grid{grid-template-columns:1fr}}
`;

const atelierHomeBody = `
\${featured ? \`
<div class="shell">
  <aside class="side">
    <div><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a><div class="studio" style="margin-top:10px">Copper Room</div></div>
    <div class="rule"></div>
    <p>${"עסקים, קריירה וצמיחה מקצועית"}</p>
    <p style="margin-top:auto;font-size:12px;color:#9a9388">מגזין עסקי בעריכה עצמאית</p>
  </aside>
  <div class="main">
    <article class="feature">
      <a class="feature-visual" href="\${articleUrl(featured.slug)}">\${featured.hero_image_url ? '<img src="' + escapeHtml(featured.hero_image_url) + '" alt="' + escapeHtml(featured.image_alt || featured.title) + '">' : ''}</a>
      <div class="feature-copy">
        <div class="eyebrow">\${escapeHtml(featured.category || "כתבה נבחרת")}</div>
        <h1><a href="\${articleUrl(featured.slug)}">\${escapeHtml(featured.title)}</a></h1>
        <p>\${escapeHtml(featured.excerpt || "")}</p>
        <a class="cta" href="\${articleUrl(featured.slug)}">לקריאת הכתבה</a>
      </div>
    </article>
    <section class="grid">
      \${rest.map((article) => \`
        <a class="card" href="\${articleUrl(article.slug)}">
          <div class="image">\${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '" loading="lazy">' : ''}</div>
          <div class="card-copy"><div class="cat">\${escapeHtml(article.category || "מגזין")}</div><h3>\${escapeHtml(article.title)}</h3><p>\${escapeHtml(article.excerpt || "")}</p></div>
        </a>\`).join("")}
    </section>
  </div>
  <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")} · Copper Room</footer>
</div>\` : \`
<div class="shell"><aside class="side"><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a></aside><div class="main"><div class="empty"><h1>בקרוב כאן</h1><p>כתבות חדשות נמצאות בעריכה ויעלו בקרוב.</p></div></div></div>\`}
`;

const classicHomeCss = `
header{background:var(--surface);border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.nav{max-width:1180px;margin:auto;padding:24px;display:flex;align-items:center;justify-content:space-between}
.brand{font-family:var(--display);font-size:clamp(24px,4vw,38px);font-weight:800;color:var(--ink);text-decoration:none}
.tag{color:var(--muted);font-size:13px}
main{max-width:1180px;margin:auto;padding:34px 24px 70px}
.eyebrow,.category{color:var(--accent);font-size:13px;font-weight:800;letter-spacing:.04em}
.featured{display:grid;grid-template-columns:1.25fr 1fr;background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:0 12px 45px #17203312;margin-bottom:34px}
.featured img{width:100%;height:100%;min-height:390px;object-fit:cover}
.featured-copy{padding:clamp(28px,5vw,64px);align-self:center}
h1,h2{font-family:var(--display)}h1{font-size:clamp(34px,5vw,56px);line-height:1.12;margin:.25em 0}
h1 a,h2 a{color:inherit;text-decoration:none}
.featured p,.card p{color:var(--muted);line-height:1.75}
.read{display:inline-block;margin-top:14px;color:var(--accent);font-weight:800;text-decoration:none}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.card{background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:0 8px 28px #1720330d;text-decoration:none;display:block}
.image{display:block;aspect-ratio:16/10;background:var(--accent-soft)}.image img{width:100%;height:100%;object-fit:cover}
.card-copy{padding:22px}.card h2{font-size:22px;line-height:1.35;margin:.35em 0}
.empty{text-align:center;padding:90px 20px;color:var(--muted)}
footer{border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent);padding:28px;text-align:center;color:var(--muted)}
body.layout-classic.theme-business .featured{border-right:8px solid var(--accent)}
body.layout-classic.theme-nature .featured img{border-radius:40% 0 0 40%}
body.layout-classic.theme-pop .featured{border:3px solid var(--ink);box-shadow:8px 8px 0 var(--accent)}
body.layout-classic.theme-minimal .featured{box-shadow:none;border-block:1px solid var(--ink)}
body.layout-classic.theme-travel .featured{grid-template-columns:1fr;background:var(--ink);color:#fff}
body.layout-classic.theme-travel .featured p{color:#d7e0e8}
body.layout-classic.theme-news .featured{border-radius:0;border-bottom:5px solid var(--accent);box-shadow:none}
body.layout-classic.theme-studio .featured{border:2px dashed var(--ink);box-shadow:none}
@media(max-width:800px){.featured{grid-template-columns:1fr}.featured img{min-height:240px}.grid{grid-template-columns:1fr}.tag{display:none}}
`;

const classicHomeBodyFixed = (theme: MagazineTheme) => `
<header><div class="nav"><a class="brand" href="/">\${escapeHtml(site.name || "מגזין")}</a><span class="tag">${theme.tagline}</span></div></header>
<main>\${featured ? \`
<section class="featured">
  \${featured.hero_image_url ? '<a href="' + articleUrl(featured.slug) + '"><img src="' + escapeHtml(featured.hero_image_url) + '" alt="' + escapeHtml(featured.image_alt || featured.title) + '"></a>' : ''}
  <div class="featured-copy">
    <span class="eyebrow">\${escapeHtml(featured.category || "כתבה נבחרת")}</span>
    <h1><a href="\${articleUrl(featured.slug)}">\${escapeHtml(featured.title)}</a></h1>
    <p>\${escapeHtml(featured.excerpt || "")}</p>
    <a class="read" href="\${articleUrl(featured.slug)}">לקריאת הכתבה ←</a>
  </div>
</section>
<section class="grid">\${rest.map((article) => \`
  <a class="card" href="\${articleUrl(article.slug)}">
    <span class="image">\${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '" loading="lazy">' : ''}</span>
    <div class="card-copy"><span class="category">\${escapeHtml(article.category || "מגזין")}</span>
    <h2>\${escapeHtml(article.title)}</h2><p>\${escapeHtml(article.excerpt || "")}</p></div>
  </a>\`).join("")}</section>\` : '<div class="empty"><h1>בקרוב כאן</h1><p>כתבות חדשות נמצאות בעריכה ויעלו בקרוב.</p></div>'}</main>
<footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")}</footer>
`;

export function homeFunction(siteId: string, theme: MagazineTheme) {
  if (theme.layout === "signal") return homeShell(siteId, theme, signalHomeCss, signalHomeBody);
  if (theme.layout === "ledger") return homeShell(siteId, theme, ledgerHomeCss, ledgerHomeBody);
  if (theme.layout === "atelier") return homeShell(siteId, theme, atelierHomeCss, atelierHomeBody);
  return homeShell(siteId, theme, classicHomeCss, classicHomeBodyFixed(theme));
}

const articleCssByLayout = (theme: MagazineTheme) => {
  const base = `
:root{${themeVariables(theme)}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);line-height:1.8;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--display)}a{color:var(--accent);font-weight:700}
.meta{color:var(--muted)}.lead{font-size:20px;color:var(--muted)}p,li{font-size:17px}
figure{margin:38px 0}figure img{width:100%;max-height:480px;object-fit:cover}
ul{background:var(--accent-soft);border-radius:var(--radius);padding:20px 42px}
.tip{margin:30px 0;padding:22px 26px;border-right:5px solid var(--accent);background:var(--accent-soft);border-radius:var(--radius)}.tip p{margin:.3em 0}
.infographic{margin:42px 0;padding:30px;background:var(--ink);color:#f5f7fa;border-radius:var(--radius)}.infographic h2{margin-top:0;color:#fff}
.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.info-item{padding:18px;background:#ffffff10;border:1px solid #ffffff1f;border-radius:var(--radius)}
.info-item span{font-size:30px;font-weight:900;color:var(--accent)}.info-item h3{margin:.15em 0;color:#fff}.info-item p{font-size:14px;margin:0;color:#d7dee8}
.faq{margin-top:46px;border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.faq details{border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent);padding:16px 0}
.faq summary{cursor:pointer;font-size:18px;font-weight:800}.faq details p{color:var(--muted)}
@media(max-width:650px){.info-grid{grid-template-columns:1fr}}
`;
  if (theme.layout === "signal") {
    return base + `
body{background:var(--paper);color:var(--ink)}
.top{padding:24px clamp(18px,4vw,48px);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ffffff14}
.top a{font-family:var(--display);font-size:22px;font-weight:800;text-decoration:none;color:var(--ink)}
.hero-wrap{position:relative;min-height:52vh;display:grid;align-items:end;overflow:hidden}
.hero-wrap img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5}
.hero-wrap::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#07101899,#071018f2)}
.hero-copy{position:relative;z-index:1;padding:48px clamp(18px,4vw,48px);max-width:920px}
h1{font-size:clamp(32px,5vw,56px);line-height:1.12;margin:.2em 0;font-weight:800}
main{max-width:760px;margin:0 auto;padding:36px clamp(18px,4vw,48px) 80px}
.hero-inline{display:none}figure img{border-radius:4px}
footer{padding:28px;text-align:center;color:var(--muted);border-top:1px solid #ffffff14}
`;
  }
  if (theme.layout === "ledger") {
    return base + `
body{background:linear-gradient(180deg,#e8eef5 0%,var(--paper) 180px)}
.top{max-width:820px;margin:0 auto;padding:28px 24px 12px}
.top a{font-family:var(--display);font-size:clamp(28px,4vw,40px);font-weight:700;text-decoration:none;color:var(--ink);display:block}
.top .studio{margin-top:8px;padding-top:10px;border-top:3px solid var(--ink);font-size:12px;color:var(--muted)}
.hero-wrap{max-width:1100px;margin:12px auto 0;padding:0 24px}
.hero-wrap img{width:100%;aspect-ratio:21/9;object-fit:cover;position:relative}
.hero-copy{max-width:820px;margin:0 auto;padding:28px 24px 0}h1{font-size:clamp(34px,5vw,52px);line-height:1.15;margin:.25em 0}
main{max-width:820px;margin:0 auto;padding:8px 24px 80px;background:transparent;box-shadow:none}
.hero-inline{display:none}figure img{border-radius:0}
footer{max-width:820px;margin:0 auto;padding:24px;color:var(--muted);border-top:1px solid #c5ced8}
`;
  }
  if (theme.layout === "atelier") {
    return base + `
.top{background:var(--ink);padding:22px 28px}.top a{font-family:var(--display);font-size:24px;text-decoration:none;color:#f4efe7}
.top .studio{color:var(--accent);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-top:6px}
.hero-wrap{display:none}
.hero-copy{max-width:820px;margin:0 auto;padding:42px 24px 0}h1{font-size:clamp(32px,4.5vw,48px);margin:.3em 0}
main{max-width:820px;margin:24px auto 60px;background:var(--surface);border-radius:var(--radius);padding:clamp(24px,4vw,48px);box-shadow:0 16px 40px #15203314}
.hero-inline{width:100%;border-radius:var(--radius);max-height:460px;object-fit:cover;margin:8px 0 28px}
figure img{border-radius:var(--radius)}
footer{text-align:center;padding:24px;color:var(--muted)}
`;
  }
  return base + `
header,main,footer{max-width:940px;margin:auto;padding:24px}
header{border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
header a{color:var(--accent);text-decoration:none;font:800 24px var(--display)}
main{background:var(--surface);margin-top:32px;margin-bottom:32px;border-radius:var(--radius);box-shadow:0 8px 30px #0f172a12;padding:clamp(24px,5vw,58px)}
h1{font-size:clamp(30px,5vw,48px);line-height:1.2;margin:.3em 0}h2{font-size:26px;margin-top:1.6em}
.hero{width:calc(100% + clamp(48px,10vw,116px));margin:28px calc(clamp(24px,5vw,58px)*-1) 34px;max-height:520px;object-fit:cover}
figure img{border-radius:16px}
footer{color:var(--muted);border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}
.hero-wrap,.hero-copy,.top,.studio,.hero-inline{/* classic uses .hero inside main */}
`;
};

const articleBodyMarkup = (theme: MagazineTheme) => {
  if (theme.layout === "classic") {
    return `
    <header><a href="/">\${escapeHtml(site.name || "מגזין")}</a></header>
    <main><div class="meta">\${escapeHtml(article.category || "")}\${date ? " · " + escapeHtml(date) : ""}</div>
    <h1>\${escapeHtml(article.title)}</h1><p class="lead">\${escapeHtml(article.excerpt || "")}</p>
    \${article.hero_image_url ? '<img class="hero" src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '">' : ''}
    \${parts}\${infographicHtml}\${faqHtml}</main>
    <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")}</footer>`;
  }
  if (theme.layout === "atelier") {
    return `
    <div class="top"><div><a href="/">\${escapeHtml(site.name || "מגזין")}</a><div class="studio">${theme.studio}</div></div></div>
    <main>
      <div class="meta">\${escapeHtml(article.category || "")}\${date ? " · " + escapeHtml(date) : ""}</div>
      <h1>\${escapeHtml(article.title)}</h1><p class="lead">\${escapeHtml(article.excerpt || "")}</p>
      \${article.hero_image_url ? '<img class="hero-inline" src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '">' : ''}
      \${parts}\${infographicHtml}\${faqHtml}
    </main>
    <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")} · ${theme.studio}</footer>`;
  }
  return `
    <div class="top"><div><a href="/">\${escapeHtml(site.name || "מגזין")}</a><div class="studio">${theme.studio}</div></div></div>
    <section class="hero-wrap">
      \${article.hero_image_url ? '<img src="' + escapeHtml(article.hero_image_url) + '" alt="' + escapeHtml(article.image_alt || article.title) + '">' : ''}
      <div class="hero-copy"><div class="meta">\${escapeHtml(article.category || "")}\${date ? " · " + escapeHtml(date) : ""}</div>
      <h1>\${escapeHtml(article.title)}</h1><p class="lead">\${escapeHtml(article.excerpt || "")}</p></div>
    </section>
    <main>\${parts}\${infographicHtml}\${faqHtml}</main>
    <footer>© \${new Date().getFullYear()} \${escapeHtml(site.name || "")} · ${theme.studio}</footer>`;
};

export function articleFunction(siteId: string, theme: MagazineTheme) {
  return `
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
    ${fontLinks(theme)}
    <style>${articleCssByLayout(theme)}</style></head>
    <body class="layout-${theme.layout} theme-${theme.name}">
    ${articleBodyMarkup(theme)}
    </body></html>\`);
};`;
}
