import type { CompositionId } from "./compositions.ts";
import type { CreativeFormat, CreativeVisualStyleId } from "./types.ts";
import { isCompositionId } from "./compositions.ts";

const VISUAL_STYLE_IDS = new Set<CreativeVisualStyleId>([
  "adaptive", "swiss", "industrial", "mediterranean", "kinetic", "glass", "collage",
  "bauhaus", "cinematic", "holographic", "organic", "photoreal", "animation",
  "illustration", "popart", "render3d", "editorial", "ugc", "watercolor", "comic",
]);

export const isVisualStyleId = (value: unknown): value is CreativeVisualStyleId =>
  typeof value === "string" && VISUAL_STYLE_IDS.has(value as CreativeVisualStyleId);

export const isCreativeFormat = (value: unknown): value is CreativeFormat =>
  value === "9:16" || value === "1:1" || value === "4:5" || value === "16:9";

export const brandColorsFromPayload = (payload: Record<string, unknown>): string[] => {
  const book = payload.brand_book;
  if (!book || typeof book !== "object") return [];
  const colors = (book as { colors?: unknown }).colors;
  if (!Array.isArray(colors)) return [];
  return colors.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

export const logoUrlFromPayload = (payload: Record<string, unknown>): string | undefined => {
  const direct = payload.logo_url;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const book = payload.brand_book;
  if (book && typeof book === "object") {
    const logo = (book as { logoUrl?: unknown }).logoUrl;
    if (typeof logo === "string" && logo.trim()) return logo.trim();
  }
  return undefined;
};

export const visualStyleFromPayload = (payload: Record<string, unknown>): CreativeVisualStyleId | undefined => {
  const style = payload.visual_style;
  return isVisualStyleId(style) ? style : undefined;
};

export const compositionIdFromJob = (job: Record<string, unknown>): CompositionId | undefined => {
  const value = job.composition_id;
  return isCompositionId(value) ? value : undefined;
};

export const usedCompositionIdsFromPayload = (payload: Record<string, unknown>): CompositionId[] => {
  const variations = Array.isArray(payload.variations) ? payload.variations : [];
  return variations
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => row.compositionId ?? row.composition_id)
    .filter(isCompositionId);
};

export interface CreativeJobMeta {
  visual_style?: CreativeVisualStyleId;
  composition_id?: CompositionId;
  brand_colors?: string[];
  live_text_layers?: boolean;
  title?: string;
  logo_url?: string;
  composition_seed?: string;
}

export const jobMetaFromRecord = (record: Record<string, unknown>): CreativeJobMeta => ({
  visual_style: isVisualStyleId(record.visual_style) ? record.visual_style : undefined,
  composition_id: isCompositionId(record.composition_id) ? record.composition_id : undefined,
  brand_colors: Array.isArray(record.brand_colors)
    ? record.brand_colors.filter((item): item is string => typeof item === "string")
    : undefined,
  live_text_layers: record.live_text_layers === true,
  title: typeof record.title === "string" ? record.title : undefined,
  logo_url: typeof record.logo_url === "string" ? record.logo_url : undefined,
  composition_seed: typeof record.composition_seed === "string" ? record.composition_seed : undefined,
});
