import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GscKeywordRow = {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPeriodKey = "current_90d" | "prev_month" | "three_month" | "yearly";

export type GscPeriodDefinition = {
  key: GscPeriodKey;
  startOffset: number;
  endOffset: number;
  maxRows: number;
};

export const GSC_PERIOD_DEFINITIONS: GscPeriodDefinition[] = [
  { key: "current_90d", startOffset: 90, endOffset: 0, maxRows: 5000 },
  { key: "prev_month", startOffset: 58, endOffset: 30, maxRows: 1000 },
  { key: "three_month", startOffset: 118, endOffset: 90, maxRows: 1000 },
  { key: "yearly", startOffset: 393, endOffset: 365, maxRows: 1000 },
];

export function gscDateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function gscPeriodBounds(def: GscPeriodDefinition): { startDate: string; endDate: string } {
  return {
    startDate: gscDateMinus(def.startOffset),
    endDate: gscDateMinus(def.endOffset),
  };
}

export function mapGscApiRow(row: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }): GscKeywordRow {
  return {
    keyword: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr ? Math.round(row.ctr * 10000) / 100 : 0,
    position: row.position ? Math.round(row.position * 10) / 10 : 0,
  };
}

export async function fetchGscKeywordsFromApi(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  maxRows = 5000,
): Promise<GscKeywordRow[]> {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const gscApiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
  const collected: GscKeywordRow[] = [];
  const pageSize = 1000;
  const maxPages = Math.ceil(maxRows / pageSize);

  for (let page = 0; page < maxPages; page++) {
    const resp = await fetch(gscApiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: pageSize,
        startRow: page * pageSize,
        dataState: "final",
      }),
    });
    if (!resp.ok) {
      console.error("GSC API error for site", siteUrl, resp.status, await resp.text());
      break;
    }
    const json = await resp.json();
    const pageRows = Array.isArray(json.rows) ? json.rows : [];
    collected.push(...pageRows.map(mapGscApiRow));
    if (pageRows.length < pageSize) break;
  }
  return collected;
}

export async function resolveGscAccessToken(
  supabase: SupabaseClient,
  tenantIdList: string[],
): Promise<string | null> {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const { data: integrations } = await supabase
    .from("tenant_integrations")
    .select("id, api_key, settings")
    .eq("integration_type", "google_search_console")
    .eq("is_active", true)
    .in("tenant_id", tenantIdList)
    .order("updated_at", { ascending: false })
    .limit(5);

  for (const integration of integrations || []) {
    try {
      let tok = integration.api_key as string;
      const intSettings: Record<string, unknown> = (integration.settings as Record<string, unknown>) || {};
      if (
        intSettings.expires_at &&
        new Date(String(intSettings.expires_at)) < new Date() &&
        intSettings.refresh_token
      ) {
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: String(intSettings.refresh_token),
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResponse.json();
        if (refreshData.access_token) {
          tok = refreshData.access_token;
          const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
          await supabase
            .from("tenant_integrations")
            .update({ api_key: tok, settings: { ...intSettings, expires_at: newExpiresAt } })
            .eq("id", integration.id);
        }
      }
      if (tok) return tok;
    } catch (e) {
      console.error("Error preparing GSC token:", e);
    }
  }
  return null;
}

export type GscSnapshotBundle = {
  current_90d: GscKeywordRow[];
  prev_month: GscKeywordRow[];
  three_month: GscKeywordRow[];
  yearly: GscKeywordRow[];
  synced_at: string | null;
};

export async function readGscSnapshots(
  supabase: SupabaseClient,
  tenantIdList: string[],
  siteUrl: string,
  clientId?: string | null,
): Promise<GscSnapshotBundle | null> {
  let query = supabase
    .from("gsc_keyword_snapshots")
    .select("period_key, keywords, synced_at")
    .eq("site_url", siteUrl)
    .in("tenant_id", tenantIdList);

  if (clientId) {
    query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("readGscSnapshots error:", error);
    return null;
  }
  if (!data?.length) return null;

  const bundle: GscSnapshotBundle = {
    current_90d: [],
    prev_month: [],
    three_month: [],
    yearly: [],
    synced_at: null,
  };

  for (const row of data) {
    const key = row.period_key as GscPeriodKey;
    if (!(key in bundle)) continue;
    const keywords = Array.isArray(row.keywords) ? (row.keywords as GscKeywordRow[]) : [];
    bundle[key] = keywords;
    if (row.synced_at && (!bundle.synced_at || row.synced_at > bundle.synced_at)) {
      bundle.synced_at = row.synced_at;
    }
  }

  if (!bundle.current_90d.length && !bundle.prev_month.length && !bundle.three_month.length && !bundle.yearly.length) {
    return null;
  }
  return bundle;
}

export async function upsertGscSnapshot(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    clientId?: string | null;
    siteUrl: string;
    periodKey: GscPeriodKey;
    startDate: string;
    endDate: string;
    keywords: GscKeywordRow[];
  },
): Promise<void> {
  const { error } = await supabase
    .from("gsc_keyword_snapshots")
    .upsert(
      {
        tenant_id: params.tenantId,
        client_id: params.clientId || null,
        site_url: params.siteUrl,
        period_key: params.periodKey,
        start_date: params.startDate,
        end_date: params.endDate,
        keywords: params.keywords,
        row_count: params.keywords.length,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,site_url,period_key" },
    );
  if (error) console.error("upsertGscSnapshot error:", error);
}

export function mapGscRowsToCrmRecords(rows: GscKeywordRow[]) {
  return rows.map((row) => ({
    data: {
      query: row.keyword,
      keyword: row.keyword,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    },
  }));
}

export function gscBundleToMultiPeriod(bundle: GscSnapshotBundle) {
  return {
    prevMonth: bundle.prev_month,
    threeMonth: bundle.three_month,
    yearly: bundle.yearly,
  };
}

const SEO_SHARE_CACHE_TTL_MS = 10 * 60 * 1000;

export async function readSeoShareCacheFromDb(
  supabase: SupabaseClient,
  shareToken: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("seo_share_response_cache")
    .select("payload, expires_at")
    .eq("share_token", shareToken)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from("seo_share_response_cache").delete().eq("share_token", shareToken);
    return null;
  }
  return JSON.stringify(data.payload);
}

export async function writeSeoShareCacheToDb(
  supabase: SupabaseClient,
  shareToken: string,
  body: string,
  ttlMs = SEO_SHARE_CACHE_TTL_MS,
): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return;
  }
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const { error } = await supabase
    .from("seo_share_response_cache")
    .upsert(
      { share_token: shareToken, payload, expires_at: expiresAt },
      { onConflict: "share_token" },
    );
  if (error) console.error("writeSeoShareCacheToDb error:", error);
}
