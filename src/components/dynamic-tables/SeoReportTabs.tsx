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
import { TrendingUp, Search, BarChart3, Settings2, RefreshCw, Plus, Phone } from "lucide-react";
import { MaskyooSiblingCard } from "./MaskyooSiblingCard";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { useAhrefsReports } from "@/hooks/useAhrefsReports";
import { filterValidSeoReports } from "./seo/reportValidity";
import { useSeoScope } from "@/hooks/useSeoScope";

interface SeoReportTabsProps {
  /**
   * Optional: tenant_id of the SEO/Ahrefs crm_table when known by the caller
   * (e.g. when opening the standalone SEO table view inside DynamicTableView).
   * The component still resolves the FULL accessible-tenant scope from clientId
   * so shared-agency reports load regardless of where they were created.
   */
  tenantId?: string;
  clientId: string;
}

export function SeoReportTabs({ tenantId, clientId }: SeoReportTabsProps) {
  const queryClient = useQueryClient();

  // Resolve the full SEO scope (client tenant + accessible tenants via shared agencies)
  const { data: scope } = useSeoScope(clientId);
  const accessibleTenantIds = scope?.accessibleTenantIds || [];

  // Find the SEO/Ahrefs table across all accessible tenants. Prefer the explicit
  // table from scope; if none, derive a stable tenant_id for the report from
  // either the table's tenant_id, the client's home tenant, or the prop.
  const seoTable = scope?.seoTable || null;
  const reportTenantId =
    seoTable?.tenant_id ||
    scope?.clientTenantId ||
    tenantId ||
    "";

  // Check whether we actually have valid Ahrefs SEO reports for this client.
  // Use client-scoped lookup so reports stored under a sibling tenant still load.
  const { data: ahrefsReports } = useAhrefsReports({
    clientId,
    tenantIds: accessibleTenantIds,
  });
  const hasValidAhrefsReports = useMemo(
    () => filterValidSeoReports(ahrefsReports || []).length > 0,
    [ahrefsReports]
  );

  // Fetch the client's own website as a fallback for GSC domain auto-match
  // (when no Ahrefs SEO table exists for this client, targetDomain is empty).
  const { data: clientRow } = useQuery({
    queryKey: ['client-website', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('website')
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
  const clientWebsite = clientRow?.website || '';

  const targetDomain = (seoTable?.integration_settings as any)?.targetDomain || '';
  const savedGaTableId = (seoTable?.integration_settings as any)?.linkedGaTableId || '';
  const savedGscTableId = (seoTable?.integration_settings as any)?.linkedGscTableId || '';
  const savedGscSiteUrl = (seoTable?.integration_settings as any)?.linkedGscSiteUrl || '';
  const savedGscLangFilter = ((seoTable?.integration_settings as any)?.linkedGscLangFilter || 'all') as 'all' | 'he' | 'en';

  // GA / GSC tables come from the scope (already searched across all accessible tenants)
  const gaTables = scope?.gaTables || [];
  const gscTables = scope?.gscTables || [];

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
      queryClient.invalidateQueries({ queryKey: ['seo-scope', clientId] });
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

  // Check GSC/GA integration access across ALL accessible tenants (shared agency).
  // RLS still gates what the user can actually see, but we no longer restrict by
  // the active session tenant — that previously hid integrations created in
  // a sibling tenant for shared-agency clients.
  const { data: gscUserIntegrations } = useUserIntegrations(accessibleTenantIds, 'google_search_console');
  const { data: gaUserIntegrations } = useUserIntegrations(accessibleTenantIds, 'google_analytics');

  const hasGa =
    gaTables.length > 0 ||
    (Array.isArray(gaUserIntegrations) && gaUserIntegrations.length > 0);
  const hasGsc =
    (Array.isArray(gscUserIntegrations) && gscUserIntegrations.length > 0) ||
    gscTables.length > 0 ||
    !!savedGscTableId ||
    !!savedGscSiteUrl;

  // Always render tabs so the Maskyoo (calls) tab is available even when no
  // GSC/GA integrations are linked.


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
          <TabsTrigger value="maskyoo" className="gap-1.5">
            <Phone className="h-4 w-4" />
            שיחות מסקיו
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maskyoo">
          <MaskyooSiblingCard
            table={{
              id: "",
              tenant_id: reportTenantId,
              client_id: clientId,
              integration_type: "ahrefs",
              integration_settings: {},
            }}
          />
        </TabsContent>

        <TabsContent value="seo">
          <SeoDashboardView
            tenantId={reportTenantId}
            clientId={clientId}
            accessibleTenantIds={accessibleTenantIds}
            gaRecords={gaRecords || []}
            initialGscSiteUrl={savedGscSiteUrl}
            onGscSiteSelected={(siteUrl) => {
              if (siteUrl && siteUrl !== savedGscSiteUrl) {
                saveLinkMutation.mutate({ key: 'linkedGscSiteUrl', value: siteUrl });
              }
            }}
            initialLangFilter={savedGscLangFilter}
            onLangFilterChange={(v) => saveLinkMutation.mutate({ key: 'linkedGscLangFilter', value: v })}
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
                <SearchConsoleDashboard
                  tableId={selectedGscTableId}
                  initialLangFilter={savedGscLangFilter}
                  onLangFilterChange={(v) => saveLinkMutation.mutate({ key: 'linkedGscLangFilter', value: v })}
                />
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
                  tenantId={reportTenantId}
                  tenantIds={accessibleTenantIds}
                  clientId={clientId}
                  domain={savedGscSiteUrl || targetDomain || clientWebsite}
                  initialSiteUrl={savedGscSiteUrl}
                  initialLangFilter={savedGscLangFilter}
                  onLangFilterChange={(v) => saveLinkMutation.mutate({ key: 'linkedGscLangFilter', value: v })}
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
            queryClient.invalidateQueries({ queryKey: ['seo-scope', clientId] });
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
