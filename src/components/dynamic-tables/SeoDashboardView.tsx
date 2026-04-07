import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SeoSnapshotCards } from "./seo/SeoSnapshotCards";
import { SeoTrafficChart } from "./seo/SeoTrafficChart";
import { SeoKeywordsTable } from "./seo/SeoKeywordsTable";

interface SeoDashboardViewProps {
  tenantId: string;
  clientId: string;
}

export function SeoDashboardView({ tenantId, clientId }: SeoDashboardViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['seo-dashboard-reports', tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahrefs_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('report_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!clientId,
  });

  // Selected report (default to latest)
  const selectedReport = useMemo(() => {
    if (selectedReportId) {
      return reports.find(r => r.id === selectedReportId) || reports[0];
    }
    return reports[0];
  }, [reports, selectedReportId]);

  const reportData = selectedReport?.report_data as any;

  const snapshot = reportData?.snapshot || {};
  const snapshotPrevMonth = reportData?.snapshot_prev_month || reportData?.snapshot_prev || {};
  const snapshotCampaignStart = reportData?.snapshot_campaign_start || {};
  const campaignStartDate = reportData?.campaign_start_date || snapshotCampaignStart?.date;
  const trafficHistory = Array.isArray(reportData?.traffic_history) ? reportData.traffic_history : [];

  // Find previous month report and campaign start report for keyword comparison
  const selectedIdx = reports.findIndex(r => r.id === selectedReport?.id);
  const prevMonthReport = selectedIdx >= 0 && selectedIdx < reports.length - 1 ? reports[selectedIdx + 1] : null;
  const campaignStartReport = reports.length > 0 ? reports[reports.length - 1] : null;

  // Normalize keyword fields from various source formats
  function normalizeKeyword(kw: any): any {
    return {
      keyword: kw.keyword || '',
      position: kw.position ?? kw.best_position ?? null,
      traffic: kw.traffic ?? kw.sum_traffic ?? 0,
      volume: kw.volume ?? kw.search_volume ?? null,
      kd: kw.kd ?? kw.keyword_difficulty ?? null,
      cpc: kw.cpc ?? kw.cost_per_click ?? null,
      url: kw.url ?? kw.best_position_url ?? '',
      // Preserve inline comparison fields if they exist in the raw data
      position_prev_month: kw.position_prev_month ?? null,
      position_campaign_start: kw.position_campaign_start ?? null,
      traffic_prev_month: kw.traffic_prev_month ?? null,
      traffic_campaign_start: kw.traffic_campaign_start ?? null,
    };
  }

  // Build lookup map for prev month positions
  function buildPrevMonthMap(report: any): Map<string, number | null> {
    const rd = report?.report_data as any;
    if (!rd) return new Map();
    const map = new Map<string, number | null>();
    const organic = Array.isArray(rd.organic_keywords) ? rd.organic_keywords : [];
    const tracked = Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : [];
    for (const kw of [...tracked, ...organic]) {
      const name = String(kw.keyword || '').toLowerCase();
      if (!map.has(name)) {
        map.set(name, kw.position ?? kw.best_position ?? null);
      }
    }
    return map;
  }

  // Build lookup map for campaign start positions
  // If the oldest report has inline position_campaign_start, use that (actual campaign start data)
  // Otherwise fall back to the report's own position
  function buildCampaignStartMap(report: any): Map<string, number | null> {
    const rd = report?.report_data as any;
    if (!rd) return new Map();
    const map = new Map<string, number | null>();
    const organic = Array.isArray(rd.organic_keywords) ? rd.organic_keywords : [];
    const tracked = Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : [];
    for (const kw of [...tracked, ...organic]) {
      const name = String(kw.keyword || '').toLowerCase();
      if (!map.has(name)) {
        // Prefer the campaign_start position if available (carries historical data from source)
        const campPos = kw.position_campaign_start ?? null;
        const currentPos = kw.position ?? kw.best_position ?? null;
        map.set(name, campPos ?? currentPos);
      }
    }
    return map;
  }

  const prevMonthMap = useMemo(() => buildPrevMonthMap(prevMonthReport), [prevMonthReport]);
  const campaignStartMap = useMemo(() => buildCampaignStartMap(campaignStartReport), [campaignStartReport]);

  // Normalize and enrich keywords with comparison data
  const rawOrganic = Array.isArray(reportData?.organic_keywords) ? reportData.organic_keywords : [];
  const rawTracked = Array.isArray(reportData?.tracked_keywords) ? reportData.tracked_keywords : [];

  function enrichKeyword(kw: any): any {
    const normalized = normalizeKeyword(kw);
    const kwLower = String(normalized.keyword).toLowerCase();
    // Use inline data first, fallback to cross-report comparison
    const prevPos = normalized.position_prev_month ?? prevMonthMap.get(kwLower) ?? null;
    const campPos = normalized.position_campaign_start ?? campaignStartMap.get(kwLower) ?? null;
    return {
      ...normalized,
      position_prev_month: prevPos,
      position_campaign_start: campPos,
    };
  }

  const organicKeywords = useMemo(() => rawOrganic.map(enrichKeyword), [rawOrganic, prevMonthMap, campaignStartMap]);
  const trackedKeywords = useMemo(() => rawTracked.map(enrichKeyword), [rawTracked, prevMonthMap, campaignStartMap]);

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
          <span className="font-semibold text-lg">{reportData?.domain || selectedReport?.domain}</span>
          {reportData?.project_name && (
            <Badge variant="outline">{reportData.project_name}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {reports.length > 1 && (
            <Select
              value={selectedReport?.id || ''}
              onValueChange={(val) => setSelectedReportId(val)}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="בחר תאריך דוח" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {r.report_date 
                        ? format(new Date(r.report_date), 'dd MMMM yyyy', { locale: he })
                        : format(new Date(r.received_at), 'dd MMMM yyyy', { locale: he })
                      }
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {campaignStartDate && (
            <Badge variant="secondary">
              תחילת קידום: {format(new Date(campaignStartDate), 'dd/MM/yyyy')}
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

      {/* Keywords — unified view with tabs */}
      <SeoKeywordsTable
        keywords={organicKeywords}
        trackedKeywords={trackedKeywords}
      />

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
