import type { CreativeFormat, CreativeLayer, CreativeVariation } from "./types";
import { compositionById, pickCompositionId, type CompositionId } from "./compositions";
import { withLayerShadow } from "./layerShadow";
import {
  type CreativeVisualStyle,
  type CreativeVisualStyleId,
  visualStyleById,
} from "./visualStyles";

export interface CopyParts {
  headline?: string;
  offer?: string;
  body?: string;
  cta?: string;
}

interface Palette {
  headline: string;
  extrude: string;
  body: string;
  pill: string;
  pillText: string;
  cta: string;
  ctaText: string;
  band: string;
}

const PALETTES: Record<CreativeVisualStyleId, Palette> = {
  adaptive: { headline: "#111111", extrude: "#1f2937", body: "#111111", pill: "#111111", pillText: "#ffffff", cta: "#111111", ctaText: "#ffffff", band: "#111111e6" },
  swiss: { headline: "#1e3a8a", extrude: "#93c5fd", body: "#1e3a8a", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff", band: "#1e3a8af0" },
  industrial: { headline: "#facc15", extrude: "#1a1a1a", body: "#fde68a", pill: "#eab308", pillText: "#111827", cta: "#eab308", ctaText: "#111827", band: "#111111e6" },
  mediterranean: { headline: "#fffbeb", extrude: "#1e3a5f", body: "#fffbeb", pill: "#c4a574", pillText: "#1c1917", cta: "#1e3a5f", ctaText: "#fffbeb", band: "#1e3a5fe6" },
  kinetic: { headline: "#fb923c", extrude: "#4c1d95", body: "#fed7aa", pill: "#f97316", pillText: "#ffffff", cta: "#f97316", ctaText: "#ffffff", band: "#2e1065e6" },
  glass: { headline: "#e0f2fe", extrude: "#0e7490", body: "#e0f2fe", pill: "#22d3ee", pillText: "#082f49", cta: "#22d3ee", ctaText: "#082f49", band: "#082f49e6" },
  collage: { headline: "#111827", extrude: "#fecaca", body: "#1f2937", pill: "#dc2626", pillText: "#ffffff", cta: "#1e3a8a", ctaText: "#ffffff", band: "#f5f0e6e6" },
  bauhaus: { headline: "#111827", extrude: "#facc15", body: "#111827", pill: "#2563eb", pillText: "#ffffff", cta: "#2563eb", ctaText: "#ffffff", band: "#f5f0dce6" },
  cinematic: { headline: "#f8fafc", extrude: "#0f172a", body: "#e2e8f0", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff", band: "#0b1220e6" },
  holographic: { headline: "#ffffff", extrude: "#db2777", body: "#ffffff", pill: "#ffffff", pillText: "#111827", cta: "#ffffff", ctaText: "#111827", band: "#4a044ee6" },
  organic: { headline: "#fff7ed", extrude: "#3f3a32", body: "#fff7ed", pill: "#4d7c0f", pillText: "#fffbeb", cta: "#1d4ed8", ctaText: "#ffffff", band: "#3f3a32e6" },
  photoreal: { headline: "#ffffff", extrude: "#1e3a8a", body: "#f8fafc", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff", band: "#0f172ae6" },
  animation: { headline: "#ffffff", extrude: "#312e81", body: "#fff7ed", pill: "#ea580c", pillText: "#ffffff", cta: "#ea580c", ctaText: "#ffffff", band: "#1e1b4be6" },
  illustration: { headline: "#fffbeb", extrude: "#9a3412", body: "#1c1917", pill: "#c2410c", pillText: "#fff7ed", cta: "#1c1917", ctaText: "#fff7ed", band: "#7c2d12e6" },
  popart: { headline: "#fef08a", extrude: "#1d4ed8", body: "#111827", pill: "#dc2626", pillText: "#ffffff", cta: "#111827", ctaText: "#facc15", band: "#1d4ed8e6" },
  render3d: { headline: "#ffffff", extrude: "#0c4a6e", body: "#e2e8f0", pill: "#0284c7", pillText: "#ffffff", cta: "#0284c7", ctaText: "#ffffff", band: "#082f49e6" },
  editorial: { headline: "#ffffff", extrude: "#111827", body: "#ffffff", pill: "#111827", pillText: "#ffffff", cta: "#111827", ctaText: "#ffffff", band: "#111827e6" },
  ugc: { headline: "#ffffff", extrude: "#334155", body: "#ffffff", pill: "#ffffff", pillText: "#111827", cta: "#ffffff", ctaText: "#111827", band: "#111827cc" },
  watercolor: { headline: "#fff7ed", extrude: "#7c2d12", body: "#fff7ed", pill: "#9a3412", pillText: "#fff7ed", cta: "#7c2d12", ctaText: "#fff7ed", band: "#7c2d12e6" },
  comic: { headline: "#fef08a", extrude: "#111827", body: "#111827", pill: "#111827", pillText: "#fef08a", cta: "#111827", ctaText: "#fef08a", band: "#111827e6" },
};

const hexLuma = (hex: string) => {
  const value = hex.replace("#", "");
  if (value.length < 6) return 0.5;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const inkOn = (hex: string) => (hexLuma(hex) > 0.55 ? "#111111" : "#ffffff");

const normalizeHex = (value: string) => {
  const hex = value.trim();
  const raw = hex.startsWith("#") ? hex : `#${hex}`;
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : undefined;
};

export const applyBrandPalette = (base: Palette, colors?: string[]): Palette => {
  const cleaned = (colors ?? []).map(normalizeHex).filter((item): item is string => !!item);
  if (cleaned.length === 0) return base;
  const sorted = [...cleaned].sort((left, right) => hexLuma(left) - hexLuma(right));
  const dark = sorted[0];
  const light = sorted[sorted.length - 1];
  const accent = cleaned.find((item) => item !== dark && item !== light) ?? cleaned[1] ?? cleaned[0];
  return {
    headline: hexLuma(dark) < 0.35 ? light : dark,
    extrude: dark,
    body: hexLuma(dark) < 0.35 ? light : dark,
    pill: accent,
    pillText: inkOn(accent),
    cta: accent,
    ctaText: inkOn(accent),
    band: `${dark}e6`,
  };
};

const FAT_DISPLAY_STYLES = new Set<CreativeVisualStyleId>([
  "adaptive", "industrial", "kinetic", "cinematic", "collage", "organic", "mediterranean",
  "popart", "comic", "render3d", "editorial", "photoreal", "ugc",
]);

const displayType = (styleId: CreativeVisualStyleId) =>
  FAT_DISPLAY_STYLES.has(styleId)
    ? { fontFamily: "Suez One", fontWeight: "400" }
    : { fontFamily: "Heebo", fontWeight: "900" };

const WEAK_ALONE = new Set([
  "המתחרים", "הצעה", "מבצע", "אנחנו", "לקוחות", "שירות", "מוצר", "קמפיין", "כותרת",
]);

const PUNCH_WORDS = /עכשיו|רק |טסים|בואו|תפסיקו|תחילו|הזדמנות|מחיר|לילה|חינם|בלעדי|מטורף|הוגן|סוף סוף|בלי /;

const LABEL_KEYS: Record<string, keyof CopyParts | "skip"> = {
  כותרת: "headline",
  "כותרת ראשית": "headline",
  headline: "headline",
  title: "headline",
  הצעה: "offer",
  "הצעת ערך": "offer",
  offer: "offer",
  גוף: "body",
  "גוף הפרסומת": "body",
  body: "body",
  cta: "cta",
  "קריאה לפעולה": "cta",
  "קריאת פעולה": "cta",
  רציונל: "skip",
  rationale: "skip",
  reference: "skip",
  רפרנס: "skip",
};

const STOP_WORDS = new Set([
  "את", "של", "עם", "על", "אל", "בין", "כל", "זה", "לא", "אם", "או", "גם", "רק", "כי",
  "יש", "אין", "מה", "איך", "the", "and", "for", "with",
]);

export const cleanLine = (line: string) =>
  line.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^[-*]\s*/, "").replace(/^["״']+|["״']+$/g, "").trim();

const normalizeKey = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export const isInternalCopyLine = (line: string): boolean => {
  const cleaned = cleanLine(line);
  if (!cleaned) return true;
  if (/^(כותרת|כותרת ראשית|הצעה|הצעת ערך|גוף|גוף הפרסומת|cta|קריאה לפעולה|קריאת פעולה|רציונל|rationale|רפרנס|reference|headline|title|offer|body)\s*:?\s*$/i.test(cleaned)) {
    return true;
  }
  if (/^וריאציה\s*\d+/i.test(cleaned) || /^variation\s*\d+/i.test(cleaned)) return true;
  if (/\b(AIDA|PAS|BAB|4Ps|4PS)\b/.test(cleaned) && /[—–\-]/.test(cleaned)) return true;
  if (/^(AIDA|PAS|BAB|4Ps|4PS)$/i.test(cleaned)) return true;
  return false;
};

const labeledField = (line: string): { key: keyof CopyParts | "skip"; value: string } | null => {
  const match = cleanLine(line).match(/^(.{2,24}?)\s*[:：]\s*(.*)$/);
  if (!match) return null;
  const key = LABEL_KEYS[normalizeKey(match[1])];
  if (!key) return null;
  return { key, value: match[2].trim() };
};

const clip = (value: string | undefined, max: number) => {
  if (!value) return undefined;
  const next = value.trim();
  if (!next || isInternalCopyLine(next)) return undefined;
  return next.slice(0, max);
};

export const parseCreativeCopy = (copyText: string, fallbackTitle?: string): CopyParts => {
  const parts: CopyParts = {};
  let pending: keyof CopyParts | "skip" | null = null;

  for (const raw of copyText.split("\n")) {
    const line = cleanLine(raw);
    if (!line) continue;

    const labeled = labeledField(line);
    if (labeled) {
      if (labeled.key === "skip") {
        pending = null;
        continue;
      }
      if (labeled.value && !isInternalCopyLine(labeled.value)) {
        parts[labeled.key] ??= labeled.value;
        pending = null;
      } else {
        pending = labeled.key;
      }
      continue;
    }

    if (isInternalCopyLine(line)) continue;

    if (pending && pending !== "skip") {
      parts[pending] ??= line;
      pending = null;
      continue;
    }
  }

  if (!parts.headline) {
    const firstReal = copyText
      .split("\n")
      .map(cleanLine)
      .find((line) => line && !isInternalCopyLine(line) && !labeledField(line));
    if (firstReal) parts.headline = firstReal;
  }

  const fallback = fallbackTitle?.trim();
  if (!parts.headline && fallback && !isInternalCopyLine(fallback)) {
    parts.headline = fallback;
  }

  if (parts.offer && parts.offer === parts.headline) delete parts.offer;
  if (parts.body && (parts.body === parts.headline || parts.body === parts.offer)) delete parts.body;
  if (parts.cta && (parts.cta === parts.headline || parts.cta === parts.offer)) delete parts.cta;

  return {
    headline: clip(parts.headline, 48),
    offer: clip(parts.offer, 42),
    body: clip(parts.body, 80),
    cta: clip(parts.cta, 48),
  };
};

export const heroWord = (headline?: string): string | undefined => {
  if (!headline) return undefined;
  const text = cleanLine(headline);
  if (!text || isInternalCopyLine(text)) return undefined;
  if (text.length <= 14) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const distinctive = words.find((word) => {
    const bare = word.replace(/[^\p{L}\p{N}]+/gu, "");
    return bare.length >= 3 && bare.length <= 12 && !STOP_WORDS.has(bare.toLowerCase());
  });
  if (distinctive && words.length > 2) return distinctive.replace(/[^\p{L}\p{N}₪$€]+/gu, "") || distinctive;
  const two = words.slice(0, 2).join(" ");
  return (two.length <= 16 ? two : words[0]).slice(0, 16);
};

const splitSentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?…])\s+|(?<=[。])/)
    .map(cleanLine)
    .filter((line) => line && !isInternalCopyLine(line));

export const punchScore = (value: string): number => {
  const text = cleanLine(value);
  if (!text || isInternalCopyLine(text)) return -100;
  const length = text.length;
  let score = 16;
  if (length >= 8 && length <= 28) score += 32;
  else if (length >= 6 && length <= 36) score += 20;
  else if (length <= 4) score -= 28;
  else if (length > 42) score -= 18;
  if (/\d/.test(text) || /[₪$€%]/.test(text)) score += 24;
  if (/[!?]/.test(text)) score += 6;
  if (PUNCH_WORDS.test(text)) score += 16;
  if (WEAK_ALONE.has(text)) score -= 42;
  if (text.split(/\s+/).length === 1 && length < 8) score -= 22;
  return score;
};

export const wrapPosterLine = (text: string, maxPerLine = 14): string => {
  if (text.length <= maxPerLine) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return text;
  let best = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    const right = words.slice(index).join(" ");
    const diff = Math.abs(left.length - right.length);
    if (left.length <= maxPerLine + 6 && right.length <= maxPerLine + 8 && diff < bestDiff) {
      bestDiff = diff;
      best = index;
    }
  }
  return `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
};

export const strongestLine = (copyText: string, fallbackTitle?: string): string | undefined => {
  const parts = parseCreativeCopy(copyText, fallbackTitle);
  const candidates = [parts.headline, parts.offer, parts.body]
    .filter((item): item is string => !!item)
    .flatMap(splitSentences);
  if (candidates.length === 0) return undefined;
  const ranked = [...candidates].sort((left, right) => punchScore(right) - punchScore(left));
  return clip(ranked[0], 40);
};

const posterFontSize = (text: string, story: boolean) => {
  const longest = Math.max(...text.split("\n").map((line) => line.length), 1);
  if (longest <= 6) return story ? 76 : 66;
  if (longest <= 10) return story ? 60 : 52;
  if (longest <= 16) return story ? 46 : 40;
  if (longest <= 22) return story ? 36 : 32;
  return story ? 30 : 28;
};

const flattenLayerText = (value?: string) => (value ?? "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();

export const buildCampaignVisualBrief = ({
  copyText,
  title,
  brief,
  instructions,
}: {
  copyText?: string;
  title?: string;
  brief?: string;
  instructions?: string;
}): string => {
  const parts = parseCreativeCopy(copyText ?? "");
  const bits = [
    parts.headline,
    parts.offer,
    parts.body,
    brief?.trim(),
    instructions?.trim(),
    title && !isInternalCopyLine(title) ? title : undefined,
  ].filter((bit): bit is string => !!bit && !isInternalCopyLine(bit));

  const unique = [...new Set(bits.map((bit) => bit.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return "the specific situation described in this variation's copy — not a generic destination or product catalog";
  }
  return unique.join(". ");
};

const ANGLE_LINE = /^(?:וריאציה|variation)\s*\d+\s*[—–\-|:•·]\s*(.+)$/i;

const sanitizeCopyAngle = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const angle = raw
    .replace(/\b(AIDA|PAS|BAB|4Ps|4PS|framework)\b/gi, "")
    .replace(/[—–\-•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return angle && !isInternalCopyLine(angle) ? angle : undefined;
};

export const extractCopyAngle = (copyText?: string, copyLabel?: string): string | undefined => {
  const firstCopyLine = copyText?.split("\n").map((line) => line.trim()).find(Boolean);
  for (const source of [firstCopyLine, copyLabel]) {
    if (!source) continue;
    const header = source.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^[-*]\s*/, "").trim();
    const match = header.match(ANGLE_LINE);
    const angle = sanitizeCopyAngle(match?.[1] ?? (copyLabel && source === copyLabel ? source : undefined));
    if (angle) return angle;
  }
  return sanitizeCopyAngle(copyLabel);
};

export const buildCopySceneBrief = ({
  copyText,
  title,
  brief,
  instructions,
  copyLabel,
  angle: explicitAngle,
}: {
  copyText?: string;
  title?: string;
  brief?: string;
  instructions?: string;
  copyLabel?: string;
  angle?: string;
}): string => {
  const parts = parseCreativeCopy(copyText ?? "", title);
  const strong = strongestLine(copyText ?? "", title);
  const angle = sanitizeCopyAngle(explicitAngle) || extractCopyAngle(copyText, copyLabel);
  const idea = strong || parts.headline || parts.body;
  const lines = [
    "IRON RULE — SUBJECT FIRST. Style may change light, material and crop. It may NOT change what the ad is about.",
    idea && `STAGE THIS IDEA as a silent picture (people, objects, light — no letters). COPY CONTEXT — meaning only, NEVER draw these characters: «${idea}»`,
    angle && `This variation's angle (meaning only, do not paint it): ${angle}. A stranger must see this specific idea — not a prettier default from the style board.`,
    parts.headline && parts.headline !== idea && `Headline beat (do not paint): ${parts.headline}`,
    parts.offer && parts.offer !== idea && `Offer that must be visible as a situation, not as written type: ${parts.offer}`,
    parts.body && parts.body !== idea && `Story beat (do not paint): ${parts.body}`,
    brief?.trim() && `Campaign brief (supporting only — do not replace the variation idea): ${brief.trim().slice(0, 280)}`,
    instructions?.trim() && `Constraints: ${instructions.trim().slice(0, 180)}`,
    "Any Hebrew or English in this brief is context for the scene. Drawing it — or a gibberish stand-in — is a fail.",
    "The still fails if it is a pretty style-board that could belong to any other variation.",
    "Forbidden substitutions: Santorini, generic sea arch, airplane wing, suitcase, jet engine, random phone light-trails — unless the copy is actually about those things.",
  ].filter(Boolean);
  if (!idea) {
    lines.push("If copy is thin, invent a situation from the brief — never a default travel postcard.");
  }
  return lines.join("\n");
};

export const isLegacyCaptionPlate = (layer: CreativeLayer): boolean =>
  layer.type === "shape" && layer.y >= 58 && layer.height >= 18 && layer.height <= 36 && layer.width >= 70;

export const isLegacyHeadlineBand = (layer: CreativeLayer): boolean =>
  layer.type === "shape" && layer.y <= 1 && layer.x <= 1 && layer.width >= 90 && layer.height >= 12 && layer.height <= 36;

export const shouldRebuildDesignedLayers = (layers: CreativeLayer[], copyText?: string): boolean => {
  if (layers.some((layer) =>
    (typeof layer.text === "string" && isInternalCopyLine(layer.text))
    || isLegacyCaptionPlate(layer)
    || isLegacyHeadlineBand(layer)
  )) {
    return true;
  }
  if (!copyText) return false;
  const strong = strongestLine(copyText);
  if (!strong) return false;
  const strongText = flattenLayerText(strong);
  const poster = layers.find((layer) => {
    if (layer.type !== "text") return false;
    const text = flattenLayerText(layer.text);
    return !!text && (text === strongText || strongText.includes(text) || text.includes(strongText.slice(0, 12)));
  }) ?? layers.find((layer) => layer.type === "text" && layer.y <= 14);
  const posterText = flattenLayerText(poster?.text);
  if (!posterText) return true;
  if (strongText.includes(posterText) && posterText.length < strongText.length && posterText.length <= 14) return true;
  if ((poster?.fontSize ?? 0) < 34) return true;
  if ((poster?.fontFamily === "Rubik" || !poster?.fontFamily) && (poster?.fontSize ?? 0) <= 36) return true;
  return false;
};

export const pickNextVariationStyle = (_used: CreativeVisualStyleId[] = []): CreativeVisualStyle =>
  visualStyleById("adaptive");

const layer = (partial: Omit<CreativeLayer, "id">): CreativeLayer => ({
  id: crypto.randomUUID(),
  ...partial,
});

export const isLogoLayer = (layer: CreativeLayer) =>
  layer.type === "image" && (layer.role === "logo" || !layer.role);

export const makeLogoLayer = (
  logoUrl: string,
  slot: { x: number; y: number; width: number; height: number } = { x: 6, y: 86, width: 20, height: 9 },
): CreativeLayer => layer({
  type: "image",
  role: "logo",
  src: logoUrl,
  ...slot,
});

export const ensureLogoLayer = (
  layers: CreativeLayer[],
  logoUrl?: string,
  slot?: { x: number; y: number; width: number; height: number },
): CreativeLayer[] => {
  const withoutLogo = layers.filter((item) => !isLogoLayer(item));
  if (!logoUrl) return withoutLogo;
  const existing = layers.find(isLogoLayer);
  if (existing) {
    return [...withoutLogo, { ...existing, src: logoUrl, role: "logo", type: "image", ...(slot ?? {}) }];
  }
  return [...withoutLogo, makeLogoLayer(logoUrl, slot)];
};

export const buildDesignedCopyLayers = ({
  copyText,
  format,
  styleId,
  title,
  logoUrl,
  compositionId,
  brandColors,
}: {
  copyText?: string;
  format: CreativeFormat;
  styleId: CreativeVisualStyleId;
  title?: string;
  logoUrl?: string;
  compositionId?: CompositionId;
  brandColors?: string[];
}): CreativeLayer[] => {
  const parts = parseCreativeCopy(copyText ?? "", title);
  const poster = strongestLine(copyText ?? "", title);
  if (!poster && !parts.cta && !logoUrl) return [];

  const composition = compositionById(compositionId);
  const palette = applyBrandPalette(PALETTES[styleId] ?? PALETTES.swiss, brandColors);
  const typeface = displayType(styleId);
  const story = format === "9:16" || format === "4:5";
  const layers: CreativeLayer[] = [];

  if (poster && composition.field) {
    layers.push(layer({
      type: "shape",
      x: composition.field.x,
      y: composition.field.y,
      width: composition.field.width,
      height: composition.field.height,
      fill: palette.band,
      borderRadius: composition.field.radius,
      rotation: composition.field.rotation,
      boxShadow: composition.field.shadow ? "0 22px 48px rgba(15,23,42,0.28)" : undefined,
    }));
  }

  if (poster && composition.accent) {
    layers.push(layer({
      type: "shape",
      ...composition.accent,
      fill: palette.pill,
      borderRadius: composition.accent.radius,
      rotation: composition.accent.rotation,
    }));
  }

  if (poster) {
    const lockup = wrapPosterLine(poster, composition.type.width < 40 ? 10 : 14);
    const lines = lockup.split("\n").length;
    const fontSize = posterFontSize(lockup, story);
    layers.push(layer({
      type: "text",
      x: composition.type.x,
      y: composition.type.y,
      width: composition.type.width,
      height: composition.type.height,
      text: lockup,
      fontFamily: typeface.fontFamily,
      fontSize,
      fontWeight: typeface.fontWeight,
      color: palette.headline,
      textAlign: composition.type.align,
      letterSpacing: "-0.045em",
      lineHeight: 0.86,
      ...withLayerShadow(
        composition.id === "flush" || !composition.field
          ? {
            shadowStyle: "halo",
            shadowDepth: 4,
            shadowColor: hexLuma(palette.headline) < 0.5 ? "#fde7ee" : palette.extrude,
            shadowBlur: 18,
          }
          : {
            shadowStyle: "extrude",
            shadowDepth: lines >= 2 ? 6 : 9,
            shadowColor: palette.extrude,
            shadowBlur: 18,
          },
      ),
    }));
    if (composition.bar && composition.id !== "flush") {
      layers.push(layer({
        type: "shape",
        ...composition.bar,
        fill: palette.pill,
        borderRadius: 999,
      }));
    }
  }

  if (parts.cta && flattenLayerText(parts.cta) !== flattenLayerText(poster)) {
    const longCta = parts.cta.length > 22;
    if (composition.cta.pill) {
      layers.push(layer({
        type: "shape",
        x: composition.cta.x,
        y: composition.cta.y,
        width: composition.cta.width,
        height: composition.cta.height,
        fill: palette.cta,
        borderRadius: 999,
        boxShadow: "0 14px 30px rgba(15,23,42,0.28)",
      }));
    }
    layers.push(layer({
      type: "text",
      x: composition.cta.x,
      y: composition.cta.y + (composition.cta.pill ? 1.2 : 0),
      width: composition.cta.width,
      height: longCta ? 7 : 5.6,
      text: parts.cta,
      fontFamily: "Heebo",
      fontSize: longCta ? 14 : 16,
      fontWeight: "800",
      color: composition.cta.pill ? palette.ctaText : palette.headline,
      textAlign: composition.type.align === "center" ? "center" : "right",
      letterSpacing: "-0.02em",
      ...withLayerShadow({
        shadowStyle: composition.cta.pill ? "none" : "soft",
        shadowDepth: 4,
        shadowColor: palette.extrude,
        shadowBlur: 10,
      }),
    }));
  }

  return ensureLogoLayer(layers, logoUrl, composition.logo);
};

export const hydrateVariationLayers = (
  variation: CreativeVariation,
  copyText: string,
  title?: string,
  styleId?: CreativeVisualStyleId,
  logoUrl?: string,
  brandColors?: string[],
): CreativeVariation => {
  const compositionId = variation.compositionId ?? pickCompositionId(variation.id);
  const layers = shouldRebuildDesignedLayers(variation.layers, variation.copyText || copyText)
    ? buildDesignedCopyLayers({
      copyText: variation.copyText || copyText,
      format: variation.format,
      styleId: variation.visualStyle ?? styleId ?? "swiss",
      title,
      logoUrl,
      compositionId,
      brandColors,
    })
    : variation.layers;
  return {
    ...variation,
    compositionId,
    layers: ensureLogoLayer(layers, logoUrl),
  };
};

export const styleLabelForId = (styleId?: CreativeVisualStyleId) =>
  styleId ? visualStyleById(styleId).label : undefined;
