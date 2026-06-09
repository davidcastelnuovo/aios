import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CategoryTable {
  id: string;
  name: string;
  integration_type: string | null;
  integration_settings?: any;
  client_id?: string | null;
  tenant_id?: string | null;
}

interface Props {
  category: string;
  tables: CategoryTable[];
}

const FN_BY_TYPE: Record<string, string> = {
  google_analytics: "sync-google-analytics-data",
  facebook_ecommerce: "sync-facebook-ecommerce",
  facebook_insights: "sync-facebook-insights",
  google_ads: "sync-google-ads-data",
  google_search_console: "sync-google-search-console-data",
  ahrefs: "sync-ahrefs-data",
};

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function syncStoredAhrefsReportTable(t: CategoryTable) {
  const settings = t.integration_settings || {};
  const clientId = settings.clientId || settings.client_id || t.client_id;
  if (!clientId || !t.tenant_id) throw new Error("Missing SEO report scope");

  const normalizeDomain = (value?: string) =>
    String(value || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const domain = settings.targetDomain || settings.target || settings.domain;
  const normalizedDomain = normalizeDomain(domain);

  // Look up the most recent ahrefs_project_id for this client+domain so the
  // fetch can pull tracked_keywords from Rank Tracker. Without this, the
  // snapshot is rebuilt without "ביטויים במעקב".
  let projectId: string | number | null = settings.ahrefs_project_id ?? null;
  let usedMode: string | null = settings.ahrefs_mode ?? null;
  let usedProtocol: string | null = settings.ahrefs_protocol ?? null;
  if (!projectId) {
    const { data: lastWithProject } = await supabase
      .from("ahrefs_reports" as any)
      .select("metadata, domain")
      .eq("tenant_id", t.tenant_id)
      .eq("client_id", clientId)
      .not("metadata->ahrefs_project_id", "is", null)
      .order("report_date", { ascending: false })
      .limit(20);
    const rows = (lastWithProject as any[]) || [];
    const match = rows.find((r: any) =>
      !normalizedDomain || normalizeDomain(r.domain) === normalizedDomain
    ) || rows[0];
    const meta = match?.metadata as any;
    if (meta) {
      projectId = meta.ahrefs_project_id ?? null;
      usedMode = usedMode ?? meta.used_mode ?? null;
      usedProtocol = usedProtocol ?? meta.used_protocol ?? null;
    }
  }


  // Step 1: Fetch fresh Ahrefs snapshot from API (persists into ahrefs_reports via webhook)
  const { error: fetchError } = await supabase.functions.invoke("fetch-ahrefs-snapshot", {
    body: {
      clientId,
      domain,
      country: settings.country || "il",
      ...(projectId ? { projectId } : {}),
      ...(usedMode ? { mode: usedMode } : {}),
      ...(usedProtocol ? { protocol: usedProtocol } : {}),
    },
  });
  if (fetchError) throw fetchError;


  // Step 2: Read freshly stored reports and rebuild crm_records
  const { data: reports, error } = await supabase
    .from("ahrefs_reports" as any)
    .select("*")
    .eq("tenant_id", t.tenant_id)
    .eq("client_id", clientId)
    .order("report_date", { ascending: false });

  if (error) throw error;
  if (!reports || reports.length === 0) throw new Error("לא נמצאו דוחות Ahrefs שמורים");

  const target = normalizedDomain;

  const reportsToUse = target
    ? reports.filter((report: any) => normalizeDomain(report.domain) === target)
    : reports;

  const recordsToInsert: any[] = [];
  for (const report of (reportsToUse.length > 0 ? reportsToUse : reports) as any[]) {
    const rd = report.report_data || {};
    const snapshot = rd.snapshot || {};
    const reportDate = report.report_date || report.received_at;
    const allKeywords = [
      ...(Array.isArray(rd.organic_keywords) ? rd.organic_keywords : []),
      ...(Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : []),
    ];

    if (allKeywords.length > 0) {
      for (const kw of allKeywords) {
        recordsToInsert.push({
          table_id: t.id,
          tenant_id: t.tenant_id,
          data: {
            keyword: String(kw.keyword || ""),
            position: kw.position ?? null,
            position_prev_month: kw.position_prev_month ?? null,
            position_change: kw.position_prev_month != null && kw.position != null ? kw.position_prev_month - kw.position : null,
            traffic: kw.traffic ?? 0,
            traffic_prev_month: kw.traffic_prev_month ?? 0,
            volume: kw.volume ?? 0,
            kd: kw.kd ?? null,
            cpc: kw.cpc ?? null,
            url: kw.url ?? "",
            domain: report.domain,
            dr: snapshot.dr,
            report_date: reportDate,
          },
        });
      }
    } else {
      recordsToInsert.push({
        table_id: t.id,
        tenant_id: t.tenant_id,
        data: {
          domain: report.domain,
          dr: snapshot.dr,
          org_traffic: snapshot.org_traffic,
          org_keywords_top3: snapshot.org_keywords_top3,
          org_keywords_top10: snapshot.org_keywords_top10,
          org_keywords_total: snapshot.org_keywords_total,
          referring_domains: snapshot.referring_domains,
          backlinks_live: snapshot.backlinks_live,
          backlinks_all_time: snapshot.backlinks_all_time,
          report_date: reportDate,
        },
      });
    }
  }

  await supabase.from("crm_records" as any).delete().eq("table_id", t.id);
  for (let i = 0; i < recordsToInsert.length; i += 500) {
    const { error: insertError } = await supabase.from("crm_records" as any).insert(recordsToInsert.slice(i, i + 500));
    if (insertError) throw insertError;
  }

  const syncedAt = new Date().toISOString();
  await supabase.functions.invoke("crm-tables", {
    method: "PATCH",
    body: {
      table_id: t.id,
      integration_settings: { ...settings, last_sync_at: syncedAt },
    },
  });
}

async function syncTrackedOnlyForTable(t: CategoryTable) {
  const settings = t.integration_settings || {};
  const clientId = settings.clientId || settings.client_id || t.client_id;
  if (!clientId || !t.tenant_id) throw new Error("Missing SEO report scope");
  const domain = settings.targetDomain || settings.target || settings.domain;

  const { data, error } = await supabase.functions.invoke("fetch-ahrefs-snapshot", {
    body: {
      clientId,
      domain,
      tracked_only: true,
      ...(settings.ahrefs_project_id ? { projectId: settings.ahrefs_project_id } : {}),
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);

  // Persist project id on the table so future syncs (full + tracked) reuse it.
  const persistedProjectId = (data as any)?.projectId;
  if (persistedProjectId && !settings.ahrefs_project_id) {
    await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: {
        table_id: t.id,
        integration_settings: { ...settings, ahrefs_project_id: persistedProjectId },
      },
    });
  }

  // Rebuild crm_records from the (now-merged) report so the table reflects tracked keywords.
  const normalizeDomain = (value?: string) =>
    String(value || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const target = normalizeDomain(domain);
  const { data: reports } = await supabase
    .from("ahrefs_reports" as any)
    .select("*")
    .eq("tenant_id", t.tenant_id)
    .eq("client_id", clientId)
    .order("report_date", { ascending: false });
  const reportsToUse = target
    ? ((reports as any[]) || []).filter((r: any) => normalizeDomain(r.domain) === target)
    : ((reports as any[]) || []);
  const recordsToInsert: any[] = [];
  for (const report of (reportsToUse.length > 0 ? reportsToUse : ((reports as any[]) || []))) {
    const rd = report.report_data || {};
    const snapshot = rd.snapshot || {};
    const reportDate = report.report_date || report.received_at;
    const allKeywords = [
      ...(Array.isArray(rd.organic_keywords) ? rd.organic_keywords : []),
      ...(Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : []),
    ];
    if (allKeywords.length > 0) {
      for (const kw of allKeywords) {
        recordsToInsert.push({
          table_id: t.id,
          tenant_id: t.tenant_id,
          data: {
            keyword: String(kw.keyword || ""),
            position: kw.position ?? null,
            position_prev_month: kw.position_prev_month ?? null,
            position_change: kw.position_prev_month != null && kw.position != null ? kw.position_prev_month - kw.position : null,
            traffic: kw.traffic ?? 0,
            traffic_prev_month: kw.traffic_prev_month ?? 0,
            volume: kw.volume ?? 0,
            kd: kw.kd ?? null,
            cpc: kw.cpc ?? null,
            url: kw.url ?? "",
            domain: report.domain,
            dr: snapshot.dr,
            report_date: reportDate,
          },
        });
      }
    }
  }
  if (recordsToInsert.length > 0) {
    await supabase.from("crm_records" as any).delete().eq("table_id", t.id);
    for (let i = 0; i < recordsToInsert.length; i += 500) {
      const { error: insertError } = await supabase.from("crm_records" as any).insert(recordsToInsert.slice(i, i + 500));
      if (insertError) throw insertError;
    }
  }
  return (data as any)?.tracked_count ?? 0;
}

export function CategorySyncControl({ category, tables }: Props) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTrackedSyncing, setIsTrackedSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const syncableTables = useMemo(
    () => tables.filter((t) => t.integration_type && FN_BY_TYPE[t.integration_type]),
    [tables]
  );

  const ahrefsReportTables = useMemo(
    () => tables.filter((t) => t.integration_type === "ahrefs" && t.integration_settings?.data_source === "ahrefs_reports"),
    [tables]
  );

  // Show the OLDEST sync among syncable tables — reflects the staleness of the
  // category as a whole. A single freshly-synced table shouldn't make everything look fresh.
  const { oldestSyncAt, neverSyncedCount } = useMemo(() => {
    let oldest: Date | null = null;
    let never = 0;
    for (const t of syncableTables) {
      const ts = t.integration_settings?.last_sync_at;
      if (!ts) {
        never++;
        continue;
      }
      const d = new Date(ts);
      if (!oldest || d < oldest) oldest = d;
    }
    return { oldestSyncAt: oldest, neverSyncedCount: never };
  }, [syncableTables]);

  const handleSyncAll = async () => {
    if (syncableTables.length === 0) {
      toast.error("אין דוחות לסנכרון בקטגוריה זו");
      return;
    }
    setIsSyncing(true);
    setProgress({ done: 0, total: syncableTables.length });
    let success = 0;
    let failed = 0;

    await runWithConcurrency(syncableTables, 2, async (t) => {
      const fnName = FN_BY_TYPE[t.integration_type as string];
      try {
        if (t.integration_type === "ahrefs" && t.integration_settings?.data_source === "ahrefs_reports") {
          await syncStoredAhrefsReportTable(t);
          success++;
          return;
        }

        // Build per-integration body. Ahrefs requires a config object with target+dataType.
        const body: Record<string, any> = { tableId: t.id, table_id: t.id };
        if (t.integration_type === "ahrefs") {
          const settings = t.integration_settings || {};
          body.config = {
            target: settings.targetDomain || settings.target || settings.domain,
            dataType: settings.reportType || settings.dataType || "site_explorer",
            country: settings.country,
            limit: settings.limit,
          };
        }
        const { error } = await supabase.functions.invoke(fnName, { body });
        if (error) throw error;
        success++;
      } catch (e: any) {
        console.error(`[CategorySyncControl] sync failed for ${t.name}:`, e);
        failed++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });

    setIsSyncing(false);
    if (failed === 0) {
      toast.success(`סונכרנו ${success} דוחות בהצלחה`);
    } else if (success === 0) {
      toast.error(`הסנכרון נכשל עבור כל ${failed} הדוחות`);
    } else {
      toast.warning(`סונכרנו ${success} דוחות, ${failed} נכשלו`);
    }
    // Refresh tables list so last_sync_at updates
    queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
    queryClient.invalidateQueries({ queryKey: ["dynamic-tables"] });
    queryClient.invalidateQueries({ queryKey: ["ahrefs-reports"] });
    queryClient.invalidateQueries({ queryKey: ["seo-dashboard-reports"] });
  };

  const handleSyncTrackedOnly = async () => {
    if (ahrefsReportTables.length === 0) {
      toast.error("אין דוחות Ahrefs בקטגוריה זו");
      return;
    }
    setIsTrackedSyncing(true);
    setProgress({ done: 0, total: ahrefsReportTables.length });
    let success = 0;
    let failed = 0;
    let totalTracked = 0;

    await runWithConcurrency(ahrefsReportTables, 3, async (t) => {
      try {
        const count = await syncTrackedOnlyForTable(t);
        totalTracked += count;
        success++;
      } catch (e: any) {
        console.error(`[CategorySyncControl] tracked-only sync failed for ${t.name}:`, e);
        failed++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });

    setIsTrackedSyncing(false);
    if (failed === 0) {
      toast.success(`סונכרנו ביטויים במעקב ב-${success} דוחות (${totalTracked} ביטויים סה״כ)`);
    } else if (success === 0) {
      toast.error(`סנכרון ביטויים במעקב נכשל בכל ${failed} הדוחות`);
    } else {
      toast.warning(`סונכרנו ${success} דוחות (${totalTracked} ביטויים), ${failed} נכשלו`);
    }
    queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
    queryClient.invalidateQueries({ queryKey: ["dynamic-tables"] });
    queryClient.invalidateQueries({ queryKey: ["ahrefs-reports"] });
    queryClient.invalidateQueries({ queryKey: ["seo-dashboard-reports"] });
  };

  let lastSyncLabel: string;
  let lastSyncTone = "text-muted-foreground";
  if (syncableTables.length === 0) {
    lastSyncLabel = "אין דוחות לסנכרון";
  } else if (neverSyncedCount > 0) {
    lastSyncLabel = `${neverSyncedCount} דוחות לא סונכרנו מעולם`;
    lastSyncTone = "text-destructive";
  } else if (oldestSyncAt) {
    lastSyncLabel = `הישן ביותר: לפני ${formatDistanceToNow(oldestSyncAt, { locale: he })}`;
  } else {
    lastSyncLabel = "לא סונכרן עדיין";
  }

  const anySyncing = isSyncing || isTrackedSyncing;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-xs ${lastSyncTone}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{lastSyncLabel}</span>
            </div>
          </TooltipTrigger>
          {oldestSyncAt && (
            <TooltipContent>
              הדוח הכי ישן בקטגוריה סונכרן ב-{oldestSyncAt.toLocaleString("he-IL")}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {ahrefsReportTables.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSyncTrackedOnly}
                disabled={anySyncing}
                className="gap-1.5 h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTrackedSyncing ? "animate-spin" : ""}`} />
                {isTrackedSyncing
                  ? `מסנכרן ביטויים במעקב… (${progress.done}/${progress.total})`
                  : `ביטויים במעקב בלבד (${ahrefsReportTables.length})`}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              משיכת ביטויים במעקב בלבד מ-Ahrefs Rank Tracker. לא צורך קרדיטים של Site Explorer.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={handleSyncAll}
        disabled={anySyncing || syncableTables.length === 0}
        className="gap-1.5 h-8"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing
          ? `${category === "seo" ? "מסנכרן Ahrefs…" : "מסנכרן…"} (${progress.done}/${progress.total})`
          : `סנכרן עכשיו${syncableTables.length ? ` (${syncableTables.length})` : ""}`}
      </Button>
    </div>
  );
}
