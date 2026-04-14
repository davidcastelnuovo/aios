import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SeoDashboardView } from "./SeoDashboardView";
import { SearchConsoleDashboard } from "./SearchConsoleDashboard";
import { GoogleAnalyticsDashboard } from "./GoogleAnalyticsDashboard";
import { GscIntegration } from "./seo/GscIntegration";
import { TrendingUp, Search, BarChart3, Settings2 } from "lucide-react";
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

  // Fetch ALL GA and GSC tables for this tenant
  const { data: relatedTables } = useQuery({
    queryKey: ['seo-related-tables', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_tables')
        .select('id, name, slug, integration_type, integration_settings')
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

  useEffect(() => {
    if (savedGaTableId) setSelectedGaTableId(savedGaTableId);
    else if (gaTables.length === 1) setSelectedGaTableId(gaTables[0].id);
  }, [savedGaTableId, gaTables]);

  useEffect(() => {
    if (savedGscTableId) setSelectedGscTableId(savedGscTableId);
    else if (gscTables.length === 1) setSelectedGscTableId(gscTables[0].id);
  }, [savedGscTableId, gscTables]);

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

  // Fetch GA records for selected table
  const { data: gaRecords } = useQuery({
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
          <SeoDashboardView tenantId={tenantId} clientId={clientId} />
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
                  domain={targetDomain}
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
                    {selectedGaTableId && (
                      <Badge variant="secondary" className="text-xs">
                        {gaTables.find(t => t.id === selectedGaTableId)?.name}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* GA Dashboard */}
              {selectedGaTableId && gaRecords && gaRecords.length > 0 ? (
                <GoogleAnalyticsDashboard
                  records={gaRecords}
                  tableId={selectedGaTableId}
                />
              ) : selectedGaTableId ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    אין נתונים זמינים עבור חשבון Analytics זה
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
