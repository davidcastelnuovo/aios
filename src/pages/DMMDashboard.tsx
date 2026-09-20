/**
 * דשבורד בדיקת דופק — שכבה 1: נתוני קמפיין גולמיים מ-Meta/Google, מקובצים לפי לקוח
 * וסוג קמפיין (לידים / אינגייג׳מנט / איקומרס) ללא רמזור או ניתוח.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { fetchActiveCampaigners } from "@/lib/taskCampaigners";
import { isSeoTaggedClient } from "@/lib/seoClients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, Facebook, Filter, LayoutGrid, Link2, RefreshCw, Search } from "lucide-react";
import { isFacebookIntegration, type AgencyPlatformFilter } from "@/lib/agencyCampaignData";
import { PulseClientRawCard } from "@/components/pulse/PulseClientRawCard";
import { CarmenLoadingScreen } from "@/components/shared/CarmenLoadingScreen";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  PulseClientCallDialog,
  type PulseClientCallTarget,
} from "@/components/clients/PulseClientCallDialog";
import {
  buildPulseDashboardUrl,
  clientHasCampaignCoverage,
  collectCampaignBreakdownFromSnapshots,
  fetchPulseCampaignDeliveryHints,
  pulseMetaTablesNeedingDeliveryHints,
  rehydrateCampaignBreakdownRows,
  applyClientCallToPulseSnapshot,
  filterPulseCampaignRowsWithSpend,
  fetchPulseCampaignRecords,
  getPulsePeriodBounds,
  jerusalemYmd,
  PULSE_PERIOD_OPTIONS,
  type PulseCampaignTable,
  type PulsePeriod,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";
import {
  buildPulseCampaignRows,
  pulseTrendWindows,
  type PulseCampaignGoal,
  type PulseCampaignGoalRow,
} from "@/lib/pulseCampaignGoals";

export type CampaignPulseDashboardProps = {
  /** When embedded from agency dashboard — lock to one agency and hide picker */
  fixedAgencyId?: string | null;
  showTitle?: boolean;
};

export function CampaignPulseDashboard({
  fixedAgencyId = null,
  showTitle = true,
}: CampaignPulseDashboardProps = {}) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath, tenantSlug } = useTenantPath();
  const { selectedAgency, setSelectedAgency } = useAgency();
  const { isOwner, isTeamManager, isSuperAdmin, isCampaigner, isSeo, campaignerId } = useUserRole();
  const { userAgencyIds } = useUserAgencies();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState<"all" | "ppc_google" | "ppc_meta" | "seo" | "campaign">("campaign");
  const [filterCampaigner, setFilterCampaigner] = useState("all");
  const [platformFilter, setPlatformFilter] = useState<AgencyPlatformFilter>("all");
  const [period, setPeriod] = useState<PulsePeriod>("last_7_days");
  const [callLogTarget, setCallLogTarget] = useState<PulseClientCallTarget | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const periodBounds = useMemo(() => getPulsePeriodBounds(period), [period]);
  const campaignTrendBounds = useMemo(() => pulseTrendWindows(jerusalemYmd()), []);
  const effectiveAgencyId = fixedAgencyId || (selectedAgency !== "all" ? selectedAgency : null);

  useEffect(() => {
    if (fixedAgencyId && fixedAgencyId !== selectedAgency) {
      setSelectedAgency(fixedAgencyId);
    }
  }, [fixedAgencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync agency from shareable URL (?agency=...) — standalone pulse dashboard only
  useEffect(() => {
    if (fixedAgencyId) return;
    const agencyFromUrl = searchParams.get("agency");
    if (agencyFromUrl && agencyFromUrl !== selectedAgency) {
      setSelectedAgency(agencyFromUrl);
    }
  }, [searchParams, fixedAgencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fixedAgencyId) return;
    const current = searchParams.get("agency");
    if (selectedAgency && selectedAgency !== "all") {
      if (current !== selectedAgency) {
        const next = new URLSearchParams(searchParams);
        next.set("agency", selectedAgency);
        setSearchParams(next, { replace: true });
      }
    } else if (current) {
      const next = new URLSearchParams(searchParams);
      next.delete("agency");
      setSearchParams(next, { replace: true });
    }
  }, [selectedAgency, fixedAgencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openClientCard(clientId: string) {
    navigate(buildPath(`/clients?clientId=${clientId}&tab=updates`));
  }

  async function copyShareLink() {
    if (!tenantSlug) {
      toast.error("לא נמצא slug של הטננט");
      return;
    }
    const url = buildPulseDashboardUrl(
      window.location.origin,
      tenantSlug,
      effectiveAgencyId,
    );
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        effectiveAgencyId ? "קישור הסוכנות הועתק" : "קישור הדשבורד הועתק",
      );
    } catch {
      toast.error("לא ניתן להעתיק קישור");
    }
  }

  const { data: crossTenantAgencyIds = [] } = useQuery({
    queryKey: ["cross-tenant-agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId);
      if (error) return [];
      return data?.map((d) => d.agency_id) ?? [];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: rawClients = [], isLoading: clientsLoading, refetch: refetchClients } = useQuery({
    queryKey: ["pulse-dash-clients", tenantId, selectedAgency, userAgencyIds, crossTenantAgencyIds, isSeo],
    queryFn: async () => {
      if (!tenantId) return [];
      const allAccessibleAgencyIds = [...(userAgencyIds ?? []), ...crossTenantAgencyIds];
      let query = supabase
        .from("clients")
        .select(`
          id, name, status, agency_id, is_seo_client, services,
          agencies ( name ),
          client_team (
            campaigner_id,
            campaigners ( full_name )
          )
        `)
        .in("status", ["active", "onboarding"])
        .order("name");

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      } else if (isOwner || isSuperAdmin || isSeo) {
        if (crossTenantAgencyIds.length > 0) {
          query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`);
        } else {
          query = query.eq("tenant_id", tenantId);
        }
      } else if (allAccessibleAgencyIds.length > 0) {
        query = query.in("agency_id", allAccessibleAgencyIds);
      } else {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const needsCampaignerFilter = isCampaigner && !isSeo && !isOwner && !isTeamManager && !isSuperAdmin;
  const showCampaignerPicker = !needsCampaignerFilter;

  const { data: campaigners = [] } = useQuery({
    queryKey: ["pulse-dash-campaigners", tenantId, crossTenantAgencyIds.join(",")],
    queryFn: () => fetchActiveCampaigners(tenantId!, crossTenantAgencyIds),
    enabled: !!tenantId && showCampaignerPicker,
    staleTime: 60_000,
  });
  const filteredByRole = useMemo(() => {
    if (isSeo && !isOwner && !isTeamManager && !isSuperAdmin) {
      return rawClients.filter((c: any) => isSeoTaggedClient(c));
    }
    let clients = rawClients;
    if (needsCampaignerFilter) {
      if (!campaignerId) return [];
      clients = clients.filter((c: any) =>
        c.client_team?.some((ct: any) => ct.campaigner_id === campaignerId),
      );
    } else if (showCampaignerPicker && filterCampaigner !== "all") {
      clients = clients.filter((c: any) =>
        c.client_team?.some((ct: any) => ct.campaigner_id === filterCampaigner),
      );
    }
    return clients;
  }, [rawClients, isSeo, isOwner, isTeamManager, isSuperAdmin, needsCampaignerFilter, campaignerId, showCampaignerPicker, filterCampaigner]);

  const clientIds = filteredByRole.map((c: any) => c.id);

  const {
    data: pulseRows = [],
    isLoading: pulseSnapshotsLoading,
    isFetching: pulseSnapshotsFetching,
    refetch: refetchPulse,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["pulse-dash-snapshots", tenantId, clientIds.join(","), selectedAgency],
    queryFn: async () => {
      if (!tenantId || !clientIds.length) return [] as PulseSnapshotRow[];
      const baseColumns =
        "client_id, agency_id, status, campaign_goal_mode, is_ecommerce, spend_7d, lead_spend_7d, ecommerce_spend_7d, leads_7d, cpl_7d, cpl_change_pct, purchases_7d, revenue_7d, roas_7d, roas_change_pct, lead_goal_status, ecommerce_goal_status, campaign_breakdown, flags, data_fresh_through, calculated_at, last_meta_change_at, last_meta_change_type, last_meta_change_actor, last_meta_change_object, meta_change_availability";
      const legacyBaseColumns = baseColumns.replace(", campaign_breakdown", "");
      const load = (columns: string) =>
        (supabase as any)
          .from("campaign_pulse_snapshots")
          .select(columns)
          .in("client_id", clientIds);
      let { data, error } = await load(`${baseColumns}, last_client_call_at, last_client_call_by`);
      if (error && /last_client_call|campaign_breakdown/.test(error.message ?? "")) {
        ({ data, error } = await load(legacyBaseColumns));
      }
      if (error) throw error;
      return (data ?? []) as PulseSnapshotRow[];
    },
    enabled: !!tenantId && clientIds.length > 0,
    staleTime: 30_000,
  });

  const { data: pulseCampaignTables = [] } = useQuery({
    queryKey: ["pulse-dash-tables", tenantId, clientIds.join(",")],
    queryFn: async () => {
      if (!tenantId || !clientIds.length) return [] as PulseCampaignTable[];
      const { data: tables, error } = await supabase
        .from("crm_tables")
        .select("id, client_id, integration_type, category, campaign_active, last_sync_at, integration_settings")
        .in("client_id", clientIds)
        .in("integration_type", ["facebook_insights", "facebook_ecommerce", "google_ads"]);
      if (error) throw error;
      // Keep both Meta sources here. The campaign classifier deduplicates the
      // same campaign/day after choosing the richer objective/outcome record.
      return (tables ?? []) as PulseCampaignTable[];
    },
    enabled: !!tenantId && clientIds.length > 0,
    staleTime: 60_000,
  });

  const pulseTableIds = useMemo(
    () => pulseCampaignTables.map((table) => table.id),
    [pulseCampaignTables],
  );

  const snapshotCampaignRows = useMemo(
    () => collectCampaignBreakdownFromSnapshots(pulseRows),
    [pulseRows],
  );

  const deliveryHintStart = useMemo(
    () => jerusalemYmd(new Date(Date.now() - 7 * 86_400_000)),
    [],
  );

  const metaHintTableIds = useMemo(() => {
    const primed = rehydrateCampaignBreakdownRows(snapshotCampaignRows, pulseCampaignTables, []);
    return pulseMetaTablesNeedingDeliveryHints(primed, pulseCampaignTables);
  }, [snapshotCampaignRows, pulseCampaignTables]);

  const metaTableIdSet = useMemo(
    () =>
      new Set(
        pulseCampaignTables
          .filter(
            (table) =>
              table.integration_type === "facebook_insights"
              || table.integration_type === "facebook_ecommerce",
          )
          .map((table) => table.id),
      ),
    [pulseCampaignTables],
  );

  const {
    data: deliveryHints = [],
    isFetching: deliveryHintsFetching,
  } = useQuery({
    queryKey: ["pulse-dash-delivery-hints", metaHintTableIds.join(","), deliveryHintStart],
    queryFn: () => fetchPulseCampaignDeliveryHints(metaHintTableIds, deliveryHintStart),
    enabled: metaHintTableIds.length > 0,
    staleTime: 120_000,
  });

  const {
    data: pulseCampaignRecords = [],
    isFetching: pulseRecordsFetching,
    refetch: refetchPulseRecords,
  } = useQuery({
    queryKey: [
      "pulse-dash-records",
      pulseTableIds.join(","),
      campaignTrendBounds.queryStart,
      campaignTrendBounds.queryEnd,
    ],
    queryFn: () => fetchPulseCampaignRecords(pulseTableIds, {
      ...periodBounds,
      prevStartDate: campaignTrendBounds.queryStart,
      endDate: campaignTrendBounds.queryEnd,
    }),
    enabled: pulseTableIds.length > 0,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const campaignData = useMemo(() => {
    const tableToType = new Map(pulseCampaignTables.map((t) => [t.id, t.integration_type as string | null]));
    const tableToClient = new Map(pulseCampaignTables.map((t) => [t.id, t.client_id as string]));
    return {
      tables: pulseCampaignTables,
      records: pulseCampaignRecords,
      tableToType,
      tableToClient,
    };
  }, [pulseCampaignTables, pulseCampaignRecords]);

  const campaignGoalRows = useMemo(() => {
    if (pulseCampaignRecords.length > 0) {
      return buildPulseCampaignRows({
        records: pulseCampaignRecords,
        tables: pulseCampaignTables,
        nowYmd: jerusalemYmd(),
      });
    }
    return rehydrateCampaignBreakdownRows(
      snapshotCampaignRows,
      pulseCampaignTables,
      deliveryHints,
    );
  }, [
    snapshotCampaignRows,
    pulseCampaignTables,
    deliveryHints,
    pulseCampaignRecords,
  ]);

  const pulseInitialLoading =
    clientsLoading
    || (pulseSnapshotsLoading && clientIds.length > 0)
    || (pulseSnapshotsFetching && pulseRows.length === 0 && clientIds.length > 0);

  const pulseRefining =
    deliveryHintsFetching
    || (pulseRecordsFetching && pulseTableIds.length > 0);

  const refetchCampaignData = () => {
    refetchPulseTables();
    refetchPulseRecords();
  };

  const tablesByClient = useMemo(() => {
    const map = new Map<string, PulseCampaignTable[]>();
    for (const table of campaignData?.tables ?? []) {
      const list = map.get(table.client_id) || [];
      list.push(table);
      map.set(table.client_id, list);
    }
    return map;
  }, [campaignData?.tables]);

  const pulseByClient = useMemo(() => {
    const map = new Map<string, PulseSnapshotRow>();
    for (const row of pulseRows) {
      const prev = map.get(row.client_id);
      if (!prev || String(row.calculated_at || "") > String(prev.calculated_at || "")) {
        map.set(row.client_id, row);
      }
    }
    return map;
  }, [pulseRows]);

  const clientMetaById = useMemo(() => {
    const map = new Map<string, { name: string; campaignerName: string; agencyName: string; services: string[] }>();
    for (const c of filteredByRole as Array<{
      id: string;
      name: string;
      services?: string[];
      client_team?: Array<{ campaigners?: { full_name?: string } }>;
      agencies?: { name?: string };
    }>) {
      const services: string[] = Array.isArray(c.services) ? [...c.services] : [];
      map.set(c.id, {
        name: c.name,
        campaignerName: c.client_team?.[0]?.campaigners?.full_name ?? "—",
        agencyName: c.agencies?.name ?? "—",
        services,
      });
    }
    return map;
  }, [filteredByRole]);

  const spendingCampaignRows = useMemo(
    () => filterPulseCampaignRowsWithSpend(campaignGoalRows),
    [campaignGoalRows],
  );

  const visibleCampaignRows = useMemo(() => {
    return spendingCampaignRows.filter((row) => {
      const meta = clientMetaById.get(row.client_id);
      if (!meta) return false;
      if (search && !meta.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (platformFilter === "facebook" && row.platform !== "meta") return false;
      if (platformFilter === "google_ads" && row.platform !== "google") return false;
      if (filterService === "campaign") {
        const clientTables = tablesByClient.get(row.client_id) ?? [];
        if (!clientHasCampaignCoverage(meta.services, clientTables)) return false;
      }
      if (filterService === "ppc_meta" && row.platform !== "meta") return false;
      if (filterService === "ppc_google" && row.platform !== "google") return false;
      if (
        filterService !== "all"
        && filterService !== "campaign"
        && filterService !== "ppc_meta"
        && filterService !== "ppc_google"
        && !meta.services.includes(filterService)
      ) {
        return false;
      }
      return true;
    });
  }, [
    spendingCampaignRows,
    clientMetaById,
    search,
    platformFilter,
    filterService,
    tablesByClient,
  ]);

  const clientRawViews = useMemo(() => {
    const byClient = new Map<string, PulseCampaignGoalRow[]>();
    for (const row of visibleCampaignRows) {
      const list = byClient.get(row.client_id) ?? [];
      list.push(row);
      byClient.set(row.client_id, list);
    }

    return filteredByRole
      .filter((client: { id: string; name: string; services?: string[] }) => {
        if (!byClient.has(client.id)) return false;
        if (search && !client.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .map((client: { id: string }) => {
        const rowsForClient = byClient.get(client.id) ?? [];
        const campaignsByGoal: Partial<Record<PulseCampaignGoal, PulseCampaignGoalRow[]>> = {};
        for (const row of rowsForClient) {
          const bucket = campaignsByGoal[row.goal] ?? [];
          bucket.push(row);
          campaignsByGoal[row.goal] = bucket;
        }
        const lastCampaignTouchAt = rowsForClient
          .map((row) => row.last_change_at)
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null;
        const meta = clientMetaById.get(client.id)!;
        return {
          clientId: client.id,
          meta,
          campaignsByGoal,
          lastCampaignTouchAt,
          pulse: pulseByClient.get(client.id) ?? null,
        };
      })
      .sort((a, b) => a.meta.name.localeCompare(b.meta.name, "he"));
  }, [visibleCampaignRows, filteredByRole, search, clientMetaById, pulseByClient]);

  const unclassifiedCampaignRows = useMemo(
    () => visibleCampaignRows.filter((row) => row.goal === "unknown"),
    [visibleCampaignRows],
  );

  const availablePlatforms = useMemo(() => {
    const types = new Set((campaignData?.tables ?? []).map((table) => table.integration_type));
    return {
      hasFacebook: Array.from(types).some((type) => isFacebookIntegration(type)),
      hasGoogleAds: types.has("google_ads"),
    };
  }, [campaignData?.tables]);

  const listSummary = useMemo(() => ({
    clientCount: clientRawViews.length,
    campaignCount: visibleCampaignRows.length,
    unclassifiedCount: unclassifiedCampaignRows.length,
  }), [clientRawViews.length, visibleCampaignRows.length, unclassifiedCampaignRows.length]);

  const freshness = useMemo(() => {
    const times = pulseRows.map((r) => r.calculated_at).filter(Boolean) as string[];
    if (!times.length) return null;
    const latest = times.sort().reverse()[0];
    return new Date(latest).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [pulseRows]);

  const mobileActiveFilterCount = useMemo(() => {
    let count = 0;
    if (period !== "last_7_days") count += 1;
    if (filterService !== "campaign") count += 1;
    if (showCampaignerPicker && filterCampaigner !== "all") count += 1;
    return count;
  }, [period, filterService, filterCampaigner, showCampaignerPicker]);

  const mobileFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (period !== "last_7_days") {
      parts.push(PULSE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period);
    }
    if (filterService !== "campaign") {
      const serviceLabels: Record<string, string> = {
        all: "כל השירותים",
        ppc_google: "PPC Google",
        ppc_meta: "PPC Meta",
        seo: "SEO",
      };
      parts.push(serviceLabels[filterService] ?? filterService);
    }
    if (showCampaignerPicker && filterCampaigner !== "all") {
      parts.push(campaigners.find((c) => c.id === filterCampaigner)?.full_name ?? "קמפיינר");
    }
    return parts.length ? parts.join(" · ") : "כל הסינונים";
  }, [
    period,
    filterService,
    filterCampaigner,
    showCampaignerPicker,
    campaigners,
  ]);

  if (pulseInitialLoading) {
    return (
      <CarmenLoadingScreen
        variant="page"
        title="כרמן מכינה את בדיקת הדופק"
        messages={[
          "כרמן אוספת את נתוני הקמפיינים…",
          "מסדרת לפי לקוח, פלטפורמה ומטרה…",
          "בודקת מי פעיל ומי מושהה…",
          "עוד רגע הכול על המסך…",
        ]}
      />
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-x-hidden max-w-full min-w-0" dir="rtl">
      {pulseRefining ? (
        <CarmenLoadingScreen
          variant="inline"
          messages={[
            "כרמן מדייקת סטטוסי קמפיין (פעיל/מושהה)…",
            "מעדכנת את הקריטריונים החדשים…",
            "עוד רגע הנתונים יתיישרו…",
          ]}
        />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {showTitle ? (
            <h1 className="text-xl sm:text-2xl font-bold">דשבורד בדיקת דופק</h1>
          ) : null}
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 break-words">
            {listSummary.clientCount} לקוחות · {listSummary.campaignCount} קמפיינים עם הוצאה
            {` · ${periodBounds.label}`}
            {period !== "last_7_days"
              ? ` (${periodBounds.startDate}–${periodBounds.endDate})`
              : ""}
            {freshness ? ` · עודכן ${freshness}` : ""}
            {pulseRefining ? " · כרמן מכינה את הנתונים…" : ""}
            {listSummary.unclassifiedCount > 0
              ? ` · ${listSummary.unclassifiedCount} קמפיינים טעונים סיווג`
              : ""}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => copyShareLink()}>
            <Link2 className="h-4 w-4 ml-1 shrink-0" />
            <span className="truncate">העתק קישור{selectedAgency && selectedAgency !== "all" ? " לסוכנות" : ""}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => {
              refetchClients();
              refetchPulse();
              refetchCampaignData();
            }}
          >
            <RefreshCw className="h-4 w-4 ml-1 shrink-0" />
            רענן
          </Button>
        </div>
      </div>

      {/* Mobile filters — search + single filter dropdown */}
      <div className="flex flex-col gap-2 md:hidden w-full min-w-0">
        <div className="relative w-full min-w-0">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 w-full"
          />
        </div>
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal h-10 px-3"
              aria-label="סינון"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{mobileFilterSummary}</span>
                {mobileActiveFilterCount > 0 ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {mobileActiveFilterCount}
                  </Badge>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50 mr-1" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" dir="rtl">
            <SheetHeader>
              <SheetTitle>סינון</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">טווח זמן</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PulsePeriod)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="טווח זמן" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[200]">
                    {PULSE_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">שירות</Label>
                <Select value={filterService} onValueChange={(v) => setFilterService(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="שירותים" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[200]">
                    <SelectItem value="campaign">קמפיין (Meta/Google)</SelectItem>
                    <SelectItem value="all">כל השירותים</SelectItem>
                    <SelectItem value="ppc_google">PPC Google</SelectItem>
                    <SelectItem value="ppc_meta">PPC Meta</SelectItem>
                    <SelectItem value="seo">SEO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showCampaignerPicker && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">קמפיינר</Label>
                  <Select value={filterCampaigner} onValueChange={setFilterCampaigner}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="קמפיינר" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[200]">
                      <SelectItem value="all">כל הקמפיינרים</SelectItem>
                      {campaigners.map((campaigner) => (
                        <SelectItem key={campaigner.id} value={campaigner.id}>
                          {campaigner.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setMobileFiltersOpen(false)}
              >
                סגור
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop filters — inline row (agency filter lives in AppLayout header) */}
      <div className="hidden md:flex flex-wrap gap-2 items-center">
        <Select value={period} onValueChange={(v) => setPeriod(v as PulsePeriod)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="טווח זמן" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            {PULSE_PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterService} onValueChange={(v) => setFilterService(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="שירותים" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="campaign">קמפיין (Meta/Google)</SelectItem>
            <SelectItem value="all">כל השירותים</SelectItem>
            <SelectItem value="ppc_google">PPC Google</SelectItem>
            <SelectItem value="ppc_meta">PPC Meta</SelectItem>
            <SelectItem value="seo">SEO</SelectItem>
          </SelectContent>
        </Select>
        {showCampaignerPicker && (
          <Select value={filterCampaigner} onValueChange={setFilterCampaigner}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="קמפיינר" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">כל הקמפיינרים</SelectItem>
              {campaigners.map((campaigner) => (
                <SelectItem key={campaigner.id} value={campaigner.id}>
                  {campaigner.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {(availablePlatforms.hasFacebook || availablePlatforms.hasGoogleAds) ? (
        <Tabs
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as AgencyPlatformFilter)}
          dir="rtl"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="all" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              כל הפלטפורמות
            </TabsTrigger>
            {availablePlatforms.hasFacebook && (
              <TabsTrigger value="facebook" className="gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                Facebook
              </TabsTrigger>
            )}
            {availablePlatforms.hasGoogleAds && (
              <TabsTrigger value="google_ads" className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04" />
                  <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4" />
                  <circle cx="6" cy="18" r="3.5" fill="#34A853" />
                </svg>
                Google Ads
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      ) : null}

      {unclassifiedCampaignRows.length > 0 ? (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">{unclassifiedCampaignRows.length} קמפיינים טעונים סיווג</strong>
          {" "}— מוצגים תחת «טעון סיווג» בתוך כרטיס הלקוח.
        </div>
      ) : null}

      <div className="space-y-4 min-w-0">
        {clientRawViews.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              אין לקוחות עם נתוני קמפיין בטווח ובסינון שנבחרו
            </CardContent>
          </Card>
        ) : (
          clientRawViews.map((view) => (
            <PulseClientRawCard
              key={view.clientId}
              clientName={view.meta.name}
              campaignerName={view.meta.campaignerName}
              agencyName={view.meta.agencyName}
              period={period}
              pulse={view.pulse}
              campaignsByGoal={view.campaignsByGoal}
              lastCampaignTouchAt={view.lastCampaignTouchAt}
              onOpenClient={() => openClientCard(view.clientId)}
              onCallLog={() => {
                if (!view.pulse) return;
                setCallLogTarget({
                  clientId: view.clientId,
                  clientName: view.meta.name,
                  pulse: view.pulse,
                });
              }}
            />
          ))
        )}
      </div>

      <PulseClientCallDialog
        open={!!callLogTarget}
        onOpenChange={(open) => {
          if (!open) setCallLogTarget(null);
        }}
        target={callLogTarget}
        onSaved={({ clientId, lastClientCallAt, lastClientCallBy }) => {
          const pulseQueryKey = ["pulse-dash-snapshots", tenantId, clientIds.join(","), selectedAgency] as const;
          queryClient.setQueryData<PulseSnapshotRow[]>(pulseQueryKey, (old) => {
            if (!old) return old;
            return old.map((row) =>
              row.client_id === clientId
                ? applyClientCallToPulseSnapshot(row, lastClientCallAt, lastClientCallBy)
                : row,
            );
          });
          queryClient.invalidateQueries({ queryKey: ["client-updates", clientId] });
          queryClient.invalidateQueries({ queryKey: ["pulse-client-call-updates", clientId] });
        }}
      />
    </div>
  );
}

export default function DMMDashboard() {
  return <CampaignPulseDashboard />;
}
