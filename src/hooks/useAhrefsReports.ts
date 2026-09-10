import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { reportQueryOptions } from "@/lib/reportQueryOptions";
import { filterSeoReportsByDomain, normalizeSeoDomain } from "@/lib/seoDomain";

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
      const baseQuery = () => {
        let q = supabase
          .from("ahrefs_reports" as any)
          .select("*")
          .order("received_at", { ascending: false })
          .limit(limit);
        if (reportType) q = q.eq("report_type", reportType);
        return q;
      };

      const scopeByTenants = (q: ReturnType<typeof baseQuery>) => {
        if (effectiveTenants.length === 1) {
          return q.eq("tenant_id", effectiveTenants[0]);
        }
        if (effectiveTenants.length > 1) {
          return q.in("tenant_id", effectiveTenants);
        }
        return q;
      };

      // Prefer client-scoped lookup (works across shared-agency tenants).
      if (clientId) {
        const { data, error } = await baseQuery().eq("client_id", clientId);
        if (error) {
          if (error.code === "42P01") return [];
          throw error;
        }
        const rows = (data || []) as unknown as AhrefsReport[];
        if (rows.length > 0) {
          return domain ? filterSeoReportsByDomain(rows, domain) : rows;
        }

        // Duplicate client cards sometimes link the SEO table to client A while
        // ahrefs_reports rows were saved under client B for the same domain.
        const normalized = normalizeSeoDomain(domain);
        if (normalized) {
          const { data: domainRows, error: domainError } = await scopeByTenants(baseQuery()).ilike(
            "domain",
            `%${normalized}%`,
          );
          if (domainError) {
            if (domainError.code === "42P01") return [];
            throw domainError;
          }
          return filterSeoReportsByDomain(
            (domainRows || []) as unknown as AhrefsReport[],
            normalized,
          );
        }
        return rows;
      }

      let query = scopeByTenants(baseQuery());
      if (domain) query = query.eq("domain", domain);

      const { data, error } = await query;
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as unknown as AhrefsReport[];
    },
    enabled,
    ...reportQueryOptions<AhrefsReport[]>(),
  });
}
