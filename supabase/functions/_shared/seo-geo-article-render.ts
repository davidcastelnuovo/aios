/** Rich article HTML for the destination site. Colors come from that site's theme. */

import { NEUTRAL_SITE_THEME, type SiteTheme } from "./seo-geo-site-theme.ts";

export type SeoGeoArticleBlock = {
  title: string;
  excerpt?: string;
  content: string[];
  faq?: Array<{ question: string; answer: string }>;
  infographic?: { title?: string; items?: Array<{ value?: string; label: string; description: string }> };
};

function hex(value: string, fallback: string): string {
  return /^#[0-9A-F]{6}$/i.test(value) ? value : fallback;
}

export function articleThemeCss(theme: SiteTheme = NEUTRAL_SITE_THEME): string {
  const primary = hex(theme.primary, NEUTRAL_SITE_THEME.primary);
  const secondary = hex(theme.secondary, NEUTRAL_SITE_THEME.secondary);
  const accent = hex(theme.accent, NEUTRAL_SITE_THEME.accent);
  const surface = hex(theme.surface, NEUTRAL_SITE_THEME.surface);
  const text = hex(theme.text, NEUTRAL_SITE_THEME.text);
  const muted = hex(theme.muted, NEUTRAL_SITE_THEME.muted);
  const font = theme.font.includes(";") || theme.font.includes("{") ? NEUTRAL_SITE_THEME.font : theme.font;
  return `
.aios-seo-article{direction:rtl;text-align:right;font-family:${font};line-height:1.75;color:${text};max-width:720px;margin:0 auto}
.aios-seo-article .aios-lead{font-size:1.125rem;color:${muted};margin:0 0 1.5rem}
.aios-seo-article h2{font-size:1.35rem;margin:2rem 0 .75rem;color:${primary};border-right:4px solid ${accent};padding-right:.65rem}
.aios-seo-article p{margin:0 0 1rem}
.aios-seo-article ul{margin:0 0 1.25rem;padding-right:1.25rem}
.aios-seo-article li{margin-bottom:.35rem}
.aios-seo-article .aios-tip{background:${surface};border:1px solid ${secondary};border-radius:12px;padding:1rem 1.15rem;margin:1.5rem 0}
.aios-seo-article .aios-tip strong{display:block;margin-bottom:.35rem;color:${primary}}
.aios-seo-article .aios-infographic{margin:2rem 0;padding:1.25rem;background:${surface};border-radius:16px;border:1px solid ${secondary}}
.aios-seo-article .aios-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-top:1rem}
.aios-seo-article .aios-info-item{background:#fff;border-radius:10px;padding:.85rem;border:1px solid ${secondary}}
.aios-seo-article .aios-info-item span{font-size:.75rem;font-weight:700;color:${accent}}
.aios-seo-article .aios-info-item h3{font-size:.95rem;margin:.35rem 0;color:${primary}}
.aios-seo-article .aios-info-item p{font-size:.85rem;color:${muted};margin:0}
.aios-seo-article .aios-faq{margin-top:2rem}
.aios-seo-article .aios-faq details{border:1px solid ${secondary};border-radius:10px;padding:.65rem .85rem;margin-bottom:.5rem;background:#fff}
.aios-seo-article .aios-faq summary{cursor:pointer;font-weight:600;color:${primary}}
`.replace(/\s+/g, " ");
}

export function reskinArticleHtml(html: string, theme: SiteTheme = NEUTRAL_SITE_THEME): string {
  const css = articleThemeCss(theme);
  const styled = /<style>[\s\S]*?<\/style>/.test(html)
    ? html.replace(/<style>[\s\S]*?<\/style>/, `<style>${css}</style>`)
    : `<style>${css}</style>${html}`;
  if (/class="aios-seo-article"/.test(styled)) {
    return styled.replace(
      /<div class="aios-seo-article"(?: data-aios-theme="[^"]*")?/,
      `<div class="aios-seo-article" data-aios-theme="${theme.source}"`,
    );
  }
  return `<div class="aios-seo-article" data-aios-theme="${theme.source}">${styled}</div>`;
}

function escapeHtml(value = "") {
  const plain = String(value).replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
  return plain.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  );
}

export function renderSeoGeoArticleHtml(article: SeoGeoArticleBlock, theme: SiteTheme = NEUTRAL_SITE_THEME): string {
  const parts = (article.content ?? []).map((part) => {
    const text = String(part).trim();
    if (!text) return "";
    const list = text.match(/^#{0,6}\s*LIST:\s*([\s\S]+)/i);
    if (list) {
      const items = list[1].split("|").map((item) => item.replace(/^#{0,6}\s*/, "").replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
      return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    }
    const tip = text.match(/^#{0,6}\s*TIP:\s*([\s\S]+)/i);
    if (tip) {
      return `<aside class="aios-tip"><strong>כדאי לדעת</strong><p>${escapeHtml(tip[1].trim())}</p></aside>`;
    }
    const heading = text.match(/^#{2,6}\s+(.+)/);
    if (heading) return `<h2>${escapeHtml(heading[1].trim())}</h2>`;
    return `<p>${escapeHtml(text)}</p>`;
  }).join("");

  const info = article.infographic;
  const infoItems = Array.isArray(info?.items) ? info!.items!.filter((i) => i.label && i.description) : [];
  const infographicHtml = infoItems.length
    ? `<section class="aios-infographic"><h2>${escapeHtml(info?.title || "הדברים החשובים בקצרה")}</h2><div class="aios-info-grid">${infoItems.map((item) =>
      `<div class="aios-info-item"><span>${escapeHtml(item.value || "•")}</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.description)}</p></div>`
    ).join("")}</div></section>`
    : "";

  const faq = article.faq ?? [];
  const faqHtml = faq.length
    ? `<section class="aios-faq"><h2>שאלות נפוצות</h2>${faq.map((item) =>
      `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`
    ).join("")}</section>`
    : "";

  const lead = article.excerpt ? `<p class="aios-lead">${escapeHtml(article.excerpt)}</p>` : "";
  return reskinArticleHtml(`<div class="aios-seo-article">${lead}${parts}${infographicHtml}${faqHtml}</div>`, theme);
}
