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
  const { fetchComparisons, comparisonData, isLoading: isEnriching } = useAhrefsEnrichment();
  const [hasAutoEnriched, setHasAutoEnriched] = useState(false);
  const [cachedComparison, setCachedComparison] = useState<{
    threeMonth: Map<string, any>;
    yearly: Map<string, any>;
  } | null>(null);

  // Effective comparison data: API data takes priority, then cached DB data
  const effectiveComparison = useMemo(() => {
    if (comparisonData.threeMonth.size > 0 || comparisonData.yearly.size > 0) {
      return comparisonData;
    }
    if (cachedComparison) {
      return cachedComparison;
    }
    return comparisonData;
  }, [comparisonData, cachedComparison]);

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

  // Find previous month report for keyword comparison
  const selectedIdx = reports.findIndex(r => r.id === selectedReport?.id);
  const prevMonthReport = selectedIdx >= 0 && selectedIdx < reports.length - 1 ? reports[selectedIdx + 1] : null;

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

  const prevMonthMap = useMemo(() => buildPrevMonthMap(prevMonthReport), [prevMonthReport]);

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

  function enrichKeyword(kw: any, effComparison: typeof comparisonData): any {
    const normalized = normalizeKeyword(kw);
    const kwLower = String(normalized.keyword).toLowerCase().trim();
    // Use inline data first, fallback to cross-report comparison
    let prevPos = normalized.position_prev_month ?? prevMonthMap.get(kwLower) ?? null;
    
    // Enrich from comparison data (API or cached)
    const api3m = effComparison.threeMonth.get(kwLower);
    const apiYear = effComparison.yearly.get(kwLower);
    
    // 3-month position comparison
    let pos3m: number | null = null;
    if (api3m?.best_position_prev != null) {
      pos3m = api3m.best_position_prev;
    }
    
    // Yearly position comparison
    let posYear: number | null = null;
    if (apiYear?.best_position_prev != null) {
      posYear = apiYear.best_position_prev;
    }

    // Fill missing prev month from 3m data if needed
    if (prevPos === null && api3m?.best_position_prev != null) {
      prevPos = api3m.best_position_prev;
    }
    
    // Fill volume/kd/cpc from data if missing
    const apiRow = api3m || apiYear;
    if (apiRow) {
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
      position_3month: pos3m,
      position_yearly: posYear,
      gsc_clicks: gscRow?.clicks ?? null,
      gsc_impressions: gscRow?.impressions ?? null,
      gsc_ctr: gscRow?.ctr ?? null,
      gsc_position: gscRow?.position ?? null,
    };
  }

  const organicKeywords = useMemo(() => rawOrganic.map(kw => enrichKeyword(kw, effectiveComparison)), [rawOrganic, prevMonthMap, gscMap, effectiveComparison]);
  const trackedKeywords = useMemo(() => rawTracked.map(kw => enrichKeyword(kw, effectiveComparison)), [rawTracked, prevMonthMap, gscMap, effectiveComparison]);

  const domain = reportData?.domain || selectedReport?.domain;

  // Load cached comparison data from the database on mount (no API call)
  useEffect(() => {
    if (selectedReport && !hasAutoEnriched) {
      const cached = (selectedReport as any).comparison_data;
      if (cached && cached.threeMonth && cached.yearly) {
        const threeMonthMap = new Map<string, any>(Object.entries(cached.threeMonth));
        const yearlyMap = new Map<string, any>(Object.entries(cached.yearly));
        // Set comparison data via the hook's internal setter is not exposed,
        // so we store it locally and merge into enrichKeyword
        setCachedComparison({ threeMonth: threeMonthMap, yearly: yearlyMap });
      }
      setHasAutoEnriched(true);
    }
  }, [selectedReport, hasAutoEnriched]);

  const [cachedComparison, setCachedComparison] = useState<{
    threeMonth: Map<string, any>;
    yearly: Map<string, any>;
  } | null>(null);

  // Effective comparison data: API data takes priority, then cached DB data
  const effectiveComparison = useMemo(() => {
    if (comparisonData.threeMonth.size > 0 || comparisonData.yearly.size > 0) {
      return comparisonData;
    }
    if (cachedComparison) {
      return cachedComparison;
    }
    return comparisonData;
  }, [comparisonData, cachedComparison]);

  const handleManualSync = useCallback(async () => {
    if (!domain) return;
    const reportDate = selectedReport?.report_date || new Date().toISOString().split('T')[0];
    const result = await fetchComparisons(domain, reportDate, 200);
    
    // Save to DB as cache
    if (result && selectedReport?.id) {
      const cachePayload: Record<string, Record<string, any>> = {
        threeMonth: {},
        yearly: {},
      };
      result.threeMonth.forEach((v, k) => { cachePayload.threeMonth[k] = v; });
      result.yearly.forEach((v, k) => { cachePayload.yearly[k] = v; });
      
      await supabase
        .from('ahrefs_reports')
        .update({ comparison_data: cachePayload } as any)
        .eq('id', selectedReport.id);
    }
  }, [domain, selectedReport, fetchComparisons]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isEnriching}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isEnriching ? 'animate-spin' : ''}`} />
            {isEnriching ? 'מסנכרן...' : 'סנכרון Ahrefs'}
          </Button>
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
        show3Month={comparisonData.threeMonth.size > 0}
        showYearly={comparisonData.yearly.size > 0}
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
