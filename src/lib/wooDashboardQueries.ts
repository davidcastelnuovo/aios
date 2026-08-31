import type { QueryClient } from "@tanstack/react-query";
import { format, subDays, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  getJerusalemDashboardDateRange,
  jerusalemDateRangeToIso,
} from "@/lib/calendarTimeZone";
import {
  aggregateOrdersByAttribution,
  summarizeGoogleAttributedWooOrders,
  type WooGoogleAttributionSummary,
} from "@/lib/wooAttribution";
import {
  dedupeWooOrdersById,
  filterWooOrdersForRevenue,
  sumWooRevenue,
  type WooOrderRevenueRow,
} from "@/lib/wooOrderRevenue";

/** React-query keys used by DashboardView + WooCommerceDashboard. */
export const wooDashboardQueryKeys = {
  hasWooCommerce: (clientId?: string | null) => ["has-woocommerce", clientId] as const,
  wooSummaryPrefix: ["woo-summary-for-totals"] as const,
  wooSites: (clientId?: string | null) => ["woo-sites-for-client", clientId] as const,
  wooOrdersPrefix: ["woo-orders"] as const,
};

function parseCustomDashboardDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Jerusalem-calendar ISO bounds for woocommerce_orders revenue filtering.
 * Uses date_paid → date_completed → date_created (see wooOrderRevenue.ts).
 */
export function getWooDashboardDateRangeIso(
  dateFilter: string,
  options?: {
    customFrom?: Date | string | null;
    customTo?: Date | string | null;
    now?: Date;
  },
): { start: string; end: string } {
  const now = options?.now ?? new Date();
  const customFrom = parseCustomDashboardDate(options?.customFrom);
  const customTo = parseCustomDashboardDate(options?.customTo);
  const customFromStr = customFrom ? format(customFrom, "yyyy-MM-dd") : null;
  const customToStr = customTo ? format(customTo, "yyyy-MM-dd") : null;
  const { startDate, endDate } = getJerusalemDashboardDateRange(
    dateFilter,
    now,
    customFromStr,
    customToStr,
  );

  if (!startDate || !endDate) {
    const todayYmd = format(now, "yyyy-MM-dd");
    const yesterday = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    const start = format(subDays(yesterday, 6), "yyyy-MM-dd");
    const end = format(yesterday, "yyyy-MM-dd");
    return jerusalemDateRangeToIso(start, end);
  }

  return jerusalemDateRangeToIso(startDate, endDate);
}

/** ISO range aligned with DynamicTableView client-side date filters. */
export function getDynamicTableDateRangeIso(
  dateFilter: string,
  customFrom?: Date | null,
  customTo?: Date | null,
): { start: string; end: string } | null {
  if (dateFilter === 'all') return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: string | null = null;
  let endDate: string | null = null;

  switch (dateFilter) {
    case 'today':
      startDate = endDate = format(today, 'yyyy-MM-dd');
      break;
    case 'yesterday': {
      const d = subDays(today, 1);
      startDate = endDate = format(d, 'yyyy-MM-dd');
      break;
    }
    case 'this_week':
      startDate = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
      break;
    case 'last_week': {
      const endLW = subDays(startOfWeek(today, { weekStartsOn: 0 }), 1);
      startDate = format(subDays(endLW, 6), 'yyyy-MM-dd');
      endDate = format(endLW, 'yyyy-MM-dd');
      break;
    }
    case 'last_7_days':
      startDate = format(subDays(today, 7), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'last_14_days':
      startDate = format(subDays(today, 14), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'last_30_days':
      startDate = format(subDays(today, 30), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'this_month':
      startDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
      break;
    case 'last_month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = format(lm, 'yyyy-MM-dd');
      endDate = format(new Date(now.getFullYear(), now.getMonth(), 0), 'yyyy-MM-dd');
      break;
    }
    case 'last_90_days':
      startDate = format(subDays(today, 90), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'last_180_days':
      startDate = format(subDays(today, 180), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'last_365_days':
      startDate = format(subDays(today, 365), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
      break;
    case 'custom':
      if (customFrom && customTo) {
        startDate = format(customFrom, 'yyyy-MM-dd');
        endDate = format(customTo, 'yyyy-MM-dd');
      }
      break;
    default:
      startDate = format(subDays(today, 30), 'yyyy-MM-dd');
      endDate = format(subDays(today, 1), 'yyyy-MM-dd');
  }

  if (!startDate || !endDate) return null;

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  return {
    start: new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString(),
    end: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(),
  };
}

export type WooReportAttributionData = {
  orders: any[];
  googlePaid: WooGoogleAttributionSummary;
  bySource: ReturnType<typeof aggregateOrdersByAttribution>;
};

const WOO_PAGE_SIZE = 1000;
const WOO_MAX_PAGES = 50; // safety cap — 50k orders per range

async function fetchWooOrdersForColumnInRange(
  siteIds: string[],
  column: "date_created" | "date_paid" | "date_completed",
  range: { start: string; end: string },
  select: string,
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 0; page < WOO_MAX_PAGES; page++) {
    const from = page * WOO_PAGE_SIZE;
    const { data: orders, error } = await supabase
      .from("woocommerce_orders" as any)
      .select(select)
      .in("site_id", siteIds)
      .gte(column, range.start)
      .lte(column, range.end)
      .not(column, "is", null)
      .order(column, { ascending: false })
      .range(from, from + WOO_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (orders as any[]) || [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < WOO_PAGE_SIZE) break;
  }
  return all;
}

/** Paginated fetch — matches Woo admin by revenue date (paid/completed/created). */
export async function fetchWooOrdersInRange(
  siteIds: string[],
  range: { start: string; end: string } | null,
  select = "id, total, status, date_created, date_completed, date_paid, attribution",
): Promise<any[]> {
  if (siteIds.length === 0) return [];
  if (!range) {
    const all: any[] = [];
    for (let page = 0; page < WOO_MAX_PAGES; page++) {
      const from = page * WOO_PAGE_SIZE;
      const { data: orders, error } = await supabase
        .from("woocommerce_orders" as any)
        .select(select)
        .in("site_id", siteIds)
        .order("date_created", { ascending: false })
        .range(from, from + WOO_PAGE_SIZE - 1);
      if (error) throw error;
      const batch = (orders as any[]) || [];
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < WOO_PAGE_SIZE) break;
    }
    return all;
  }

  const [byCreated, byPaid, byCompleted] = await Promise.all([
    fetchWooOrdersForColumnInRange(siteIds, "date_created", range, select),
    fetchWooOrdersForColumnInRange(siteIds, "date_paid", range, select),
    fetchWooOrdersForColumnInRange(siteIds, "date_completed", range, select),
  ]);

  const merged = dedupeWooOrdersById([...byCreated, ...byPaid, ...byCompleted]);
  return filterWooOrdersForRevenue(merged as WooOrderRevenueRow[], range);
}

export async function fetchWooSiteIdsForClient(clientId: string): Promise<string[]> {
  const { data: sites, error } = await supabase
    .from('social_media_wordpress_sites' as any)
    .select('id')
    .eq('client_id', clientId)
    .eq('woocommerce_enabled', true)
    .eq('is_active', true);
  if (error) {
    console.error('[fetchWooSiteIdsForClient] query failed:', error);
    throw error;
  }
  return ((sites as any[]) || []).map((s: any) => s.id);
}

/** Fetch WooCommerce orders + attribution summary for a linked client report. */
export async function fetchWooReportAttribution(
  clientId: string,
  range: { start: string; end: string } | null,
): Promise<WooReportAttributionData> {
  const empty: WooReportAttributionData = {
    orders: [],
    googlePaid: { paidOrders: 0, paidRevenue: 0, organicOrders: 0, organicRevenue: 0 },
    bySource: [],
  };
  if (!clientId) return empty;

  const siteIds = await fetchWooSiteIdsForClient(clientId);
  if (siteIds.length === 0) return empty;

  const list = await fetchWooOrdersInRange(siteIds, range);
  const valid = list as WooOrderRevenueRow[];

  return {
    orders: valid,
    googlePaid: summarizeGoogleAttributedWooOrders(valid),
    bySource: aggregateOrdersByAttribution(valid),
  };
}

/** KPI summary for combined dashboard cards — paginates past the 1k PostgREST cap. */
export async function fetchWooDashboardSummary(
  clientId: string,
  range: { start: string; end: string },
): Promise<{
  revenue: number;
  orders: number;
  googlePaid: ReturnType<typeof summarizeGoogleAttributedWooOrders>;
}> {
  const empty = {
    revenue: 0,
    orders: 0,
    googlePaid: { paidOrders: 0, paidRevenue: 0, organicOrders: 0, organicRevenue: 0 },
  };
  if (!clientId) return empty;

  const siteIds = await fetchWooSiteIdsForClient(clientId);
  if (siteIds.length === 0) return empty;

  const list = await fetchWooOrdersInRange(siteIds, range, "id, total, status, attribution, date_created, date_completed, date_paid");
  const valid = list as WooOrderRevenueRow[];
  return {
    revenue: sumWooRevenue(valid),
    orders: valid.length,
    googlePaid: summarizeGoogleAttributedWooOrders(valid),
  };
}

/** Bust Woo caches after sync/link so the tab + KPI cards appear without a full reload. */
export function invalidateWooDashboardQueries(
  queryClient: QueryClient,
  clientId?: string | null,
) {
  queryClient.invalidateQueries({ queryKey: wooDashboardQueryKeys.hasWooCommerce(clientId) });
  queryClient.invalidateQueries({ queryKey: wooDashboardQueryKeys.wooSummaryPrefix });
  if (clientId) {
    queryClient.invalidateQueries({ queryKey: wooDashboardQueryKeys.wooSites(clientId) });
  }
  queryClient.invalidateQueries({ queryKey: wooDashboardQueryKeys.wooOrdersPrefix });
}

/**
 * Share a WP/Woo site with every tenant that has agency_tenant_access to its agency
 * (plus the agency home tenant). Needed for DMM-MC sites stored on DMM while viewed from MC.
 */
export async function shareWordpressSiteWithAgencyTenants(
  siteId: string,
  agencyId: string | null | undefined,
) {
  if (!agencyId) return;

  const { data: agency } = await supabase
    .from("agencies")
    .select("tenant_id")
    .eq("id", agencyId)
    .maybeSingle();

  const { data: accessRows } = await supabase
    .from("agency_tenant_access")
    .select("accessing_tenant_id")
    .eq("agency_id", agencyId);

  const tenantIds = new Set<string>();
  if (agency?.tenant_id) tenantIds.add(agency.tenant_id);
  (accessRows || []).forEach((row: { accessing_tenant_id: string }) => {
    tenantIds.add(row.accessing_tenant_id);
  });

  if (tenantIds.size === 0) return;

  const rows = Array.from(tenantIds).map((tenant_id) => ({ site_id: siteId, tenant_id }));
  await supabase
    .from("wordpress_sites_shared_tenants")
    .upsert(rows, { onConflict: "site_id,tenant_id", ignoreDuplicates: true });
}
