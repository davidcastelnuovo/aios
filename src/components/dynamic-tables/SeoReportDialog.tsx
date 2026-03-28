import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Globe, FileText, Calendar, ArrowUp, ArrowDown, Loader2, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface SeoReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

export function SeoReportDialog({ open, onOpenChange, assignedClientIds }: SeoReportDialogProps) {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['seo-report-clients', currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, agency_id, website, is_seo_client')
        .eq('tenant_id', currentTenantId!)
        .order('name');
      if (error) throw error;
      let result = data || [];
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
            targetDomain: domain,
            reportType: 'site_explorer',
            clientId: selectedClient,
          },
        }
      });

      if (error) throw error;

      toast({ title: "טבלת דוח SEO נוצרה בהצלחה!", description: "כעת ניתן לשתף אותה." });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
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
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      {client.name}
                      {client.is_seo_client && (
                        <Badge variant="secondary" className="text-xs">SEO</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {latestReport && format(new Date(latestReport.received_at), 'dd MMMM yyyy', { locale: he })}
                      <Badge variant="secondary">{reports.length} דוחות</Badge>
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
