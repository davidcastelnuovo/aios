import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, FileText, Calendar, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SeoSnapshotCards } from "./seo/SeoSnapshotCards";
import { SeoTrafficChart } from "./seo/SeoTrafficChart";
import { SeoKeywordsTable } from "./seo/SeoKeywordsTable";
import { SeoTrackedKeywords } from "./seo/SeoTrackedKeywords";

interface SeoDashboardViewProps {
  tenantId: string;
  clientId: string;
}

export function SeoDashboardView({ tenantId, clientId }: SeoDashboardViewProps) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['seo-dashboard-reports', tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahrefs_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!clientId,
  });

  const latestReport = reports[0];
  const reportData = latestReport?.report_data as any;

  const snapshot = reportData?.snapshot || {};
  const snapshotPrevMonth = reportData?.snapshot_prev_month || {};
  const snapshotCampaignStart = reportData?.snapshot_campaign_start || {};
  const campaignStartDate = reportData?.campaign_start_date;
  const trafficHistory = Array.isArray(reportData?.traffic_history) ? reportData.traffic_history : [];
  const organicKeywords = Array.isArray(reportData?.organic_keywords) ? reportData.organic_keywords : [];
  const trackedKeywords = Array.isArray(reportData?.tracked_keywords) ? reportData.tracked_keywords : [];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" dir="rtl">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-16 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="p-8 text-center" dir="rtl">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg mb-1">אין דוחות SEO</h3>
        <p className="text-muted-foreground text-sm">
          לא נמצאו דוחות עבור לקוח זה. ודא שהאינטגרציה מחוברת ושולחת נתונים.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
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
          {campaignStartDate && (
            <Badge variant="secondary">
              תחילת קמפיין: {format(new Date(campaignStartDate), 'dd/MM/yyyy')}
            </Badge>
          )}
          <Badge variant="secondary">{reports.length} דוחות</Badge>
        </div>
      </div>

      {/* Snapshot Metrics with Comparisons */}
      <SeoSnapshotCards
        snapshot={snapshot}
        prevMonth={snapshotPrevMonth}
        campaignStart={snapshotCampaignStart}
      />

      {/* Traffic History Chart */}
      <SeoTrafficChart trafficHistory={trafficHistory} />

      {/* Tracked Keywords */}
      {trackedKeywords.length > 0 && (
        <SeoTrackedKeywords keywords={trackedKeywords} />
      )}

      {/* Organic Keywords Table */}
      {organicKeywords.length > 0 && (
        <SeoKeywordsTable keywords={organicKeywords} />
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
    </div>
  );
}
