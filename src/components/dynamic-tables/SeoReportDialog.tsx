import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Globe, FileText, Calendar, ArrowUp, ArrowDown, Loader2, PlusCircle, Search, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

interface SeoReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

function ClientSearchSelect({ clients, selectedClient, onSelect }: {
  clients: { id: string; name: string; is_seo_client?: boolean | null }[];
  selectedClient: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  const selectedName = clients.find(c => c.id === selectedClient)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selectedName || "בחר לקוח..."}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חפש לקוח..."
            className="border-0 p-0 h-8 focus-visible:ring-0 shadow-none"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו לקוחות</p>
          ) : (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => { onSelect(client.id); setOpen(false); setSearch(""); }}
                className={cn(
                  "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-right",
                  selectedClient === client.id && "bg-accent"
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0", selectedClient === client.id ? "opacity-100" : "opacity-0")} />
                {client.name}
                {client.is_seo_client && <Badge variant="secondary" className="text-xs mr-auto">SEO</Badge>}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SeoReportDialog({ open, onOpenChange, assignedClientIds }: SeoReportDialogProps) {
  const { currentTenantId, currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState("");
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['seo-report-clients', currentTenantId],
    queryFn: async () => {
      // 1) Own-tenant clients
      const ownPromise = supabase
        .from('clients')
        .select('id, name, agency_id, website, is_seo_client')
        .eq('tenant_id', currentTenantId!);

      // 2) Cross-tenant: agencies shared with this tenant
      const sharedAgenciesPromise = supabase
        .from('agency_tenant_access')
        .select('agency_id')
        .eq('accessing_tenant_id', currentTenantId!);

      const [ownRes, sharedRes] = await Promise.all([ownPromise, sharedAgenciesPromise]);
      if (ownRes.error) throw ownRes.error;
      if (sharedRes.error) throw sharedRes.error;

      const sharedAgencyIds = (sharedRes.data || []).map((r: any) => r.agency_id).filter(Boolean);

      let sharedClients: any[] = [];
      if (sharedAgencyIds.length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, agency_id, website, is_seo_client')
          .in('agency_id', sharedAgencyIds);
        if (error) throw error;
        sharedClients = data || [];
      }

      // Merge & dedupe by id
      const map = new Map<string, any>();
      [...(ownRes.data || []), ...sharedClients].forEach((c: any) => map.set(c.id, c));
      let result = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'he'));

      if (assignedClientIds) {
        result = result.filter(c => assignedClientIds.includes(c.id));
      }
      return result;
    },
    enabled: !!currentTenantId && open,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['seo-reports', currentTenantId, selectedClient],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahrefs_reports')
        .select('*')
        .eq('tenant_id', currentTenantId!)
        .eq('client_id', selectedClient)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId && !!selectedClient,
  });

  // Extract structured data from the latest report
  const latestReport = reports[0];
  const reportData = latestReport?.report_data as any;

  const snapshot = reportData?.snapshot || {};
  const trafficHistory = Array.isArray(reportData?.traffic_history) ? reportData.traffic_history : [];
  const organicKeywords = Array.isArray(reportData?.organic_keywords) ? reportData.organic_keywords : [];

  const snapshotMetrics = [
    { label: 'דירוג דומיין (DR)', value: snapshot.dr, icon: '🏆' },
    { label: 'תנועה אורגנית', value: snapshot.org_traffic?.toLocaleString(), icon: '📈' },
    { label: 'מילות מפתח (Top 3)', value: snapshot.org_keywords_top3, icon: '🥇' },
    { label: 'מילות מפתח (Top 10)', value: snapshot.org_keywords_top10, icon: '🔟' },
    { label: 'סה״כ מילות מפתח', value: snapshot.org_keywords_total, icon: '🔑' },
    { label: 'דומיינים מפנים', value: snapshot.referring_domains, icon: '🔗' },
    { label: 'קישורים נכנסים (פעילים)', value: snapshot.backlinks_live?.toLocaleString(), icon: '🌐' },
    { label: 'קישורים נכנסים (כולל)', value: snapshot.backlinks_all_time?.toLocaleString(), icon: '📊' },
  ].filter(m => m.value !== undefined && m.value !== null);

  const chartData = trafficHistory.map((item: any) => ({
    date: item.date ? format(new Date(item.date), 'MM/yy') : '',
    traffic: item.traffic || 0,
  }));

  const selectedClientObj = clients.find(c => c.id === selectedClient);

  const handleCreateTable = async () => {
    if (!selectedClient || !latestReport) return;
    setIsCreatingTable(true);
    try {
      const domain = reportData?.domain || latestReport?.domain || '';
      const clientName = selectedClientObj?.name || '';
      const tableName = `דוח SEO - ${clientName}`;
      const slug = `seo-report-${selectedClient}-${Date.now()}`;

      const { error } = await supabase.functions.invoke('crm-tables', {
        body: {
          action: 'create',
          tenantId: currentTenantId,
          name: tableName,
          slug,
          description: `דוח SEO עבור ${domain}`,
          category: 'seo',
          icon: 'TrendingUp',
          agencyId: selectedClientObj?.agency_id || null,
          clientId: selectedClient,
          integration_type: 'ahrefs',
          integration_settings: {
            data_source: 'ahrefs_reports',
            targetDomain: domain,
            reportType: 'site_explorer',
            clientId: selectedClient,
          },
        }
      });

      if (error) throw error;

      toast({ title: "טבלת דוח SEO נוצרה בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      onOpenChange(false);
      // Navigate to the new table
      const tenantSlug = currentTenant?.slug || '';
      if (tenantSlug) {
        navigate(`/t/${tenantSlug}/table/${slug}`);
      }
    } catch (error: any) {
      toast({ title: "שגיאה ביצירת הטבלה", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingTable(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דוח SEO
          </DialogTitle>
          <DialogDescription>
            בחר לקוח כדי לצפות בנתוני SEO שהתקבלו מהאינטגרציה
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>בחר לקוח</Label>
            <ClientSearchSelect
              clients={clients}
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
            />
          </div>

          {/* Reports Display */}
          {selectedClient && (
            <div className="space-y-5">
              {reportsLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map(i => (
                    <Card key={i}>
                      <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                      <CardContent><Skeleton className="h-16 w-full" /></CardContent>
                    </Card>
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-lg mb-1">אין דוחות SEO</h3>
                  <p className="text-muted-foreground text-sm">
                    לא נמצאו דוחות עבור לקוח זה. ודא שהאינטגרציה מחוברת ושולחת נתונים.
                  </p>
                </Card>
              ) : (
                <>
                  {/* Report Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">{reportData?.domain || latestReport?.domain}</span>
                      {reportData?.project_name && (
                        <Badge variant="outline">{reportData.project_name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateTable}
                        disabled={isCreatingTable}
                        className="gap-1.5"
                      >
                        {isCreatingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        צור כטבלה
                      </Button>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {latestReport && format(new Date(latestReport.received_at), 'dd MMMM yyyy', { locale: he })}
                        <Badge variant="secondary">{reports.length} דוחות</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Snapshot Metrics */}
                  {snapshotMetrics.length > 0 && (
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                      {snapshotMetrics.map((metric, idx) => (
                        <Card key={idx} className="border-primary/10">
                          <CardContent className="p-4 text-center">
                            <span className="text-xl mb-1 block">{metric.icon}</span>
                            <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                            <p className="text-2xl font-bold text-primary">{metric.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Traffic History Chart */}
                  {chartData.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">היסטוריית תנועה אורגנית</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip 
                              formatter={(value: number) => [value.toLocaleString(), 'תנועה']}
                              labelFormatter={(label) => `תאריך: ${label}`}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="traffic" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2.5}
                              dot={{ fill: "hsl(var(--primary))", r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Organic Keywords Table */}
                  {organicKeywords.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>מילות מפתח אורגניות</span>
                          <Badge variant="outline">{organicKeywords.length} מילים</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-right p-3 font-medium">מילת מפתח</th>
                                <th className="text-center p-3 font-medium">מיקום</th>
                                <th className="text-center p-3 font-medium">שינוי</th>
                                <th className="text-center p-3 font-medium">תנועה</th>
                                <th className="text-center p-3 font-medium">נפח חיפוש</th>
                                <th className="text-center p-3 font-medium">KD</th>
                              </tr>
                            </thead>
                            <tbody>
                              {organicKeywords.slice(0, 20).map((kw: any, idx: number) => {
                                const posChange = kw.position_prev_month != null 
                                  ? kw.position_prev_month - (kw.position || 0) 
                                  : null;
                                return (
                                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-3 font-medium">{String(kw.keyword || '')}</td>
                                    <td className="p-3 text-center">
                                      <Badge variant="secondary" className="font-mono">
                                        {kw.position ?? '-'}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-center">
                                      {posChange !== null && posChange !== 0 ? (
                                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${posChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          {posChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                          {Math.abs(posChange)}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">{kw.traffic != null ? Number(kw.traffic).toLocaleString() : '-'}</td>
                                    <td className="p-3 text-center">{kw.volume != null ? Number(kw.volume).toLocaleString() : '-'}</td>
                                    <td className="p-3 text-center">
                                      <Badge variant={kw.kd <= 20 ? 'default' : kw.kd <= 50 ? 'secondary' : 'destructive'} className="text-xs">
                                        {kw.kd ?? '-'}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {organicKeywords.length > 20 && (
                            <p className="text-center text-sm text-muted-foreground py-3">
                              +{organicKeywords.length - 20} מילות מפתח נוספות
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* HTML content fallback */}
                  {reportData?.html && (
                    <Card>
                      <CardContent className="p-4">
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none text-right"
                          dangerouslySetInnerHTML={{ __html: reportData.html }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
