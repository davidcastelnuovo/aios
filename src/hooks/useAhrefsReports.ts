import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export interface AhrefsReport {
  id: string;
  tenant_id: string;
  client_id: string | null;
  agency_id: string | null;
  domain: string;
  report_type: string;
  report_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  report_date: string | null;
  received_at: string;
  created_at: string;
}

interface UseAhrefsReportsOptions {
  clientId?: string;
  domain?: string;
  reportType?: string;
  limit?: number;
  /**
   * Optional override: when fetching SEO reports for a shared-agency client,
   * pass the full set of accessible tenant IDs (from useSeoScope) so reports
   * created in a different tenant aren't filtered out. RLS still applies.
   */
  tenantIds?: string[];
}

export function useAhrefsReports(options: UseAhrefsReportsOptions = {}) {
  const { tenantId } = useCurrentTenant();
  const { clientId, domain, reportType, limit = 50, tenantIds } = options;

  const effectiveTenants =
    Array.isArray(tenantIds) && tenantIds.length > 0
      ? Array.from(new Set(tenantIds.filter(Boolean)))
      : tenantId
        ? [tenantId]
        : [];

  // When we have a clientId we trust it as the strongest scoping signal
  // (RLS still enforces visibility). Without clientId we MUST require tenants.
  const enabled = !!clientId || effectiveTenants.length > 0;

  return useQuery({
    queryKey: [
      "ahrefs-reports",
      effectiveTenants.slice().sort().join(","),
      clientId,
      domain,
      reportType,
      limit,
    ],
    queryFn: async () => {
      let query = supabase
        .from("ahrefs_reports" as any)
        .select("*")
        .order("received_at", { ascending: false })
        .limit(limit);

      // Prefer client-scoped lookup (works across shared-agency tenants).
      // Fall back to tenant filtering only if there's no clientId.
      if (clientId) {
        query = query.eq("client_id", clientId);
      } else if (effectiveTenants.length === 1) {
        query = query.eq("tenant_id", effectiveTenants[0]);
      } else if (effectiveTenants.length > 1) {
        query = query.in("tenant_id", effectiveTenants);
      }

      if (domain) query = query.eq("domain", domain);
      if (reportType) query = query.eq("report_type", reportType);

      const { data, error } = await query;
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as unknown as AhrefsReport[];
    },
    enabled,
  });
}
