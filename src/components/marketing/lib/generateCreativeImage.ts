import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";

interface GenerateCreativeImageArgs {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  stageId: string;
  prompt: string;
}

/** Primary path: marketing-run-stage (skins, runs, pipeline). Fallback: ai-generate-social-image (OPENAI_API_KEY secret). */
export async function generateCreativeImage({
  supabase,
  tenantId,
  itemId,
  stageId,
  prompt,
}: GenerateCreativeImageArgs): Promise<{ imageUrl: string; usedFallback: boolean }> {
  const stageResult = await supabase.functions.invoke("marketing-run-stage", {
    body: { item_id: itemId, stage_id: stageId },
  });

  if (!stageResult.error && !stageResult.data?.error) {
    const imageUrl = stageResult.data?.url ?? stageResult.data?.image_url;
    if (imageUrl && typeof imageUrl === "string") {
      return { imageUrl, usedFallback: false };
    }
  }

  const stageError = stageResult.error
    ? await invokeErrorMessage(stageResult.error, stageResult.data, "יצירת הקריאייטיב נכשלה", stageResult.response)
    : stageResult.data?.error ?? "לא התקבלה תמונה מהיצירה";

  const fallbackResult = await supabase.functions.invoke("ai-generate-social-image", {
    body: {
      prompt,
      tenant_id: tenantId,
      post_id: itemId,
    },
  });

  if (fallbackResult.error) {
    const fallbackError = await invokeErrorMessage(
      fallbackResult.error,
      fallbackResult.data,
      "יצירת תמונה נכשלה",
      fallbackResult.response,
    );
    throw new Error(`${stageError} · גיבוי: ${fallbackError}`);
  }
  if (fallbackResult.data?.error) {
    throw new Error(`${stageError} · גיבוי: ${fallbackResult.data.error}`);
  }

  const imageUrl = fallbackResult.data?.image_url;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error(stageError);
  }

  return { imageUrl, usedFallback: true };
}
