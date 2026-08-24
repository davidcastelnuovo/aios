import type { CreativeFormat, CreativeLayer, CreativeVariation } from "./types";
import {
  CREATIVE_VISUAL_STYLES,
  stylesInGroup,
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
}

const PALETTES: Record<CreativeVisualStyleId, Palette> = {
  swiss: { headline: "#1e3a8a", extrude: "#93c5fd", body: "#1e3a8a", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff" },
  industrial: { headline: "#facc15", extrude: "#1a1a1a", body: "#fde68a", pill: "#eab308", pillText: "#111827", cta: "#eab308", ctaText: "#111827" },
  mediterranean: { headline: "#1e3a5f", extrude: "#d6c4a8", body: "#3f3a32", pill: "#c4a574", pillText: "#1c1917", cta: "#1e3a5f", ctaText: "#fffbeb" },
  kinetic: { headline: "#fb923c", extrude: "#4c1d95", body: "#fed7aa", pill: "#f97316", pillText: "#ffffff", cta: "#f97316", ctaText: "#ffffff" },
  glass: { headline: "#e0f2fe", extrude: "#0e7490", body: "#e0f2fe", pill: "#22d3ee", pillText: "#082f49", cta: "#22d3ee", ctaText: "#082f49" },
  collage: { headline: "#1e3a8a", extrude: "#fecaca", body: "#1f2937", pill: "#dc2626", pillText: "#ffffff", cta: "#1e3a8a", ctaText: "#ffffff" },
  bauhaus: { headline: "#111827", extrude: "#facc15", body: "#111827", pill: "#2563eb", pillText: "#ffffff", cta: "#2563eb", ctaText: "#ffffff" },
  cinematic: { headline: "#f8fafc", extrude: "#0f172a", body: "#e2e8f0", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff" },
  holographic: { headline: "#ffffff", extrude: "#db2777", body: "#ffffff", pill: "#ffffff", pillText: "#111827", cta: "#ffffff", ctaText: "#111827" },
  organic: { headline: "#fff7ed", extrude: "#3f3a32", body: "#fff7ed", pill: "#4d7c0f", pillText: "#fffbeb", cta: "#1d4ed8", ctaText: "#ffffff" },
  photoreal: { headline: "#ffffff", extrude: "#1e3a8a", body: "#f8fafc", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff" },
  animation: { headline: "#ffffff", extrude: "#312e81", body: "#fff7ed", pill: "#ea580c", pillText: "#ffffff", cta: "#ea580c", ctaText: "#ffffff" },
  illustration: { headline: "#fffbeb", extrude: "#9a3412", body: "#1c1917", pill: "#c2410c", pillText: "#fff7ed", cta: "#1c1917", ctaText: "#fff7ed" },
  popart: { headline: "#fef08a", extrude: "#1d4ed8", body: "#111827", pill: "#dc2626", pillText: "#ffffff", cta: "#111827", ctaText: "#facc15" },
  render3d: { headline: "#ffffff", extrude: "#0c4a6e", body: "#e2e8f0", pill: "#0284c7", pillText: "#ffffff", cta: "#0284c7", ctaText: "#ffffff" },
  editorial: { headline: "#ffffff", extrude: "#111827", body: "#ffffff", pill: "#111827", pillText: "#ffffff", cta: "#111827", ctaText: "#ffffff" },
  ugc: { headline: "#ffffff", extrude: "#334155", body: "#ffffff", pill: "#ffffff", pillText: "#111827", cta: "#ffffff", ctaText: "#111827" },
  watercolor: { headline: "#fff7ed", extrude: "#7c2d12", body: "#fff7ed", pill: "#9a3412", pillText: "#fff7ed", cta: "#7c2d12", ctaText: "#fff7ed" },
  comic: { headline: "#fef08a", extrude: "#111827", body: "#111827", pill: "#111827", pillText: "#fef08a", cta: "#111827", ctaText: "#fef08a" },
};

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
    cta: clip(parts.cta, 36),
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
    return "a premium cinematic commercial world — destination, product, or flagship brand moment in a real environment";
  }
  return unique.join(". ");
};

export const isLegacyCaptionPlate = (layer: CreativeLayer): boolean =>
  layer.type === "shape" && layer.y >= 52 && layer.height >= 18 && layer.width >= 70;

export const shouldRebuildDesignedLayers = (layers: CreativeLayer[]): boolean =>
  layers.some((layer) => (typeof layer.text === "string" && isInternalCopyLine(layer.text)) || isLegacyCaptionPlate(layer));

export const pickNextVariationStyle = (used: CreativeVisualStyleId[]): CreativeVisualStyle => {
  const unusedReference = stylesInGroup("reference").filter((item) => !used.includes(item.id));
  if (unusedReference.length > 0) {
    return unusedReference[Math.floor(Math.random() * unusedReference.length)];
  }
  const unused = CREATIVE_VISUAL_STYLES.filter((item) => !used.includes(item.id));
  const last = used[used.length - 1];
  const pool = unused.length > 0
    ? unused
    : CREATIVE_VISUAL_STYLES.filter((item) => item.id !== last);
  return pool[Math.floor(Math.random() * Math.max(pool.length, 1))] ?? CREATIVE_VISUAL_STYLES[0];
};

const layer = (partial: Omit<CreativeLayer, "id">): CreativeLayer => ({
  id: crypto.randomUUID(),
  ...partial,
});

const extrudeShadow = (color: string, depth = 12) => {
  const steps = Array.from({ length: depth }, (_, index) => {
    const offset = index + 1;
    return `${offset}px ${offset}px 0 ${color}`;
  });
  steps.unshift("0 1px 0 rgba(255,255,255,0.35)");
  steps.push(`${depth + 4}px ${depth + 14}px 30px rgba(15,23,42,0.38)`);
  return steps.join(", ");
};

export const buildDesignedCopyLayers = ({
  copyText,
  format,
  styleId,
  title,
}: {
  copyText?: string;
  format: CreativeFormat;
  styleId: CreativeVisualStyleId;
  title?: string;
}): CreativeLayer[] => {
  const parts = parseCreativeCopy(copyText ?? "", title);
  const hero = heroWord(parts.headline);
  if (!hero && !parts.offer && !parts.body && !parts.cta) return [];

  const palette = PALETTES[styleId] ?? PALETTES.swiss;
  const wide = format === "16:9";
  const story = format === "9:16" || format === "4:5";
  const shortHero = (hero?.length ?? 0) <= 12;
  const layers: CreativeLayer[] = [];

  if (hero) {
    layers.push(layer({
      type: "text",
      x: wide ? 6 : 5,
      y: wide ? 24 : story ? 30 : 28,
      width: wide ? 52 : 90,
      height: shortHero ? (story ? 18 : 16) : 12,
      text: hero,
      fontFamily: "Rubik",
      fontSize: shortHero ? (story ? 88 : 72) : story ? 44 : 38,
      fontWeight: "800",
      color: palette.headline,
      textAlign: "center",
      letterSpacing: "-0.04em",
      textShadow: extrudeShadow(palette.extrude),
    }));
  }

  const offer = parts.offer && parts.offer !== hero ? parts.offer : undefined;
  if (offer) {
    const pill = wide
      ? { x: 10, y: 50, width: 40, height: 7 }
      : { x: 18, y: story ? 54 : 52, width: 64, height: 7 };
    layers.push(layer({
      type: "shape",
      ...pill,
      fill: palette.pill,
      borderRadius: 999,
      boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
    }));
    layers.push(layer({
      type: "text",
      x: pill.x,
      y: pill.y + 0.8,
      width: pill.width,
      height: 5.4,
      text: offer,
      fontFamily: "Rubik",
      fontSize: 15,
      fontWeight: "700",
      color: palette.pillText,
      textAlign: "center",
    }));
  }

  const body = parts.body && parts.body !== hero && parts.body !== offer ? parts.body : undefined;
  if (body && !offer) {
    layers.push(layer({
      type: "text",
      x: wide ? 8 : 10,
      y: wide ? 58 : story ? 62 : 60,
      width: wide ? 46 : 80,
      height: 7,
      text: body,
      fontFamily: "Rubik",
      fontSize: 16,
      fontWeight: "600",
      color: palette.body,
      textAlign: "center",
      textShadow: "0 2px 16px rgba(0,0,0,0.45)",
    }));
  }

  if (parts.cta) {
    const cta = wide
      ? { x: 12, y: 78, width: 36, height: 9 }
      : { x: 22, y: story ? 82 : 80, width: 56, height: 9 };
    layers.push(layer({
      type: "shape",
      ...cta,
      fill: palette.cta,
      borderRadius: 18,
      boxShadow: "0 14px 30px rgba(29,78,216,0.28)",
    }));
    layers.push(layer({
      type: "text",
      x: cta.x,
      y: cta.y + 1.6,
      width: cta.width,
      height: 6,
      text: parts.cta,
      fontFamily: "Rubik",
      fontSize: 16,
      fontWeight: "700",
      color: palette.ctaText,
      textAlign: "center",
    }));
  }

  return layers;
};

export const hydrateVariationLayers = (
  variation: CreativeVariation,
  copyText: string,
  title?: string,
  styleId?: CreativeVisualStyleId,
): CreativeVariation => {
  if (!shouldRebuildDesignedLayers(variation.layers)) return { ...variation };
  return {
    ...variation,
    layers: buildDesignedCopyLayers({
      copyText,
      format: variation.format,
      styleId: variation.visualStyle ?? styleId ?? "swiss",
      title,
    }),
  };
};

export const styleLabelForId = (styleId?: CreativeVisualStyleId) =>
  styleId ? visualStyleById(styleId).label : undefined;
