import type { CreativeFormat, CreativeLayer } from "./types";
import {
  CREATIVE_VISUAL_STYLES,
  type CreativeVisualStyle,
  type CreativeVisualStyleId,
  visualStyleById,
} from "./visualStyles";

interface CopyParts {
  headline?: string;
  subline?: string;
  cta?: string;
}

interface Palette {
  plate: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
}

const PALETTES: Record<CreativeVisualStyleId, Palette> = {
  photoreal: { plate: "#0f172acc", text: "#ffffff", muted: "#e2e8f0", accent: "#0f766e", accentText: "#ffffff" },
  cinematic: { plate: "#020617d9", text: "#f8fafc", muted: "#cbd5e1", accent: "#d97706", accentText: "#111827" },
  animation: { plate: "#1e1b4bd9", text: "#ffffff", muted: "#e0e7ff", accent: "#ea580c", accentText: "#ffffff" },
  illustration: { plate: "#fff7edd9", text: "#1c1917", muted: "#44403c", accent: "#c2410c", accentText: "#fff7ed" },
  popart: { plate: "#facc15e6", text: "#111827", muted: "#1f2937", accent: "#dc2626", accentText: "#ffffff" },
  render3d: { plate: "#18181bd9", text: "#f8fafc", muted: "#d4d4d8", accent: "#0284c7", accentText: "#ffffff" },
  editorial: { plate: "#fffffff2", text: "#111827", muted: "#3f3f46", accent: "#111827", accentText: "#ffffff" },
  ugc: { plate: "#00000099", text: "#ffffff", muted: "#f4f4f5", accent: "#ffffff", accentText: "#111827" },
  watercolor: { plate: "#fffcf5d9", text: "#3f2e1f", muted: "#57534e", accent: "#9a3412", accentText: "#fff7ed" },
  comic: { plate: "#fef08ae6", text: "#111827", muted: "#1f2937", accent: "#111827", accentText: "#fef08a" },
};

const cleanLine = (line: string) =>
  line.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^[-*]\s*/, "").trim();

export const parseCreativeCopy = (copyText: string, fallbackTitle?: string): CopyParts => {
  const lines = copyText.split("\n").map(cleanLine).filter(Boolean);
  if (lines.length === 0) {
    const headline = fallbackTitle?.trim();
    return headline ? { headline: headline.slice(0, 72) } : {};
  }
  const headline = lines[0].slice(0, 72);
  const last = lines.length > 1 ? lines[lines.length - 1] : undefined;
  const cta = last && last !== headline && (
    (lines.length >= 3 && last.length <= 36) ||
    (lines.length === 2 && last.length <= 18)
  ) ? last : undefined;
  const middle = lines.slice(1, cta ? -1 : lines.length);
  const subSource = middle[0];
  return {
    headline,
    subline: subSource && subSource !== cta ? subSource.slice(0, 140) : undefined,
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
  if (!parts.headline && !parts.subline && !parts.cta) return [];

  const palette = PALETTES[styleId] ?? PALETTES.photoreal;
  const wide = format === "16:9";
  const story = format === "9:16" || format === "4:5";
  const plate = wide
    ? { x: 54, y: 16, width: 40, height: 68 }
    : story
      ? { x: 6, y: 58, width: 88, height: 36 }
      : { x: 6, y: 60, width: 88, height: 34 };
  const textX = plate.x + 4;
  const textW = plate.width - 8;

  const layers: CreativeLayer[] = [
    layer({
      type: "shape",
      ...plate,
      fill: palette.plate,
      borderRadius: wide ? 28 : 24,
    }),
  ];

  if (parts.headline) {
    layers.push(layer({
      type: "text",
      x: textX,
      y: plate.y + 3,
      width: textW,
      height: story ? 14 : 16,
      text: parts.headline,
      fontFamily: "Rubik",
      fontSize: story ? 34 : 30,
      fontWeight: "700",
      color: palette.text,
      textAlign: "right",
    }));
  }

  if (parts.subline) {
    layers.push(layer({
      type: "text",
      x: textX,
      y: plate.y + (story ? 18 : 20),
      width: textW,
      height: 10,
      text: parts.subline,
      fontFamily: "Rubik",
      fontSize: 16,
      fontWeight: "500",
      color: palette.muted,
      textAlign: "right",
    }));
  }

  if (parts.cta) {
    const ctaY = plate.y + plate.height - 10;
    const ctaW = Math.min(42, textW);
    const ctaX = plate.x + plate.width - ctaW - 4;
    layers.push(layer({
      type: "shape",
      x: ctaX,
      y: ctaY,
      width: ctaW,
      height: 7,
      fill: palette.accent,
      borderRadius: 999,
    }));
    layers.push(layer({
      type: "text",
      x: ctaX,
      y: ctaY + 0.6,
      width: ctaW,
      height: 6,
      text: parts.cta,
      fontFamily: "Rubik",
      fontSize: 14,
      fontWeight: "700",
      color: palette.accentText,
      textAlign: "center",
    }));
  }

  return layers;
};

export const styleLabelForId = (styleId?: CreativeVisualStyleId) =>
  styleId ? visualStyleById(styleId).label : undefined;
