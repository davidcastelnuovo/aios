/** Colors and type taken from the destination site. Never invent a brand palette. */

import { assertPublicUrl } from "./web-research.ts";

export type SiteThemeSource = "elementor" | "css-vars" | "neutral";

export type SiteTheme = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
  muted: string;
  font: string;
  source: SiteThemeSource;
};

type Rgb = { r: number; g: number; b: number; a: number };

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

export const NEUTRAL_SITE_THEME: SiteTheme = {
  primary: "#1E293B",
  secondary: "#94A3B8",
  accent: "#334155",
  surface: "#F8FAFC",
  text: "#1E293B",
  muted: "#475569",
  font: "system-ui, -apple-system, \"Segoe UI\", sans-serif",
  source: "neutral",
};

function parseColor(raw: string): Rgb | null {
  const value = raw.trim().replace(/["']/g, "");
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb = value.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!rgb) return null;
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] ? Number(rgb[4]) : 1 };
}

function channel(v: number): number {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function toHex(c: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r * (1 - t) + b.r * t,
    g: a.g * (1 - t) + b.g * t,
    b: a.b * (1 - t) + b.b * t,
    a: 1,
  };
}

function same(a: Rgb, b: Rgb): boolean {
  return toHex(a) === toHex(b);
}

function usable(c: Rgb | null): c is Rgb {
  return !!c && c.a >= 0.9 && c.r <= 255 && c.g <= 255 && c.b <= 255;
}

function safeFont(raw: string): string {
  const name = raw.replace(/["']/g, "").replace(/[^a-zA-Z0-9 \-]/g, "").trim();
  if (!name || name.length > 40) return NEUTRAL_SITE_THEME.font;
  return `"${name}", system-ui, -apple-system, "Segoe UI", sans-serif`;
}

function firstVar(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;}{]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

/** Read a brand palette out of a stylesheet. Returns null when the sheet has no brand color. */
export function themeFromCss(css: string): SiteTheme | null {
  const elementor = /--e-global-color-primary\s*:/i.test(css);
  const primary = parseColor(firstVar(css, "--e-global-color-primary"))
    ?? parseColor(firstVar(css, "--ast-global-color-0"))
    ?? parseColor(firstVar(css, "--wp--preset--color--primary"))
    ?? parseColor(firstVar(css, "--primary-color"))
    ?? parseColor(firstVar(css, "--primary"));
  if (!usable(primary)) return null;

  const secondary = parseColor(firstVar(css, "--e-global-color-secondary"))
    ?? parseColor(firstVar(css, "--ast-global-color-1"))
    ?? parseColor(firstVar(css, "--secondary"));
  const namedAccent = parseColor(firstVar(css, "--e-global-color-accent"))
    ?? parseColor(firstVar(css, "--accent"));
  const namedText = parseColor(firstVar(css, "--e-global-color-text"))
    ?? parseColor(firstVar(css, "--ast-global-color-3"));
  const fontRaw = firstVar(css, "--e-global-typography-text-font-family")
    || firstVar(css, "--e-global-typography-primary-font-family");

  const counts = new Map<string, { rgb: Rgb; n: number }>();
  for (const match of css.matchAll(/--e-global-color-[a-z0-9-]+\s*:\s*([^;}{]+)/gi)) {
    const rgb = parseColor(match[1]);
    if (!usable(rgb) || same(rgb, primary)) continue;
    const key = toHex(rgb);
    const row = counts.get(key) ?? { rgb, n: 0 };
    row.n += 1;
    counts.set(key, row);
  }

  const mid = [...counts.values()]
    .filter((row) => {
      const lum = luminance(row.rgb);
      return lum > 0.12 && lum < 0.55;
    })
    .sort((a, b) => b.n - a.n || Math.abs(luminance(a.rgb) - 0.32) - Math.abs(luminance(b.rgb) - 0.32));
  const accent = mid[0]?.rgb
    ?? (usable(namedAccent) && luminance(namedAccent) < 0.75 ? namedAccent : null)
    ?? (usable(secondary) && luminance(secondary) < 0.75 ? secondary : null)
    ?? primary;

  const lights = [...counts.values()]
    .filter((row) => {
      const lum = luminance(row.rgb);
      return lum > 0.9 && lum < 0.995;
    })
    .sort((a, b) => luminance(a.rgb) - luminance(b.rgb));
  const surface = lights[0]?.rgb
    ?? (usable(secondary) && luminance(secondary) > 0.7 ? mix(secondary, WHITE, 0.45) : mix(primary, WHITE, 0.92));

  const wash = usable(secondary) && luminance(secondary) > 0.45 ? secondary : mix(accent, WHITE, 0.72);
  const fallbackText = parseColor(NEUTRAL_SITE_THEME.text) ?? primary;
  const textRgb = usable(namedText) && luminance(namedText) < 0.45
    ? namedText
    : (luminance(primary) < 0.45 ? primary : fallbackText);

  return {
    primary: toHex(luminance(primary) < 0.45 ? primary : textRgb),
    secondary: toHex(wash),
    accent: toHex(accent),
    surface: toHex(surface),
    text: toHex(textRgb),
    muted: toHex(mix(textRgb, WHITE, 0.38)),
    font: safeFont(fontRaw),
    source: elementor ? "elementor" : "css-vars",
  };
}

async function fetchText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AIOS-SEO/1.0)",
      Accept: accept,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return "";
  return (await res.text()).slice(0, 400_000);
}

function sameSite(page: URL, asset: string): string | null {
  try {
    const url = new URL(asset, page);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname.replace(/^www\./, "") !== page.hostname.replace(/^www\./, "")) return null;
    return assertPublicUrl(url.toString());
  } catch {
    return null;
  }
}

export async function extractSiteTheme(rawUrl: string): Promise<SiteTheme> {
  try {
    const pageUrl = new URL(assertPublicUrl(rawUrl));
    const html = await fetchText(pageUrl.toString(), "text/html");
    if (!html) return NEUTRAL_SITE_THEME;

    const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const inlineTheme = themeFromCss(inline);
    if (inlineTheme) return inlineTheme;

    const hrefs = [...html.matchAll(/href=["']([^"']+\.css[^"']*)/gi)].map((m) => m[1]);
    const ranked = hrefs
      .map((href) => sameSite(pageUrl, href))
      .filter((href): href is string => !!href)
      .sort((a, b) => {
        const score = (href: string) => href.includes("/elementor/css/post-") ? 0 : href.includes("elementor") ? 1 : 2;
        return score(a) - score(b);
      });

    const seen = new Set<string>();
    let fetched = 0;
    for (const href of ranked) {
      const clean = href.split("?")[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      if (fetched >= 6) break;
      fetched += 1;
      const css = await fetchText(href, "text/css");
      const theme = css ? themeFromCss(css) : null;
      if (theme) return theme;
    }
    return NEUTRAL_SITE_THEME;
  } catch {
    return NEUTRAL_SITE_THEME;
  }
}
