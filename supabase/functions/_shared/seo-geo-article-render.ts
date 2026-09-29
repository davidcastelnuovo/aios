/** Rich article HTML for client WordPress (PBN-style blocks, inline CSS for theme safety). */

export type SeoGeoArticleBlock = {
  title: string;
  excerpt?: string;
  content: string[];
  faq?: Array<{ question: string; answer: string }>;
  infographic?: { title?: string; items?: Array<{ value?: string; label: string; description: string }> };
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  );
}

export function renderSeoGeoArticleHtml(article: SeoGeoArticleBlock): string {
  const parts = (article.content ?? []).map((part) => {
    const text = String(part).trim();
    if (!text) return "";
    if (text.startsWith("## ")) return `<h2>${escapeHtml(text.slice(3))}</h2>`;
    if (text.startsWith("LIST: ")) {
      const items = text.slice(6).split("|").map((item) => item.trim()).filter(Boolean);
      return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (text.startsWith("TIP: ")) {
      return `<aside class="aios-tip"><strong>כדאי לדעת</strong><p>${escapeHtml(text.slice(5).trim())}</p></aside>`;
    }
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

  const css = `
.aios-seo-article{direction:rtl;text-align:right;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.75;color:#1a1a1a;max-width:720px;margin:0 auto}
.aios-seo-article .aios-lead{font-size:1.125rem;color:#444;margin:0 0 1.5rem}
.aios-seo-article h2{font-size:1.35rem;margin:2rem 0 .75rem;color:#0f5132;border-right:4px solid #10b981;padding-right:.65rem}
.aios-seo-article p{margin:0 0 1rem}
.aios-seo-article ul{margin:0 0 1.25rem;padding-right:1.25rem}
.aios-seo-article li{margin-bottom:.35rem}
.aios-seo-article .aios-tip{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #6ee7b7;border-radius:12px;padding:1rem 1.15rem;margin:1.5rem 0}
.aios-seo-article .aios-tip strong{display:block;margin-bottom:.35rem;color:#047857}
.aios-seo-article .aios-infographic{margin:2rem 0;padding:1.25rem;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0}
.aios-seo-article .aios-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-top:1rem}
.aios-seo-article .aios-info-item{background:#fff;border-radius:10px;padding:.85rem;border:1px solid #e5e7eb}
.aios-seo-article .aios-info-item span{font-size:.75rem;font-weight:700;color:#059669}
.aios-seo-article .aios-info-item h3{font-size:.95rem;margin:.35rem 0}
.aios-seo-article .aios-info-item p{font-size:.85rem;color:#555;margin:0}
.aios-seo-article .aios-faq{margin-top:2rem}
.aios-seo-article .aios-faq details{border:1px solid #e5e7eb;border-radius:10px;padding:.65rem .85rem;margin-bottom:.5rem;background:#fff}
.aios-seo-article .aios-faq summary{cursor:pointer;font-weight:600}
`.replace(/\s+/g, " ");

  const lead = article.excerpt ? `<p class="aios-lead">${escapeHtml(article.excerpt)}</p>` : "";

  return `<div class="aios-seo-article"><style>${css}</style>${lead}${parts}${infographicHtml}${faqHtml}</div>`;
}
