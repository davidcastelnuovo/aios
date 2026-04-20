import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoDashboardView } from "./SeoDashboardView";

interface SeoDashboardWithGaProps {
  tenantId: string;
  clientId: string;
}

/**
 * Wrapper around SeoDashboardView that auto-resolves the linked Google Analytics
 * table for the SEO report and feeds its records in, so the "Organic Traffic"
 * card and chart show real GA Organic Search sessions instead of Ahrefs estimates.
 *
 * Resolution priority for the GA table:
 * 1. integration_settings.linkedGaTableId on the client's Ahrefs SEO table
 * 2. A google_analytics crm_table whose client_id matches
 */
export function SeoDashboardWithGa({ tenantId, clientId }: SeoDashboardWithGaProps) {
  // Find the SEO (Ahrefs) table for this client to read linkedGaTableId
  const { data: seoTable } = useQuery({
    queryKey: ["seo-table-for-ga-link", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tables")
        .select("id, integration_settings, client_id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "ahrefs")
        .limit(100);
      if (error) throw error;
      return (
        data?.find(
          (t) =>
            (t.integration_settings as any)?.clientId === clientId ||
            t.client_id === clientId,
        ) || null
      );
    },
    enabled: !!tenantId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  // Find a GA table by client_id as fallback
  const { data: gaTableByClient } = useQuery({
    queryKey: ["ga-table-by-client", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tables")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "google_analytics")
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!tenantId && !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const linkedGaTableId = useMemo(() => {
    const fromSettings = (seoTable?.integration_settings as any)?.linkedGaTableId;
    return fromSettings || gaTableByClient?.id || "";
  }, [seoTable, gaTableByClient]);

  // Fetch GA records (channel_group + monthly_organic + daily_source) for the linked table
  const { data: gaRecords = [] } = useQuery({
    queryKey: ["seo-ga-records", linkedGaTableId],
    queryFn: async () => {
      if (!linkedGaTableId) return [];
      const { data, error } = await supabase
        .from("crm_records")
        .select("id, data")
        .eq("table_id", linkedGaTableId)
        .limit(5000);
      if (error) return [];
      return data || [];
    },
    enabled: !!linkedGaTableId,
    staleTime: 5 * 60 * 1000,
  });

  const savedGscSiteUrl = (seoTable?.integration_settings as any)?.linkedGscSiteUrl || "";

  const persistGscSiteUrl = async (siteUrl: string) => {
    if (!seoTable?.id || !siteUrl || siteUrl === savedGscSiteUrl) return;
    try {
      const newSettings = { ...((seoTable.integration_settings as any) || {}), linkedGscSiteUrl: siteUrl };
      await supabase.from("crm_tables").update({ integration_settings: newSettings }).eq("id", seoTable.id);
    } catch (err) {
      console.warn("[SeoDashboardWithGa] failed to persist linkedGscSiteUrl", err);
    }
  };

  return (
    <SeoDashboardView
      tenantId={tenantId}
      clientId={clientId}
      gaRecords={gaRecords}
      initialGscSiteUrl={savedGscSiteUrl}
      onGscSiteSelected={persistGscSiteUrl}
    />
  );
}
