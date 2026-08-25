import type { CreativeFormat, CreativeLayer } from "./types";
import { withLayerShadow } from "./layerShadow";

/** Bannerbear/Polotno-style named slots for the Promo lead-gen board. */
export const OFFER_BOARD_SLOTS = {
  typeField: { x: 0, y: 0, width: 54, height: 68 },
  headline: { x: 5, y: 12, width: 46, height: 22 },
  sub: { x: 5, y: 35, width: 46, height: 10 },
  bullet: { x: 5, y: 46, width: 46, height: 5.2 },
  footer: { x: 0, y: 68, width: 100, height: 32 },
  footerTitle: { x: 8, y: 69.5, width: 84, height: 5 },
  icon: { y: 75.5, width: 7, height: 7, gutter: 25 },
  iconLabel: { y: 83.2, width: 22, height: 5.5 },
  ctaFill: { x: 18, y: 90, width: 64, height: 7 },
  logo: { x: 4, y: 3, width: 22, height: 8 },
} as const;

export const OFFER_ICON_NAMES = [
  "search",
  "file-search",
  "clipboard-list",
  "shield",
  "sparkles",
  "message-circle",
  "phone",
  "badge-check",
] as const;

export type OfferIconName = (typeof OFFER_ICON_NAMES)[number];

export interface OfferPalette {
  headline: string;
  body: string;
  pill: string;
  pillText: string;
  cta: string;
  ctaText: string;
  band: string;
  extrude: string;
}

const layer = (partial: Omit<CreativeLayer, "id">): CreativeLayer => ({
  id: crypto.randomUUID(),
  ...partial,
});

/** Character-per-line fit used by Canva-class editors before measureText. */
export const fitFontSize = (text: string, boxWidthPct: number, maxPx: number, minPx: number): number => {
  const longest = Math.max(...text.split("\n").map((line) => line.length), 1);
  const pxPerChar = ((boxWidthPct / 100) * 1080) / longest;
  return Math.round(Math.min(maxPx, Math.max(minPx, pxPerChar * 0.9)));
};

export const parseOfferBullets = (copyText: string): string[] => {
  const fromMarks = copyText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*•✓]/.test(line))
    .map((line) => line.replace(/^[-*•✓]+\s*/, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 42);
  if (fromMarks.length > 0) return fromMarks.slice(0, 4);
  return [];
};

const iconX = (index: number, count: number) => {
  const slot = OFFER_BOARD_SLOTS.icon;
  const span = slot.gutter;
  const start = (100 - span * (count - 1) - slot.width) / 2;
  return start + index * span;
};

export const buildOfferBoardLayers = ({
  headline,
  sub,
  bullets,
  cta,
  footerTitle,
  palette,
  logoUrl,
  format,
}: {
  headline?: string;
  sub?: string;
  bullets?: string[];
  cta?: string;
  footerTitle?: string;
  palette: OfferPalette;
  logoUrl?: string;
  format: CreativeFormat;
}): CreativeLayer[] => {
  const story = format === "9:16" || format === "4:5";
  const marks = (bullets ?? []).filter(Boolean).slice(0, 4);
  const icons = marks.length > 0 ? marks : ["חיפוש AI", "בדיקת אתר", "אסטרטגיה", "אבטחה"];
  const layers: CreativeLayer[] = [];

  layers.push(layer({
    type: "shape",
    role: "type_field",
    ...OFFER_BOARD_SLOTS.typeField,
    fill: "#fffffff2",
  }));

  if (headline) {
    const wrapped = headline.length > 22 ? headline.replace(/\s+/, "\n") : headline;
    layers.push(layer({
      type: "text",
      role: "headline",
      ...OFFER_BOARD_SLOTS.headline,
      text: wrapped,
      fontFamily: "Heebo",
      fontSize: fitFontSize(wrapped, OFFER_BOARD_SLOTS.headline.width, story ? 48 : 40, 22),
      fontWeight: "900",
      color: "#111111",
      textAlign: "right",
      letterSpacing: "-0.04em",
      lineHeight: 0.95,
      ...withLayerShadow({ shadowStyle: "none" }),
    }));
  }

  if (sub) {
    layers.push(layer({
      type: "text",
      role: "sub",
      ...OFFER_BOARD_SLOTS.sub,
      text: sub,
      fontFamily: "Heebo",
      fontSize: fitFontSize(sub, OFFER_BOARD_SLOTS.sub.width, 18, 13),
      fontWeight: "600",
      color: "#1f2937",
      textAlign: "right",
      lineHeight: 1.15,
    }));
  }

  marks.slice(0, 3).forEach((item, index) => {
    const y = OFFER_BOARD_SLOTS.bullet.y + index * 6;
    layers.push(layer({
      type: "shape",
      role: "icon",
      icon: "badge-check",
      x: 46.5,
      y: y + 0.4,
      width: 3.6,
      height: 3.6,
      fill: palette.cta,
      borderRadius: 999,
    }));
    layers.push(layer({
      type: "text",
      role: "bullet",
      x: 5,
      y,
      width: 40.5,
      height: 5.2,
      text: item,
      fontFamily: "Heebo",
      fontSize: 14,
      fontWeight: "600",
      color: "#111111",
      textAlign: "right",
      lineHeight: 1.1,
    }));
  });

  layers.push(layer({
    type: "shape",
    role: "footer",
    ...OFFER_BOARD_SLOTS.footer,
    fill: palette.band.startsWith("#") && palette.band.length >= 7 ? palette.band.slice(0, 7) : "#111111",
  }));

  if (footerTitle) {
    layers.push(layer({
      type: "text",
      role: "sub",
      ...OFFER_BOARD_SLOTS.footerTitle,
      text: footerTitle,
      fontFamily: "Heebo",
      fontSize: 14,
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "center",
    }));
  }

  const count = Math.min(4, Math.max(icons.length, 3));
  const row = icons.slice(0, count);
  row.forEach((label, index) => {
    const x = iconX(index, row.length);
    layers.push(layer({
      type: "shape",
      role: "icon",
      icon: OFFER_ICON_NAMES[index % OFFER_ICON_NAMES.length],
      x,
      y: OFFER_BOARD_SLOTS.icon.y,
      width: OFFER_BOARD_SLOTS.icon.width,
      height: OFFER_BOARD_SLOTS.icon.height,
      fill: "transparent",
      color: palette.cta,
      borderRadius: 999,
    }));
    layers.push(layer({
      type: "text",
      role: "icon_label",
      x: x - (OFFER_BOARD_SLOTS.iconLabel.width - OFFER_BOARD_SLOTS.icon.width) / 2,
      y: OFFER_BOARD_SLOTS.iconLabel.y,
      width: OFFER_BOARD_SLOTS.iconLabel.width,
      height: OFFER_BOARD_SLOTS.iconLabel.height,
      text: label,
      fontFamily: "Heebo",
      fontSize: 11,
      fontWeight: "600",
      color: "#ffffff",
      textAlign: "center",
      lineHeight: 1.15,
    }));
  });

  const ctaText = cta || "השאירו פרטים";
  layers.push(layer({
    type: "shape",
    role: "cta_fill",
    ...OFFER_BOARD_SLOTS.ctaFill,
    fill: palette.cta,
    borderRadius: 999,
    boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
  }));
  layers.push(layer({
    type: "text",
    role: "cta",
    x: OFFER_BOARD_SLOTS.ctaFill.x,
    y: OFFER_BOARD_SLOTS.ctaFill.y + 1,
    width: OFFER_BOARD_SLOTS.ctaFill.width,
    height: 5.2,
    text: ctaText,
    fontFamily: "Heebo",
    fontSize: fitFontSize(ctaText, OFFER_BOARD_SLOTS.ctaFill.width, 16, 12),
    fontWeight: "800",
    color: palette.ctaText,
    textAlign: "center",
    ...withLayerShadow({ shadowStyle: "none" }),
  }));

  if (logoUrl) {
    layers.push(layer({
      type: "image",
      role: "logo",
      src: logoUrl,
      ...OFFER_BOARD_SLOTS.logo,
    }));
  }

  return layers;
};
