import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type GscKeywordRow = {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function mapGscApiRow(row: any): GscKeywordRow {
  return {
    keyword: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr ? Math.round(row.ctr * 10000) / 100 : 0,
    position: row.position ? Math.round(row.position * 10) / 10 : 0,
  };
}

async function resolveGscAccessToken(
  supabase: ReturnType<typeof createClient>,
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
      const intSettings: any = integration.settings || {};
      if (intSettings.expires_at && new Date(intSettings.expires_at) < new Date() && intSettings.refresh_token) {
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: intSettings.refresh_token,
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

async function fetchGscKeywordsLive(
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
      const settings = (table.integration_settings as any) || {};
      // IMPORTANT: prefer settings.clientId over table.client_id.
      // The internal SEO report (useAhrefsReports) is driven by the clientId
      // saved in the SEO settings/URL, and Ahrefs reports are stored under
      // that same clientId. table.client_id sometimes points at a different
      // (sibling) client and would silently filter out all reports.
      const targetClientId = settings.clientId || table.client_id;
      const targetDomain = settings.targetDomain || null;
      const linkedGscSiteUrl = settings.linkedGscSiteUrl || null;

      // Build the set of accessible tenant_ids for this client (mirrors useSeoScope):
      // home tenant + every tenant sharing the agency via agency_tenant_access.
      const accessibleTenantIds = new Set<string>();
      accessibleTenantIds.add(table.tenant_id);
      let clientAgencyId: string | null = null;
      let clientName: string | null = null;
      let clientWebsite: string | null = null;
      // Manual "לא רלוונטי" / "רלוונטי" overrides — shared with PublicSeoView.
      let seoForceRelevant: string[] = [];
      let seoForceIrrelevant: string[] = [];
      if (targetClientId) {
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
      }
      const tenantIdList = Array.from(accessibleTenantIds);

      // Ahrefs reports — search across all accessible tenants
      // Order MUST match SeoDashboardView (received_at DESC, then report_date DESC)
      // so the "first/latest" report shown publicly is the same one the user sees internally.
      // Cap at 20: matching the in-app report list keeps the public payload small/fast.
      let reportsQuery = supabase
        .from("ahrefs_reports")
        .select("id, domain, report_type, report_date, received_at, report_data, comparison_data, metadata")
        .in("tenant_id", tenantIdList)
        .order("received_at", { ascending: false })
        .order("report_date", { ascending: false, nullsFirst: false })
        .limit(20);

      if (targetClientId) reportsQuery = reportsQuery.eq("client_id", targetClientId);

      const { data: ahrefsReportsRaw, error: reportsErr } = await reportsQuery;
      if (reportsErr) console.error("Error fetching ahrefs reports:", reportsErr);
      const ahrefsReports = filterSeoReportsByDomain(ahrefsReportsRaw || [], targetDomain);

      // Fetch linked GA / GSC tables (per integration_settings or by client_id)
      const linkedGaTableId = settings.linkedGaTableId || null;
      const linkedGscTableId = settings.linkedGscTableId || null;

      let gaTable: any = null;
      let gscTable: any = null;
      let gaRecords: any[] = [];
      let gscRecords: any[] = [];

      // Resolve GA table — search across accessible tenants
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
            .in("tenant_id", tenantIdList)
            .eq("integration_type", "google_analytics")
            .eq("client_id", targetClientId)
            .limit(1);
          gaTable = data?.[0] || null;
        }
      } catch (e) {
        console.error("Error resolving GA table:", e);
      }

      // Resolve GSC table — search across accessible tenants
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
            .in("tenant_id", tenantIdList)
            .eq("integration_type", "google_search_console")
            .eq("client_id", targetClientId)
            .limit(1);
          gscTable = data?.[0] || null;
        }
      } catch (e) {
        console.error("Error resolving GSC table:", e);
      }

      // Fetch GA records (paginated, up to 5000)
      if (gaTable?.id) {
        try {
          for (let from = 0; from < 5000; from += 1000) {
            const { data: page, error } = await supabase
              .from("crm_records")
              .select("id, data")
              .eq("table_id", gaTable.id)
              .order("created_at", { ascending: false })
              .range(from, from + 999);
            if (error || !page || page.length === 0) break;
            gaRecords.push(...page);
            if (page.length < 1000) break;
          }
        } catch (e) {
          console.error("Error fetching GA records:", e);
        }
      }

      const effectiveGscSiteUrl = linkedGscSiteUrl || (gscTable?.integration_settings as any)?.siteUrl || null;

      // Prefer live GSC keyword data (mirrors internal GscIntegration) so share
      // links show positions/clicks even when crm_records were never synced.
      if (effectiveGscSiteUrl) {
        try {
          const accessToken = await resolveGscAccessToken(supabase, tenantIdList);
          if (accessToken) {
            const end = new Date().toISOString().split("T")[0];
            const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            const liveRows = await fetchGscKeywordsLive(accessToken, effectiveGscSiteUrl, start, end);
            if (liveRows.length > 0) {
              gscRecords = liveRows.map((row) => ({
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
          }
        } catch (e) {
          console.error("Error fetching live GSC keywords:", e);
        }
      }

      // Fallback: synced GSC table rows when live fetch is unavailable.
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

      // Maskyoo call snapshots — previous calendar month (default report window)
      let maskyooSnapshots: any[] = [];
      let maskyooPeriod: { start: string; end: string } | null = null;
      if (targetClientId) {
        try {
          const now = new Date();
          const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
          const fmt = (d: Date) => d.toISOString().slice(0, 10);
          maskyooPeriod = { start: fmt(prevMonthStart), end: fmt(prevMonthEnd) };
          const { data: snaps } = await supabase
            .from("seo_call_snapshots")
            .select("category, incoming_count, is_manual")
            .in("tenant_id", tenantIdList)
            .eq("client_id", targetClientId)
            .eq("period_start", maskyooPeriod.start)
            .eq("period_end", maskyooPeriod.end);
          maskyooSnapshots = snaps || [];
        } catch (e) {
          console.error("Error fetching maskyoo snapshots:", e);
        }
      }

      // Monthly work log + share token — powers the public "עבודה חודשית" tab.
      // Fetched before/alongside the slower GSC multi-period calls.
      let seoMonthly: {
        client_name: string | null;
        domain: string | null;
        share_token: string | null;
        months: Array<{
          month: string;
          status: string;
          work: unknown;
          notes: string | null;
          share_token: string | null;
          /** Exact in-app deck snapshot (metrics/GSC/keywords) when a share was published. */
          snapshot: unknown | null;
        }>;
      } = {
        client_name: clientName,
        domain: targetDomain || clientWebsite,
        share_token: null,
        months: [],
      };
      const seoMonthlyPromise = (async () => {
        if (!targetClientId) return;
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
          for (const share of monthlyShare || []) {
            shareByMonth.set(String(share.month || "").slice(0, 10), share);
          }
          seoMonthly.months = (monthlyRows || []).map((row: any) => {
            const month = String(row.month || "").slice(0, 10);
            const share = shareByMonth.get(month);
            return {
              month,
              status: row.status || "stable",
              work: row.work ?? {},
              notes: row.notes ?? null,
              share_token: share?.share_token || null,
              // Prefer the frozen in-app snapshot so the public deck matches the system deck.
              snapshot: share?.snapshot && typeof share.snapshot === "object" ? share.snapshot : null,
            };
          });
          // Prefer last calendar month's share token (matches default month in the UI).
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
      })();

      // Multi-period GSC keyword aggregates for SEO change columns
      // (שינוי חודשי / 3 חודשים / שנתי). Mirrors GscIntegration's
      // useQuery("gsc-multi-period") so the public viewer matches the
      // internal SeoDashboardView exactly.
      let gscMultiPeriod: { prevMonth: any[]; threeMonth: any[]; yearly: any[] } | null = null;
      if (effectiveGscSiteUrl) {
        try {
          const accessToken = await resolveGscAccessToken(supabase, tenantIdList);
          if (accessToken) {
            const dateMinus = (days: number) => {
              const d = new Date();
              d.setDate(d.getDate() - days);
              return d.toISOString().split("T")[0];
            };
            const periods = {
              prevMonth: { startOffset: 58, endOffset: 30 },
              threeMonth: { startOffset: 118, endOffset: 90 },
              yearly: { startOffset: 393, endOffset: 365 },
            } as const;

            const fetchPeriod = (startOffset: number, endOffset: number) =>
              fetchGscKeywordsLive(
                accessToken,
                effectiveGscSiteUrl,
                dateMinus(startOffset),
                dateMinus(endOffset),
                1000,
              );

            const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
              Promise.race<T>([
                promise,
                new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
              ]);
            const [pm, tm, yr] = await Promise.all([
              withTimeout(fetchPeriod(periods.prevMonth.startOffset, periods.prevMonth.endOffset), 4500, []),
              withTimeout(fetchPeriod(periods.threeMonth.startOffset, periods.threeMonth.endOffset), 4500, []),
              withTimeout(fetchPeriod(periods.yearly.startOffset, periods.yearly.endOffset), 4500, []),
            ]);
            gscMultiPeriod = { prevMonth: pm, threeMonth: tm, yearly: yr };
          }
        } catch (e) {
          console.error("Error fetching GSC multi-period:", e);
        }
      }

      await seoMonthlyPromise;

      return new Response(
        JSON.stringify({
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
          maskyoo_snapshots: maskyooSnapshots,
          maskyoo_period: maskyooPeriod,
          seo_monthly: seoMonthly,
          seo_keyword_relevance: {
            force_relevant: seoForceRelevant,
            force_irrelevant: seoForceIrrelevant,
          },
          has_email_restriction: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

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

