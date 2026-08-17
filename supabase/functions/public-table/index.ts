import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type GscKeywordRow,
  GSC_PERIOD_DEFINITIONS,
  fetchGscKeywordsFromApi,
  gscBundleToMultiPeriod,
  gscDateMinus,
  gscPeriodBounds,
  mapGscRowsToCrmRecords,
  readGscSnapshots,
  readSeoShareCacheFromDb,
  resolveGscAccessToken,
  writeSeoShareCacheToDb,
} from "../_shared/gscKeywords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(d: Date): string {
  // Format as yyyy-MM-dd in local time (matches DynamicTableView's format(d, 'yyyy-MM-dd'))
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Mirror of getDateRange logic in src/pages/DynamicTableView.tsx
 * (the internal report). MUST stay in sync so the public share link
 * shows the exact same numbers as the internal view.
 *
 * Notably: "last_N_days" includes today for ads reports — same as
 * the internal view and Meta/Google report expectations.
 */
function getDateRange(
  filter: string,
  customStart?: string | null,
  customEnd?: string | null,
): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case "all":
      return { startDate: null, endDate: null };
    case "today":
      return { startDate: fmt(today), endDate: fmt(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case "this_week": {
      // Week starts on Sunday (weekStartsOn: 0 in DynamicTableView)
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case "last_week": {
      const startOfThisWeek = new Date(today);
      startOfThisWeek.setDate(today.getDate() - today.getDay());
      const endLW = subDays(startOfThisWeek, 1);
      const startLW = subDays(endLW, 6);
      return { startDate: fmt(startLW), endDate: fmt(endLW) };
    }
    case "last_7_days":
      // Match Facebook's "Last 7 days": 7 full days ending yesterday.
      return { startDate: fmt(subDays(today, 7)), endDate: fmt(subDays(today, 1)) };
    case "last_14_days":
      return { startDate: fmt(subDays(today, 14)), endDate: fmt(subDays(today, 1)) };
    case "last_30_days":
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
    case "last_70_days":
      return { startDate: fmt(subDays(today, 70)), endDate: fmt(subDays(today, 1)) };
    case "last_90_days":
      return { startDate: fmt(subDays(today, 90)), endDate: fmt(subDays(today, 1)) };
    case "last_180_days":
      return { startDate: fmt(subDays(today, 180)), endDate: fmt(subDays(today, 1)) };
    case "last_365_days":
      return { startDate: fmt(subDays(today, 365)), endDate: fmt(subDays(today, 1)) };
    case "this_month":
      return {
        startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: fmt(today),
      };
    case "last_month":
      return {
        startDate: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        endDate: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "custom":
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
      }
      // Fall through to default if custom range incomplete
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
    default:
      // Default mirrors internal default: last_30_days
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
  }
}

/** Mirror of normalizeSeoDomain / seoDomainsMatch in src/lib/seoDomain.ts */
function normalizeSeoDomain(value?: string | null): string {
  let v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^sc-domain:/, "");
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split("/")[0].split("?")[0].split("#")[0];
  v = v.replace(/:\d+$/, "");
  v = v.replace(/^www\./, "");
  return v;
}

function seoDomainsMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeSeoDomain(a);
  const nb = normalizeSeoDomain(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(`.${nb}`) || nb.endsWith(`.${na}`);
}

/** Mirror of filterSeoReportsByDomain — client-side only, with fallback. */
function filterSeoReportsByDomain<T extends { domain?: string | null }>(
  reports: T[],
  expectedDomain?: string | null,
): T[] {
  const expected = normalizeSeoDomain(expectedDomain);
  if (!expected) return reports || [];
  const matching = (reports || []).filter((r) => seoDomainsMatch(r.domain, expected));
  return matching.length > 0 ? matching : (reports || []);
}

/** Mirror of resolve-seo-gsc-integration — no auth required (service-role only). */
async function resolveGscSiteForClient(
  supabase: ReturnType<typeof createClient>,
  tenantIdList: string[],
  clientId: string,
  expectedSiteUrl?: string | null,
): Promise<string | null> {
  const { data: integrations } = await supabase
    .from("tenant_integrations")
    .select("id, settings")
    .in("tenant_id", tenantIdList)
    .eq("integration_type", "google_search_console")
    .eq("is_active", true);

  type Candidate = { siteUrl: string; rank: number };
  const candidates: Candidate[] = [];

  for (const i of integrations || []) {
    const s: any = i.settings || {};
    const clientSites = s.client_sites || {};
    const availableSites: any[] = Array.isArray(s.available_sites) ? s.available_sites : [];
    const mappedForClient: string | null = clientSites[clientId] || null;
    const isMappingUsable = (siteUrl: string | null) => {
      if (!siteUrl) return false;
      const meta = availableSites.find((x: any) => x?.siteUrl === siteUrl);
      return !meta || meta.permissionLevel !== "siteUnverifiedUser";
    };

    if (mappedForClient && isMappingUsable(mappedForClient)) {
      if (!expectedSiteUrl || seoDomainsMatch(mappedForClient, expectedSiteUrl)) {
        candidates.push({ siteUrl: mappedForClient, rank: 1 });
        continue;
      }
    }

    if (expectedSiteUrl) {
      const siteMatch = availableSites.find(
        (x: any) =>
          x?.permissionLevel !== "siteUnverifiedUser" &&
          seoDomainsMatch(x?.siteUrl, expectedSiteUrl),
      );
      if (siteMatch?.siteUrl) {
        candidates.push({ siteUrl: siteMatch.siteUrl, rank: 2 });
        continue;
      }
    }

    if (mappedForClient && isMappingUsable(mappedForClient)) {
      candidates.push({ siteUrl: mappedForClient, rank: 3 });
    }
  }

  candidates.sort((a, b) => a.rank - b.rank);
  return candidates[0]?.siteUrl || null;
}

const SEO_SHARE_CACHE_TTL_MS = 10 * 60 * 1000;
const seoShareResponseCache = new Map<string, { body: string; expiresAt: number }>();

function readSeoShareCacheLocal(cacheKey: string): string | null {
  const hit = seoShareResponseCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    seoShareResponseCache.delete(cacheKey);
    return null;
  }
  return hit.body;
}

function writeSeoShareCacheLocal(cacheKey: string, body: string) {
  seoShareResponseCache.set(cacheKey, {
    body,
    expiresAt: Date.now() + SEO_SHARE_CACHE_TTL_MS,
  });
  if (seoShareResponseCache.size > 150) {
    const oldest = seoShareResponseCache.keys().next().value;
    if (oldest) seoShareResponseCache.delete(oldest);
  }
}

async function readSeoShareCache(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
): Promise<string | null> {
  const local = readSeoShareCacheLocal(cacheKey);
  if (local) return local;
  const db = await readSeoShareCacheFromDb(supabase, cacheKey);
  if (db) writeSeoShareCacheLocal(cacheKey, db);
  return db;
}

async function writeSeoShareCache(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  body: string,
) {
  writeSeoShareCacheLocal(cacheKey, body);
  await writeSeoShareCacheToDb(supabase, cacheKey, body, SEO_SHARE_CACHE_TTL_MS);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Strip bulky fields from Ahrefs reports for anonymous share links. Keywords stay intact. */
function trimAhrefsReportsForPublic(reports: any[]): any[] {
  return (reports || []).map((report, index) => {
    const rd = report?.report_data;
    if (!rd || typeof rd !== "object") return report;
    const trimmedRd: Record<string, unknown> = {};
    for (const key of [
      "domain",
      "snapshot",
      "snapshot_prev_month",
      "snapshot_prev",
      "snapshot_campaign_start",
      "campaign_start_date",
      "organic_keywords",
      "tracked_keywords",
      "project_name",
    ]) {
      if (rd[key] !== undefined) trimmedRd[key] = rd[key];
    }
    // HTML deck only on the default (latest) report — same as typical public view.
    if (index === 0 && typeof rd.html === "string" && rd.html.trim()) {
      trimmedRd.html = rd.html;
    }
    return {
      id: report.id,
      domain: report.domain,
      report_type: report.report_type,
      report_date: report.report_date,
      received_at: report.received_at,
      metadata: report.metadata,
      report_data: trimmedRd,
      comparison_data: index === 0 ? report.comparison_data : null,
    };
  });
}

/** Only the GA row types used by computeGaOrganicByMonth — not thousands of daily rows. */
async function fetchGaRecordsForSeoChart(
  supabase: ReturnType<typeof createClient>,
  gaTableId: string,
): Promise<any[]> {
  const reportTypes = ["monthly_channel", "daily_source", "monthly_organic"] as const;
  const pages = await Promise.all(
    reportTypes.map((reportType) =>
      supabase
        .from("crm_records")
        .select("id, data")
        .eq("table_id", gaTableId)
        .eq("data->>report_type", reportType)
        .order("created_at", { ascending: false })
        .limit(reportType === "daily_source" ? 800 : 120)
    ),
  );
  const out: any[] = [];
  for (const { data, error } of pages) {
    if (error) {
      console.error("Error fetching GA records for SEO chart:", error);
      continue;
    }
    if (data?.length) out.push(...data);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST: allow viewers of a share link to update manual_roi (closures/revenue)
  // on the shared table. Auth is the share token itself (must be active + allow_edit).
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const shareToken = body?.token as string | undefined;
      const manualRoi = body?.manual_roi as { closures?: number | null; revenue?: number | null } | undefined;
      if (!shareToken || !manualRoi) {
        return new Response(JSON.stringify({ error: "Missing token or manual_roi" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const { data: share } = await supabase
        .from("table_shares")
        .select("table_id, is_active")
        .eq("share_token", shareToken)
        .eq("is_active", true)
        .single();

      if (!share?.table_id) {
        return new Response(JSON.stringify({ error: "Invalid or inactive share link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tbl } = await supabase
        .from("crm_tables")
        .select("integration_settings")
        .eq("id", share.table_id)
        .single();

      const baseSettings = (tbl?.integration_settings as any) || {};
      const newSettings = {
        ...baseSettings,
        manual_roi: {
          closures: manualRoi.closures == null ? null : Number(manualRoi.closures) || 0,
          revenue: manualRoi.revenue == null ? null : Number(manualRoi.revenue) || 0,
        },
      };

      const { error: updateError } = await supabase
        .from("crm_tables")
        .update({ integration_settings: newSettings })
        .eq("id", share.table_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Error in public-table POST:", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get("token");
    const dateFilter = url.searchParams.get("date_filter") || "last_30_days";
    const customStart = url.searchParams.get("custom_start");
    const customEnd = url.searchParams.get("custom_end");
    const seoPart = url.searchParams.get("seo_part"); // core | gsc | null (full)
    const liveGsc = url.searchParams.get("live_gsc") === "1";

    if (!shareToken) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the share
    const { data: share, error: shareError } = await supabase
      .from("table_shares")
      .select("*, crm_tables(*)")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive share link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const table = share.crm_tables;
    if (!table) {
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agency name via client association
    let agencyName: string | null = null;
    if (table.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("agency_id, agencies(name)")
        .eq("id", table.client_id)
        .single();
      agencyName = (client?.agencies as any)?.name || null;
    }

    // Fetch fields
    const { data: fields } = await supabase
      .from("crm_fields")
      .select("*")
      .eq("table_id", table.id)
      .order("sort_order");

    // For Ahrefs/SEO tables — return the actual SEO reports payload so the
    // public viewer can render the visual SEO dashboard instead of a raw table.
    if (table.integration_type === "ahrefs") {
      const cacheKey = seoPart === "gsc"
        ? `${shareToken}:gsc`
        : seoPart === "core"
        ? `${shareToken}:core`
        : shareToken;
      const cachedSeoBody = await readSeoShareCache(supabase, cacheKey);
      if (cachedSeoBody) {
        return new Response(cachedSeoBody, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            "X-Cache": "HIT",
          },
        });
      }

      const settings = (table.integration_settings as any) || {};
      const targetClientId = settings.clientId || table.client_id;
      const targetDomain = settings.targetDomain || null;
      const linkedGscSiteUrl = settings.linkedGscSiteUrl || null;
      const linkedGaTableId = settings.linkedGaTableId || null;
      const linkedGscTableId = settings.linkedGscTableId || null;

      const accessibleTenantIds = new Set<string>();
      accessibleTenantIds.add(table.tenant_id);
      let clientAgencyId: string | null = null;
      let clientName: string | null = null;
      let clientWebsite: string | null = null;
      let seoForceRelevant: string[] = [];
      let seoForceIrrelevant: string[] = [];

      const clientContextPromise = (async () => {
        if (!targetClientId) return;
        try {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("tenant_id, agency_id, name, website, seo_keyword_relevance")
            .eq("id", targetClientId)
            .maybeSingle();
          if (clientRow?.tenant_id) accessibleTenantIds.add(clientRow.tenant_id);
          clientAgencyId = clientRow?.agency_id || null;
          clientName = (clientRow as any)?.name || null;
          clientWebsite = (clientRow as any)?.website || null;
          const relevance = (clientRow as any)?.seo_keyword_relevance || {};
          const asList = (v: unknown): string[] =>
            Array.isArray(v)
              ? v.map((x) => String(x || "").trim()).filter(Boolean)
              : [];
          seoForceRelevant = asList(relevance.force_relevant ?? relevance.forceRelevant);
          seoForceIrrelevant = asList(relevance.force_irrelevant ?? relevance.forceIrrelevant);
          if (clientAgencyId) {
            const { data: accessRows } = await supabase
              .from("agency_tenant_access")
              .select("accessing_tenant_id, source_tenant_id")
              .eq("agency_id", clientAgencyId);
            for (const r of accessRows || []) {
              if (r.accessing_tenant_id) accessibleTenantIds.add(r.accessing_tenant_id);
              if (r.source_tenant_id) accessibleTenantIds.add(r.source_tenant_id);
            }
          }
        } catch (e) {
          console.error("Error resolving accessible tenants:", e);
        }
      })();

      const tenantIdList = () => Array.from(accessibleTenantIds);

      const ahrefsPromise = seoPart === "gsc"
        ? Promise.resolve([] as any[])
        : (async () => {
        await clientContextPromise;
        const tenants = tenantIdList();
        let reportsQuery = supabase
          .from("ahrefs_reports")
          .select("id, domain, report_type, report_date, received_at, report_data, comparison_data, metadata")
          .in("tenant_id", tenants)
          .order("received_at", { ascending: false })
          .order("report_date", { ascending: false, nullsFirst: false })
          .limit(12);
        if (targetClientId) reportsQuery = reportsQuery.eq("client_id", targetClientId);
        const { data: ahrefsReportsRaw, error: reportsErr } = await reportsQuery;
        if (reportsErr) console.error("Error fetching ahrefs reports:", reportsErr);
        return trimAhrefsReportsForPublic(
          filterSeoReportsByDomain(ahrefsReportsRaw || [], targetDomain),
        );
      })();

      const gaGscTablesPromise = (async () => {
        await clientContextPromise;
        const tenants = tenantIdList();
        let gaTable: any = null;
        let gscTable: any = null;
        try {
          if (linkedGaTableId) {
            const { data } = await supabase
              .from("crm_tables")
              .select("id, name, integration_settings")
              .eq("id", linkedGaTableId)
              .maybeSingle();
            gaTable = data || null;
          } else if (targetClientId) {
            const { data } = await supabase
              .from("crm_tables")
              .select("id, name, integration_settings")
              .in("tenant_id", tenants)
              .eq("integration_type", "google_analytics")
              .eq("client_id", targetClientId)
              .limit(1);
            gaTable = data?.[0] || null;
          }
        } catch (e) {
          console.error("Error resolving GA table:", e);
        }
        try {
          if (linkedGscTableId) {
            const { data } = await supabase
              .from("crm_tables")
              .select("id, name, integration_settings")
              .eq("id", linkedGscTableId)
              .maybeSingle();
            gscTable = data || null;
          } else if (targetClientId) {
            const { data } = await supabase
              .from("crm_tables")
              .select("id, name, integration_settings")
              .in("tenant_id", tenants)
              .eq("integration_type", "google_search_console")
              .eq("client_id", targetClientId)
              .limit(1);
            gscTable = data?.[0] || null;
          }
        } catch (e) {
          console.error("Error resolving GSC table:", e);
        }
        return { gaTable, gscTable };
      })();

      const maskyooPromise = seoPart === "gsc"
        ? Promise.resolve({ snapshots: [] as any[], period: null })
        : (async (): Promise<{ snapshots: any[]; period: { start: string; end: string } | null }> => {
        await clientContextPromise;
        if (!targetClientId) return { snapshots: [], period: null };
        try {
          const now = new Date();
          const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
          const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
          const period = { start: fmtDate(prevMonthStart), end: fmtDate(prevMonthEnd) };
          const { data: snaps } = await supabase
            .from("seo_call_snapshots")
            .select("category, incoming_count, is_manual")
            .in("tenant_id", tenantIdList())
            .eq("client_id", targetClientId)
            .eq("period_start", period.start)
            .eq("period_end", period.end);
          return { snapshots: snaps || [], period };
        } catch (e) {
          console.error("Error fetching maskyoo snapshots:", e);
          return { snapshots: [], period: null };
        }
      })();

      const seoMonthlyPromise = seoPart === "gsc"
        ? Promise.resolve({
          client_name: null,
          domain: null,
          share_token: null,
          months: [] as Array<{
            month: string;
            status: string;
            work: unknown;
            notes: string | null;
            share_token: string | null;
            snapshot: unknown | null;
          }>,
        })
        : (async () => {
        await clientContextPromise;
        const seoMonthly: {
          client_name: string | null;
          domain: string | null;
          share_token: string | null;
          months: Array<{
            month: string;
            status: string;
            work: unknown;
            notes: string | null;
            share_token: string | null;
            snapshot: unknown | null;
          }>;
        } = {
          client_name: clientName,
          domain: targetDomain || clientWebsite,
          share_token: null,
          months: [],
        };
        if (!targetClientId) return seoMonthly;
        try {
          const [{ data: monthlyRows }, { data: monthlyShare }] = await Promise.all([
            supabase
              .from("seo_monthly_updates")
              .select("month, status, work, notes")
              .eq("client_id", targetClientId)
              .order("month", { ascending: false })
              .limit(12),
            supabase
              .from("seo_monthly_shares")
              .select("share_token, month, is_active, snapshot")
              .eq("client_id", targetClientId)
              .eq("is_active", true)
              .order("month", { ascending: false })
              .limit(12),
          ]);
          const shareByMonth = new Map<string, any>();
          for (const shareRow of monthlyShare || []) {
            shareByMonth.set(String(shareRow.month || "").slice(0, 10), shareRow);
          }
          seoMonthly.months = (monthlyRows || []).map((row: any) => {
            const month = String(row.month || "").slice(0, 10);
            const shareRow = shareByMonth.get(month);
            return {
              month,
              status: row.status || "stable",
              work: row.work ?? {},
              notes: row.notes ?? null,
              share_token: shareRow?.share_token || null,
              snapshot: shareRow?.snapshot && typeof shareRow.snapshot === "object" ? shareRow.snapshot : null,
            };
          });
          const now = new Date();
          const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
          const lastMonth = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
          const matched =
            seoMonthly.months.find((m) => m.month === lastMonth && m.share_token) ||
            seoMonthly.months.find((m) => m.share_token) ||
            null;
          seoMonthly.share_token = matched?.share_token || null;
        } catch (e) {
          console.error("Error fetching seo monthly work for public table:", e);
        }
        return seoMonthly;
      })();

      const [ahrefsReports, { gaTable, gscTable }, maskyooResult, seoMonthly] = await Promise.all([
        ahrefsPromise,
        gaGscTablesPromise,
        maskyooPromise,
        seoMonthlyPromise,
      ]);

      await clientContextPromise;

      const effectiveGscSiteUrl =
        linkedGscSiteUrl ||
        (gscTable?.integration_settings as any)?.siteUrl ||
        (targetClientId
          ? await resolveGscSiteForClient(
            supabase,
            tenantIdList(),
            targetClientId,
            linkedGscSiteUrl || targetDomain || clientWebsite,
          )
          : null);

      const gaRecordsPromise = seoPart === "gsc" || !gaTable?.id
        ? Promise.resolve([] as any[])
        : fetchGaRecordsForSeoChart(supabase, gaTable.id);

      const gscBundlePromise = (async () => {
        if (seoPart === "core") {
          return { gscRecords: [] as any[], gscMultiPeriod: null, gscSyncedAt: null };
        }

        let gscRecords: any[] = [];
        let gscMultiPeriod: { prevMonth: GscKeywordRow[]; threeMonth: GscKeywordRow[]; yearly: GscKeywordRow[] } | null = null;
        let gscSyncedAt: string | null = null;
        if (!effectiveGscSiteUrl) return { gscRecords, gscMultiPeriod, gscSyncedAt };

        try {
          const snapshotBundle = await readGscSnapshots(
            supabase,
            tenantIdList(),
            effectiveGscSiteUrl,
            targetClientId,
          );
          if (snapshotBundle) {
            gscSyncedAt = snapshotBundle.synced_at;
            if (snapshotBundle.current_90d.length > 0) {
              gscRecords = mapGscRowsToCrmRecords(snapshotBundle.current_90d);
            }
            gscMultiPeriod = gscBundleToMultiPeriod(snapshotBundle);
          }
        } catch (e) {
          console.error("Error reading GSC snapshots:", e);
        }

        if (gscRecords.length === 0 && gscTable?.id) {
          try {
            for (let from = 0; from < 3000; from += 1000) {
              const { data: page, error } = await supabase
                .from("crm_records")
                .select("id, data")
                .eq("table_id", gscTable.id)
                .order("created_at", { ascending: false })
                .range(from, from + 999);
              if (error || !page || page.length === 0) break;
              gscRecords.push(...page);
              if (page.length < 1000) break;
            }
          } catch (e) {
            console.error("Error fetching GSC records:", e);
          }
        }

        const needsLiveGsc = liveGsc || gscRecords.length === 0;
        if (needsLiveGsc) {
          try {
            const accessToken = await resolveGscAccessToken(supabase, tenantIdList());
            if (accessToken) {
              const currentDef = GSC_PERIOD_DEFINITIONS.find((p) => p.key === "current_90d")!;
              const { startDate, endDate } = gscPeriodBounds(currentDef);
              const [currentRows, pm, tm, yr] = await Promise.all([
                fetchGscKeywordsFromApi(accessToken, effectiveGscSiteUrl, startDate, endDate, currentDef.maxRows),
                withTimeout(
                  fetchGscKeywordsFromApi(
                    accessToken,
                    effectiveGscSiteUrl,
                    gscDateMinus(58),
                    gscDateMinus(30),
                    1000,
                  ),
                  4500,
                  [] as GscKeywordRow[],
                ),
                withTimeout(
                  fetchGscKeywordsFromApi(
                    accessToken,
                    effectiveGscSiteUrl,
                    gscDateMinus(118),
                    gscDateMinus(90),
                    1000,
                  ),
                  4500,
                  [] as GscKeywordRow[],
                ),
                withTimeout(
                  fetchGscKeywordsFromApi(
                    accessToken,
                    effectiveGscSiteUrl,
                    gscDateMinus(393),
                    gscDateMinus(365),
                    1000,
                  ),
                  4500,
                  [] as GscKeywordRow[],
                ),
              ]);

              if (currentRows.length > 0) {
                gscRecords = mapGscRowsToCrmRecords(currentRows);
              }
              gscMultiPeriod = { prevMonth: pm, threeMonth: tm, yearly: yr };
              gscSyncedAt = new Date().toISOString();
            }
          } catch (e) {
            console.error("Error fetching live GSC keywords:", e);
          }
        }

        return { gscRecords, gscMultiPeriod, gscSyncedAt };
      })();

      const [gaRecords, { gscRecords, gscMultiPeriod, gscSyncedAt }] = await Promise.all([
        gaRecordsPromise,
        gscBundlePromise,
      ]);

      if (seoPart === "gsc") {
        const gscPayload = {
          gsc_records: gscRecords,
          gsc_multi_period: gscMultiPeriod,
          gsc_synced_at: gscSyncedAt,
        };
        const gscBody = JSON.stringify(gscPayload);
        await writeSeoShareCache(supabase, cacheKey, gscBody);
        return new Response(gscBody, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            "X-Cache": "MISS",
          },
        });
      }

      const seoPayload = {
        table: {
          id: table.id,
          name: table.name,
          integration_type: table.integration_type,
          integration_settings: table.integration_settings,
          agency_name: agencyName,
          client_id: targetClientId || null,
        },
        fields: fields || [],
        records: [],
        ahrefs_reports: ahrefsReports || [],
        ga_table: gaTable ? { id: gaTable.id, name: gaTable.name, integration_settings: gaTable.integration_settings } : null,
        ga_records: gaRecords,
        gsc_table: gscTable ? { id: gscTable.id, name: gscTable.name, integration_settings: gscTable.integration_settings } : null,
        gsc_records: gscRecords,
        gsc_multi_period: gscMultiPeriod,
        gsc_synced_at: gscSyncedAt,
        maskyoo_snapshots: maskyooResult.snapshots,
        maskyoo_period: maskyooResult.period,
        seo_monthly: seoMonthly,
        seo_keyword_relevance: {
          force_relevant: seoForceRelevant,
          force_irrelevant: seoForceIrrelevant,
        },
        has_email_restriction: false,
      };

      const seoBody = JSON.stringify(seoPayload);
      await writeSeoShareCache(supabase, cacheKey, seoBody);

      return new Response(seoBody, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "X-Cache": "MISS",
        },
      });
    }

    // Calculate date range — mirror of internal DynamicTableView logic
    const { startDate, endDate } = getDateRange(dateFilter, customStart, customEnd);

    // Fetch records WITH PAGINATION (bypass 1000-row default limit)
    const allRecords: any[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await supabase
        .from("crm_records")
        .select("*")
        .eq("table_id", table.id)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching records page:", error);
        break;
      }
      if (!page || page.length === 0) break;
      allRecords.push(...page);
      if (page.length < pageSize) break;
    }

    // Filter by date — uses ONLY record.data.date so it matches the internal
    // DynamicTableView 1:1 (which also reads record.data.date). For "all"
    // (startDate === null) — return everything.
    const filteredRecords = !startDate
      ? allRecords
      : allRecords.filter((r: any) => {
          const recordDate = r.data?.date;
          if (!recordDate) return true; // keep non-dated records (matches internal)
          if (endDate) return recordDate >= startDate && recordDate <= endDate;
          return recordDate >= startDate;
        });



    return new Response(
      JSON.stringify({
        table: {
          id: table.id,
          name: table.name,
          integration_type: table.integration_type,
          integration_settings: table.integration_settings,
          agency_name: agencyName,
        },
        fields: fields || [],
        records: filteredRecords,
        has_email_restriction: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in public-table:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

