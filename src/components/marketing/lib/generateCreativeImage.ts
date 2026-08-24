import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";
import { resolveCreativeImageUrl } from "@/components/marketing/lib/resolveCreativeImageUrl";

interface GenerateCreativeImageArgs {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  stageId: string;
  prompt: string;
  referenceImageUrls?: string[];
}

const NO_TEXT_ON_IMAGE =
  "Photorealistic marketing visual only. Do not render any text, letters, numbers, captions, logos, watermarks, or typography in the image. Leave clean visual space. No Hebrew and no English words.";

async function invokeSocialImage(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  prompt: string,
  referenceImageUrls?: string[],
) {
  return supabase.functions.invoke("ai-generate-social-image", {
    body: {
      prompt: `${prompt}\n\n${NO_TEXT_ON_IMAGE}`,
      tenant_id: tenantId,
      post_id: itemId,
      reference_image_url: referenceImageUrls?.[0],
      reference_image_urls: referenceImageUrls,
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

/** Generate a marketing image. Uses ai-generate-social-image first (gpt-image-1, stable), then marketing-run-stage. */
export async function generateCreativeImage({
  supabase,
  tenantId,
  itemId,
  stageId,
  prompt,
  referenceImageUrls,
}: GenerateCreativeImageArgs): Promise<{ imageUrl: string; usedFallback: boolean }> {
  const socialResult = await invokeSocialImage(supabase, tenantId, itemId, prompt, referenceImageUrls);
  if (!socialResult.error && !socialResult.data?.error) {
    const imageUrl = socialResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      return { imageUrl: (await resolveCreativeImageUrl(imageUrl)) ?? imageUrl, usedFallback: true };
    }
  }

  const socialError = socialResult.error
    ? await invokeErrorMessage(socialResult.error, socialResult.data, "יצירת תמונה נכשלה", socialResult.response)
    : socialResult.data?.error ?? "לא התקבלה תמונה";

  const stageResult = await invokeMarketingStage(supabase, itemId, stageId);
  if (!stageResult.error && !stageResult.data?.error) {
    const imageUrl = stageResult.data?.url ?? stageResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      return { imageUrl: (await resolveCreativeImageUrl(imageUrl)) ?? imageUrl, usedFallback: false };
    }
  }

  const stageError = stageResult.error
    ? await invokeErrorMessage(stageResult.error, stageResult.data, "יצירת הקריאייטיב נכשלה", stageResult.response)
    : stageResult.data?.error ?? "לא התקבלה תמונה מהיצירה";

  throw new Error(`${socialError} · pipeline: ${stageError}`);
}
