import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { SeoSnapshotCards } from "./seo/SeoSnapshotCards";
import { SeoTrafficChart } from "./seo/SeoTrafficChart";
import { SeoKeywordsTable } from "./seo/SeoKeywordsTable";
import { filterValidSeoReports } from "./seo/reportValidity";

interface PublicGscKeyword {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PublicSeoViewProps {
  tableName: string;
  reports: any[];
  /** Optional GSC data aggregated per keyword — enables enrichment + GSC-only rows. */
  gscData?: PublicGscKeyword[];
  /** Optional GA monthly non-paid sessions — replaces the Ahrefs traffic chart with real Analytics data. */
  gaOrganicByMonth?: { month: string; sessions: number }[];
  /** Initial language filter persisted on the SEO crm_table — read-only in public view. */
  initialLangFilter?: "all" | "he" | "en";
}

function normalizeKeyword(kw: any) {
  return {
    keyword: kw.keyword || "",
    position: kw.position ?? kw.best_position ?? null,
    traffic: kw.traffic ?? kw.sum_traffic ?? 0,
    volume: kw.volume ?? kw.search_volume ?? null,
    kd: kw.kd ?? kw.keyword_difficulty ?? null,
    cpc: kw.cpc ?? kw.cost_per_click ?? null,
    url: kw.url ?? kw.best_position_url ?? "",
    position_prev_month: kw.position_prev_month ?? null,
    position_campaign_start: kw.position_campaign_start ?? null,
    traffic_prev_month: kw.traffic_prev_month ?? null,
    traffic_campaign_start: kw.traffic_campaign_start ?? null,
  };
}

export function PublicSeoView({ tableName, reports, gscData = [], initialLangFilter }: PublicSeoViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const validReports = useMemo(() => filterValidSeoReports(reports), [reports]);

  const selectedReport = useMemo(() => {
    if (selectedReportId) return validReports.find((r) => r.id === selectedReportId) || validReports[0];
    return validReports[0];
  }, [validReports, selectedReportId]);

  const reportData = (selectedReport?.report_data as any) || {};
  const snapshot = reportData?.snapshot || {};
  const snapshotPrevMonth = reportData?.snapshot_prev_month || reportData?.snapshot_prev || {};
  const snapshotCampaignStart = reportData?.snapshot_campaign_start || {};
  const campaignStartDate = reportData?.campaign_start_date || snapshotCampaignStart?.date;
  const trafficHistory = Array.isArray(reportData?.traffic_history) ? reportData.traffic_history : [];

  // Comparison cache (3-month / yearly)
  const comparison = useMemo(() => {
    const cached = (selectedReport as any)?.comparison_data;
    const threeMonth = new Map<string, any>();
    const yearly = new Map<string, any>();
    if (cached?.threeMonth) {
      for (const [k, v] of Object.entries(cached.threeMonth)) threeMonth.set(k, v as any);
    }
    if (cached?.yearly) {
      for (const [k, v] of Object.entries(cached.yearly)) yearly.set(k, v as any);
    }
    return { threeMonth, yearly };
  }, [selectedReport?.id]);

  // Previous month report for prev-month positions fallback
  const prevMonthMap = useMemo(() => {
    const idx = validReports.findIndex((r) => r.id === selectedReport?.id);
    const prev = idx >= 0 && idx < validReports.length - 1 ? validReports[idx + 1] : null;
    const map = new Map<string, number | null>();
    if (!prev) return map;
    const rd = (prev.report_data as any) || {};
    const all = [
      ...(Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : []),
      ...(Array.isArray(rd.organic_keywords) ? rd.organic_keywords : []),
    ];
    for (const kw of all) {
      const name = String(kw.keyword || "").toLowerCase();
      if (!map.has(name)) map.set(name, kw.position ?? kw.best_position ?? null);
    }
    return map;
  }, [validReports, selectedReport?.id]);

  // Map GSC keywords (already aggregated by SharedTable) for fast lookup.
  const gscMap = useMemo(() => {
    const m = new Map<string, PublicGscKeyword>();
    for (const g of gscData) {
      const name = String(g.keyword || "").toLowerCase().trim();
      if (name) m.set(name, g);
    }
    return m;
  }, [gscData]);

  function enrich(kw: any) {
    const n = normalizeKeyword(kw);
    const lower = String(n.keyword).toLowerCase().trim();
    const api3 = comparison.threeMonth.get(lower);
    const apiY = comparison.yearly.get(lower);
    const gscRow = gscMap.get(lower);

    let prevPos = n.position_prev_month ?? prevMonthMap.get(lower) ?? null;
    if (prevPos == null && api3?.best_position_prev != null) prevPos = api3.best_position_prev;

    if (n.volume == null && (api3 || apiY)?.volume != null) n.volume = (api3 || apiY).volume;
    if (n.kd == null && (api3 || apiY)?.keyword_difficulty != null) n.kd = (api3 || apiY).keyword_difficulty;
    if (n.cpc == null && (api3 || apiY)?.cpc != null) n.cpc = (api3 || apiY).cpc;

    return {
      ...n,
      position_prev_month: prevPos,
      position_3month: api3?.best_position_prev ?? null,
      position_yearly: apiY?.best_position_prev ?? null,
      gsc_clicks: gscRow?.clicks ?? null,
      gsc_impressions: gscRow?.impressions ?? null,
      gsc_ctr: gscRow?.ctr ?? null,
      gsc_position: gscRow?.position ?? null,
    };
  }

  const rawOrganic = Array.isArray(reportData?.organic_keywords) ? reportData.organic_keywords : [];
  const rawTracked = Array.isArray(reportData?.tracked_keywords) ? reportData.tracked_keywords : [];

  const organicKeywords = useMemo(() => {
    const enriched = rawOrganic.map(enrich);
    const existing = new Set<string>();
    for (const kw of rawOrganic) existing.add(String(kw.keyword || "").toLowerCase().trim());
    for (const kw of rawTracked) existing.add(String(kw.keyword || "").toLowerCase().trim());

    const extra = new Map<string, any>();
    for (const [name, kw] of comparison.threeMonth) {
      if (!existing.has(name)) extra.set(name, kw);
    }
    for (const [name, kw] of comparison.yearly) {
      if (!existing.has(name) && !extra.has(name)) extra.set(name, kw);
    }
    for (const [, kw] of extra) {
      enriched.push(
        enrich({
          keyword: kw.keyword,
          position: kw.best_position,
          traffic: kw.sum_traffic,
          volume: kw.volume,
          kd: kw.keyword_difficulty,
          cpc: kw.cpc,
          url: kw.best_position_url,
        }),
      );
    }
    return enriched;
  }, [rawOrganic, rawTracked, comparison, prevMonthMap, gscMap]);

  const trackedKeywords = useMemo(() => rawTracked.map(enrich), [rawTracked, comparison, prevMonthMap, gscMap]);

  // GSC-only keywords: appear in GSC but not in Ahrefs organic/tracked.
  const gscOnlyKeywords = useMemo(() => {
    if (gscData.length === 0) return [];
    const ahrefsNames = new Set<string>();
    for (const kw of rawOrganic) ahrefsNames.add(String(kw.keyword || "").toLowerCase().trim());
    for (const kw of rawTracked) ahrefsNames.add(String(kw.keyword || "").toLowerCase().trim());
    return gscData
      .filter((g) => {
        const name = String(g.keyword || "").toLowerCase().trim();
        return name && !ahrefsNames.has(name);
      })
      .map((g) => ({
        keyword: g.keyword,
        position: null,
        traffic: 0,
        volume: null,
        kd: null,
        cpc: null,
        url: "",
        position_prev_month: null,
        position_3month: null,
        position_yearly: null,
        gsc_clicks: g.clicks,
        gsc_impressions: g.impressions,
        gsc_ctr: g.ctr,
        gsc_position: g.position,
      }));
  }, [gscData, rawOrganic, rawTracked]);

  if (!validReports || validReports.length === 0) {
    return (
      <Card className="p-8 text-center" dir="rtl">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg mb-1">אין דוחות SEO</h3>
        <p className="text-muted-foreground text-sm">לא נמצאו דוחות לטבלה זו.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">
            {reportData?.domain || selectedReport?.domain || tableName}
          </span>
          {reportData?.project_name && <Badge variant="outline">{reportData.project_name}</Badge>}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
           {validReports.length > 1 && (
            <Select
              value={selectedReport?.id || ""}
              onValueChange={(val) => setSelectedReportId(val)}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="בחר תאריך דוח" />
              </SelectTrigger>
              <SelectContent>
                 {validReports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {r.report_date
                        ? format(new Date(r.report_date), "dd MMMM yyyy", { locale: he })
                        : format(new Date(r.received_at), "dd MMMM yyyy", { locale: he })}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {campaignStartDate && (
            <Badge variant="secondary">
              תחילת קידום: {format(new Date(campaignStartDate), "dd/MM/yyyy")}
            </Badge>
          )}
           <Badge variant="secondary">{validReports.length} דוחות</Badge>
        </div>
      </div>

      <SeoSnapshotCards
        snapshot={snapshot}
        prevMonth={snapshotPrevMonth}
        campaignStart={snapshotCampaignStart}
      />

      <SeoTrafficChart trafficHistory={trafficHistory} />

      <SeoKeywordsTable
        keywords={organicKeywords}
        trackedKeywords={trackedKeywords}
        gscOnlyKeywords={gscOnlyKeywords}
        hasGscData={gscData.length > 0}
        show3Month={comparison.threeMonth.size > 0}
        showYearly={comparison.yearly.size > 0}
        initialLangFilter={initialLangFilter}
      />

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
