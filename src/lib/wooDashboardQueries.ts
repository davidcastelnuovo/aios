import type { QueryClient } from "@tanstack/react-query";
import { format, subDays, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateOrdersByAttribution,
  summarizeGoogleAttributedWooOrders,
  type WooGoogleAttributionSummary,
} from "@/lib/wooAttribution";

/** React-query keys used by DashboardView + WooCommerceDashboard. */
export const wooDashboardQueryKeys = {
  hasWooCommerce: (clientId?: string | null) => ["has-woocommerce", clientId] as const,
  wooSummaryPrefix: ["woo-summary-for-totals"] as const,
  wooSites: (clientId?: string | null) => ["woo-sites-for-client", clientId] as const,
  wooOrdersPrefix: ["woo-orders"] as const,
};

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

const WOO_VALID_STATUSES = ['completed', 'processing', 'on-hold'] as const;
const WOO_PAGE_SIZE = 1000;
const WOO_MAX_PAGES = 50; // safety cap — 50k orders per range

/** Paginated fetch — PostgREST caps responses at 1000 rows per request. */
export async function fetchWooOrdersInRange(
  siteIds: string[],
  range: { start: string; end: string } | null,
  select = 'total, status, date_created, attribution',
): Promise<any[]> {
  if (siteIds.length === 0) return [];

  const all: any[] = [];
  for (let page = 0; page < WOO_MAX_PAGES; page++) {
    const from = page * WOO_PAGE_SIZE;
    let query = supabase
      .from('woocommerce_orders' as any)
      .select(select)
      .in('site_id', siteIds)
      .order('date_created', { ascending: false })
      .range(from, from + WOO_PAGE_SIZE - 1);

    if (range) {
      query = query.gte('date_created', range.start).lte('date_created', range.end);
    }

    const { data: orders, error } = await query;
    if (error) throw error;
    const batch = (orders as any[]) || [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < WOO_PAGE_SIZE) break;
  }

  return all;
}

export async function fetchWooSiteIdsForClient(clientId: string): Promise<string[]> {
  const { data: sites } = await supabase
    .from('social_media_wordpress_sites' as any)
    .select('id')
    .eq('client_id', clientId)
    .eq('woocommerce_enabled', true)
    .eq('is_active', true);
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
  const valid = list.filter((o) => WOO_VALID_STATUSES.includes(o.status));

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

  const list = await fetchWooOrdersInRange(siteIds, range, 'total, status, attribution');
  const valid = list.filter((o) => WOO_VALID_STATUSES.includes(o.status));
  const revenue = valid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  return {
    revenue,
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
