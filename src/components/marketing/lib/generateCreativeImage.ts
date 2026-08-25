import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";
import { resolveCreativeImageUrl } from "@/components/marketing/lib/resolveCreativeImageUrl";
import {
  costFromApiUsage,
  estimateGptImage1,
  type ImageGenerationCost,
  type ImageQuality,
  type ImageSize,
} from "@/components/marketing/departments/creative/imageCost";
import { wrapCreativeImagePrompt, type CreativeReferenceRole } from "@/components/marketing/lib/creativeImagePrompt";

export type { CreativeReferenceRole } from "@/components/marketing/lib/creativeImagePrompt";
export { FINISHED_HEBREW_AD, NO_TEXT_ON_IMAGE, buildFinishedAdLock, buildNoGlyphLock, wrapCreativeImagePrompt } from "@/components/marketing/lib/creativeImagePrompt";

interface GenerateCreativeImageArgs {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  stageId: string;
  prompt: string;
  referenceImageUrls?: string[];
  referenceRole?: CreativeReferenceRole;
  size?: ImageSize;
  quality?: ImageQuality;
  regenerate?: boolean;
  liveTextLayers?: boolean;
  signal?: AbortSignal;
}

async function invokeSocialImage(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  prompt: string,
  referenceImageUrls?: string[],
  size?: GenerateCreativeImageArgs["size"],
  quality?: GenerateCreativeImageArgs["quality"],
  referenceRole?: CreativeReferenceRole,
  regenerate?: boolean,
  liveTextLayers?: boolean,
  signal?: AbortSignal,
) {
  return supabase.functions.invoke("ai-generate-social-image", {
    body: {
      prompt: wrapCreativeImagePrompt(prompt, { regenerate, liveTextLayers }),
      tenant_id: tenantId,
      post_id: itemId,
      reference_image_url: referenceImageUrls?.[0],
      reference_image_urls: referenceImageUrls,
      reference_role: referenceRole,
      live_text_layers: !!liveTextLayers,
      size,
      quality,
    },
    signal,
  });
}

async function invokeMarketingStage(
  supabase: SupabaseClient,
  itemId: string,
  stageId: string,
) {
  return supabase.functions.invoke("marketing-run-stage", {
    body: { item_id: itemId, stage_id: stageId },
  });
}

const logCreativeRun = async (
  supabase: SupabaseClient,
  args: { tenantId: string; itemId: string; stageId: string; prompt: string; cost: ImageGenerationCost },
) => {
  try {
    const { error } = await supabase.from("marketing_runs").insert({
      tenant_id: args.tenantId,
      item_id: args.itemId,
      stage_id: args.stageId,
      model: args.cost.model,
      status: "completed",
      tokens_in: args.cost.textTokens + args.cost.imageInTokens,
      tokens_out: args.cost.outputTokens,
      cost_usd: args.cost.costUsd,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      input: { prompt: args.prompt.slice(0, 2000), quality: args.cost.quality, size: args.cost.size, source: args.cost.source },
      output: { usage_source: args.cost.source, total_tokens: args.cost.totalTokens },
    });
    if (error) return;
  } catch {
    /* cost is still stored on the variation */
  }
};

export const estimateCreativeImageCall = ({
  prompt,
  quality = "high",
  size = "1024x1024",
  referenceCount = 0,
  liveTextLayers,
}: {
  prompt: string;
  quality?: ImageQuality;
  size?: ImageSize;
  referenceCount?: number;
  liveTextLayers?: boolean;
}): ImageGenerationCost =>
  estimateGptImage1({
    prompt: wrapCreativeImagePrompt(prompt, { liveTextLayers }),
    quality,
    size,
    referenceCount,
  });

/** Generate a marketing image. Uses ai-generate-social-image first (gpt-image-1, stable), then marketing-run-stage. */
export async function generateCreativeImage({
  supabase,
  tenantId,
  itemId,
  stageId,
  prompt,
  referenceImageUrls,
  referenceRole,
  size = "1024x1024",
  quality = "high",
  regenerate,
  liveTextLayers,
  signal,
}: GenerateCreativeImageArgs): Promise<{ imageUrl: string; usedFallback: boolean; cost: ImageGenerationCost }> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const estimate = estimateCreativeImageCall({
    prompt,
    quality,
    size,
    referenceCount: referenceImageUrls?.length ?? 0,
    liveTextLayers,
  });
  const socialResult = await invokeSocialImage(
    supabase,
    tenantId,
    itemId,
    prompt,
    referenceImageUrls,
    size,
    quality,
    referenceRole,
    regenerate,
    liveTextLayers,
    signal,
  );
  if (!socialResult.error && !socialResult.data?.error) {
    const imageUrl = socialResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      const cost = costFromApiUsage(socialResult.data?.usage, quality, size, referenceImageUrls?.length ?? 0) ?? estimate;
      await logCreativeRun(supabase, { tenantId, itemId, stageId, prompt, cost });
      return { imageUrl: (await resolveCreativeImageUrl(imageUrl)) ?? imageUrl, usedFallback: true, cost };
    }
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const socialError = socialResult.error
    ? await invokeErrorMessage(socialResult.error, socialResult.data, "יצירת תמונה נכשלה", socialResult.response)
    : socialResult.data?.error ?? "לא התקבלה תמונה";

  const stageResult = await invokeMarketingStage(supabase, itemId, stageId);
  if (!stageResult.error && !stageResult.data?.error) {
    const imageUrl = stageResult.data?.url ?? stageResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      return { imageUrl: (await resolveCreativeImageUrl(imageUrl)) ?? imageUrl, usedFallback: false, cost: estimate };
    }
  }

  const stageError = stageResult.error
    ? await invokeErrorMessage(stageResult.error, stageResult.data, "יצירת הקריאייטיב נכשלה", stageResult.response)
    : stageResult.data?.error ?? "לא התקבלה תמונה מהיצירה";

  throw new Error(`${socialError} · pipeline: ${stageError}`);
}
