export function improveContent(html) {
  if (!html) return "";

  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\sdata-start="[^"]*"/gi, "")
    .replace(/\sdata-end="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/<span>\s*<\/span>/gi, "")
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");

  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, (block) => {
    const src = block.match(/src="([^"]+)"/)?.[1];
    if (src && src.includes("youtube.com")) {
      return `<div class="video-embed"><iframe src="${src}" title="YouTube" loading="lazy" allowfullscreen></iframe></div>`;
    }
    return "";
  });

  out = out.replace(/<img([^>]*?)>/gi, (full, attrs) => {
    if (/loading=/i.test(attrs)) return `<img${attrs}>`;
    return `<img loading="lazy" decoding="async"${attrs}>`;
  });

  return out.trim();
}

export function firstImageFromHtml(html) {
  const match = html?.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] || null;
}
