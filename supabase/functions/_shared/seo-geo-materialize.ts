import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type ContentPlanItem = {
  title?: string;
  contentType?: string;
  primaryKeyword?: string;
  cluster?: string;
  intent?: string;
  angle?: string;
  geoQuestions?: string[];
  priority?: string;
};

type Cluster = {
  name?: string;
  pillarKeyword?: string;
  supportingKeywords?: string[];
  intent?: string;
  priority?: string;
  evidence?: string;
};

type SeoPlan = {
  clusters?: Cluster[];
  contentPlan?: ContentPlanItem[];
};

function spreadDates(count: number, horizonMonths: number): string[] {
  if (count <= 0) return [];
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + Math.max(1, horizonMonths));
  const days: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dow = cursor.getUTCDay();
    if (dow !== 5 && dow !== 6) days.push(cursor.toISOString().slice(0, 10));
  }
  if (!days.length) return [];
  const step = Math.max(1, Math.floor(days.length / count));
  return Array.from({ length: count }, (_, i) => days[Math.min(i * step, days.length - 1)]);
}

export async function materializeSeoGeoPlan(
  admin: SupabaseClient,
  params: {
    workItemId: string;
    tenantId: string;
    clientId: string;
    plan: SeoPlan;
    autoApprove: boolean;
    horizonMonths: number;
    replaceExisting?: boolean;
  },
) {
  const { workItemId, tenantId, clientId, plan, autoApprove, horizonMonths, replaceExisting } = params;

  if (replaceExisting) {
    await admin.from("seo_geo_calendar_entries").delete().eq("work_item_id", workItemId);
    await admin.from("seo_geo_keywords").delete().eq("work_item_id", workItemId);
  }

  const keywordRows: Record<string, unknown>[] = [];
  let sort = 0;
  for (const cluster of plan.clusters ?? []) {
    const keywords = [cluster.pillarKeyword, ...(cluster.supportingKeywords ?? [])].filter(Boolean) as string[];
    for (const keyword of keywords) {
      keywordRows.push({
        tenant_id: tenantId,
        client_id: clientId,
        work_item_id: workItemId,
        keyword,
        intent: cluster.intent ?? null,
        priority: cluster.priority ?? "medium",
        source: "plan",
        promoted: true,
        evidence: cluster.evidence ?? null,
        sort_order: sort++,
      });
    }
  }

  const contentPlan = plan.contentPlan ?? [];
  for (const item of contentPlan) {
    if (!item.primaryKeyword) continue;
    if (keywordRows.some((row) => row.keyword === item.primaryKeyword)) continue;
    keywordRows.push({
      tenant_id: tenantId,
      client_id: clientId,
      work_item_id: workItemId,
      keyword: item.primaryKeyword,
      intent: item.intent ?? null,
      priority: item.priority ?? "medium",
      source: "plan",
      promoted: true,
      evidence: item.cluster ?? null,
      sort_order: sort++,
    });
  }

  if (keywordRows.length) {
    const { error } = await admin.from("seo_geo_keywords").upsert(keywordRows, { onConflict: "work_item_id,keyword" });
    if (error) throw error;
  }

  const dates = spreadDates(contentPlan.length, horizonMonths);
  const now = new Date().toISOString();
  const entries = contentPlan.map((item, index) => ({
    tenant_id: tenantId,
    client_id: clientId,
    work_item_id: workItemId,
    scheduled_date: dates[index] ?? dates[dates.length - 1] ?? now.slice(0, 10),
    title: item.title || item.primaryKeyword || `מאמר ${index + 1}`,
    primary_keyword: item.primaryKeyword ?? null,
    content_type: item.contentType ?? null,
    cluster: item.cluster ?? null,
    intent: item.intent ?? null,
    angle: item.angle ?? null,
    geo_questions: item.geoQuestions ?? [],
    approval_status: autoApprove ? "auto_approved" : "pending",
    approved_at: autoApprove ? now : null,
    approved_by_carmen: autoApprove,
    generation_status: "planned",
    plan_index: index,
  }));

  if (entries.length) {
    const { error } = await admin.from("seo_geo_calendar_entries").insert(entries);
    if (error) throw error;
  }

  return { keywords: keywordRows.length, entries: entries.length };
}

export async function syncTrackedKeywords(
  admin: SupabaseClient,
  params: { workItemId: string; tenantId: string; clientId: string },
) {
  const { data: projects } = await admin
    .from("rank_tracking_projects")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("client_id", params.clientId)
    .eq("is_active", true);
  const ids = (projects ?? []).map((p) => p.id);
  if (!ids.length) return 0;
  const { data: tracked } = await admin
    .from("rank_tracking_keywords")
    .select("keyword,current_position,search_volume")
    .in("project_id", ids)
    .eq("is_active", true)
    .limit(200);
  const rows = (tracked ?? []).map((row, index) => ({
    tenant_id: params.tenantId,
    client_id: params.clientId,
    work_item_id: params.workItemId,
    keyword: row.keyword,
    source: "tracked",
    promoted: true,
    priority: "medium",
    metadata: { position: row.current_position, volume: row.search_volume },
    sort_order: 1000 + index,
  }));
  if (!rows.length) return 0;
  const { error } = await admin.from("seo_geo_keywords").upsert(rows, { onConflict: "work_item_id,keyword" });
  if (error) throw error;
  return rows.length;
}
