import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** React-query keys used by DashboardView + WooCommerceDashboard. */
export const wooDashboardQueryKeys = {
  hasWooCommerce: (clientId?: string | null) => ["has-woocommerce", clientId] as const,
  wooSummaryPrefix: ["woo-summary-for-totals"] as const,
  wooSites: (clientId?: string | null) => ["woo-sites-for-client", clientId] as const,
  wooOrdersPrefix: ["woo-orders"] as const,
};

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
