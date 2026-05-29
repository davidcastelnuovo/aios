import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Loader2, Link2, ExternalLink, TrendingUp, Search, Link as LinkIcon, BarChart3, Copy, Webhook, FileText, Calendar, Globe, UserPlus } from "lucide-react";
import { useAhrefsReports, AhrefsReport } from "@/hooks/useAhrefsReports";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";
import { hasValidSeoReportData } from "@/components/dynamic-tables/seo/reportValidity";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-webhook`;

const REPORT_TYPE_LABELS: Record<string, string> = {
  organic_keywords: "מילות מפתח אורגניות",
  backlinks: "בקלינקים",
  referring_domains: "דומיינים מפנים",
  site_explorer: "Site Explorer",
  domain_rating: "דירוג דומיין",
  keywords_explorer: "Keywords Explorer",
  content_explorer: "Content Explorer",
  rank_tracker: "מעקב דירוגים",
};

export default function AhrefsSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { crossTenantAgencyIds, hasCrossTenantAccess, buildCrossTenantFilter } = useCrossTenantAgencyIds();
  const [isConnecting, setIsConnecting] = useState(false);
  const [filterReportType, setFilterReportType] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<AhrefsReport | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  // Fetch clients for association — include cross-tenant shared agency clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-ahrefs', tenantId, crossTenantAgencyIds],
    queryFn: async () => {
      if (!tenantId) return [];
      const crossFilter = buildCrossTenantFilter();
      if (crossFilter) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, website, agency_id')
          .or(crossFilter)
          .order('name');
        return data || [];
      }
      const { data } = await supabase
        .from('clients')
        .select('id, name, website, agency_id')
        .eq('tenant_id', tenantId)
        .order('name');
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Link report to client mutation
  const linkClientMutation = useMutation({
    mutationFn: async ({ reportId, clientId, domain }: { reportId: string; clientId: string; domain: string }) => {
      // Validate that the domain matches the client's website
      const client = clients.find(c => c.id === clientId);
      const normalizeDomain = (s: string | null | undefined) =>
        (s || '')
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '')
          .trim();
      const normalizedDomain = normalizeDomain(domain);
      const normalizedWebsite = normalizeDomain(client?.website);
      if (
        normalizedWebsite &&
        normalizedDomain &&
        normalizedDomain !== normalizedWebsite
      ) {
        const ok = window.confirm(
          `שים לב — הדומיין "${domain}" לא תואם את האתר של הלקוח (${client?.website}).\nלשייך בכל זאת?`
        );
        if (!ok) {
          throw new Error('LINK_CANCELLED');
        }
      }

      // Update only valid SEO reports for the same domain with this client_id
      const { data: reportsForDomain, error: reportError } = await supabase
        .from('ahrefs_reports')
        .select('id, report_data')
        .eq('domain', domain);
      if (reportError) throw reportError;

      const validIds = (reportsForDomain || [])
        .filter((report) => hasValidSeoReportData(report.report_data))
        .map((report) => report.id);

      if (validIds.length > 0) {
        const { error: validUpdateError } = await supabase
          .from('ahrefs_reports')
          .update({ client_id: clientId })
          .in('id', validIds);

        if (validUpdateError) throw validUpdateError;
      }

      // Update client website if not set
      if (client && !client.website) {
        const websiteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
        await supabase
          .from('clients')
          .update({ website: websiteUrl })
          .eq('id', clientId);
      }

      // Auto-create SEO report table per domain+client (not just per client)
      const { data: existingTables } = await supabase
        .from('crm_tables')
        .select('id, integration_settings')
        .eq('client_id', clientId)
        .eq('integration_type', 'ahrefs');

      const domainTableExists = existingTables?.some((t: any) => {
        const settings = t.integration_settings as any;
        return settings?.targetDomain === domain;
      });

      if (!domainTableExists) {
        const clientName = client?.name || clients.find(c => c.id === clientId)?.name || '';
        const tableName = `${clientName} - ${domain}`;
        const slug = `seo-report-${clientId}-${domain.replace(/\./g, '-')}-${Date.now()}`;

        await supabase.functions.invoke('crm-tables', {
          body: {
            name: tableName,
            slug,
            description: `דוח SEO עבור ${domain}`,
            category: 'seo',
            icon: 'TrendingUp',
            agency_id: client?.agency_id || null,
            client_id: clientId,
            integration_type: 'ahrefs',
            integration_settings: {
              data_source: 'ahrefs_reports',
              targetDomain: domain,
              reportType: 'site_explorer',
              clientId,
            },
          }
        });
      }
    },
    onSuccess: () => {
      toast.success('הדוח שויך ללקוח בהצלחה ודוח SEO נוצר אוטומטית');
      queryClient.invalidateQueries({ queryKey: ['ahrefs-reports'] });
      queryClient.invalidateQueries({ queryKey: ['clients-for-ahrefs'] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      setClientSearchOpen(null);
      setClientSearch("");
    },
    onError: () => toast.error('שגיאה בשיוך הדוח'),
  });

  const { data: connectionStatus, isLoading } = useQuery({
    queryKey: ['ahrefs-status'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };

      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!statusResponse.ok) return { connected: false };
      return statusResponse.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=connect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('התחברת בהצלחה ל-Ahrefs');
      queryClient.invalidateQueries({ queryKey: ['ahrefs-status'] });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהתחברות: ${error.message}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast.success('התנתקת מ-Ahrefs');
      queryClient.invalidateQueries({ queryKey: ['ahrefs-status'] });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהתנתקות: ${error.message}`);
    },
  });

  const { data: reports = [], isLoading: reportsLoading } = useAhrefsReports({
    reportType: filterReportType !== "all" ? filterReportType : undefined,
  });

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("כתובת ה-Webhook הועתקה");
  };

  const features = [
    { icon: TrendingUp, title: 'Rank Tracker', description: 'מעקב דירוגים יומי למילות מפתח ספציפיות' },
    { icon: Search, title: 'Site Explorer', description: 'ניתוח תנועה אורגנית ובקלינקים' },
    { icon: BarChart3, title: 'Keywords Explorer', description: 'נפח חיפוש, קושי ורעיונות למילות מפתח' },
    { icon: LinkIcon, title: 'Backlinks', description: 'ניתוח קישורים נכנסים ודומיינים מפנים' },
  ];

  const reportTypes = [...new Set(reports.map((r) => r.report_type))];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ahrefs</h1>
          <p className="text-muted-foreground">חבר את חשבון ה-Ahrefs שלך לקבלת נתוני SEO מתקדמים</p>
        </div>
        <a
          href="https://app.ahrefs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          פתח Ahrefs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                סטטוס חיבור
              </CardTitle>
              <CardDescription>
                {connectionStatus?.connected 
                  ? 'החשבון מחובר ומוכן לשימוש'
                  : 'חבר את חשבון ה-Ahrefs שלך'}
              </CardDescription>
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : connectionStatus?.connected ? (
              <Badge variant="default" className="bg-green-500">
                <Check className="h-3 w-3 ml-1" />
                מחובר
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="h-3 w-3 ml-1" />
                לא מחובר
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {connectionStatus?.connected ? (
            <div className="space-y-4">
              {connectionStatus.integration?.settings?.subscription && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">פרטי מנוי</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">יחידות API נותרו:</span>
                      <span className="mr-2 font-medium">
                        {connectionStatus.integration.settings.subscription.units_left?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">יחידות שימוש:</span>
                      <span className="mr-2 font-medium">
                        {connectionStatus.integration.settings.subscription.units_used?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <Button 
                variant="destructive" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                התנתק מ-Ahrefs
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                מפתח ה-API מוגדר במערכת. לחץ על "התחבר" כדי לבדוק את החיבור ולהפעיל את האינטגרציה.
              </p>
              <Button 
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                התחבר ל-Ahrefs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook לקליטת דוחות
          </CardTitle>
          <CardDescription>
            שלח נתוני SEO מ-Ahrefs או כל מערכת חיצונית ישירות למערכת דרך Webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all" dir="ltr">
              {WEBHOOK_URL}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <h4 className="font-medium">איך להשתמש:</h4>
            <p>שלח בקשת POST עם הכותרת <code className="bg-muted px-1 rounded" dir="ltr">x-api-key</code> ו-body בפורמט JSON:</p>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto" dir="ltr">{`{
  "tenant_id": "your-tenant-id",
  "domain": "example.com",
  "report_type": "organic_keywords",
  "report_data": { ... },
  "client_id": "optional-client-id",
  "agency_id": "optional-agency-id",
  "report_date": "2026-03-27",
  "metadata": { "source": "ahrefs" }
}`}</pre>
            <p className="text-muted-foreground">
              סוגי דוחות נתמכים: organic_keywords, backlinks, referring_domains, site_explorer, domain_rating, keywords_explorer, content_explorer, rank_tracker
            </p>
            <p className="text-muted-foreground">
              ניתן לשלוח מערך של דוחות בבת אחת (batch).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Received Reports Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                דוחות שהתקבלו
              </CardTitle>
              <CardDescription>
                {reports.length} דוחות נקלטו דרך Webhook
              </CardDescription>
            </div>
            <Select value={filterReportType} onValueChange={setFilterReportType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="סוג דוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>עדיין לא התקבלו דוחות</p>
              <p className="text-sm">שלח נתונים לכתובת ה-Webhook למעלה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>דומיין</TableHead>
                  <TableHead>סוג דוח</TableHead>
                  <TableHead>תאריך דוח</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>התקבל</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const linkedClient = clients.find(c => c.id === report.client_id);
                  const filteredClients = clients.filter(c =>
                    c.name.toLowerCase().includes(clientSearch.toLowerCase())
                  );

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {report.domain}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.report_date ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(report.report_date), "dd/MM/yyyy")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Popover 
                          open={clientSearchOpen === report.id} 
                          onOpenChange={(open) => {
                            setClientSearchOpen(open ? report.id : null);
                            if (!open) setClientSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            {linkedClient ? (
                              <Button variant="ghost" size="sm" className="p-1 h-auto">
                                <Badge variant="outline" className="bg-primary/10 cursor-pointer">
                                  {linkedClient.name}
                                </Badge>
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-muted-foreground">
                                <UserPlus className="h-3 w-3 ml-1" />
                                שייך ללקוח
                              </Button>
                            )}
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" align="start">
                            <Input
                              placeholder="חפש לקוח..."
                              value={clientSearch}
                              onChange={(e) => setClientSearch(e.target.value)}
                              className="mb-2"
                              autoFocus
                            />
                            <ScrollArea className="max-h-48">
                              {filteredClients.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-2">לא נמצאו לקוחות</p>
                              ) : (
                                filteredClients.map((client) => (
                                  <button
                                    key={client.id}
                                    className="w-full text-right px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                                    onClick={() => linkClientMutation.mutate({
                                      reportId: report.id,
                                      clientId: client.id,
                                      domain: report.domain,
                                    })}
                                  >
                                    {client.name}
                                    {!client.website && (
                                      <span className="text-xs text-muted-foreground mr-1">(ללא אתר)</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(report.received_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)}>
                          צפה
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>איך להשתמש</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>1. התחבר ל-Ahrefs באמצעות הכפתור למעלה</p>
          <p>2. עבור לדף "טבלאות" וצור טבלה חדשה</p>
          <p>3. בחר "Ahrefs" כמקור נתונים</p>
          <p>4. הזן את הדומיין לניתוח ובחר את סוג הדוח</p>
          <p>5. לחץ על "סנכרן" לשליפת הנתונים</p>
          <p>6. <strong>חדש!</strong> שלח דוחות דרך Webhook לקליטה אוטומטית</p>
        </CardContent>
      </Card>

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedReport?.domain} — {selectedReport && (REPORT_TYPE_LABELS[selectedReport.report_type] || selectedReport.report_type)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {selectedReport && (() => {
              const data = selectedReport.report_data as Record<string, unknown>;
              // Check for HTML in various possible fields
              const htmlContent = typeof data === 'string' ? data 
                : typeof data === 'object' && data !== null ? (
                  typeof data.report_html === 'string' ? data.report_html
                  : typeof data.html === 'string' ? data.html
                  : null
                ) : null;
              
              // Extract summary metrics if available
              const summary = typeof data === 'object' && data !== null && typeof data.summary === 'object' && data.summary !== null
                ? data.summary as Record<string, unknown> : null;
              const projectName = typeof data === 'object' && data !== null ? String(data.project_name || '') : '';

              if (htmlContent || summary) {
                return (
                  <div className="space-y-4">
                    {projectName && (
                      <Badge variant="outline" className="text-sm">
                        פרויקט: {projectName}
                      </Badge>
                    )}
                    
                    {/* Render summary metrics cards */}
                    {summary && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {Object.entries(summary).map(([key, value]) => (
                          <div key={key} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                            <h3 className="text-xs font-medium text-muted-foreground mb-1">
                              {key.replace(/_/g, ' ')}
                            </h3>
                            <div className="text-2xl font-bold text-primary">
                              {String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Render HTML report */}
                    {htmlContent && (
                      <div 
                        className="prose prose-sm max-w-none dark:prose-invert
                          [&_table]:w-full [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden
                          [&_th]:bg-primary [&_th]:text-primary-foreground [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-right [&_th]:text-sm [&_th]:font-medium
                          [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border [&_td]:text-sm
                          [&_tr:hover_td]:bg-muted/50
                          [&_.metrics-grid]:grid [&_.metrics-grid]:grid-cols-2 [&_.metrics-grid]:md:grid-cols-4 [&_.metrics-grid]:gap-3 [&_.metrics-grid]:mb-6
                          [&_.metric-card]:bg-card [&_.metric-card]:border [&_.metric-card]:border-border [&_.metric-card]:rounded-lg [&_.metric-card]:p-4 [&_.metric-card]:shadow-sm
                          [&_.metric-value]:text-2xl [&_.metric-value]:font-bold [&_.metric-value]:text-primary
                          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4
                          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3
                          [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-muted-foreground [&_h3]:mb-1
                          [&_.header]:bg-gradient-to-l [&_.header]:from-primary/80 [&_.header]:to-primary [&_.header]:text-primary-foreground [&_.header]:p-6 [&_.header]:rounded-lg [&_.header]:mb-6
                        "
                        dir="rtl"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                      />
                    )}
                  </div>
                );
              }
              
              // Fallback: render as formatted JSON
              return (
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                  {JSON.stringify(data, null, 2)}
                </pre>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
