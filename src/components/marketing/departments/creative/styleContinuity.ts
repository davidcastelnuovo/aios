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

const CASTS = [
  "a new adult — different face, age, and wardrobe than any previous card",
  "hands and objects only, or a cropped profile — no centered full-face portrait",
  "two people in the relationship THIS copy implies, not a generic smiling couple",
  "a silhouette or back-of-head plus one clear object from THIS sentence",
  "a close fragment of the action (thumb, ticket, phone, door) instead of a hero portrait",
];

const CROPS = [
  "tight intimate crop, subject filling most of the frame",
  "wide graphic field, subject small and offset",
  "diagonal cut, subject entering from one edge",
  "unexpected high or low angle of the real action",
];

const MARKS = [
  "a large torn-paper island as the designed type pocket",
  "ink bloom and charcoal sketch as the graphic marks",
  "newsprint fragment plus one stamp or seal (no letters)",
  "layered cut-outs stacked, not a centered portrait",
  "one bold geometric slash of paper color with the figure off-center",
];

export const hashStylePlaySeed = (text: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const pickStylePlay = (seed: number) => ({
  cast: CASTS[seed % CASTS.length],
  crop: CROPS[Math.floor(seed / CASTS.length) % CROPS.length],
  mark: MARKS[Math.floor(seed / (CASTS.length * CROPS.length)) % MARKS.length],
});

/** Same technique family, a new picture — style is not a 1:1 reprint. */
export const buildStylePlayLock = ({
  copyText,
  copyLabel,
  copyKey,
  index = 0,
  avoidLabels,
}: {
  copyText?: string;
  copyLabel?: string;
  copyKey?: string;
  index?: number;
  avoidLabels?: string[];
}): string => {
  const seed = hashStylePlaySeed(`${copyKey || ""}|${copyLabel || ""}|${copyText || ""}|${index}`);
  const play = pickStylePlay(seed);
  return [
    "STYLE PLAY — style means TECHNIQUE, color family, and composition approach. It is not a photocopy.",
    `This card's unique staging: ${play.cast}. Crop: ${play.crop}. Graphic marks: ${play.mark}.`,
    "Change characters, props, sketches, stamps, cut-outs, and crop so they illustrate THIS sentence.",
    avoidLabels?.length ? `Do not echo these earlier cards: ${avoidLabels.join("; ")}.` : "",
    "Two cards in the same style must be instantly distinguishable. If this still could be mistaken for another variation, it failed.",
  ].filter(Boolean).join(" ");
};

export const buildStyleContinuityLock = ({
  sourceLabel,
  sourceIdea,
  attachStill = true,
}: {
  sourceLabel?: string;
  sourceIdea?: string;
  attachStill?: boolean;
}): string => [
  attachStill
    ? "CAMPAIGN STYLE LOCK — an approved still is attached as a TECHNIQUE sample only (paper, ink, collage method, color family)."
    : "CAMPAIGN STYLE LOCK — keep the same TECHNIQUE family (paper, ink, collage method, color family, composition approach). No still is attached to copy — invent a new picture.",
  sourceLabel && `Technique sample from: ${sourceLabel}.`,
  sourceIdea && `That card staged: "${sourceIdea}". Steal the craft, not the picture.`,
  "STYLE ≠ CLONE. Style means technique, color family, and composition approach. It does NOT mean copy the face, pose, crop, props, or graphic marks 1-to-1.",
  "Invent a NEW board for THIS copy: new people, new pose, new props, new sketches/stamps/cut-outs, new crop. Play with the arrangement.",
  "A stranger must see the new message. If this still looks like a reprint of the sample, it failed.",
  "No caption plates and no cream/white rectangles under type. Type sits flush in a designed pocket (torn paper, shadow, color bloom).",
  "Same campaign art director — different picture every time.",
].filter(Boolean).join(" ");
