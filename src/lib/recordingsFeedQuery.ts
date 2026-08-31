import { supabase } from "@/integrations/supabase/client";

/** Full feed select — disambiguated FKs (see #162). */
export const RECORDINGS_FEED_SELECT =
  "*, clients!zoom_recordings_client_id_fkey(name), leads(company_name), agencies!zoom_recordings_agency_id_fkey(name)";

const STALE_PROCESSING_MS = 10 * 60 * 1000;

async function markStaleProcessing(list: any[]) {
  const stale = list.filter(
    (r) =>
      r.transcription_status === "processing" &&
      !r.transcription &&
      Date.now() - new Date(r.updated_at || r.created_at).getTime() > STALE_PROCESSING_MS,
  );
  if (stale.length === 0) return;

  await supabase
    .from("zoom_recordings")
    .update({
      transcription_status: "failed",
      transcription_error: "תהליך התמלול נתקע (timeout)",
    } as any)
    .in(
      "id",
      stale.map((r) => r.id),
    );

  stale.forEach((r) => {
    r.transcription_status = "failed";
    r.transcription_error = "תהליך התמלול נתקע (timeout)";
  });
}

/**
 * Load tenant recordings for the feed. Tries relational embeds first; on PostgREST
 * embed/RLS failures falls back to plain rows so the module still opens.
 */
export async function fetchRecordingsFeed(tenantId: string) {
  const ordered = supabase
    .from("zoom_recordings")
    .select(RECORDINGS_FEED_SELECT)
    .eq("tenant_id", tenantId)
    .order("start_time", { ascending: false, nullsFirst: false });

  const { data, error } = await ordered;

  if (!error) {
    const list = data || [];
    await markStaleProcessing(list);
    return { list, usedFallback: false as const };
  }

  console.error("[recordings] embed query failed, retrying without joins:", error.message);

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("zoom_recordings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("start_time", { ascending: false, nullsFirst: false });

  if (fallbackError) throw fallbackError;

  const list = fallbackData || [];
  await markStaleProcessing(list);
  return { list, usedFallback: true as const, embedError: error.message };
}
