import type { CreativeFormat, CreativeLayer } from "./types";
import { withLayerShadow } from "./layerShadow";

/** Bannerbear/Polotno-style named slots for the Promo lead-gen board. */
export const OFFER_BOARD_SLOTS = {
  typeField: { x: 0, y: 0, width: 46, height: 64 },
  split: { x: 45.4, y: 0, width: 1.2, height: 64 },
  headline: { x: 4, y: 13, width: 40, height: 20 },
  sub: { x: 4, y: 34, width: 40, height: 8 },
  bullet: { x: 4, y: 43.5, width: 40, height: 5.4 },
  footer: { x: 0, y: 64, width: 100, height: 36 },
  footerTitle: { x: 8, y: 65.6, width: 84, height: 4.6 },
  icon: { y: 71.2, width: 8, height: 8, gutter: 24 },
  iconLabel: { y: 80, width: 22, height: 5.2 },
  ctaFill: { x: 22, y: 87.2, width: 56, height: 8.2 },
  logo: { x: 4, y: 3.2, width: 20, height: 8 },
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

export const DEFAULT_OFFER_MODULES: { icon: OfferIconName; label: string }[] = [
  { icon: "search", label: "חיפוש AI" },
  { icon: "file-search", label: "בדיקת אתר" },
  { icon: "clipboard-list", label: "אסטרטגיה" },
  { icon: "shield", label: "ליווי" },
];

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

export const wrapLines = (text: string, maxChars: number, maxLines = 3): string => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) current = next;
    else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) {
        const rest = [current, ...words.slice(words.indexOf(word) + 1)].join(" ");
        lines.push(rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest);
        return lines.slice(0, maxLines).join("\n");
      }
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
};

export const fitCta = (text: string, max = 26): string => {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 10 ? cut.slice(0, space) : cut).trim()}…`;
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

export const footerModules = (bullets: string[] = []) => {
  const usable = bullets.filter((item) => item.length >= 2 && item.length <= 16);
  if (usable.length < 2) return [];
  return usable.slice(0, 4).map((label, index) => ({
    icon: iconForLabel(label, index),
    label,
  }));
};

const iconForLabel = (label: string, index: number): OfferIconName => {
  const value = label.toLowerCase();
  if (/חיפוש|search|\bai\b|גוגל|צ['׳]אט/.test(value)) return "search";
  if (/אתר|audit|בדיק/.test(value)) return "file-search";
  if (/אסטרטג|תכנון|strategy/.test(value)) return "clipboard-list";
  if (/ליווי|support|הגנ/.test(value)) return "shield";
  if (/שיח|וואטסאפ|whatsapp|message/.test(value)) return "message-circle";
  if (/טלפון|שיחה|phone/.test(value)) return "phone";
  return OFFER_ICON_NAMES[index % OFFER_ICON_NAMES.length];
};

const iconX = (index: number, count: number) => {
  const slot = OFFER_BOARD_SLOTS.icon;
  const start = (100 - slot.gutter * (count - 1) - slot.width) / 2;
  return start + index * slot.gutter;
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
  const marks = (bullets ?? []).filter(Boolean).slice(0, 3);
  const modules = footerModules(bullets);
  const accent = palette.cta || "#dc2626";
  const compactFooter = modules.length === 0;
  const footer = compactFooter
    ? { x: 0, y: 86, width: 100, height: 14 }
    : OFFER_BOARD_SLOTS.footer;
  const ctaFill = compactFooter
    ? { x: 22, y: 88.2, width: 56, height: 8.2 }
    : OFFER_BOARD_SLOTS.ctaFill;
  const layers: CreativeLayer[] = [];

  layers.push(layer({
    type: "shape",
    role: "type_field",
    ...OFFER_BOARD_SLOTS.typeField,
    fill: "#ffffff",
  }));
  layers.push(layer({
    type: "shape",
    role: "divider",
    ...OFFER_BOARD_SLOTS.split,
    fill: accent,
  }));

  if (headline) {
    const wrapped = wrapLines(headline, story ? 14 : 16, 3);
    layers.push(layer({
      type: "text",
      role: "headline",
      ...OFFER_BOARD_SLOTS.headline,
      text: wrapped,
      fontFamily: "Heebo",
      fontSize: fitFontSize(wrapped, OFFER_BOARD_SLOTS.headline.width, story ? 36 : 32, 18),
      fontWeight: "900",
      color: "#111111",
      textAlign: "right",
      letterSpacing: "-0.035em",
      lineHeight: 1.05,
      ...withLayerShadow({ shadowStyle: "none" }),
    }));
  }

  if (sub) {
    layers.push(layer({
      type: "text",
      role: "sub",
      ...OFFER_BOARD_SLOTS.sub,
      text: wrapLines(sub, 28, 2),
      fontFamily: "Heebo",
      fontSize: fitFontSize(sub, OFFER_BOARD_SLOTS.sub.width, 15, 12),
      fontWeight: "600",
      color: "#374151",
      textAlign: "right",
      lineHeight: 1.2,
    }));
  }

  marks.forEach((item, index) => {
    const y = OFFER_BOARD_SLOTS.bullet.y + index * 6.2;
    layers.push(layer({
      type: "shape",
      role: "icon",
      icon: "badge-check",
      x: 38.6,
      y: y + 0.5,
      width: 3.4,
      height: 3.4,
      fill: accent,
      color: "#ffffff",
      borderRadius: 999,
    }));
    layers.push(layer({
      type: "text",
      role: "bullet",
      x: 4,
      y,
      width: 33.8,
      height: 5.4,
      text: item,
      fontFamily: "Heebo",
      fontSize: 13,
      fontWeight: "600",
      color: "#111111",
      textAlign: "right",
      lineHeight: 1.15,
    }));
  });

  layers.push(layer({
    type: "shape",
    role: "footer",
    ...footer,
    fill: "#111111",
  }));

  if (!compactFooter) {
    layers.push(layer({
      type: "text",
      role: "sub",
      ...OFFER_BOARD_SLOTS.footerTitle,
      text: footerTitle || "מה מקבלים איתנו?",
      fontFamily: "Heebo",
      fontSize: 13,
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "center",
    }));
  }

  modules.forEach((mod, index) => {
    const x = iconX(index, modules.length);
    layers.push(layer({
      type: "shape",
      role: "icon",
      icon: mod.icon,
      x,
      y: OFFER_BOARD_SLOTS.icon.y,
      width: OFFER_BOARD_SLOTS.icon.width,
      height: OFFER_BOARD_SLOTS.icon.height,
      fill: "transparent",
      color: accent,
      borderRadius: 999,
    }));
    layers.push(layer({
      type: "text",
      role: "icon_label",
      x: x - (OFFER_BOARD_SLOTS.iconLabel.width - OFFER_BOARD_SLOTS.icon.width) / 2,
      y: OFFER_BOARD_SLOTS.iconLabel.y,
      width: OFFER_BOARD_SLOTS.iconLabel.width,
      height: OFFER_BOARD_SLOTS.iconLabel.height,
      text: mod.label,
      fontFamily: "Heebo",
      fontSize: 11,
      fontWeight: "600",
      color: "#ffffff",
      textAlign: "center",
      lineHeight: 1.15,
    }));
  });

  const ctaText = fitCta(cta || "השאירו פרטים");
  layers.push(layer({
    type: "shape",
    role: "cta_fill",
    ...ctaFill,
    fill: accent,
    borderRadius: 999,
    boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
  }));
  layers.push(layer({
    type: "text",
    role: "cta",
    x: ctaFill.x,
    y: ctaFill.y + 1.4,
    width: ctaFill.width,
    height: 5.4,
    text: ctaText,
    fontFamily: "Heebo",
    fontSize: fitFontSize(ctaText, ctaFill.width, 15, 12),
    fontWeight: "800",
    color: palette.ctaText || "#ffffff",
    textAlign: "center",
    ...withLayerShadow({ shadowStyle: "none" }),
  }));

  return layers;
};
