import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, FileText, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SeoSnapshotCards } from "./seo/SeoSnapshotCards";
import { MaskyooSiblingCard } from "./MaskyooSiblingCard";
import { SeoKeywordsTable } from "./seo/SeoKeywordsTable";
import { GscIntegration, type GscKeywordData, type GscMultiPeriodData } from "./seo/GscIntegration";
import { useAhrefsEnrichment, type AhrefsKeyword } from "@/hooks/useAhrefsEnrichment";
import { useResolvedGscIntegration } from "@/hooks/useResolvedGscIntegration";
import { AhrefsProjectPicker } from "./AhrefsProjectPicker";
import { ListChecks } from "lucide-react";
import { filterValidSeoReports } from "./seo/reportValidity";
import { computeGaOrganicByMonth } from "./seo/computeGaOrganicByMonth";

interface SeoDashboardViewProps {
  tenantId: string;
  clientId: string;
  /**
   * Optional list of all tenant_ids reachable for this client via shared
   * agencies. When provided, ahrefs_reports are fetched across the full set
   * (matching what SeoReportTabs already resolves for shared-agency clients).
   */
  accessibleTenantIds?: string[];
  /** CRM records from the linked Google Analytics table */
  gaRecords?: any[];
  /** GSC site URL persisted on the SEO crm_table — used as source of truth on first load. */
  initialGscSiteUrl?: string;
  /** Persist callback when GSC site is selected/auto-linked at the report level. */
  onGscSiteSelected?: (siteUrl: string) => void;
  /** Initial language filter for the keywords table, persisted on the SEO crm_table. */
  initialLangFilter?: "all" | "he" | "en";
  /** Persist callback when the language filter changes. */
  onLangFilterChange?: (lang: "all" | "he" | "en") => void;
}

export function SeoDashboardView({ tenantId, clientId, accessibleTenantIds, gaRecords = [], initialGscSiteUrl, onGscSiteSelected, initialLangFilter, onLangFilterChange }: SeoDashboardViewProps) {
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isFetchingSnapshot, setIsFetchingSnapshot] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFetchSnapshot = useCallback(async () => {
    setIsFetchingSnapshot(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ahrefs-snapshot', {
        body: { clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('הדוח נטען בהצלחה מ-Ahrefs');
      await queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports'] });
    } catch (err: any) {
      console.error('fetch-ahrefs-snapshot failed:', err);
      toast.error(err?.message || 'שליפת הדוח נכשלה. ודא שהוגדר דומיין ושיש מפתח Ahrefs.');
    } finally {
      setIsFetchingSnapshot(false);
    }
  }, [clientId, tenantId, queryClient]);
  const [gscData, setGscData] = useState<GscKeywordData[]>([]);
  const [gscMultiPeriod, setGscMultiPeriod] = useState<GscMultiPeriodData | null>(null);
  const { comparisonData, resetComparisonData } = useAhrefsEnrichment();
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

  const handleGscMultiPeriodLoaded = useCallback((data: GscMultiPeriodData) => {
    setGscMultiPeriod(data);
    // Also keep gscData in sync with the "current" period so existing aggregations keep working
    setGscData(data.current);
  }, []);

  // Build tenant scope: prefer the explicit shared-agency list when provided,
  // else fall back to the single tenant prop. Without scoping by client_id we
  // would cross-contaminate, so client_id is always the strongest filter and
  // tenant filtering is supplementary (mostly so RLS errors stay clear).
  const reportTenants =
    Array.isArray(accessibleTenantIds) && accessibleTenantIds.length > 0
      ? Array.from(new Set(accessibleTenantIds.filter(Boolean)))
      : tenantId
        ? [tenantId]
        : [];

  const { data: reports = [], isLoading, error: reportsError } = useQuery({
    queryKey: ['seo-dashboard-reports', reportTenants.slice().sort().join(','), clientId],
    queryFn: async () => {
      let q = supabase
        .from('ahrefs_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('received_at', { ascending: false })
        .order('report_date', { ascending: false });
      if (reportTenants.length === 1) q = q.eq('tenant_id', reportTenants[0]);
      else if (reportTenants.length > 1) q = q.in('tenant_id', reportTenants);
      const { data, error } = await q;
      if (error) {
        console.error('[SeoDashboardView] ahrefs_reports fetch failed:', error, { clientId, reportTenants });
        throw error;
      }
      return data || [];
    },
    enabled: !!clientId,
  });

  const validReports = useMemo(() => filterValidSeoReports(reports), [reports]);

  // Resolve a tenant-wide GSC integration as a fallback when the current
  // user has no personal/shared one — OR when their personal one isn't
  // mapped/usable for this client/site. Mirrors public-link parity so internal
  // viewers see Search Console keywords automatically without a manual sync.
  const firstReportDomain = useMemo(() => {
    const r = (Array.isArray(reports) ? reports : []).find((x: any) => x?.domain);
    return r?.domain as string | undefined;
  }, [reports]);

  const resolvedGsc = useResolvedGscIntegration({
    clientId,
    tenantIds: reportTenants,
    savedSiteUrl: initialGscSiteUrl,
    expectedDomain: firstReportDomain,
  });

  // Selected report (default to the most-recently-synced valid report)
  const latestReport = useMemo(() => {
    if (validReports.length === 0) return null;
    return [...validReports].sort((a: any, b: any) => {
      const aT = new Date(a.received_at || a.report_date || 0).getTime();
      const bT = new Date(b.received_at || b.report_date || 0).getTime();
      return bT - aT;
    })[0];
  }, [validReports]);

  const selectedReport = useMemo(() => {
    if (selectedReportId) {
      return validReports.find(r => r.id === selectedReportId) || latestReport;
    }
    return latestReport;
  }, [validReports, selectedReportId, latestReport]);

  // Reset manual selection when client changes so a freshly-synced client always lands on the newest report.
  useEffect(() => {
    setSelectedReportId(null);
  }, [clientId]);

  const reportData = selectedReport?.report_data as any;

  const snapshot = reportData?.snapshot || {};
  const snapshotPrevMonth = reportData?.snapshot_prev_month || reportData?.snapshot_prev || {};
  const snapshotCampaignStart = reportData?.snapshot_campaign_start || {};
  const campaignStartDate = reportData?.campaign_start_date || snapshotCampaignStart?.date;
  const trafficHistory = Array.isArray(reportData?.traffic_history) ? reportData.traffic_history : [];

  // Monthly NON-PAID sessions for the chart — derived via the shared helper so
  // the public SharedTable produces identical numbers from the same gaRecords.
  const gaOrganicByMonth = useMemo(() => computeGaOrganicByMonth(gaRecords), [gaRecords]);

  // Snapshot organic sessions — from channel_group 'Organic Search' filtered to current month
  const gaOrganicCurrentMonth = useMemo(() => {
    if (!gaRecords || gaRecords.length === 0) return null;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const channelOrganic = gaRecords
      .filter(r => r.data?.report_type === 'channel_group')
      .filter(r => {
        const cg = String(r.data?.channel_group || '').toLowerCase();
        return cg === 'organic search' || cg.includes('organic search');
      })
      .filter(r => {
        // If record has date, filter to current month; otherwise include (legacy)
        const d = r.data?.date;
        if (!d) return true;
        return String(d).startsWith(currentMonth);
      })
      .reduce((sum, r) => sum + (Number(r.data?.users) || Number(r.data?.sessions) || 0), 0);
    if (channelOrganic > 0) return channelOrganic;
    // Fallback: sum from monthly chart data
    if (gaOrganicByMonth.length === 0) return null;
    return gaOrganicByMonth[gaOrganicByMonth.length - 1]?.sessions ?? null;
  }, [gaRecords, gaOrganicByMonth]);

  // Previous month organic from channel_group records with date filtering
  const gaOrganicPrevMonth = useMemo(() => {
    if (!gaRecords || gaRecords.length === 0) {
      if (gaOrganicByMonth.length < 2) return null;
      return gaOrganicByMonth[gaOrganicByMonth.length - 2]?.sessions ?? null;
    }
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevOrganic = gaRecords
      .filter(r => r.data?.report_type === 'channel_group')
      .filter(r => {
        const cg = String(r.data?.channel_group || '').toLowerCase();
        return cg === 'organic search' || cg.includes('organic search');
      })
      .filter(r => {
        const d = r.data?.date;
        if (!d) return false; // skip dateless for prev period
        return String(d).startsWith(prevMonth);
      })
      .reduce((sum, r) => sum + (Number(r.data?.users) || Number(r.data?.sessions) || 0), 0);
    if (prevOrganic > 0) return prevOrganic;
    if (gaOrganicByMonth.length < 2) return null;
    return gaOrganicByMonth[gaOrganicByMonth.length - 2]?.sessions ?? null;
  }, [gaRecords, gaOrganicByMonth]);

  // Find previous month report for keyword comparison
  const selectedIdx = validReports.findIndex(r => r.id === selectedReport?.id);
  const prevMonthReport = selectedIdx >= 0 && selectedIdx < validReports.length - 1 ? validReports[selectedIdx + 1] : null;

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

  // Build GSC lookup map (current period — used for clicks/impressions/CTR enrichment)
  const gscMap = useMemo(() => {
    const map = new Map<string, GscKeywordData>();
    for (const row of gscData) {
      if (!row.keyword) continue;
      map.set(row.keyword.toLowerCase().trim(), row);
    }
    return map;
  }, [gscData]);

  // GSC historical period maps (for cross-period position comparisons)
  function buildGscMap(rows: GscKeywordData[]): Map<string, GscKeywordData> {
    const map = new Map<string, GscKeywordData>();
    for (const row of rows || []) {
      if (!row?.keyword) continue;
      map.set(row.keyword.toLowerCase().trim(), row);
    }
    return map;
  }
  const gscPrevMonthMap = useMemo(() => buildGscMap(gscMultiPeriod?.prevMonth || []), [gscMultiPeriod]);
  const gscThreeMonthMap = useMemo(() => buildGscMap(gscMultiPeriod?.threeMonth || []), [gscMultiPeriod]);
  const gscYearlyMap = useMemo(() => buildGscMap(gscMultiPeriod?.yearly || []), [gscMultiPeriod]);
  const hasGscHistory = gscPrevMonthMap.size > 0 || gscThreeMonthMap.size > 0 || gscYearlyMap.size > 0;

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

    // GSC historical fallback: when Ahrefs lacks comparison data, use GSC average position per period
    let positionSource: 'ahrefs' | 'gsc' | undefined =
      (prevPos != null || pos3m != null || posYear != null) ? 'ahrefs' : undefined;
    if (prevPos == null) {
      const gscPrev = gscPrevMonthMap.get(kwLower)?.position;
      if (gscPrev != null) { prevPos = gscPrev; positionSource = positionSource ?? 'gsc'; }
    }
    if (pos3m == null) {
      const gsc3 = gscThreeMonthMap.get(kwLower)?.position;
      if (gsc3 != null) { pos3m = gsc3; positionSource = positionSource ?? 'gsc'; }
    }
    if (posYear == null) {
      const gscY = gscYearlyMap.get(kwLower)?.position;
      if (gscY != null) { posYear = gscY; positionSource = positionSource ?? 'gsc'; }
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
    
    // Merge GSC supplementary data (clicks, impressions, CTR, avg position).
    // Ahrefs remains the PRIMARY position source so the SEO report stays consistent
    // with the historical dashboard. GSC data is shown alongside, not as a replacement.
    const gscRow = gscMap.get(kwLower);
    const gscPos = gscRow?.position ?? null;
    const ahrefsPos = normalized.position;

    return {
      ...normalized,
      position: ahrefsPos,
      ahrefs_position: ahrefsPos,
      position_prev_month: prevPos,
      position_3month: pos3m,
      position_yearly: posYear,
      _position_source: positionSource,
      gsc_clicks: gscRow?.clicks ?? null,
      gsc_impressions: gscRow?.impressions ?? null,
      gsc_ctr: gscRow?.ctr ?? null,
      gsc_position: gscPos,
    };
  }

  const organicKeywords = useMemo(() => {
    const enriched = rawOrganic.map(kw => enrichKeyword(kw, effectiveComparison));
    // Add keywords from Ahrefs comparison API that don't exist in webhook data
    const existingNames = new Set<string>();
    for (const kw of rawOrganic) existingNames.add(String(kw.keyword || '').toLowerCase().trim());
    for (const kw of rawTracked) existingNames.add(String(kw.keyword || '').toLowerCase().trim());
    
    // Merge from both 3-month and yearly comparison maps
    const comparisonOnly = new Map<string, AhrefsKeyword>();
    for (const [name, kw] of effectiveComparison.threeMonth) {
      if (!existingNames.has(name)) comparisonOnly.set(name, kw);
    }
    for (const [name, kw] of effectiveComparison.yearly) {
      if (!existingNames.has(name) && !comparisonOnly.has(name)) comparisonOnly.set(name, kw);
    }
    
    for (const [, kw] of comparisonOnly) {
      enriched.push(enrichKeyword({
        keyword: kw.keyword,
        position: kw.best_position,
        traffic: kw.sum_traffic,
        volume: kw.volume,
        kd: kw.keyword_difficulty,
        cpc: kw.cpc,
        url: kw.best_position_url,
      }, effectiveComparison));
    }
    return enriched;
  }, [rawOrganic, rawTracked, prevMonthMap, gscMap, gscPrevMonthMap, gscThreeMonthMap, gscYearlyMap, effectiveComparison]);
  const trackedKeywords = useMemo(() => rawTracked.map(kw => enrichKeyword(kw, effectiveComparison)), [rawTracked, prevMonthMap, gscMap, gscPrevMonthMap, gscThreeMonthMap, gscYearlyMap, effectiveComparison]);

  // Build GSC-only keywords: keywords in GSC that don't exist in Ahrefs data
  const gscOnlyKeywords = useMemo(() => {
    if (gscData.length === 0) return [];
    const ahrefsNames = new Set<string>();
    for (const kw of organicKeywords) {
      ahrefsNames.add(String(kw.keyword || '').toLowerCase().trim());
    }
    for (const kw of trackedKeywords) {
      ahrefsNames.add(String(kw.keyword || '').toLowerCase().trim());
    }
    return gscData
      .filter(g => g.keyword && !ahrefsNames.has(g.keyword.toLowerCase().trim()))
      .map(g => {
        const k = g.keyword.toLowerCase().trim();
        const prev = gscPrevMonthMap.get(k)?.position ?? null;
        const m3 = gscThreeMonthMap.get(k)?.position ?? null;
        const y1 = gscYearlyMap.get(k)?.position ?? null;
        return {
          keyword: g.keyword,
          position: g.position ?? null,
          traffic: null,
          volume: null,
          kd: null,
          cpc: null,
          url: null,
          position_prev_month: prev,
          position_3month: m3,
          position_yearly: y1,
          gsc_clicks: g.clicks ?? null,
          gsc_impressions: g.impressions ?? null,
          gsc_ctr: g.ctr ?? null,
          gsc_position: g.position ?? null,
          _position_source: (prev != null || m3 != null || y1 != null) ? 'gsc' as const : undefined,
          _source: 'gsc' as const,
        };
      });
  }, [gscData, organicKeywords, trackedKeywords, gscPrevMonthMap, gscThreeMonthMap, gscYearlyMap]);

  const domain = reportData?.domain || selectedReport?.domain;

  // Load cached comparison data from the DB only — never auto-fetch (saves API credits)
  useEffect(() => {
    // Reset live comparison data when switching reports to avoid stale cross-client data
    resetComparisonData?.();
    setCachedComparison(null);

    if (!selectedReport) return;
    const cached = (selectedReport as any).comparison_data;
    if (cached && cached.threeMonth && cached.yearly) {
      const threeMonthMap = new Map<string, any>(Object.entries(cached.threeMonth));
      const yearlyMap = new Map<string, any>(Object.entries(cached.yearly));
      setCachedComparison({ threeMonth: threeMonthMap, yearly: yearlyMap });
    }
  }, [selectedReport?.id]);


  const handleManualSync = useCallback(async () => {
    const projectId = (selectedReport as any)?.metadata?.ahrefs_project_id;
    if (!projectId) {
      toast.info('כדי למשוך ביטויים במעקב צריך לבחור פרויקט מ-Ahrefs');
      setPickerOpen(true);
      return;
    }
    setIsFetchingSnapshot(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ahrefs-snapshot', {
        body: { clientId, domain, projectId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`הדוח סונכרן (${(data as any)?.keywords_count ?? 0} אורגניים, ${(data as any)?.tracked_count ?? 0} במעקב)`);
      await queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports'] });
    } catch (err: any) {
      console.error('fetch-ahrefs-snapshot failed:', err);
      toast.error(err?.message || 'סנכרון Ahrefs נכשל');
    } finally {
      setIsFetchingSnapshot(false);
    }
  }, [clientId, domain, selectedReport, queryClient]);

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

  if (reportsError) {
    return (
      <Card className="p-8 text-center" dir="rtl">
        <FileText className="h-12 w-12 mx-auto text-destructive mb-3" />
        <h3 className="font-semibold text-lg mb-1">שגיאה בטעינת דוחות SEO</h3>
        <p className="text-muted-foreground text-sm mb-2">לא ניתן לטעון את הדוחות. ייתכן שיש בעיית הרשאה או חיבור.</p>
        <p className="text-xs text-muted-foreground mb-4">{(reportsError as any)?.message || String(reportsError)}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports'] })}>נסה שוב</Button>
      </Card>
    );
  }

  if (validReports.length === 0) {
    return (
      <>
        <Card className="p-8 text-center" dir="rtl">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">אין דוחות SEO</h3>
          <p className="text-muted-foreground text-sm mb-4">
            לא נמצאו דוחות עבור לקוח זה. ניתן לבחור פרויקט קיים מ-Ahrefs או לסנכרן לפי הדומיין של הלקוח.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button onClick={() => setPickerOpen(true)} variant="default" className="gap-2">
              <ListChecks className="h-4 w-4" />
              בחר פרויקט מ-Ahrefs
            </Button>
            <Button onClick={handleFetchSnapshot} disabled={isFetchingSnapshot} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetchingSnapshot ? 'animate-spin' : ''}`} />
              {isFetchingSnapshot ? 'מסנכרן...' : 'סנכרן לפי דומיין הלקוח'}
            </Button>
          </div>
        </Card>
        <AhrefsProjectPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          clientId={clientId}
          onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports', tenantId, clientId] })}
        />
      </>
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
            disabled={isFetchingSnapshot}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingSnapshot ? 'animate-spin' : ''}`} />
            {isFetchingSnapshot ? 'מסנכרן...' : 'סנכרון Ahrefs'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <ListChecks className="h-3.5 w-3.5" />
            בחר פרויקט מ-Ahrefs
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {(() => {
             const uniqueDomains = new Set(validReports.map(r => r.domain));
            const showDomain = uniqueDomains.size > 1;
             if (validReports.length <= 1) {
              return selectedReport ? (
                <Badge variant="outline" className="gap-1.5 font-normal">
                  <Globe className="h-3 w-3" />
                  {selectedReport.domain}
                </Badge>
              ) : null;
            }
            return (
              <Select
                value={selectedReport?.id || ''}
                onValueChange={(val) => setSelectedReportId(val)}
              >
                <SelectTrigger className={`${showDomain ? 'w-[300px]' : 'w-[200px]'} h-8 text-xs`}>
                  <SelectValue placeholder="בחר דוח" />
                </SelectTrigger>
                <SelectContent>
                  {validReports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        {showDomain && (
                          <>
                            <Globe className="h-3 w-3" />
                            <span className="font-medium">{r.domain}</span>
                            <span className="text-muted-foreground">·</span>
                          </>
                        )}
                        <Calendar className="h-3 w-3" />
                        {r.report_date
                          ? format(new Date(r.report_date), 'dd MMMM yyyy', { locale: he })
                          : format(new Date(r.received_at), 'dd MMMM yyyy', { locale: he })
                        }
                        {r.received_at && (
                          <span className="text-[10px] text-muted-foreground">
                            (סונכרן {format(new Date(r.received_at), 'dd/MM')})
                          </span>
                        )}
                        {latestReport?.id === r.id && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">אחרון</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
          {campaignStartDate && (
            <Badge variant="secondary">
              תחילת קידום: {format(new Date(campaignStartDate), 'dd/MM/yyyy')}
            </Badge>
          )}
          <Badge variant="secondary">{validReports.length} דוחות</Badge>
        </div>
      </div>

      {/* Snapshot Metrics with Comparisons */}
      <SeoSnapshotCards
        snapshot={snapshot}
        prevMonth={snapshotPrevMonth}
        campaignStart={snapshotCampaignStart}
        gaOrganicSessions={gaOrganicCurrentMonth}
        gaOrganicSessionsPrev={gaOrganicPrevMonth}
      />

      {/* Maskyoo calls (replaces removed Ahrefs traffic chart per request) */}
      <MaskyooSiblingCard
        table={{
          id: selectedReport?.id || "",
          tenant_id: tenantId,
          client_id: clientId,
          integration_type: "ahrefs",
          integration_settings: {},
        }}
      />

      {/* Google Search Console Integration — enriches keyword rows silently, no raw table shown here */}
      <GscIntegration
        tenantId={tenantId}
        tenantIds={accessibleTenantIds}
        clientId={clientId}
        domain={reportData?.domain || selectedReport?.domain}
        keywords={[]}
        onDataLoaded={handleGscDataLoaded}
        onMultiPeriodLoaded={handleGscMultiPeriodLoaded}
        initialSiteUrl={initialGscSiteUrl}
        onSiteSelected={onGscSiteSelected}
        resolvedFallback={resolvedGsc}
        hideTable
      />

      {/* Keywords — unified view with tabs */}
      <SeoKeywordsTable
        keywords={organicKeywords}
        trackedKeywords={trackedKeywords}
        gscOnlyKeywords={gscOnlyKeywords}
        hasGscData={gscData.length > 0}
        show3Month={effectiveComparison.threeMonth.size > 0 || gscThreeMonthMap.size > 0}
        showYearly={effectiveComparison.yearly.size > 0 || gscYearlyMap.size > 0}
        initialLangFilter={initialLangFilter}
        onLangFilterChange={onLangFilterChange}
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

      <AhrefsProjectPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clientId={clientId}
        onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports', tenantId, clientId] })}
      />
    </div>
  );
}
