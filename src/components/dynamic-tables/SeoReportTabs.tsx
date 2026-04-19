import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeoDashboardView } from "./SeoDashboardView";
import { SearchConsoleDashboard } from "./SearchConsoleDashboard";
import { GoogleAnalyticsDashboard } from "./GoogleAnalyticsDashboard";
import { GoogleAnalyticsTableDialog } from "./GoogleAnalyticsTableDialog";
import { GscIntegration } from "./seo/GscIntegration";
import { TrendingUp, Search, BarChart3, Settings2, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface SeoReportTabsProps {
  tenantId: string;
  clientId: string;
}

export function SeoReportTabs({ tenantId, clientId }: SeoReportTabsProps) {
  const queryClient = useQueryClient();

  // Get the current SEO table's domain for GSC matching
  const { data: seoTable } = useQuery({
    queryKey: ['seo-table-info', tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_tables')
        .select('id, integration_settings')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'ahrefs')
        .limit(100);
      if (error) throw error;
      return data?.find(t => (t.integration_settings as any)?.clientId === clientId) || null;
    },
    enabled: !!tenantId && !!clientId,
  });

  const targetDomain = (seoTable?.integration_settings as any)?.targetDomain || '';
  const savedGaTableId = (seoTable?.integration_settings as any)?.linkedGaTableId || '';
  const savedGscTableId = (seoTable?.integration_settings as any)?.linkedGscTableId || '';
  const savedGscSiteUrl = (seoTable?.integration_settings as any)?.linkedGscSiteUrl || '';

  // Fetch ALL GA and GSC tables for this tenant
  const { data: relatedTables } = useQuery({
    queryKey: ['seo-related-tables', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_tables')
        .select('id, name, slug, integration_type, integration_settings, client_id')
        .eq('tenant_id', tenantId)
        .in('integration_type', ['google_search_console', 'google_analytics']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const gaTables = useMemo(() => 
    relatedTables?.filter(t => t.integration_type === 'google_analytics') || [],
    [relatedTables]
  );

  const gscTables = useMemo(() =>
    relatedTables?.filter(t => t.integration_type === 'google_search_console') || [],
    [relatedTables]
  );

  // Selected GA table (from saved or first available)
  const [selectedGaTableId, setSelectedGaTableId] = useState<string>("");
  const [selectedGscTableId, setSelectedGscTableId] = useState<string>("");
  const [showGaDialog, setShowGaDialog] = useState(false);

  useEffect(() => {
    if (savedGaTableId) setSelectedGaTableId(savedGaTableId);
    else {
      // Auto-match by client_id
      const matchByClient = gaTables.find(t => t.client_id === clientId);
      if (matchByClient) {
        setSelectedGaTableId(matchByClient.id);
        // Auto-save the link
        if (seoTable?.id) saveLinkMutation.mutate({ key: 'linkedGaTableId', value: matchByClient.id });
      } else if (gaTables.length === 1) {
        setSelectedGaTableId(gaTables[0].id);
      }
    }
  }, [savedGaTableId, gaTables, clientId]);

  useEffect(() => {
    if (savedGscTableId) setSelectedGscTableId(savedGscTableId);
    else {
      const matchByClient = gscTables.find(t => t.client_id === clientId);
      if (matchByClient) {
        setSelectedGscTableId(matchByClient.id);
        if (seoTable?.id) saveLinkMutation.mutate({ key: 'linkedGscTableId', value: matchByClient.id });
      } else if (gscTables.length === 1) {
        setSelectedGscTableId(gscTables[0].id);
      }
    }
  }, [savedGscTableId, gscTables, clientId]);

  // Save linked table ID to SEO table's integration_settings
  const saveLinkMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!seoTable?.id) return;
      const currentSettings = (seoTable.integration_settings as any) || {};
      const { error } = await supabase
        .from('crm_tables')
        .update({ integration_settings: { ...currentSettings, [key]: value } })
        .eq('id', seoTable.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-table-info'] });
      toast.success('החיבור נשמר');
    },
  });

  // Fetch GA records for selected table (daily_source, daily, top_pages, traffic_source, event_total)
  const { data: gaRecordsRaw } = useQuery({
    queryKey: ['crm-records', selectedGaTableId],
    queryFn: async () => {
      if (!selectedGaTableId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke(`crm-records?table_id=${selectedGaTableId}`, { method: 'GET' });
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!selectedGaTableId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch channel_group and event_aggregate records directly — these are small sets that
  // can get pushed out of the crm-records response when there are many daily_source rows
  const { data: gaAggregateRecords } = useQuery({
    queryKey: ['crm-records-aggregate', selectedGaTableId],
    queryFn: async () => {
      if (!selectedGaTableId) return [];
      const { data, error } = await supabase
        .from('crm_records')
        .select('id, data')
        .eq('table_id', selectedGaTableId)
        .in('data->>report_type', ['channel_group', 'event_aggregate', 'monthly_organic'])
        .order('created_at', { ascending: false })
        .limit(600);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedGaTableId,
    staleTime: 5 * 60 * 1000,
  });

  // Merge: aggregate records first so they are always present, dedup by id
  const gaRecords = useMemo(() => {
    const base = Array.isArray(gaRecordsRaw) ? gaRecordsRaw : [];
    const agg = Array.isArray(gaAggregateRecords) ? gaAggregateRecords : [];
    if (agg.length === 0) return base;
    const existingIds = new Set(base.map((r: any) => r.id));
    const newAgg = agg.filter((r: any) => !existingIds.has(r.id));
    return [...newAgg, ...base];
  }, [gaRecordsRaw, gaAggregateRecords]);

  // GA sync mutation
  const syncGaMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const now = new Date();
      const endDate = now.toISOString().split('T')[0];
      // Sync at least 90 days so we don't wipe historical data when triggering
      // a manual GA sync from the SEO report (which only shows monthly trends).
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await supabase.functions.invoke('sync-google-analytics-data', {
        method: 'POST',
        body: { tableId, startDate, endDate },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', selectedGaTableId] });
      toast.success(`נתוני Analytics סונכרנו (${data?.records_synced || 0} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון Analytics: ' + error.message);
    },
  });

  // Auto-sync GA if table is selected but has no records
  useEffect(() => {
    if (selectedGaTableId && gaRecords && gaRecords.length === 0 && !syncGaMutation.isPending) {
      syncGaMutation.mutate(selectedGaTableId);
    }
  }, [selectedGaTableId, gaRecords]);

  // Check GSC integration exists
  const { data: gscIntegration } = useQuery({
    queryKey: ['gsc-integration', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_search_console')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const hasGa = gaTables.length > 0;
  const hasGsc = !!gscIntegration || gscTables.length > 0;

  // If no related integrations at all, just render SEO dashboard directly
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
          <SeoDashboardView
            tenantId={tenantId}
            clientId={clientId}
            gaRecords={gaRecords || []}
          />
        </TabsContent>

        {hasGsc && (
          <TabsContent value="gsc">
            {/* If we have a GSC crm_table with data, show the full dashboard */}
            {selectedGscTableId ? (
              <div className="space-y-3">
                {gscTables.length > 1 && (
                  <GscTableSelector
                    tables={gscTables}
                    selectedId={selectedGscTableId}
                    onSelect={(id) => {
                      setSelectedGscTableId(id);
                      saveLinkMutation.mutate({ key: 'linkedGscTableId', value: id });
                    }}
                  />
                )}
                <SearchConsoleDashboard tableId={selectedGscTableId} />
              </div>
            ) : (
              /* Otherwise show GSC integration component with site selector */
              <div className="space-y-3">
                {gscTables.length > 0 && (
                  <GscTableSelector
                    tables={gscTables}
                    selectedId={selectedGscTableId}
                    onSelect={(id) => {
                      setSelectedGscTableId(id);
                      saveLinkMutation.mutate({ key: 'linkedGscTableId', value: id });
                    }}
                  />
                )}
                <GscIntegration
                  tenantId={tenantId}
                  clientId={clientId}
                  domain={savedGscSiteUrl || targetDomain}
                  onSiteSelected={(siteUrl) => {
                    if (siteUrl && siteUrl !== savedGscSiteUrl) {
                      saveLinkMutation.mutate({ key: 'linkedGscSiteUrl', value: siteUrl });
                    }
                  }}
                />
              </div>
            )}
          </TabsContent>
        )}

        {hasGa && (
          <TabsContent value="ga">
            <div className="space-y-3">
              {/* GA table selector */}
              <Card className="border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Settings2 className="h-4 w-4" />
                      <span>חיבור Analytics:</span>
                    </div>
                    <Select
                      value={selectedGaTableId}
                      onValueChange={(id) => {
                        setSelectedGaTableId(id);
                        saveLinkMutation.mutate({ key: 'linkedGaTableId', value: id });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[280px] text-sm">
                        <SelectValue placeholder="בחר חשבון Analytics" />
                      </SelectTrigger>
                      <SelectContent>
                        {gaTables.map((table) => {
                          const settings = table.integration_settings as any;
                          const label = settings?.propertyName || settings?.accountName || table.name;
                          return (
                            <SelectItem key={table.id} value={table.id}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowGaDialog(true)}
                      title="צור חיבור Analytics חדש"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {selectedGaTableId && (
                      <>
                        <Badge variant="secondary" className="text-xs">
                          {gaTables.find(t => t.id === selectedGaTableId)?.name}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => syncGaMutation.mutate(selectedGaTableId)}
                          disabled={syncGaMutation.isPending}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${syncGaMutation.isPending ? 'animate-spin' : ''}`} />
                          {syncGaMutation.isPending ? 'מסנכרן...' : 'סנכרן'}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* GA Dashboard */}
              {selectedGaTableId && gaRecords && gaRecords.length > 0 ? (
                <GoogleAnalyticsDashboard
                  records={gaRecords}
                  tableId={selectedGaTableId}
                  defaultReportMode={
                    (gaTables.find(t => t.id === selectedGaTableId)?.integration_settings as any)?.default_report_mode || 'leads'
                  }
                />
              ) : selectedGaTableId ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground space-y-3">
                    {syncGaMutation.isPending ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>מסנכרן נתוני Analytics...</span>
                      </div>
                    ) : (
                      <>
                        <p>אין נתונים זמינים עבור חשבון Analytics זה</p>
                        <Button
                          variant="outline"
                          onClick={() => syncGaMutation.mutate(selectedGaTableId)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          סנכרן נתונים
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    בחר חשבון Analytics כדי להציג נתונים
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <GoogleAnalyticsTableDialog
        open={showGaDialog}
        onOpenChange={(open) => {
          setShowGaDialog(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['seo-related-tables'] });
          }
        }}
      />
    </div>
  );
}

function GscTableSelector({ tables, selectedId, onSelect }: {
  tables: any[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            <span>חיבור Search Console:</span>
          </div>
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="h-8 w-[280px] text-sm">
              <SelectValue placeholder="בחר אתר Search Console" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
