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

interface GenerateCreativeImageArgs {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  stageId: string;
  prompt: string;
  referenceImageUrls?: string[];
  size?: ImageSize;
  quality?: ImageQuality;
}

export const NO_TEXT_ON_IMAGE =
  "No letters, numbers, captions, logos, watermarks, buttons, or typography anywhere — the image API still garbles Hebrew glyphs, so exact type and the real logo are composited later. Do not invent or redraw a logo. Do NOT reserve a top headline strip, a bottom CTA pill, or a top-right logo pad (that is the old caption template). Build a finished multi-element graphic poster: several designed pieces already in the still (rail, slash, badge, split field, shadow pocket, object, light) so type can sit inside the art. No Hebrew and no English words.";

async function invokeSocialImage(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  prompt: string,
  referenceImageUrls?: string[],
  size?: GenerateCreativeImageArgs["size"],
  quality?: GenerateCreativeImageArgs["quality"],
) {
  return supabase.functions.invoke("ai-generate-social-image", {
    body: {
      prompt: `${prompt}\n\n${NO_TEXT_ON_IMAGE}`,
      tenant_id: tenantId,
      post_id: itemId,
      reference_image_url: referenceImageUrls?.[0],
      reference_image_urls: referenceImageUrls,
      size,
      quality,
    },
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
}: {
  prompt: string;
  quality?: ImageQuality;
  size?: ImageSize;
  referenceCount?: number;
}): ImageGenerationCost =>
  estimateGptImage1({
    prompt: `${prompt}\n\n${NO_TEXT_ON_IMAGE}`,
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
  size = "1024x1024",
  quality = "high",
}: GenerateCreativeImageArgs): Promise<{ imageUrl: string; usedFallback: boolean; cost: ImageGenerationCost }> {
  const estimate = estimateCreativeImageCall({
    prompt,
    quality,
    size,
    referenceCount: referenceImageUrls?.length ?? 0,
  });
  const socialResult = await invokeSocialImage(supabase, tenantId, itemId, prompt, referenceImageUrls, size, quality);
  if (!socialResult.error && !socialResult.data?.error) {
    const imageUrl = socialResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      const cost = costFromApiUsage(socialResult.data?.usage, quality, size, referenceImageUrls?.length ?? 0) ?? estimate;
      await logCreativeRun(supabase, { tenantId, itemId, stageId, prompt, cost });
      return { imageUrl: (await resolveCreativeImageUrl(imageUrl)) ?? imageUrl, usedFallback: true, cost };
    }
  }

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
