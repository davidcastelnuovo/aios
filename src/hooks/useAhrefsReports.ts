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
}

export function useAhrefsReports(options: UseAhrefsReportsOptions = {}) {
  const { tenantId } = useCurrentTenant();
  const { clientId, domain, reportType, limit = 50 } = options;

  return useQuery({
    queryKey: ["ahrefs-reports", tenantId, clientId, domain, reportType, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("ahrefs_reports" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("received_at", { ascending: false })
        .limit(limit);

      if (clientId) query = query.eq("client_id", clientId);
      if (domain) query = query.eq("domain", domain);
      if (reportType) query = query.eq("report_type", reportType);

      const { data, error } = await query;
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as unknown as AhrefsReport[];
    },
    enabled: !!tenantId,
  });
}
