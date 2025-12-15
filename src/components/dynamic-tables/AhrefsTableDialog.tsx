import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, TrendingUp, ExternalLink, Link, Globe } from "lucide-react";

interface AhrefsTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AhrefsTableDialog({ open, onOpenChange }: AhrefsTableDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, currentTenantId: activeTenantId } = useTenant();
  
  const [mode, setMode] = useState<"domain" | "report">("domain");
  const [tableName, setTableName] = useState("");
  const [category, setCategory] = useState("seo");
  const [targetDomain, setTargetDomain] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportType, setReportType] = useState("domain_rating");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch Ahrefs integration
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ['ahrefs-integration', activeTenantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .eq('integration_type', 'ahrefs')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      return data;
    },
    enabled: open && !!activeTenantId,
  });

  // Fetch agencies
  const { data: agencies } = useQuery({
    queryKey: ['agencies-for-table', activeTenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', activeTenantId)
        .order('name');
      return data || [];
    },
    enabled: open && !!activeTenantId,
  });

  // Fetch clients based on selected agency
  const { data: clients } = useQuery({
    queryKey: ['clients-for-table', selectedAgency],
    queryFn: async () => {
      if (!selectedAgency) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', selectedAgency)
        .order('name');
      return data || [];
    },
    enabled: !!selectedAgency,
  });

  const parseReportUrl = (url: string) => {
    // Parse Ahrefs report URL to extract report type and target
    // Example: https://app.ahrefs.com/site-explorer/organic-keywords/v2/subdomains/live?select=...&target=example.com
    try {
      const urlObj = new URL(url);
      const target = urlObj.searchParams.get('target') || '';
      const path = urlObj.pathname;
      
      let detectedType = 'custom_report';
      if (path.includes('organic-keywords')) detectedType = 'organic_keywords';
      else if (path.includes('backlinks')) detectedType = 'backlinks';
      else if (path.includes('referring-domains')) detectedType = 'referring_domains';
      else if (path.includes('domain-rating')) detectedType = 'domain_rating';
      else if (path.includes('site-explorer')) detectedType = 'site_explorer';
      
      return { target, reportType: detectedType };
    } catch {
      return { target: '', reportType: 'custom_report' };
    }
  };

  const handleCreate = async () => {
    const isReportMode = mode === "report";
    
    if (!tableName.trim() || !integration) {
      toast({ title: "נא למלא את כל השדות הנדרשים", variant: "destructive" });
      return;
    }
    
    if (isReportMode && !reportUrl) {
      toast({ title: "נא להזין כתובת דוח Ahrefs", variant: "destructive" });
      return;
    }
    
    if (!isReportMode && !targetDomain) {
      toast({ title: "נא להזין דומיין לניתוח", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const slug = tableName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const parsedReport = isReportMode ? parseReportUrl(reportUrl) : null;
      const finalTarget = isReportMode ? (parsedReport?.target || reportUrl) : targetDomain;
      const finalReportType = isReportMode ? (parsedReport?.reportType || 'custom_report') : reportType;

      const { data, error } = await supabase.functions.invoke('crm-tables', {
        body: {
          action: 'create',
          tenantId: activeTenantId,
          name: tableName,
          slug: `ahrefs-${slug}-${Date.now()}`,
          description: isReportMode ? `Ahrefs Report - ${finalTarget}` : `Ahrefs - ${targetDomain}`,
          category,
          icon: 'TrendingUp',
          agencyId: selectedAgency || null,
          clientId: selectedClient || null,
          integration_type: 'ahrefs',
          integration_settings: {
            integrationId: integration.id,
            targetDomain: finalTarget,
            reportType: finalReportType,
            reportUrl: isReportMode ? reportUrl : null,
            isExistingReport: isReportMode,
          },
          integrations: [{
            type: 'ahrefs',
            integrationId: integration.id,
            targetDomain: finalTarget,
            reportType: finalReportType,
            reportUrl: isReportMode ? reportUrl : null,
            isExistingReport: isReportMode,
          }]
        }
      });

      if (error) throw error;

      toast({ title: "טבלת Ahrefs נוצרה בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "שגיאה ביצירת הטבלה", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setMode("domain");
    setTableName("");
    setCategory("seo");
    setTargetDomain("");
    setReportUrl("");
    setReportType("domain_rating");
    setSelectedAgency("");
    setSelectedClient("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            טבלת Ahrefs חדשה
          </DialogTitle>
          <DialogDescription>
            התחבר לדוח קיים או צור ניתוח חדש מ-Ahrefs
          </DialogDescription>
        </DialogHeader>

        {integrationLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !integration ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">
              לא נמצא חיבור Ahrefs פעיל
            </p>
            <Button variant="outline" asChild>
              <a href={`/t/${currentTenant?.slug}/ahrefs-settings`}>
                <ExternalLink className="h-4 w-4 ml-2" />
                חבר Ahrefs
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "domain" | "report")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="domain" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  דומיין חדש
                </TabsTrigger>
                <TabsTrigger value="report" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  דוח קיים
                </TabsTrigger>
              </TabsList>

              <TabsContent value="domain" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>שם הטבלה *</Label>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="לדוגמה: ניתוח SEO - אתר ראשי"
                  />
                </div>

                <div className="space-y-2">
                  <Label>דומיין לניתוח *</Label>
                  <Input
                    value={targetDomain}
                    onChange={(e) => setTargetDomain(e.target.value)}
                    placeholder="example.com"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label>סוג דוח</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain_rating">Domain Rating</SelectItem>
                      <SelectItem value="backlinks">Backlinks</SelectItem>
                      <SelectItem value="organic_keywords">Organic Keywords</SelectItem>
                      <SelectItem value="referring_domains">Referring Domains</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="report" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>שם הטבלה *</Label>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="לדוגמה: דוח בקלינקים - אתר ראשי"
                  />
                </div>

                <div className="space-y-2">
                  <Label>כתובת הדוח ב-Ahrefs *</Label>
                  <Input
                    value={reportUrl}
                    onChange={(e) => setReportUrl(e.target.value)}
                    placeholder="https://app.ahrefs.com/site-explorer/..."
                    dir="ltr"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    העתק את כתובת הדוח מהדפדפן כאשר אתה צופה בו ב-Ahrefs
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seo">SEO</SelectItem>
                  <SelectItem value="analytics">אנליטיקס</SelectItem>
                  <SelectItem value="reports">דוחות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סוכנות (אופציונלי)</Label>
              <Select value={selectedAgency || "all"} onValueChange={(v) => { setSelectedAgency(v === "all" ? "" : v); setSelectedClient(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAgency && (
              <div className="space-y-2">
                <Label>לקוח (אופציונלי)</Label>
                <Select value={selectedClient || "all"} onValueChange={(v) => setSelectedClient(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="כל הלקוחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הלקוחות</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                צור טבלה
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
