export type ImageQuality = "low" | "medium" | "high";
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type ImageCostSource = "api" | "official_table" | "inferred";

export interface ImageGenerationCost {
  model: "gpt-image-1";
  quality: ImageQuality;
  size: ImageSize;
  textTokens: number;
  imageInTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  source: ImageCostSource;
  createdAt: string;
  referenceCount?: number;
}

/** Official gpt-image-1 rates (USD per 1M tokens). */
export const GPT_IMAGE1_USD_PER_M = {
  textIn: 5,
  imageIn: 10,
  imageOut: 40,
} as const;

/**
 * Official output-token ladder for gpt-image-1.
 * High 1024 = 4160 × $40/1M ≈ $0.167; portrait/landscape high = 6240 ≈ $0.25.
 */
export const GPT_IMAGE1_OUTPUT_TOKENS: Record<ImageQuality, Record<ImageSize, number>> = {
  low: { "1024x1024": 272, "1024x1536": 408, "1536x1024": 408 },
  medium: { "1024x1024": 1056, "1024x1536": 1584, "1536x1024": 1584 },
  high: { "1024x1024": 4160, "1024x1536": 6240, "1536x1024": 6240 },
};

/** High-fidelity 1024 input image, used only when the API does not return usage. */
export const GPT_IMAGE1_REF_INPUT_TOKENS = 1440;

export const imageOutputTokens = (quality: ImageQuality, size: ImageSize): number =>
  GPT_IMAGE1_OUTPUT_TOKENS[quality][size];

export const usdFromImageTokens = (textTokens: number, imageInTokens: number, outputTokens: number): number =>
  +((
    textTokens * GPT_IMAGE1_USD_PER_M.textIn
    + imageInTokens * GPT_IMAGE1_USD_PER_M.imageIn
    + outputTokens * GPT_IMAGE1_USD_PER_M.imageOut
  ) / 1e6).toFixed(6);

/** Mixed Hebrew/English prompt: Latin ≈ 4 chars/token, Hebrew/other ≈ 1.5 chars/token. */
export const estimateTextTokens = (text: string): number => {
  let tokens = 8;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    tokens += code <= 0x7f ? 0.25 : 0.67;
  }
  return Math.max(1, Math.ceil(tokens));
};

export const isImageQuality = (value: unknown): value is ImageQuality =>
  value === "low" || value === "medium" || value === "high";

export const isImageSize = (value: unknown): value is ImageSize =>
  value === "1024x1024" || value === "1024x1536" || value === "1536x1024";

export const isImageGenerationCost = (value: unknown): value is ImageGenerationCost => {
  if (!value || typeof value !== "object") return false;
  const cost = value as ImageGenerationCost;
  return cost.model === "gpt-image-1"
    && isImageQuality(cost.quality)
    && isImageSize(cost.size)
    && typeof cost.totalTokens === "number"
    && typeof cost.costUsd === "number";
};

const makeCost = (
  quality: ImageQuality,
  size: ImageSize,
  textTokens: number,
  imageInTokens: number,
  outputTokens: number,
  source: ImageCostSource,
  referenceCount = 0,
): ImageGenerationCost => ({
  model: "gpt-image-1",
  quality,
  size,
  textTokens,
  imageInTokens,
  outputTokens,
  totalTokens: textTokens + imageInTokens + outputTokens,
  costUsd: usdFromImageTokens(textTokens, imageInTokens, outputTokens),
  source,
  createdAt: new Date().toISOString(),
  referenceCount,
});

export const estimateGptImage1 = ({
  prompt,
  quality,
  size,
  referenceCount = 0,
}: {
  prompt: string;
  quality: ImageQuality;
  size: ImageSize;
  referenceCount?: number;
}): ImageGenerationCost => {
  const refs = Math.max(0, referenceCount);
  return makeCost(
    quality,
    size,
    estimateTextTokens(prompt),
    refs * GPT_IMAGE1_REF_INPUT_TOKENS,
    imageOutputTokens(quality, size),
    "official_table",
    refs,
  );
};

export const costFromApiUsage = (
  usage: unknown,
  quality: ImageQuality,
  size: ImageSize,
  referenceCount = 0,
): ImageGenerationCost | null => {
  if (!usage || typeof usage !== "object") return null;
  const row = usage as {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
  const details = row.input_tokens_details;
  const textTokens = Number(details?.text_tokens ?? (details ? 0 : row.input_tokens) ?? 0);
  const imageInTokens = Number(details?.image_tokens ?? 0);
  const outputTokens = Number(row.output_tokens ?? 0);
  if (!Number.isFinite(textTokens + imageInTokens + outputTokens)) return null;
  if (textTokens + imageInTokens + outputTokens <= 0) return null;
  return makeCost(quality, size, textTokens, imageInTokens, outputTokens, "api", referenceCount);
};

export const inferImageCost = (quality: ImageQuality, size: ImageSize): ImageGenerationCost =>
  makeCost(quality, size, 0, 0, imageOutputTokens(quality, size), "inferred");

export interface CostTotals {
  images: number;
  tokens: number;
  costUsd: number;
  exactImages: number;
  estimatedImages: number;
}

export const emptyCostTotals = (): CostTotals => ({
  images: 0,
  tokens: 0,
  costUsd: 0,
  exactImages: 0,
  estimatedImages: 0,
});

export const addCost = (totals: CostTotals, cost: ImageGenerationCost): CostTotals => ({
  images: totals.images + 1,
  tokens: totals.tokens + cost.totalTokens,
  costUsd: +(totals.costUsd + cost.costUsd).toFixed(6),
  exactImages: totals.exactImages + (cost.source === "api" ? 1 : 0),
  estimatedImages: totals.estimatedImages + (cost.source === "api" ? 0 : 1),
});

export const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const formatTokens = (value: number) =>
  Math.round(value).toLocaleString("he-IL");

export const costSourceLabel = (totals: CostTotals) => {
  if (totals.images === 0) return "אין תמונות";
  if (totals.exactImages === totals.images) return "מדויק מה־API";
  if (totals.exactImages > 0) return "חלק מדויק / חלק מחירון";
  if (totals.estimatedImages > 0 && totals.images === totals.estimatedImages) return "מחירון רשמי";
  return "הערכה";
};

export interface StoredImageCost {
  generationCost?: ImageGenerationCost | null;
  imageUrl?: string;
  source?: string;
  format?: string;
}

export interface LoggedRunCost {
  tokens_in?: number | null;
  tokens_out?: number | null;
  cost_usd?: number | null;
  model?: string | null;
}

const sizeFromFormat = (format?: string): ImageSize => {
  if (format === "9:16" || format === "4:5") return "1024x1536";
  if (format === "16:9") return "1536x1024";
  return "1024x1024";
};

export const summarizeStoredImageCosts = (
  images: StoredImageCost[],
  fallbackQuality: ImageQuality,
  runs: LoggedRunCost[] = [],
): CostTotals => {
  const stored = images.filter((image) => isImageGenerationCost(image.generationCost));
  if (stored.length > 0) {
    let totals = emptyCostTotals();
    for (const image of images) {
      if (isImageGenerationCost(image.generationCost)) {
        totals = addCost(totals, image.generationCost);
        continue;
      }
      if (image.imageUrl) totals = addCost(totals, inferImageCost(fallbackQuality, sizeFromFormat(image.format)));
    }
    return totals;
  }

  const relevantRuns = runs.filter((run) => (run.cost_usd ?? 0) > 0 || (run.tokens_out ?? 0) > 0);
  if (relevantRuns.length > 0) {
    return {
      images: relevantRuns.length,
      tokens: relevantRuns.reduce((sum, run) => sum + (run.tokens_in ?? 0) + (run.tokens_out ?? 0), 0),
      costUsd: +relevantRuns.reduce((sum, run) => sum + Number(run.cost_usd ?? 0), 0).toFixed(6),
      exactImages: 0,
      estimatedImages: relevantRuns.length,
    };
  }

  let totals = emptyCostTotals();
  for (const image of images) {
    if (!image.imageUrl || image.source === "manual_edit") continue;
    totals = addCost(totals, inferImageCost(fallbackQuality, sizeFromFormat(image.format)));
  }
  return totals;
};
