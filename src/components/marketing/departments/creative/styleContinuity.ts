import type { CopyVariationBlock } from "./copyVariations";
import type { CreativeLayer, CreativeVariation } from "./types";

/** A designed field under type — not a thin accent bar. */
export const isTypePlate = (layer: CreativeLayer): boolean =>
  layer.type === "shape"
  && (layer.width ?? 0) >= 20
  && (layer.height ?? 0) >= 6;

export const usesIntegratedType = (variation: Pick<CreativeVariation, "layers" | "compositionId">): boolean =>
  variation.compositionId === "flush" || !variation.layers.some(isTypePlate);

export const missingCopyBlocks = (
  blocks: CopyVariationBlock[],
  variations: CreativeVariation[],
  source: Pick<CreativeVariation, "id" | "copyKey">,
): CopyVariationBlock[] => {
  const taken = new Set(
    variations
      .filter((variation) => !variation.rejected && variation.id !== source.id)
      .map((variation) => variation.copyKey)
      .filter((key): key is string => !!key),
  );
  if (source.copyKey) taken.add(source.copyKey);
  return blocks.filter((block) => block.text.trim() && !taken.has(block.key));
};

export const buildStyleContinuityLock = ({
  sourceLabel,
  sourceIdea,
}: {
  sourceLabel?: string;
  sourceIdea?: string;
}): string => [
  "CAMPAIGN STYLE LOCK — one approved still from THIS campaign is attached as the style master.",
  sourceLabel && `Approved card: ${sourceLabel}.`,
  sourceIdea && `That card staged: "${sourceIdea}". Keep the same art DNA, not the same moment.`,
  "Match paper, collage/graphic language, texture, light, palette, how objects sit, and the logo pocket.",
  "This is the look we are keeping for the campaign. Invent the NEXT situation so it depicts THIS variation's copy.",
  "A stranger must recognize the new copy idea. Do not copy the reference face, pose, lettering, or exact props unless the new copy is the same beat.",
  "No caption plates and no cream/white rectangles under type. Type sits in a designed pocket already in the art (torn paper, shadow, color bloom) like the approved still.",
  "The set must feel like one campaign shot by the same art director.",
].filter(Boolean).join(" ");
