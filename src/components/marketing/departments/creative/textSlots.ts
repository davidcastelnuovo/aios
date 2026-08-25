import type { CreativeLayer, CreativeLayerRole, CreativeVariation } from "./types";
import { compositionById, type CompositionId } from "./compositions";

export type TextSlotRole = "headline" | "sub" | "cta" | "logo";

export interface PixelBuffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface TextSlot {
  role: TextSlotRole;
  x: number;
  y: number;
  width: number;
  height: number;
  textColor?: string;
  pocketLuma?: number;
  source: "pixels" | "composition";
}

const MOVABLE_ROLES: CreativeLayerRole[] = ["headline", "sub", "cta", "cta_fill", "logo"];

export const lumaFromHex = (hex: string): number => {
  const value = hex.replace("#", "");
  if (value.length < 6) return 0.5;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const inkOnLuma = (luma: number): string => (luma > 0.55 ? "#111111" : "#ffffff");

const sampleCell = (buffer: PixelBuffer, x0: number, y0: number, x1: number, y1: number) => {
  let lumaSum = 0;
  let lumaSq = 0;
  let count = 0;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(buffer.width, Math.ceil(x1));
  const bottom = Math.min(buffer.height, Math.ceil(y1));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * buffer.width + x) * 4;
      const luma = (0.2126 * buffer.data[i] + 0.7152 * buffer.data[i + 1] + 0.0722 * buffer.data[i + 2]) / 255;
      lumaSum += luma;
      lumaSq += luma * luma;
      count += 1;
    }
  }
  if (!count) return { luma: 0.5, energy: 1 };
  const luma = lumaSum / count;
  return { luma, energy: Math.max(0, lumaSq / count - luma * luma) };
};

const toPct = (value: number, total: number) => Number(((value / total) * 100).toFixed(2));

/** Lowest-variance rectangles — the quiet atmospheric pockets, not painted chrome. */
export const proposeTextSlotsFromPixels = (buffer: PixelBuffer): TextSlot[] => {
  if (buffer.width < 8 || buffer.height < 8) return [];
  const cols = 6;
  const rows = 6;
  const cellW = buffer.width / cols;
  const cellH = buffer.height / rows;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const scored = sampleCell(buffer, col * cellW, row * cellH, (col + 1) * cellW, (row + 1) * cellH);
      cells.push({ col, row, ...scored });
    }
  }
  const ranked = [...cells].sort((left, right) => left.energy - right.energy || right.col - left.col);
  const headlineCell = ranked[0];
  const medianEnergy = ranked[Math.floor(ranked.length / 2)]?.energy ?? 1;
  const clearlyQuiet = headlineCell && headlineCell.energy <= 0.02 && headlineCell.energy <= medianEnergy * 0.35;
  if (!clearlyQuiet) return [];

  const headline: TextSlot = {
    role: "headline",
    x: toPct(Math.max(0, (headlineCell.col - 1) * cellW), buffer.width),
    y: toPct(Math.max(0, headlineCell.row * cellH), buffer.height),
    width: toPct(Math.min(buffer.width, cellW * 3), buffer.width),
    height: toPct(Math.min(buffer.height, cellH * 2), buffer.height),
    textColor: inkOnLuma(headlineCell.luma),
    pocketLuma: headlineCell.luma,
    source: "pixels",
  };

  const used = new Set([`${headlineCell.col}:${headlineCell.row}`]);
  const ctaCell = ranked.find((cell) => {
    const key = `${cell.col}:${cell.row}`;
    return !used.has(key) && cell.row >= 3 && cell.energy <= 0.05;
  }) ?? ranked[1];

  const slots: TextSlot[] = [headline];
  if (ctaCell) {
    slots.push({
      role: "cta",
      x: toPct(Math.max(0, (ctaCell.col - 0.4) * cellW), buffer.width),
      y: toPct(Math.max(0, ctaCell.row * cellH), buffer.height),
      width: toPct(Math.min(buffer.width, cellW * 2.4), buffer.width),
      height: toPct(Math.min(buffer.height, cellH * 0.9), buffer.height),
      textColor: inkOnLuma(ctaCell.luma),
      pocketLuma: ctaCell.luma,
      source: "pixels",
    });
  }

  slots.push({
    role: "logo",
    x: 4,
    y: 3.2,
    width: 18,
    height: 8,
    source: "pixels",
  });
  return slots;
};

export const slotsFromComposition = (compositionId?: CompositionId | null): TextSlot[] => {
  const composition = compositionById(compositionId);
  return [
    { role: "headline", ...composition.type, source: "composition" },
    { role: "cta", ...composition.cta, source: "composition" },
    { role: "logo", ...composition.logo, source: "composition" },
  ];
};

export const applySlotsToLayers = (layers: CreativeLayer[], slots: TextSlot[]): CreativeLayer[] => {
  const byRole = new Map(slots.map((slot) => [slot.role, slot]));
  let usedHeadline = false;
  return layers.map((layer) => {
    const role = layer.role && MOVABLE_ROLES.includes(layer.role) ? layer.role : undefined;
    const slotRole: TextSlotRole | undefined = role === "cta_fill"
      ? "cta"
      : role === "headline" || role === "sub" || role === "cta" || role === "logo"
        ? role
        : !role && layer.type === "text" && !usedHeadline
          ? "headline"
          : undefined;
    if (slotRole === "headline" && !role) usedHeadline = true;
    const slot = slotRole ? byRole.get(slotRole === "sub" ? "headline" : slotRole) : undefined;
    if (!slot) return layer;
    if (slotRole === "sub") {
      return {
        ...layer,
        x: slot.x,
        y: Math.min(92, slot.y + slot.height * 0.72),
        width: slot.width,
        height: Math.max(6, slot.height * 0.36),
        color: slot.textColor ?? layer.color,
      };
    }
    return {
      ...layer,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: layer.role === "cta_fill" ? Math.max(layer.height, slot.height) : slot.height,
      color: layer.type === "text" ? (slot.textColor ?? layer.color) : layer.color,
    };
  });
};

export const proposeAndApplySlots = (
  variation: CreativeVariation,
  buffer?: PixelBuffer | null,
): { variation: CreativeVariation; slots: TextSlot[] } => {
  const slots = buffer ? proposeTextSlotsFromPixels(buffer) : [];
  const nextSlots = slots.length > 0 ? slots : slotsFromComposition(variation.compositionId);
  return {
    variation: { ...variation, layers: applySlotsToLayers(variation.layers ?? [], nextSlots) },
    slots: nextSlots,
  };
};
