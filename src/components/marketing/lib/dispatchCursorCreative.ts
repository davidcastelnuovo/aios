import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERATION_ABORTED } from "@/components/marketing/departments/creative/brandKit";
import type { CreativeVariation } from "@/components/marketing/departments/creative/types";
import { isCursorCreativeUnavailable } from "@/components/marketing/lib/cursorCreativeUnavailable";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";

export { isCursorCreativeUnavailable };

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

async function invokeCreativeDirect(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const result = await supabase.functions.invoke("cursor-generate-creative", { body, signal });
  if (result.error || result.data?.error) {
    const message = result.error
      ? await invokeErrorMessage(result.error, result.data, "קריאייטיב דיירקט לא זמין", result.response)
      : String(result.data.error);
    throw new Error(message);
  }
  return (result.data ?? {}) as Record<string, unknown>;
}

export type CreativeDirectChat = {
  agentUrl: string;
  agentId: string;
  reused: boolean;
  open: boolean;
};

const parseChat = (data: Record<string, unknown>): CreativeDirectChat => {
  const agentUrl = String(data.agent_url ?? "");
  const agentId = String(data.cursor_agent_id ?? "");
  return {
    agentUrl,
    agentId,
    reused: Boolean(data.reused),
    open: Boolean(data.open) || Boolean(agentUrl),
  };
};

/** Look up the sticky Creative Direct chat without creating one. */
export async function getCreativeDirectStatus({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}): Promise<CreativeDirectChat> {
  const data = await invokeCreativeDirect(supabase, { action: "status", tenant_id: tenantId });
  return parseChat(data);
}

/** Open the sticky Creative Direct chat if it does not already exist. */
export async function ensureCreativeDirect({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}): Promise<CreativeDirectChat> {
  const data = await invokeCreativeDirect(supabase, { action: "ensure", tenant_id: tenantId });
  const chat = parseChat(data);
  if (!chat.agentUrl) throw new Error("קריאייטיב דיירקט לא החזיר כתובת סשן");
  return chat;
}

export async function dispatchCursorCreative({
  supabase,
  tenantId,
  itemId,
  variation,
  prompt,
  lesson,
  signal,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  variation: Pick<CreativeVariation, "id" | "name" | "format" | "copyKey" | "copyLabel" | "copyText" | "parentId">;
  prompt: string;
  lesson?: string;
  signal?: AbortSignal;
}): Promise<{ agentUrl: string; jobId: string }> {
  if (signal?.aborted) throw new Error(GENERATION_ABORTED);
  const data = await invokeCreativeDirect(supabase, {
    action: "dispatch",
    tenant_id: tenantId,
    item_id: itemId,
    prompt,
    lesson: lesson?.trim() || undefined,
    variation: {
      id: variation.id,
      name: variation.name,
      format: variation.format,
      copy_key: variation.copyKey,
      copy_label: variation.copyLabel,
      copy_text: variation.copyText,
      parent_id: variation.parentId,
    },
  }, signal);
  const agentUrl = String(data.agent_url ?? "");
  const jobId = String(data.job_id ?? "");
  if (!agentUrl || !jobId) throw new Error("קריאייטיב דיירקט לא החזיר כתובת סשן");
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
    if (job?.status === "failed") throw new Error(job.error || "קריאייטיב דיירקט נכשל");
    if (job?.status === "cancelled") throw new Error(GENERATION_ABORTED);
    await sleep(POLL_MS, signal);
  }
  throw new Error("קריאייטיב דיירקט לא סיים בזמן");
}
