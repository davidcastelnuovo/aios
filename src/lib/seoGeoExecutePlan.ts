import { invokeEdgeFunction } from "@/lib/edgeFunctionInvoke";
import { seoGeoDb } from "@/lib/seoGeoDb";
import { isEntryApproved } from "@/lib/seoGeoCalendar";

/** Build the gantt from an approved plan and mark every entry approved. */
export async function materializeApprovedPlan(workItemId: string) {
  const data = await invokeEdgeFunction<{ keywords: number; entries: number }>("marketing-seo-materialize", {
    work_item_id: workItemId,
    mark_approved: true,
    replace_existing: true,
  });
  const { error } = await seoGeoDb.from("seo_geo_calendar_entries").update({
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by_carmen: false,
  }).eq("work_item_id", workItemId).eq("approval_status", "pending");
  if (error) throw error;
  return data;
}

/** Write planned, already-approved articles. `limit` caps a single user action so the UI stays responsive. */
export async function writePlannedArticles(
  workItemId: string,
  limit: number,
  onProgress?: (title: string) => void,
) {
  const { data, error } = await seoGeoDb
    .from("seo_geo_calendar_entries")
    .select("id,title,generation_status,approval_status")
    .eq("work_item_id", workItemId)
    .order("scheduled_date");
  if (error) throw error;
  const targets = (data ?? []).filter(
    (entry: { approval_status: string; generation_status: string }) =>
      isEntryApproved(entry.approval_status) && entry.generation_status === "planned",
  );
  const slice = targets.slice(0, limit);
  for (const entry of slice) {
    onProgress?.(String(entry.title ?? "מאמר"));
    await invokeEdgeFunction("marketing-seo-generate-entry", { entry_id: entry.id });
  }
  return { written: slice.length, remaining: Math.max(0, targets.length - slice.length) };
}
