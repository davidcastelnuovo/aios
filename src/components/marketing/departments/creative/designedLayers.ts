import type { CreativeFormat, CreativeLayer } from "./types";
import {
  CREATIVE_VISUAL_STYLES,
  type CreativeVisualStyle,
  type CreativeVisualStyleId,
  visualStyleById,
} from "./visualStyles";

interface CopyParts {
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
  photoreal: { headline: "#ffffff", extrude: "#1e3a8a", body: "#0f172a", pill: "#1d4ed8", pillText: "#ffffff", cta: "#1d4ed8", ctaText: "#ffffff" },
  cinematic: { headline: "#f8fafc", extrude: "#0f172a", body: "#e2e8f0", pill: "#d97706", pillText: "#111827", cta: "#f8fafc", ctaText: "#0f172a" },
  animation: { headline: "#ffffff", extrude: "#312e81", body: "#1e1b4b", pill: "#ea580c", pillText: "#ffffff", cta: "#ea580c", ctaText: "#ffffff" },
  illustration: { headline: "#fffbeb", extrude: "#9a3412", body: "#1c1917", pill: "#c2410c", pillText: "#fff7ed", cta: "#1c1917", ctaText: "#fff7ed" },
  popart: { headline: "#fef08a", extrude: "#1d4ed8", body: "#111827", pill: "#dc2626", pillText: "#ffffff", cta: "#111827", ctaText: "#facc15" },
  render3d: { headline: "#ffffff", extrude: "#0c4a6e", body: "#e2e8f0", pill: "#0284c7", pillText: "#ffffff", cta: "#0284c7", ctaText: "#ffffff" },
  editorial: { headline: "#ffffff", extrude: "#111827", body: "#111827", pill: "#111827", pillText: "#ffffff", cta: "#111827", ctaText: "#ffffff" },
  ugc: { headline: "#ffffff", extrude: "#334155", body: "#ffffff", pill: "#ffffff", pillText: "#111827", cta: "#ffffff", ctaText: "#111827" },
  watercolor: { headline: "#fff7ed", extrude: "#7c2d12", body: "#3f2e1f", pill: "#9a3412", pillText: "#fff7ed", cta: "#7c2d12", ctaText: "#fff7ed" },
  comic: { headline: "#fef08a", extrude: "#111827", body: "#111827", pill: "#111827", pillText: "#fef08a", cta: "#111827", ctaText: "#fef08a" },
};

const cleanLine = (line: string) =>
  line.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^[-*]\s*/, "").trim();

export const parseCreativeCopy = (copyText: string, fallbackTitle?: string): CopyParts => {
  const lines = copyText.split("\n").map(cleanLine).filter(Boolean);
  if (lines.length === 0) {
    const headline = fallbackTitle?.trim();
    return headline ? { headline: headline.slice(0, 28) } : {};
  }
  const headline = lines[0].slice(0, 28);
  const last = lines.length > 1 ? lines[lines.length - 1] : undefined;
  const cta = last && last !== headline && (
    (lines.length >= 3 && last.length <= 36) ||
    (lines.length === 2 && last.length <= 18)
  ) ? last : undefined;
  const middle = lines.slice(1, cta ? -1 : lines.length);
  return {
    headline,
    offer: middle[0] && middle[0] !== cta ? middle[0].slice(0, 42) : undefined,
    body: middle[1] && middle[1] !== cta ? middle[1].slice(0, 80) : undefined,
    cta,
  };
};

export const pickNextVariationStyle = (used: CreativeVisualStyleId[]): CreativeVisualStyle => {
  const unused = CREATIVE_VISUAL_STYLES.filter((style) => !used.includes(style.id));
  const last = used[used.length - 1];
  const pool = unused.length > 0
    ? unused
    : CREATIVE_VISUAL_STYLES.filter((style) => style.id !== last);
  return pool[Math.floor(Math.random() * Math.max(pool.length, 1))] ?? CREATIVE_VISUAL_STYLES[0];
};

const layer = (partial: Omit<CreativeLayer, "id">): CreativeLayer => ({
  id: crypto.randomUUID(),
  ...partial,
});

const extrudeShadow = (color: string, depth = 7) => {
  const steps = Array.from({ length: depth }, (_, index) => {
    const offset = index + 1;
    return `${offset}px ${offset}px 0 ${color}`;
  });
  steps.push(`${depth + 2}px ${depth + 10}px 22px rgba(15,23,42,0.28)`);
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
  if (!parts.headline && !parts.offer && !parts.body && !parts.cta) return [];

  const palette = PALETTES[styleId] ?? PALETTES.photoreal;
  const wide = format === "16:9";
  const story = format === "9:16" || format === "4:5";
  const shortHero = (parts.headline?.length ?? 0) <= 12;
  const layers: CreativeLayer[] = [];

  if (parts.headline) {
    layers.push(layer({
      type: "text",
      x: wide ? 8 : 6,
      y: wide ? 28 : story ? 36 : 34,
      width: wide ? 48 : 88,
      height: shortHero ? (story ? 16 : 14) : 12,
      text: parts.headline,
      fontFamily: "Rubik",
      fontSize: shortHero ? (story ? 80 : 64) : story ? 42 : 36,
      fontWeight: "800",
      color: palette.headline,
      textAlign: "center",
      letterSpacing: "-0.03em",
      textShadow: extrudeShadow(palette.extrude),
    }));
  }

  if (parts.offer) {
    const pill = wide
      ? { x: 10, y: 52, width: 44, height: 8 }
      : { x: 16, y: story ? 56 : 54, width: 68, height: 8 };
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
      y: pill.y + 1.2,
      width: pill.width,
      height: 6,
      text: parts.offer,
      fontFamily: "Rubik",
      fontSize: 16,
      fontWeight: "700",
      color: palette.pillText,
      textAlign: "center",
    }));
  }

  if (parts.body) {
    layers.push(layer({
      type: "text",
      x: wide ? 8 : 10,
      y: wide ? 64 : story ? 67 : 65,
      width: wide ? 48 : 80,
      height: 8,
      text: parts.body,
      fontFamily: "Rubik",
      fontSize: 15,
      fontWeight: "600",
      color: palette.body,
      textAlign: "center",
    }));
  }

  if (parts.cta) {
    const cta = wide
      ? { x: 12, y: 78, width: 40, height: 10 }
      : { x: 18, y: story ? 82 : 80, width: 64, height: 10 };
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
      y: cta.y + 2,
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

export const styleLabelForId = (styleId?: CreativeVisualStyleId) =>
  styleId ? visualStyleById(styleId).label : undefined;
