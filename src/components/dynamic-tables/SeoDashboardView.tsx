import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, FileText, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SeoSnapshotCards } from "./seo/SeoSnapshotCards";
import { SeoTrafficChart } from "./seo/SeoTrafficChart";
import { SeoKeywordsTable } from "./seo/SeoKeywordsTable";
import { GscIntegration, type GscKeywordData } from "./seo/GscIntegration";
import { useAhrefsEnrichment } from "@/hooks/useAhrefsEnrichment";

interface SeoDashboardViewProps {
  tenantId: string;
  clientId: string;
}

export function SeoDashboardView({ tenantId, clientId }: SeoDashboardViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [gscData, setGscData] = useState<GscKeywordData[]>([]);
  const { fetchKeywords, enrichedData: ahrefsApiData, isLoading: isEnriching } = useAhrefsEnrichment();
  const [hasAutoEnriched, setHasAutoEnriched] = useState(false);

  const handleGscDataLoaded = useCallback((data: GscKeywordData[]) => {
    setGscData(data);
  }, []);

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

  // Build GSC lookup map
  const gscMap = useMemo(() => {
    const map = new Map<string, GscKeywordData>();
    for (const row of gscData) {
      map.set(row.keyword.toLowerCase().trim(), row);
    }
    return map;
  }, [gscData]);

  function enrichKeyword(kw: any): any {
    const normalized = normalizeKeyword(kw);
    const kwLower = String(normalized.keyword).toLowerCase().trim();
    // Use inline data first, fallback to cross-report comparison
    let prevPos = normalized.position_prev_month ?? prevMonthMap.get(kwLower) ?? null;
    let campPos = normalized.position_campaign_start ?? campaignStartMap.get(kwLower) ?? null;
    
    // Enrich from Ahrefs API data if available
    const apiRow = ahrefsApiData.get(kwLower);
    if (apiRow) {
      // If we have API comparison data, use it to fill missing prev month
      if (prevPos === null && apiRow.best_position_prev != null && normalized.position != null) {
        prevPos = apiRow.best_position_prev;
      }
      // Fill volume/traffic from API if missing
      if (normalized.volume == null && apiRow.volume != null) {
        normalized.volume = apiRow.volume;
      }
      if (normalized.kd == null && apiRow.keyword_difficulty != null) {
        normalized.kd = apiRow.keyword_difficulty;
      }
      if (normalized.cpc == null && apiRow.cpc != null) {
        normalized.cpc = apiRow.cpc;
      }
    }
    
    // Merge GSC data (clicks, impressions, CTR)
    const gscRow = gscMap.get(kwLower);
    return {
      ...normalized,
      position_prev_month: prevPos,
      position_campaign_start: campPos,
      gsc_clicks: gscRow?.clicks ?? null,
      gsc_impressions: gscRow?.impressions ?? null,
      gsc_ctr: gscRow?.ctr ?? null,
      gsc_position: gscRow?.position ?? null,
    };
  }

  const organicKeywords = useMemo(() => rawOrganic.map(enrichKeyword), [rawOrganic, prevMonthMap, campaignStartMap, gscMap, ahrefsApiData]);
  const trackedKeywords = useMemo(() => rawTracked.map(enrichKeyword), [rawTracked, prevMonthMap, campaignStartMap, gscMap, ahrefsApiData]);

  // Auto-enrich: fetch comparison data from Ahrefs API when keywords lack it
  const domain = reportData?.domain || selectedReport?.domain;
  const needsEnrichment = useMemo(() => {
    const allKw = [...rawOrganic, ...rawTracked];
    if (allKw.length === 0) return false;
    // Check if most keywords lack prev month data
    const withPrev = allKw.filter(kw => 
      (kw.position_prev_month != null) || (kw.best_position_prev != null)
    );
    return withPrev.length < allKw.length * 0.3;
  }, [rawOrganic, rawTracked]);

  useEffect(() => {
    if (domain && needsEnrichment && !hasAutoEnriched && !isEnriching && reports.length > 0) {
      setHasAutoEnriched(true);
      const reportDate = selectedReport?.report_date || new Date().toISOString().split('T')[0];
      // Compare with 3 months back
      const compDate = (() => {
        const d = new Date(reportDate);
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
      })();
      fetchKeywords(domain, reportDate, compDate, 200);
    }
  }, [domain, needsEnrichment, hasAutoEnriched, isEnriching, reports.length, selectedReport, fetchKeywords]);

  const handleManualSync = useCallback(() => {
    if (!domain) return;
    setHasAutoEnriched(true);
    const reportDate = selectedReport?.report_date || new Date().toISOString().split('T')[0];
    const compDate = (() => {
      const d = new Date(reportDate);
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split('T')[0];
    })();
    fetchKeywords(domain, reportDate, compDate, 200);
  }, [domain, selectedReport, fetchKeywords]);

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

      {/* Google Search Console Integration */}
      <GscIntegration
        tenantId={tenantId}
        clientId={clientId}
        domain={reportData?.domain || selectedReport?.domain}
        keywords={[...organicKeywords, ...trackedKeywords].map((k: any) => k.keyword).filter(Boolean)}
        onDataLoaded={handleGscDataLoaded}
      />

      {/* Keywords — unified view with tabs */}
      <SeoKeywordsTable
        keywords={organicKeywords}
        trackedKeywords={trackedKeywords}
        hasGscData={gscData.length > 0}
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
