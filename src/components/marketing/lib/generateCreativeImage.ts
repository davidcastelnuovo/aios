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
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}

const NO_TEXT_ON_IMAGE =
  "No letters, numbers, captions, logos, watermarks, buttons, or typography anywhere. Keep a clean open center and lower third so a 3D title and CTA can be typeset later. Supporting objects may sit in the scene. No Hebrew and no English words.";

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

/** Generate a marketing image. Uses ai-generate-social-image first (gpt-image-1, stable), then marketing-run-stage. */
export async function generateCreativeImage({
  supabase,
  tenantId,
  itemId,
  stageId,
  prompt,
  referenceImageUrls,
  size,
  quality,
}: GenerateCreativeImageArgs): Promise<{ imageUrl: string; usedFallback: boolean }> {
  const socialResult = await invokeSocialImage(supabase, tenantId, itemId, prompt, referenceImageUrls, size, quality);
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
