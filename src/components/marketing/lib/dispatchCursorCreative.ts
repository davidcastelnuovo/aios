import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERATION_ABORTED } from "@/components/marketing/departments/creative/brandKit";
import type { CreativeVariation } from "@/components/marketing/departments/creative/types";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";

const POLL_MS = 4000;
const TIMEOUT_MS = 8 * 60 * 1000;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(GENERATION_ABORTED));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error(GENERATION_ABORTED));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export async function dispatchCursorCreative({
  supabase,
  tenantId,
  itemId,
  variation,
  prompt,
  signal,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  variation: Pick<CreativeVariation, "id" | "name" | "format" | "copyKey" | "copyLabel" | "copyText" | "parentId">;
  prompt: string;
  signal?: AbortSignal;
}): Promise<{ agentUrl: string; jobId: string }> {
  if (signal?.aborted) throw new Error(GENERATION_ABORTED);
  const result = await supabase.functions.invoke("cursor-generate-creative", {
    body: {
      action: "dispatch",
      tenant_id: tenantId,
      item_id: itemId,
      prompt,
      variation: {
        id: variation.id,
        name: variation.name,
        format: variation.format,
        copy_key: variation.copyKey,
        copy_label: variation.copyLabel,
        copy_text: variation.copyText,
        parent_id: variation.parentId,
      },
    },
    signal,
  });
  if (result.error || result.data?.error) {
    const message = result.error
      ? await invokeErrorMessage(result.error, result.data, "אייג׳נט הקריאייטיב לא זמין", result.response)
      : String(result.data.error);
    throw new Error(message);
  }
  const agentUrl = String(result.data?.agent_url ?? "");
  const jobId = String(result.data?.job_id ?? "");
  if (!agentUrl || !jobId) throw new Error("אייג׳נט הקריאייטיב לא החזיר כתובת סשן");
  return { agentUrl, jobId };
}

export async function waitForCursorCreative({
  supabase,
  tenantId,
  itemId,
  variationId,
  signal,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  variationId: string;
  signal?: AbortSignal;
}): Promise<CreativeVariation> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    if (signal?.aborted) throw new Error(GENERATION_ABORTED);
    const { data, error } = await supabase
      .from("marketing_work_items")
      .select("payload")
      .eq("id", itemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;
    const payload = (data?.payload ?? {}) as Record<string, unknown>;
    const list = Array.isArray(payload.variations) ? payload.variations : [];
    const found = list.find((row) => {
      if (!row || typeof row !== "object") return false;
      const variation = row as CreativeVariation;
      return variation.id === variationId && typeof variation.imageUrl === "string" && variation.imageUrl.length > 0;
    }) as CreativeVariation | undefined;
    if (found) return found;
    const jobs = Array.isArray(payload.creative_jobs) ? payload.creative_jobs : [];
    const job = jobs.find((row) => row && typeof row === "object" && (row as { variation_id?: string }).variation_id === variationId) as
      | { status?: string; error?: string }
      | undefined;
    if (job?.status === "failed") throw new Error(job.error || "אייג׳נט הקריאייטיב נכשל");
    if (job?.status === "cancelled") throw new Error(GENERATION_ABORTED);
    await sleep(POLL_MS, signal);
  }
  throw new Error("אייג׳נט הקריאייטיב לא סיים בזמן");
}

export const isCursorCreativeUnavailable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /404|not found|Failed to send|cursor-generate-creative|not configured|CURSOR_API_KEY/i.test(message);
};
