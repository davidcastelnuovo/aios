import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getJerusalemDashboardDateRange, jerusalemDateRangeToIso } from "../_shared/calendarTimeZone.ts";
import { dedupeWooOrdersById, filterWooOrdersForRevenue } from "../_shared/wooRevenue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getDateRange(filter: string, integrationType?: string | null): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  // Compute everything in UTC so the range matches WooCommerce admin reports
  // and the woocommerce_orders.date_created column (stored as UTC timestamptz).
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const today = new Date(Date.UTC(y, m, d));
  const yesterday = new Date(Date.UTC(y, m, d - 1));
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  let startDate: string | null = null;
  let endDate: string | null = null;

  switch (filter) {
    case "today":
      startDate = todayStr;
      endDate = todayStr;
      break;
    case "yesterday":
      startDate = yesterdayStr;
      endDate = yesterdayStr;
      break;
    case "this_week": {
      // Week starts Sunday (UTC calendar day) — matches SharedDashboard / DashboardView.
      const dow = today.getUTCDay();
      startDate = new Date(Date.UTC(y, m, d - dow)).toISOString().split("T")[0];
      endDate = todayStr;
      break;
    }
    case "last_week": {
      const dow = today.getUTCDay();
      startDate = new Date(Date.UTC(y, m, d - dow - 7)).toISOString().split("T")[0];
      endDate = new Date(Date.UTC(y, m, d - dow - 1)).toISOString().split("T")[0];
      break;
    }
    case "last_7_days": {
      // Rolling 7 full days ending yesterday — matches ads/analytics + combined dashboard.
      startDate = new Date(Date.UTC(y, m, d - 7)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    }
    case "this_month":
      startDate = new Date(Date.UTC(y, m, 1)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "last_month": {
      const startOfLastMonth = new Date(Date.UTC(y, m - 1, 1));
      const endOfLastMonth = new Date(Date.UTC(y, m, 0));
      startDate = startOfLastMonth.toISOString().split("T")[0];
      endDate = endOfLastMonth.toISOString().split("T")[0];
      break;
    }
    case "last_14_days":
      startDate = new Date(Date.UTC(y, m, d - 14)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "last_30_days":
      startDate = new Date(Date.UTC(y, m, d - 30)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case 'last_70_days':
      startDate = new Date(Date.UTC(y, m, d - 70)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "last_90_days":
      startDate = new Date(Date.UTC(y, m, d - 90)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "last_180_days":
      startDate = new Date(Date.UTC(y, m, d - 180)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "last_365_days":
      startDate = new Date(Date.UTC(y, m, d - 365)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
    case "all":
      return { startDate: null, endDate: null };
    default: // unknown preset — 30 full days ending yesterday
      startDate = new Date(Date.UTC(y, m, d - 30)).toISOString().split("T")[0];
      endDate = yesterdayStr;
      break;
  }

  return { startDate, endDate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get("token");
    const dateFilter = url.searchParams.get("date_filter") || "last_30_days";

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
      .from("dashboard_shares")
      .select("*, crm_dashboards(*, clients(name, website), agencies(name))")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive share link" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const dashboard = share.crm_dashboards;
    if (!dashboard) {
      return new Response(
        JSON.stringify({ error: "Dashboard not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch tables for this dashboard's client
    // NOTE: We intentionally do NOT filter by tenant_id here — integration tables
    // (Ahrefs / GA / Facebook) may have been created under a different tenant
    // (e.g. MarketingCaptain) but linked to a client owned by another tenant
    // (e.g. DMM). The share_token + is_active gate already authorizes this view.
    const { data: tables } = await supabase
      .from("crm_tables")
      .select("*")
      .eq("client_id", dashboard.client_id);

    const allTables = tables || [];

    const wooCalendar = getJerusalemDashboardDateRange(dateFilter);
    const wooRange = wooCalendar.startDate && wooCalendar.endDate
      ? jerusalemDateRangeToIso(wooCalendar.startDate, wooCalendar.endDate)
      : { start: null as string | null, end: null as string | null };

    // Deduplicate Facebook: if both facebook_insights AND facebook_ecommerce exist,
    // skip facebook_insights to avoid double-counting spend/impressions/clicks
    const hasFbEcommerce = allTables.some((t: any) => t.integration_type === 'facebook_ecommerce');
    const hasFbInsights = allTables.some((t: any) => t.integration_type === 'facebook_insights');
    const skipFbInsights = hasFbEcommerce && hasFbInsights;

    const tablesToProcess = skipFbInsights
      ? allTables.filter((t: any) => t.integration_type !== 'facebook_insights')
      : allTables;

    // Fetch each table's records in parallel. Select only the columns we need and
    // cap page counts so a large history can't stall the shared link for ~15s.
    const fetchTableRecords = async (table: any) => {
      const pageSize = 1000;
      const isAnalytics = table.integration_type === 'google_analytics';
      const isSeoHeavy = table.integration_type === 'google_search_console' || table.integration_type === 'ahrefs';
      const maxPages = isAnalytics ? 4 : isSeoHeavy ? 3 : 3; // 3–4k rows max per table
      const tableRecords: any[] = [];
      const { startDate, endDate } = getDateRange(dateFilter, table.integration_type);

      for (let page = 0; page < maxPages; page++) {
        const from = page * pageSize;
        const { data: rows, error } = await supabase
          .from("crm_records")
          .select("id, data, created_at")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching records for table", table.id, error);
          break;
        }
        if (!rows || rows.length === 0) break;
        tableRecords.push(...rows);
        if (rows.length < pageSize) break;
      }

      const filteredRecords = tableRecords.filter((r: any) => {
        const recordDate = r.data?.date || r.data?.date_start;
        // Keep aggregated / summary rows (no date) — needed for GA channel rolls etc.
        if (!recordDate) return true;
        if (startDate && endDate) return recordDate >= startDate && recordDate <= endDate;
        if (startDate) return recordDate >= startDate;
        return true;
      });

      return filteredRecords.map((r: any) => ({
        ...r,
        _source: table.integration_type,
        _tableName: table.name,
        _integrationSettings: table.integration_settings,
      }));
    };

    const allRecords = (await Promise.all(tablesToProcess.map(fetchTableRecords))).flat();

    // Resolve SEO / Woo / Maskyoo extras in parallel with each other.
    let ahrefsReports: any[] = [];
    let seoGaRecords: any[] = [];
    let seoGscRecords: any[] = [];
    let seoLinkedGscSiteUrl: string | null = null;
    let seoTargetClientId: string | null = dashboard.client_id || null;
    let seoForceRelevant: string[] = [];
    let seoForceIrrelevant: string[] = [];
    let seoTenantIdList: string[] = dashboard.tenant_id ? [dashboard.tenant_id] : [];
    let gscMultiPeriod: { prevMonth: any[]; threeMonth: any[]; yearly: any[] } | null = null;
    let wooSites: any[] = [];
    let wooOrders: any[] = [];
    let maskyooSnapshots: any[] = [];
    let maskyooPeriod: { start: string; end: string } | null = null;
    // Monthly work log — same payload shape as public-table so the shared
    // dashboard SEO tab can show "עבודה שבוצעה" like the SEO report share link.
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
        snapshot: unknown | null;
      }>;
    } = {
      client_name: dashboard.clients?.name || dashboard.name || null,
      domain: dashboard.clients?.website || null,
      share_token: null,
      months: [],
    };
    let seoTargetDomain: string | null = null;

    const loadAhrefs = async () => {
      if (!dashboard.client_id) return;
      const { data: reports } = await supabase
        .from("ahrefs_reports")
        .select("id, domain, report_date, report_type, report_data, comparison_data, received_at")
        .eq("client_id", dashboard.client_id)
        .order("report_date", { ascending: false })
        .limit(50);
      ahrefsReports = reports || [];
    };

    const loadWoo = async () => {
      if (!dashboard.client_id) return;
      // client_id only — WP/Woo sites for shared-agency clients may live on the
      // agency home tenant while the dashboard row is on another tenant.
      const { data: sites } = await supabase
        .from("social_media_wordpress_sites")
        .select("id, site_name, site_url, woo_last_sync_at")
        .eq("client_id", dashboard.client_id)
        .eq("woocommerce_enabled", true)
        .eq("is_active", true);
      wooSites = sites || [];
      const siteIds = wooSites.map((s: any) => s.id);
      if (siteIds.length === 0) return;

      const selectCols =
        "id, total, status, date_created, date_completed, date_paid, customer_email, customer_first_name, customer_last_name, line_items, order_number, currency, attribution";
      const pageSize = 1000;
      const maxPages = 50;

      const fetchByColumn = async (column: "date_created" | "date_paid" | "date_completed") => {
        const collected: any[] = [];
        if (!wooRange.start || !wooRange.end) return collected;
        for (let page = 0; page < maxPages; page++) {
          const from = page * pageSize;
          const { data: batch, error } = await supabase
            .from("woocommerce_orders")
            .select(selectCols)
            .in("site_id", siteIds)
            .gte(column, wooRange.start)
            .lte(column, wooRange.end)
            .not(column, "is", null)
            .order(column, { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) {
            console.error(`Error fetching woocommerce orders by ${column}:`, error);
            break;
          }
          if (!batch || batch.length === 0) break;
          collected.push(...batch);
          if (batch.length < pageSize) break;
        }
        return collected;
      };

      const merged = dedupeWooOrdersById([
        ...(await fetchByColumn("date_created")),
        ...(await fetchByColumn("date_paid")),
        ...(await fetchByColumn("date_completed")),
      ]);

      wooOrders = wooRange.start && wooRange.end
        ? filterWooOrdersForRevenue(merged, { start: wooRange.start, end: wooRange.end })
        : merged;
    };

    const loadMaskyoo = async () => {
      if (!dashboard.client_id) return;
      try {
        const now = new Date();
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        maskyooPeriod = { start: fmt(prevMonthStart), end: fmt(prevMonthEnd) };
        const { data: snaps } = await supabase
          .from("seo_call_snapshots")
          .select("category, incoming_count, is_manual")
          .in("tenant_id", seoTenantIdList.length > 0 ? seoTenantIdList : [dashboard.tenant_id])
          .eq("client_id", seoTargetClientId || dashboard.client_id)
          .eq("period_start", maskyooPeriod.start)
          .eq("period_end", maskyooPeriod.end);
        maskyooSnapshots = snaps || [];
      } catch (e) {
        console.error("Error fetching maskyoo snapshots:", e);
      }
    };

    const loadSeoLinked = async () => {
      if (!dashboard.client_id) return;
      try {
        const { data: seoTables } = await supabase
          .from("crm_tables")
          .select("id, integration_settings, client_id, tenant_id")
          .eq("integration_type", "ahrefs")
          .eq("client_id", dashboard.client_id)
          .limit(5);
        const seoTable = (seoTables || [])[0] || null;
        const seoSettings = (seoTable?.integration_settings as any) || {};
        const linkedGaTableId = seoSettings.linkedGaTableId || null;
        const linkedGscTableId = seoSettings.linkedGscTableId || null;
        seoLinkedGscSiteUrl = seoSettings.linkedGscSiteUrl || null;
        seoTargetClientId = seoSettings.clientId || seoSettings.client_id || dashboard.client_id || null;
        seoTargetDomain =
          seoSettings.targetDomain ||
          seoSettings.domain ||
          seoSettings.linkedGscSiteUrl ||
          null;

        const accessibleTenantIds = new Set<string>();
        accessibleTenantIds.add(dashboard.tenant_id);
        try {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("tenant_id, agency_id, seo_keyword_relevance")
            .eq("id", seoTargetClientId || dashboard.client_id)
            .maybeSingle();
          if (clientRow?.tenant_id) accessibleTenantIds.add(clientRow.tenant_id);
          if (clientRow?.agency_id) {
            const { data: accessRows } = await supabase
              .from("agency_tenant_access")
              .select("accessing_tenant_id, source_tenant_id")
              .eq("agency_id", clientRow.agency_id);
            for (const r of accessRows || []) {
              if (r.accessing_tenant_id) accessibleTenantIds.add(r.accessing_tenant_id);
              if (r.source_tenant_id) accessibleTenantIds.add(r.source_tenant_id);
            }
          }
          const relevance = (clientRow as any)?.seo_keyword_relevance || {};
          const asList = (v: unknown): string[] =>
            Array.isArray(v)
              ? v.map((x) => String(x || "").trim()).filter(Boolean)
              : [];
          seoForceRelevant = asList(relevance.force_relevant ?? relevance.forceRelevant);
          seoForceIrrelevant = asList(relevance.force_irrelevant ?? relevance.forceIrrelevant);
        } catch (e) {
          console.error("Error resolving accessible tenants for GSC:", e);
        }
        const tenantIdList = Array.from(accessibleTenantIds);
        seoTenantIdList = tenantIdList;

        // Prefer records already loaded for this client to avoid a second full GA scan.
        const existingGa = allRecords.filter((r: any) => r._source === "google_analytics");
        if (existingGa.length > 0) {
          seoGaRecords = existingGa.map((r: any) => ({ id: r.id, data: r.data }));
        } else {
          let gaTable: any = null;
          if (linkedGaTableId) {
            const { data } = await supabase.from("crm_tables").select("id").eq("id", linkedGaTableId).maybeSingle();
            gaTable = data || null;
          } else {
            const { data } = await supabase
              .from("crm_tables")
              .select("id")
              .eq("integration_type", "google_analytics")
              .eq("client_id", dashboard.client_id)
              .limit(1);
            gaTable = data?.[0] || null;
          }
          if (gaTable?.id) {
            for (let from = 0; from < 3000; from += 1000) {
              const { data: page, error } = await supabase
                .from("crm_records")
                .select("id, data")
                .eq("table_id", gaTable.id)
                .order("created_at", { ascending: false })
                .range(from, from + 999);
              if (error || !page || page.length === 0) break;
              seoGaRecords.push(...page);
              if (page.length < 1000) break;
            }
          }
        }

        let gscTable: any = null;
        if (linkedGscTableId) {
          const { data } = await supabase.from("crm_tables").select("id").eq("id", linkedGscTableId).maybeSingle();
          gscTable = data || null;
        } else {
          const { data } = await supabase
            .from("crm_tables")
            .select("id")
            .in("tenant_id", tenantIdList)
            .eq("integration_type", "google_search_console")
            .eq("client_id", dashboard.client_id)
            .limit(1);
          gscTable = data?.[0] || null;
        }

        if (gscTable?.id) {
          for (let from = 0; from < 3000; from += 1000) {
            const { data: page, error } = await supabase
              .from("crm_records")
              .select("id, data")
              .eq("table_id", gscTable.id)
              .order("created_at", { ascending: false })
              .range(from, from + 999);
            if (error || !page || page.length === 0) break;
            seoGscRecords.push(...page);
            if (page.length < 1000) break;
          }
        }
      } catch (e) {
        console.error("Error resolving SEO GA/GSC linked data:", e);
      }
    };

    const loadSeoMonthly = async () => {
      const clientId = seoTargetClientId || dashboard.client_id;
      if (!clientId) return;
      try {
        const [{ data: monthlyRows }, { data: monthlyShare }] = await Promise.all([
          supabase
            .from("seo_monthly_updates")
            .select("month, status, work, notes")
            .eq("client_id", clientId)
            .order("month", { ascending: false })
            .limit(12),
          supabase
            .from("seo_monthly_shares")
            .select("share_token, month, is_active, snapshot")
            .eq("client_id", clientId)
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
            snapshot: share?.snapshot && typeof share.snapshot === "object" ? share.snapshot : null,
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
        seoMonthly.client_name = dashboard.clients?.name || dashboard.name || seoMonthly.client_name;
        seoMonthly.domain = seoTargetDomain || dashboard.clients?.website || seoMonthly.domain;
      } catch (e) {
        console.error("Error fetching seo monthly work for public dashboard:", e);
      }
    };

    // Kick off independent extras together. GSC multi-period (live API) stays
    // after seo linked resolution because it needs the site URL + tenant list.
    // Monthly work can run with the dashboard client_id immediately (parallel).
    await Promise.all([loadAhrefs(), loadWoo(), loadSeoLinked(), loadSeoMonthly()]);
    // Refresh domain after seo table settings resolve (loadSeoLinked may set it).
    if (seoTargetDomain) seoMonthly.domain = seoTargetDomain || seoMonthly.domain;
    await loadMaskyoo();

    // Multi-period GSC — only when we have a site URL (SEO ranking deltas).
    if (seoLinkedGscSiteUrl && seoTenantIdList.length > 0) {
      try {
        const { data: integrations } = await supabase
          .from("tenant_integrations")
          .select("id, api_key, settings")
          .eq("integration_type", "google_search_console")
          .eq("is_active", true)
          .in("tenant_id", seoTenantIdList)
          .order("updated_at", { ascending: false })
          .limit(5);

        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

        let accessToken: string | null = null;
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
            if (tok) { accessToken = tok; break; }
          } catch (e) {
            console.error("Error preparing GSC token for multi-period (dashboard):", e);
          }
        }

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
          const encodedSiteUrl = encodeURIComponent(seoLinkedGscSiteUrl);
          const gscApiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

          const fetchPeriod = async (startOffset: number, endOffset: number) => {
            const resp = await fetch(gscApiUrl, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                startDate: dateMinus(startOffset),
                endDate: dateMinus(endOffset),
                dimensions: ["query"],
                rowLimit: 1000,
                dataState: "final",
              }),
            });
            if (!resp.ok) {
              console.error("GSC multi-period error (dashboard)", resp.status, await resp.text());
              return [] as any[];
            }
            const json = await resp.json();
            const rows = Array.isArray(json.rows) ? json.rows : [];
            return rows.map((row: any) => ({
              keyword: row.keys?.[0] || "",
              clicks: row.clicks || 0,
              impressions: row.impressions || 0,
              ctr: row.ctr ? Math.round(row.ctr * 10000) / 100 : 0,
              position: row.position ? Math.round(row.position * 10) / 10 : 0,
            }));
          };

          const [pm, tm, yr] = await Promise.all([
            fetchPeriod(periods.prevMonth.startOffset, periods.prevMonth.endOffset),
            fetchPeriod(periods.threeMonth.startOffset, periods.threeMonth.endOffset),
            fetchPeriod(periods.yearly.startOffset, periods.yearly.endOffset),
          ]);
          gscMultiPeriod = { prevMonth: pm, threeMonth: tm, yearly: yr };
        }
      } catch (e) {
        console.error("Error fetching GSC multi-period (dashboard):", e);
      }
    }

    return new Response(
      JSON.stringify({
        dashboard: {
          id: dashboard.id,
          name: dashboard.name,
          client_id: dashboard.client_id,
          client_name: dashboard.clients?.name,
          agency_name: dashboard.agencies?.name,
          dashboard_type: dashboard.dashboard_type,
          // Required so shared Analytics keeps the leads/ecommerce choice.
          settings: dashboard.settings || {},
        },
        tables: allTables.map((t: any) => ({
          id: t.id,
          name: t.name,
          integration_type: t.integration_type,
          integration_settings: t.integration_settings,
        })),
        records: allRecords,
        woocommerce: {
          sites: wooSites,
          orders: wooOrders,
        },
        ahrefs_reports: ahrefsReports,
        seo_ga_records: seoGaRecords,
        seo_gsc_records: seoGscRecords,
        gsc_multi_period: gscMultiPeriod,
        maskyoo_snapshots: maskyooSnapshots,
        maskyoo_period: maskyooPeriod,
        seo_keyword_relevance: {
          force_relevant: seoForceRelevant,
          force_irrelevant: seoForceIrrelevant,
        },
        seo_monthly: seoMonthly,
        has_email_restriction: false,
      }),

      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in public-dashboard:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

