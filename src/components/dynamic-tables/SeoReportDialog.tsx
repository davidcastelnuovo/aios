import { useState, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { useSeoScope } from "@/hooks/useSeoScope";
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
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isFetchingFromAhrefs, setIsFetchingFromAhrefs] = useState(false);

  // New-report form state
  const [domainInput, setDomainInput] = useState("");
  const [selectedAhrefsProject, setSelectedAhrefsProject] = useState<string>("none");
  const [selectedGscIntegrationId, setSelectedGscIntegrationId] = useState<string>("none");
  const [selectedGscSite, setSelectedGscSite] = useState<string>("");
  const [selectedGaIntegrationId, setSelectedGaIntegrationId] = useState<string>("none");
  const [selectedGaProperty, setSelectedGaProperty] = useState<string>("");
  const [isCreatingReport, setIsCreatingReport] = useState(false);

  const handleFetchFromAhrefs = async () => {
    if (!selectedClient) return;
    const client = clients.find(c => c.id === selectedClient);
    const domain = normalizeDomain(client?.website);
    if (!domain) {
      toast({ title: 'אין דומיין מוגדר ללקוח', variant: 'destructive' });
      return;
    }
    setIsFetchingFromAhrefs(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ahrefs-snapshot', {
        body: { clientId: selectedClient, domain },
      });
      if (error) throw error;
      toast({
        title: 'הדוח נוצר בהצלחה',
        description: `${data?.keywords_count ?? 0} מילות מפתח נטענו עבור ${data?.domain || domain}`,
      });
      queryClient.invalidateQueries({ queryKey: ['seo-reports', currentTenantId, selectedClient] });
      queryClient.invalidateQueries({ queryKey: ['ahrefs-reports'] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
    } catch (err: any) {
      toast({
        title: 'שגיאה ביצירת דוח מ-Ahrefs',
        description: err?.message || 'נסה שוב מאוחר יותר',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingFromAhrefs(false);
    }
  };

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

  // SEO scope for cross-tenant integration lookups
  const seoScope = useSeoScope(selectedClient || undefined);
  const integrationTenantIds = useMemo(() => {
    const set = new Set<string>();
    if (currentTenantId) set.add(currentTenantId);
    (seoScope.data?.accessibleTenantIds || []).forEach(t => set.add(t));
    return Array.from(set);
  }, [currentTenantId, seoScope.data?.accessibleTenantIds]);

  // Ahrefs projects
  const { data: ahrefsProjects = [], isLoading: ahrefsProjectsLoading } = useQuery({
    queryKey: ['ahrefs-projects-picker'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-ahrefs-projects', { body: {} });
      if (error) throw error;
      return (data?.projects || []) as Array<{ project_id: string; project_name: string; domain: string; url: string }>;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // GSC & GA integrations
  const { data: gscIntegrations = [] } = useUserIntegrations(integrationTenantIds, 'google_search_console', { enabled: open && integrationTenantIds.length > 0 });
  const { data: gaIntegrations = [] } = useUserIntegrations(integrationTenantIds, 'google_analytics', { enabled: open && integrationTenantIds.length > 0 });

  // Available domains for the selected client
  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r: any) => { if (r.domain) set.add(r.domain); });
    return Array.from(set);
  }, [reports]);

  // Normalize a website URL → bare domain (no protocol, no www, no path)
  const normalizeDomain = (url?: string | null): string => {
    if (!url) return '';
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase().trim();
  };

  const selectedClientObjEarly = clients.find(c => c.id === selectedClient);
  const clientPreferredDomain = normalizeDomain(selectedClientObjEarly?.website);

  // Auto-select domain: prefer the one matching client's website, else first
  useMemo(() => {
    if (!selectedClient || availableDomains.length === 0) {
      if (selectedDomain) setSelectedDomain("");
      return;
    }
    if (selectedDomain && availableDomains.includes(selectedDomain)) return;
    const preferred = clientPreferredDomain
      ? availableDomains.find(d => d.toLowerCase() === clientPreferredDomain || d.toLowerCase().includes(clientPreferredDomain) || clientPreferredDomain.includes(d.toLowerCase()))
      : null;
    setSelectedDomain(preferred || availableDomains[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, availableDomains.join('|'), clientPreferredDomain]);

  // Pick the latest report matching the selected domain
  const latestReport = useMemo(() => {
    if (!reports.length) return null;
    if (selectedDomain) {
      return reports.find((r: any) => r.domain === selectedDomain) || reports[0];
    }
    return reports[0];
  }, [reports, selectedDomain]);
  const reportData = (latestReport as any)?.report_data;

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
      const domain = selectedDomain || reportData?.domain || latestReport?.domain || '';
      const clientName = selectedClientObj?.name || '';
      const domainMatchesName = domain && clientName && domain.toLowerCase().includes(clientName.toLowerCase());
      const tableName = domain && !domainMatchesName ? `${clientName} - ${domain}` : clientName;
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
                <Card className="p-8 text-center space-y-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg mb-1">אין דוחות SEO</h3>
                    <p className="text-muted-foreground text-sm">
                      {selectedClientObj?.website ? (
                        <>ניתן ליצור דוח חדש ישירות מ-Ahrefs לפי הדומיין של הלקוח: <span className="font-medium">{normalizeDomain(selectedClientObj.website)}</span></>
                      ) : (
                        'ללקוח זה אין אתר מוגדר. הגדר אתר לקוח ונסה שוב, או חבר את האינטגרציה.'
                      )}
                    </p>
                  </div>
                  {selectedClientObj?.website && (
                    <Button
                      onClick={handleFetchFromAhrefs}
                      disabled={isFetchingFromAhrefs}
                      className="gap-2"
                    >
                      {isFetchingFromAhrefs ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      {isFetchingFromAhrefs ? 'מייצר דוח...' : 'צור דוח חדש מ-Ahrefs'}
                    </Button>
                  )}
                </Card>
              ) : (
                <>
                  {/* Report Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Globe className="h-5 w-5 text-primary" />
                      {availableDomains.length > 1 ? (
                        <select
                          value={selectedDomain}
                          onChange={(e) => setSelectedDomain(e.target.value)}
                          className="font-semibold text-lg bg-transparent border border-input rounded-md px-2 py-1 cursor-pointer hover:bg-accent"
                        >
                          {availableDomains.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-lg">{reportData?.domain || latestReport?.domain}</span>
                      )}
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
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reportData.html || "", { FORBID_TAGS: ["script", "style", "iframe", "object", "embed"], FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"] }) }}
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
