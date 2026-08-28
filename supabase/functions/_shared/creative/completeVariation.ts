import { buildDesignedCopyLayers, ensureLogoLayer } from "./designedLayers.ts";
import { pickVariationComposition, type CompositionId } from "./compositions.ts";
import type { CreativeFormat, CreativeLayer, CreativeVisualStyleId } from "./types.ts";

export interface CompleteVariationMeta {
  copyText?: string;
  title?: string;
  format: CreativeFormat;
  visualStyle?: CreativeVisualStyleId;
  compositionId?: CompositionId;
  brandColors?: string[];
  logoUrl?: string;
  liveTextLayers?: boolean;
  compositionSeed?: string;
  usedCompositionIds?: CompositionId[];
}

export const buildLayersForComplete = ({
  copyText,
  title,
  format,
  visualStyle = "swiss",
  compositionId,
  brandColors,
  logoUrl,
  liveTextLayers = false,
  compositionSeed = "",
  usedCompositionIds = [],
}: CompleteVariationMeta): { layers: CreativeLayer[]; compositionId?: CompositionId } => {
  if (!liveTextLayers) return { layers: [] };
  const resolvedComposition = compositionId ?? pickVariationComposition({
    seed: compositionSeed,
    used: usedCompositionIds,
    lockedId: compositionId,
  });
  const layers = buildDesignedCopyLayers({
    copyText,
    format,
    styleId: visualStyle,
    title,
    compositionId: resolvedComposition,
    brandColors,
  });
  return {
    layers: ensureLogoLayer(layers, logoUrl),
    compositionId: resolvedComposition,
  };
};
