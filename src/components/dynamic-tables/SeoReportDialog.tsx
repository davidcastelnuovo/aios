import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { TrendingUp, Globe, FileText, Calendar, ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface SeoReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

export function SeoReportDialog({ open, onOpenChange, assignedClientIds }: SeoReportDialogProps) {
  const { currentTenantId } = useTenant();
  const [selectedClient, setSelectedClient] = useState("");

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['seo-report-clients', currentTenantId],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, agency_id, website, is_seo_client')
        .eq('tenant_id', currentTenantId!)
        .order('name');
      
      const { data, error } = await query;
      if (error) throw error;
      let result = data || [];
      if (assignedClientIds) {
        result = result.filter(c => assignedClientIds.includes(c.id));
      }
      return result;
    },
    enabled: !!currentTenantId && open,
  });

  // Fetch ahrefs reports for selected client
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

  // Group reports by type
  const groupedReports = useMemo(() => {
    const groups: Record<string, typeof reports> = {};
    reports.forEach(r => {
      const type = r.report_type || 'general';
      if (!groups[type]) groups[type] = [];
      groups[type].push(r);
    });
    return groups;
  }, [reports]);

  // Extract key metrics from report_data
  const extractMetrics = (reportData: any): { label: string; value: string | number; change?: number }[] => {
    if (!reportData || typeof reportData !== 'object') return [];
    const metrics: { label: string; value: string | number; change?: number }[] = [];
    
    const metricLabels: Record<string, string> = {
      organic_traffic: 'תנועה אורגנית',
      organic_keywords: 'מילות מפתח',
      backlinks: 'קישורים נכנסים',
      referring_domains: 'דומיינים מפנים',
      domain_rating: 'דירוג דומיין',
      url_rating: 'דירוג URL',
      ahrefs_rank: 'דירוג Ahrefs',
      traffic_value: 'ערך תנועה',
      pages_crawled: 'דפים שנסרקו',
      health_score: 'ציון בריאות',
      total_issues: 'בעיות',
      errors: 'שגיאות',
      warnings: 'אזהרות',
      notices: 'הערות',
    };

    // Try flat keys
    for (const [key, label] of Object.entries(metricLabels)) {
      if (reportData[key] !== undefined && reportData[key] !== null) {
        metrics.push({ label, value: reportData[key] });
      }
    }

    // Try nested metrics object
    if (reportData.metrics && typeof reportData.metrics === 'object') {
      for (const [key, label] of Object.entries(metricLabels)) {
        if (reportData.metrics[key] !== undefined && reportData.metrics[key] !== null && !metrics.find(m => m.label === label)) {
          metrics.push({ label, value: reportData.metrics[key] as string | number });
        }
      }
    }

    // If no known keys found, show top-level numeric/string values
    if (metrics.length === 0) {
      for (const [key, val] of Object.entries(reportData)) {
        if ((typeof val === 'number' || typeof val === 'string') && key !== 'html' && key !== 'raw_html') {
          metrics.push({ label: key, value: val });
        }
        if (metrics.length >= 8) break;
      }
    }

    return metrics;
  };

  const reportTypeLabels: Record<string, string> = {
    site_explorer: 'סייט אקספלורר',
    site_audit: 'ביקורת אתר',
    keywords_explorer: 'מילות מפתח',
    backlinks: 'קישורים נכנסים',
    organic_search: 'חיפוש אורגני',
    content_explorer: 'תוכן',
    rank_tracker: 'מעקב דירוגים',
    general: 'כללי',
  };

  const hasHtmlContent = (reportData: any): string | null => {
    if (!reportData) return null;
    if (typeof reportData === 'string' && reportData.includes('<')) return reportData;
    if (reportData.html) return reportData.html;
    if (reportData.raw_html) return reportData.raw_html;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
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
            <div className="space-y-4">
              {reportsLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map(i => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-5 w-32" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-16 w-full" />
                      </CardContent>
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
                  {/* Summary Stats */}
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">סה״כ דוחות</p>
                        <p className="text-2xl font-bold text-primary">{reports.length}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">סוגי דוחות</p>
                        <p className="text-2xl font-bold text-primary">{Object.keys(groupedReports).length}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">דוח אחרון</p>
                        <p className="text-sm font-semibold text-primary">
                          {reports[0] ? format(new Date(reports[0].received_at), 'dd/MM/yyyy', { locale: he }) : '-'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">דומיין</p>
                        <p className="text-sm font-semibold text-primary truncate">
                          {reports[0]?.domain || '-'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Reports by Type */}
                  {Object.entries(groupedReports).map(([type, typeReports]) => (
                    <div key={type} className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {reportTypeLabels[type] || type}
                        <Badge variant="outline" className="text-xs">{typeReports.length}</Badge>
                      </h3>

                      {typeReports.slice(0, 3).map((report) => {
                        const metrics = extractMetrics(report.report_data);
                        const htmlContent = hasHtmlContent(report.report_data);

                        return (
                          <Card key={report.id} className="overflow-hidden">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {format(new Date(report.received_at), 'dd MMMM yyyy, HH:mm', { locale: he })}
                                </CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                  {report.domain}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {/* Metrics Grid */}
                              {metrics.length > 0 && (
                                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                                  {metrics.map((metric, idx) => (
                                    <div key={idx} className="bg-muted/50 rounded-lg p-3 text-center">
                                      <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                                      <p className="text-lg font-bold">
                                        {typeof metric.value === 'number' 
                                          ? metric.value.toLocaleString() 
                                          : metric.value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* HTML Content */}
                              {htmlContent && (
                                <div 
                                  className="mt-3 prose prose-sm dark:prose-invert max-w-none text-right"
                                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                                />
                              )}

                              {/* Fallback: show raw data summary if no metrics or html */}
                              {metrics.length === 0 && !htmlContent && (
                                <p className="text-sm text-muted-foreground">
                                  נתוני הדוח זמינים אך לא בפורמט מוכר להצגה ויזואלית
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                      
                      {typeReports.length > 3 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{typeReports.length - 3} דוחות נוספים
                        </p>
                      )}
                    </div>
                  ))}
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
