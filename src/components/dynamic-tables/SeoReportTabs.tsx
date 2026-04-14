import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoDashboardView } from "./SeoDashboardView";
import { SearchConsoleDashboard } from "./SearchConsoleDashboard";
import { GoogleAnalyticsDashboard } from "./GoogleAnalyticsDashboard";
import { TrendingUp, Search, BarChart3 } from "lucide-react";

interface SeoReportTabsProps {
  tenantId: string;
  clientId: string;
}

export function SeoReportTabs({ tenantId, clientId }: SeoReportTabsProps) {
  // Find related GSC and GA tables for the same client
  const { data: relatedTables } = useQuery({
    queryKey: ['seo-related-tables', tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_tables')
        .select('id, name, slug, integration_type, integration_settings')
        .eq('tenant_id', tenantId)
        .in('integration_type', ['google_search_console', 'google_analytics']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!clientId,
  });

  // Match tables by clientId first, fallback to any table of that type
  const gscTable = useMemo(() => {
    if (!relatedTables) return null;
    const gscTables = relatedTables.filter(t => t.integration_type === 'google_search_console');
    return gscTables.find(t => (t.integration_settings as any)?.clientId === clientId) || gscTables[0] || null;
  }, [relatedTables, clientId]);

  const gaTable = useMemo(() => {
    if (!relatedTables) return null;
    const gaTables = relatedTables.filter(t => t.integration_type === 'google_analytics');
    return gaTables.find(t => (t.integration_settings as any)?.clientId === clientId) || gaTables[0] || null;
  }, [relatedTables, clientId]);

  // Fetch GA records if table exists
  const { data: gaRecords } = useQuery({
    queryKey: ['crm-records', gaTable?.id],
    queryFn: async () => {
      if (!gaTable?.id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke(`crm-records?table_id=${gaTable.id}`, { method: 'GET' });
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!gaTable?.id,
    staleTime: 5 * 60 * 1000,
  });

  const hasGsc = !!gscTable;
  const hasGa = !!gaTable && !!gaRecords && gaRecords.length > 0;

  // If no related tables, just render SEO dashboard directly
  if (!hasGsc && !hasGa) {
    return <SeoDashboardView tenantId={tenantId} clientId={clientId} />;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs defaultValue="seo" className="w-full">
        <TabsList className="w-full justify-start gap-1">
          <TabsTrigger value="seo" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            SEO
          </TabsTrigger>
          {hasGsc && (
            <TabsTrigger value="gsc" className="gap-1.5">
              <Search className="h-4 w-4" />
              Search Console
            </TabsTrigger>
          )}
          {hasGa && (
            <TabsTrigger value="ga" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="seo">
          <SeoDashboardView tenantId={tenantId} clientId={clientId} />
        </TabsContent>

        {hasGsc && gscTable && (
          <TabsContent value="gsc">
            <SearchConsoleDashboard tableId={gscTable.id} />
          </TabsContent>
        )}

        {hasGa && gaTable && gaRecords && (
          <TabsContent value="ga">
            <GoogleAnalyticsDashboard
              records={gaRecords}
              tableId={gaTable.id}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
