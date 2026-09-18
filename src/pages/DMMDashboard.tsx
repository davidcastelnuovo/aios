/**
 * דשבורד בדיקת דופק — unified with agency dashboard: platform-centric campaign
 * breakdown plus pulse status, client-call, and campaign-touch columns.
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  buildClientCampaignTableData,
  isFacebookIntegration,
  type AgencyPlatformFilter,
} from "@/lib/agencyCampaignData";
import {
  PulseClientCampaignCard,
  PulseClientGoalRollupCard,
} from "@/components/pulse/PulseClientCampaignCard";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { type OverallStatus } from "@/lib/healthScore";
import {
  PulseStatusOverrideDialog,
  type PulseStatusOverrideTarget,
} from "@/components/clients/PulseStatusOverrideDialog";
import {
  PulseClientCallDialog,
  type PulseClientCallTarget,
} from "@/components/clients/PulseClientCallDialog";
import {
  buildPulseDashboardUrl,
  clientHasCampaignCoverage,
  clientHasCampaignService,
  collectCampaignBreakdownFromSnapshots,
  expandPulseToPlatformGoalRows,
  pulseClientsNeedingRecordBuild,
  pulseFallbackTableIds,
  applyClientCallToPulseSnapshot,
  filterPulseCallFlags,
  fetchPulseCampaignRecords,
  formatGoalChange,
  formatGoalEfficiency,
  formatGoalOutcomes,
  formatPulseMoney,
  getPulsePeriodBounds,
  jerusalemYmd,
  platformGoalLabel,
  pulseGoalKeyForTable,
  PULSE_PERIOD_OPTIONS,
  pulseSpendColumnLabel,
  pulseStatusToOverall,
  rollupCampaignRowsByClientGoal,
  type PulseCampaignTable,
  type PulseCrmRecord,
  type PulsePlatformDisplayRow,
  type PulseOverrideRow,
  type PulsePeriod,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";
import {
  buildPulseCampaignRows,
  pulseTrendWindows,
  type PulseCampaignGoal,
  type PulseCampaignGoalRow,
} from "@/lib/pulseCampaignGoals";

type ClientBase = {
  id: string;
  name: string;
  status: string;
  agency_id: string | null;
  services: string[];
  campaignerName: string;
  agencyName: string;
};

type PulseRow = ClientBase & {
  clientId: string;
  pulse: PulseSnapshotRow | null;
  goalRow: PulsePlatformDisplayRow | null;
  algorithmOverall: OverallStatus;
  overall: OverallStatus;
  manualOverride: PulseOverrideRow | null;
  flags: string[];
};

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
  const { selectedAgency, setSelectedAgency, agencies } = useAgency();
  const { isOwner, isTeamManager, isSuperAdmin, isCampaigner, isSeo, campaignerId } = useUserRole();
  const { userAgencyIds } = useUserAgencies();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | OverallStatus>("all");
  const [filterService, setFilterService] = useState<"all" | "ppc_google" | "ppc_meta" | "seo" | "campaign">("campaign");
  const [filterCampaigner, setFilterCampaigner] = useState("all");
  const [platformFilter, setPlatformFilter] = useState<AgencyPlatformFilter>("all");
  const [categoryTab, setCategoryTab] = useState<Exclude<PulseCampaignGoal, "unknown">>("leads");
  const [period, setPeriod] = useState<PulsePeriod>("last_7_days");
  const [overrideTarget, setOverrideTarget] = useState<PulseStatusOverrideTarget | null>(null);
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

  async function saveCampaignTarget(
    row: PulseCampaignGoalRow,
    value: number,
    kind: "cpl" | "cost_per_result" | "roas",
  ) {
    const table = pulseCampaignTables.find((candidate) => candidate.id === row.table_id);
    if (!table) {
      toast.error("לא נמצאה טבלת המקור של הקמפיין");
      return;
    }
    const settings = { ...(table.integration_settings || {}) } as Record<string, unknown>;
    const targets = {
      ...((settings.pulse_targets as Record<string, unknown> | undefined) || {}),
    };
    const targetKey = row.campaign_id || row.campaign_name;
    targets[targetKey] = {
      kind,
      [kind]: value,
      source: "pulse_dashboard",
      approved_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("crm_tables")
      .update({ integration_settings: { ...settings, pulse_targets: targets } })
      .eq("id", row.table_id);
    if (error) {
      toast.error(`שמירת היעד נכשלה: ${error.message}`);
      throw error;
    }
    toast.success("היעד המאושר נשמר");
    await refetchPulseTables();
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

  const { data: pulseRows = [], refetch: refetchPulse, dataUpdatedAt } = useQuery({
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

  const { data: pulseOverrides = [], refetch: refetchOverrides } = useQuery({
    queryKey: ["pulse-dash-overrides", tenantId, clientIds.join(",")],
    queryFn: async () => {
      if (!tenantId || !clientIds.length) return [] as PulseOverrideRow[];
      const { data, error } = await (supabase as any)
        .from("campaign_pulse_overrides")
        .select("*")
        .in("client_id", clientIds)
        .is("cleared_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PulseOverrideRow[];
    },
    enabled: !!tenantId && clientIds.length > 0,
    staleTime: 30_000,
  });

  const activeOverrideByClient = useMemo(() => {
    const map = new Map<string, PulseOverrideRow>();
    for (const row of pulseOverrides) {
      if (!map.has(row.client_id)) map.set(row.client_id, row);
    }
    return map;
  }, [pulseOverrides]);

  const { data: pulseCampaignTables = [], refetch: refetchPulseTables } = useQuery({
    queryKey: ["pulse-dash-tables", tenantId, clientIds.join(",")],
    queryFn: async () => {
      if (!tenantId || !clientIds.length) return [] as PulseCampaignTable[];
      const { data: tables, error } = await supabase
        .from("crm_tables")
        .select("id, client_id, integration_type, campaign_active, last_sync_at, integration_settings")
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

  const clientsNeedingRecordBuild = useMemo(
    () => pulseClientsNeedingRecordBuild({
      snapshots: pulseRows,
      tables: pulseCampaignTables,
    }),
    [pulseRows, pulseCampaignTables],
  );

  const fallbackTableIds = useMemo(
    () => pulseFallbackTableIds(pulseCampaignTables, clientsNeedingRecordBuild),
    [pulseCampaignTables, clientsNeedingRecordBuild],
  );

  const {
    data: pulseCampaignRecords = [],
    isFetching: pulseRecordsFetching,
    refetch: refetchPulseRecords,
  } = useQuery({
    queryKey: [
      "pulse-dash-records-fallback",
      fallbackTableIds.join(","),
      campaignTrendBounds.queryStart,
      campaignTrendBounds.queryEnd,
    ],
    queryFn: () => fetchPulseCampaignRecords(fallbackTableIds, {
      ...periodBounds,
      prevStartDate: campaignTrendBounds.queryStart,
      endDate: campaignTrendBounds.queryEnd,
    }),
    enabled: fallbackTableIds.length > 0,
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
    const fromSnapshots = collectCampaignBreakdownFromSnapshots(pulseRows);
    const coveredClients = new Set(
      pulseRows
        .filter((row) => Array.isArray(row.campaign_breakdown))
        .map((row) => row.client_id),
    );
    if (!fallbackTableIds.length || !pulseCampaignRecords.length) {
      return fromSnapshots;
    }
    const fallbackRows = buildPulseCampaignRows({
      records: pulseCampaignRecords.filter((record) => fallbackTableIds.includes(record.table_id)),
      tables: pulseCampaignTables.filter((table) => fallbackTableIds.includes(table.id)),
      nowYmd: jerusalemYmd(),
    }).filter((row) => !coveredClients.has(row.client_id));
    return [...fromSnapshots, ...fallbackRows];
  }, [pulseRows, pulseCampaignRecords, pulseCampaignTables, fallbackTableIds]);

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

  const recordsByClient = useMemo(() => {
    const map = new Map<string, PulseCrmRecord[]>();
    const tableToClient = campaignData?.tableToClient;
    if (!tableToClient) return map;
    for (const record of campaignData?.records ?? []) {
      const clientId = tableToClient.get(record.table_id);
      if (!clientId) continue;
      const list = map.get(clientId) || [];
      list.push(record);
      map.set(clientId, list);
    }
    return map;
  }, [campaignData?.records, campaignData?.tableToClient]);

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

  const rows: PulseRow[] = useMemo(() => {
    const expanded: PulseRow[] = [];
    for (const c of filteredByRole) {
      const services: string[] = Array.isArray(c.services) ? [...c.services] : [];
      if (c.is_seo_client === true && !services.includes("seo")) services.push("seo");
      const pulse = pulseByClient.get(c.id) ?? null;
      const clientTables = tablesByClient.get(c.id) ?? [];
      const hasCampaign = clientHasCampaignCoverage(services, clientTables);
      const manualOverride = activeOverrideByClient.get(c.id) ?? null;
      const clientRecords = recordsByClient.get(c.id) ?? [];
      const platformRows = hasCampaign
        ? expandPulseToPlatformGoalRows({
            snapshot: pulse,
            services,
            tables: clientTables,
            records: clientRecords,
            bounds: periodBounds,
          })
        : [];
      const displayRows = platformRows.length ? platformRows : [null];
      for (const goalRow of displayRows) {
        const algorithmOverall = goalRow
          ? pulseStatusToOverall(goalRow.status)
          : hasCampaign
            ? "yellow"
            : "green";
        const overall = manualOverride?.override_status ?? algorithmOverall;
        const flags = filterPulseCallFlags([
          ...(goalRow?.flags || pulse?.flags || []),
          ...(!pulse && hasCampaign ? ["ממתין לבדיקת דופק"] : []),
        ]);
        expanded.push({
          id: goalRow?.rowKey || c.id,
          clientId: c.id,
          name: c.name,
          status: c.status,
          agency_id: c.agency_id,
          services,
          campaignerName: c.client_team?.[0]?.campaigners?.full_name ?? "—",
          agencyName: c.agencies?.name ?? "—",
          pulse,
          goalRow,
          algorithmOverall,
          overall,
          manualOverride,
          flags,
        });
      }
    }
    return expanded;
  }, [filteredByRole, pulseByClient, activeOverrideByClient, tablesByClient, recordsByClient, periodBounds]);

  const filtered = useMemo(() => {
    return rows
      .filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterStatus !== "all" && c.overall !== filterStatus) return false;
        if (filterService === "campaign") {
          const clientTables = tablesByClient.get(c.clientId) ?? [];
          if (!clientHasCampaignCoverage(c.services, clientTables)) return false;
        }
        if (filterService === "ppc_meta" && c.goalRow?.platform !== "meta") return false;
        if (filterService === "ppc_google" && c.goalRow?.platform !== "google") return false;
        if (platformFilter === "facebook" && c.goalRow?.platform !== "meta") return false;
        if (platformFilter === "google_ads" && c.goalRow?.platform !== "google") return false;
        if (filterService !== "all" && filterService !== "campaign" && filterService !== "ppc_meta" && filterService !== "ppc_google" && !c.services.includes(filterService)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rank = (s: OverallStatus) => (s === "red" ? 0 : s === "yellow" ? 1 : 2);
        return rank(a.overall) - rank(b.overall) || a.name.localeCompare(b.name, "he");
      });
  }, [rows, search, filterStatus, filterService, platformFilter, tablesByClient]);

  const pulseRowByKey = useMemo(() => {
    const map = new Map<string, PulseRow>();
    for (const row of rows) {
      if (!row.goalRow) continue;
      map.set(`${row.clientId}:${row.goalRow.platform}:${row.goalRow.goal}`, row);
    }
    return map;
  }, [rows]);

  const pulseRowsByClient = useMemo(() => {
    const map = new Map<string, PulseRow[]>();
    for (const row of rows) {
      const list = map.get(row.clientId) || [];
      list.push(row);
      map.set(row.clientId, list);
    }
    return map;
  }, [rows]);

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

  const clientGoalRollups = useMemo(
    () => rollupCampaignRowsByClientGoal({
      campaignRows: campaignGoalRows,
      snapshotsByClient: pulseByClient,
    }),
    [campaignGoalRows, pulseByClient],
  );

  const visibleClientGoalRollups = useMemo(() => {
    return clientGoalRollups
      .filter((row) => row.goal === categoryTab)
      .filter((row) => {
        const meta = clientMetaById.get(row.client_id);
        if (!meta) return false;
        if (search && !meta.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (platformFilter === "facebook" && row.platform !== "meta") return false;
        if (platformFilter === "google_ads" && row.platform !== "google") return false;
        const manualOverride = activeOverrideByClient.get(row.client_id)?.override_status;
        const overall = manualOverride ?? pulseStatusToOverall(row.status);
        if (filterStatus !== "all" && overall !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (status: string) => (status === "critical" ? 0 : status === "warning" || status === "no_data" ? 1 : 2);
        const overallA = activeOverrideByClient.get(a.client_id)?.override_status ?? pulseStatusToOverall(a.status);
        const overallB = activeOverrideByClient.get(b.client_id)?.override_status ?? pulseStatusToOverall(b.status);
        const statusRank = (value: OverallStatus) => (value === "red" ? 0 : value === "yellow" ? 1 : 2);
        return statusRank(overallA) - statusRank(overallB)
          || rank(a.status) - rank(b.status)
          || (clientMetaById.get(a.client_id)?.name || "").localeCompare(clientMetaById.get(b.client_id)?.name || "", "he");
      });
  }, [
    clientGoalRollups,
    categoryTab,
    clientMetaById,
    search,
    platformFilter,
    filterStatus,
    activeOverrideByClient,
  ]);

  const unclassifiedCampaignRows = useMemo(
    () => campaignGoalRows.filter((row) => row.goal === "unknown" && clientMetaById.has(row.client_id)),
    [campaignGoalRows, clientMetaById],
  );

  function resolvePulseRowForCard(card: ReturnType<typeof buildClientCampaignTableData>[number]): PulseRow {
    const { platform, goal } = pulseGoalKeyForTable(card.integrationType, card.campaignType);
    const exactKey = platform ? `${card.clientId}:${platform}:${goal}` : null;
    if (exactKey) {
      const exact = pulseRowByKey.get(exactKey);
      if (exact) return exact;
    }
    const clientRows = pulseRowsByClient.get(card.clientId) ?? [];
    const platformRow = platform
      ? clientRows.find((row) => row.goalRow?.platform === platform)
      : null;
    if (platformRow) return platformRow;
    if (clientRows[0]) return clientRows[0];

    const meta = clientMetaById.get(card.clientId);
    return {
      id: `${card.clientId}:${card.tableId}`,
      clientId: card.clientId,
      name: meta?.name ?? card.clientName,
      status: "active",
      agency_id: null,
      services: meta?.services ?? [],
      campaignerName: meta?.campaignerName ?? "—",
      agencyName: meta?.agencyName ?? "—",
      pulse: pulseByClient.get(card.clientId) ?? null,
      goalRow: null,
      algorithmOverall: "yellow",
      overall: "yellow",
      manualOverride: activeOverrideByClient.get(card.clientId) ?? null,
      flags: [],
    };
  }

  function cardPassesFilters(card: ReturnType<typeof buildClientCampaignTableData>[number], pulseRow: PulseRow): boolean {
    if (search && !card.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && pulseRow.overall !== filterStatus) return false;
    if (filterService === "campaign") {
      const clientTables = tablesByClient.get(card.clientId) ?? [];
      if (!clientHasCampaignCoverage(pulseRow.services, clientTables)) return false;
    }
    if (filterService === "ppc_meta" && pulseRow.goalRow?.platform !== "meta") return false;
    if (filterService === "ppc_google" && pulseRow.goalRow?.platform !== "google") return false;
    if (platformFilter === "facebook" && pulseGoalKeyForTable(card.integrationType, card.campaignType).platform !== "meta") {
      return false;
    }
    if (platformFilter === "google_ads" && pulseGoalKeyForTable(card.integrationType, card.campaignType).platform !== "google") {
      return false;
    }
    return true;
  }

  const clientCampaignCards = useMemo(() => {
    return buildClientCampaignTableData({
      clients: filteredByRole.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
      tables: (campaignData?.tables ?? []).map((table) => ({
        id: table.id,
        client_id: table.client_id,
        name: null,
        integration_type: table.integration_type,
        integration_settings: table.integration_settings as Record<string, unknown> | null,
      })),
      records: campaignData?.records ?? [],
      startDate: periodBounds.startDate,
      endDate: periodBounds.endDate,
      platformFilter,
    });
  }, [filteredByRole, campaignData, periodBounds, platformFilter]);

  const displayItems = useMemo(() => {
    const items: Array<
      | { kind: "campaign"; card: ReturnType<typeof buildClientCampaignTableData>[number]; pulseRow: PulseRow }
      | { kind: "pulse-only"; pulseRow: PulseRow }
    > = [];
    const seenCards = new Set<string>();

    for (const card of clientCampaignCards) {
      const pulseRow = resolvePulseRowForCard(card);
      if (pulseRow.goalRow && pulseRow.goalRow.goal !== categoryTab) continue;
      if (!cardPassesFilters(card, pulseRow)) continue;
      items.push({ kind: "campaign", card, pulseRow });
      seenCards.add(`${card.clientId}-${card.tableId}`);
    }

    for (const pulseRow of filtered) {
      if (!pulseRow.goalRow) continue;
      if (pulseRow.goalRow.goal !== categoryTab) continue;
      const hasCard = clientCampaignCards.some(
        (card) =>
          seenCards.has(`${card.clientId}-${card.tableId}`) &&
          card.clientId === pulseRow.clientId &&
          pulseGoalKeyForTable(card.integrationType, card.campaignType).platform === pulseRow.goalRow?.platform,
      );
      if (hasCard) continue;
      items.push({ kind: "pulse-only", pulseRow });
    }

    return items.sort((a, b) => {
      const rank = (s: OverallStatus) => (s === "red" ? 0 : s === "yellow" ? 1 : 2);
      return rank(a.pulseRow.overall) - rank(b.pulseRow.overall) ||
        a.pulseRow.name.localeCompare(b.pulseRow.name, "he");
    });
  }, [
    clientCampaignCards,
    filtered,
    search,
    filterStatus,
    filterService,
    platformFilter,
    pulseRowByKey,
    pulseRowsByClient,
    clientMetaById,
    tablesByClient,
    activeOverrideByClient,
    pulseByClient,
    categoryTab,
  ]);

  const availablePlatforms = useMemo(() => {
    const types = new Set((campaignData?.tables ?? []).map((table) => table.integration_type));
    return {
      hasFacebook: Array.from(types).some((type) => isFacebookIntegration(type)),
      hasGoogleAds: types.has("google_ads"),
    };
  }, [campaignData?.tables]);

  const summary = useMemo(() => {
    const categoryRows = clientGoalRollups.filter(
      (row) => row.goal === categoryTab && clientMetaById.has(row.client_id),
    );
    if (categoryRows.length > 0) {
      return {
        red: categoryRows.filter((row) => {
          const overall = activeOverrideByClient.get(row.client_id)?.override_status ?? pulseStatusToOverall(row.status);
          return overall === "red";
        }).length,
        yellow: categoryRows.filter((row) => {
          const overall = activeOverrideByClient.get(row.client_id)?.override_status ?? pulseStatusToOverall(row.status);
          return overall === "yellow";
        }).length,
        green: categoryRows.filter((row) => {
          const overall = activeOverrideByClient.get(row.client_id)?.override_status ?? pulseStatusToOverall(row.status);
          return overall === "green";
        }).length,
        total: categoryRows.length,
        missingPulse: unclassifiedCampaignRows.length,
      };
    }
    const base = filterService === "campaign"
      ? rows.filter((c) => clientHasCampaignCoverage(c.services, tablesByClient.get(c.clientId)))
      : rows;
    return {
      red: base.filter((c) => c.overall === "red").length,
      yellow: base.filter((c) => c.overall === "yellow").length,
      green: base.filter((c) => c.overall === "green").length,
      total: base.length,
      missingPulse: new Set(
        base.filter((c) => clientHasCampaignService(c.services) && !c.pulse).map((c) => c.clientId),
      ).size,
    };
  }, [
    rows,
    filterService,
    clientGoalRollups,
    categoryTab,
    clientMetaById,
    unclassifiedCampaignRows.length,
    tablesByClient,
    activeOverrideByClient,
  ]);

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
    if (selectedAgency && selectedAgency !== "all") count += 1;
    if (period !== "last_7_days") count += 1;
    if (filterStatus !== "all") count += 1;
    if (filterService !== "campaign") count += 1;
    if (showCampaignerPicker && filterCampaigner !== "all") count += 1;
    return count;
  }, [selectedAgency, period, filterStatus, filterService, filterCampaigner, showCampaignerPicker]);

  const mobileFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedAgency && selectedAgency !== "all") {
      parts.push(agencies?.find((a) => a.id === selectedAgency)?.name ?? "סוכנות");
    }
    if (period !== "last_7_days") {
      parts.push(PULSE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period);
    }
    if (filterStatus !== "all") {
      parts.push(filterStatus === "red" ? "🔴 דורש טיפול" : filterStatus === "yellow" ? "🟡 לתשומת לב" : "🟢 תקין");
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
    selectedAgency,
    agencies,
    period,
    filterStatus,
    filterService,
    filterCampaigner,
    showCampaignerPicker,
    campaigners,
  ]);

  if (clientsLoading) {
    return <div className="flex justify-center p-12 text-muted-foreground">טוען בדיקת דופק...</div>;
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-x-hidden max-w-full min-w-0" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {showTitle ? (
            <h1 className="text-xl sm:text-2xl font-bold">דשבורד בדיקת דופק</h1>
          ) : null}
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 break-words">
            {summary.total} {clientGoalRollups.length ? "לקוחות בקטגוריה" : "לקוחות קמפיין פעילים"}
            {` · ${periodBounds.label}`}
            {period !== "last_7_days"
              ? ` (${periodBounds.startDate}–${periodBounds.endDate})`
              : ""}
            {freshness ? ` · עודכן ${freshness}` : ""}
            {pulseRecordsFetching && fallbackTableIds.length > 0
              ? ` · משלים ${fallbackTableIds.length} לקוחות ללא snapshot...`
              : ""}
            {summary.missingPulse > 0
              ? ` · ${summary.missingPulse} ${clientGoalRollups.length ? "קמפיינים טעונים סיווג" : "ממתינים לחישוב"}`
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
              refetchOverrides();
              refetchCampaignData();
            }}
          >
            <RefreshCw className="h-4 w-4 ml-1 shrink-0" />
            רענן
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-surface-status-red"
          onClick={() => setFilterStatus(filterStatus === "red" ? "all" : "red")}
        >
          <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-3xl leading-none shrink-0">🔴</span>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-red-700">{summary.red}</p>
              <p className="text-[11px] sm:text-sm text-red-600 truncate">דורשים טיפול</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200 bg-surface-status-yellow"
          onClick={() => setFilterStatus(filterStatus === "yellow" ? "all" : "yellow")}
        >
          <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-3xl leading-none shrink-0">🟡</span>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-yellow-700">{summary.yellow}</p>
              <p className="text-[11px] sm:text-sm text-yellow-600 truncate">לתשומת לב</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-green-200 bg-surface-status-green"
          onClick={() => setFilterStatus(filterStatus === "green" ? "all" : "green")}
        >
          <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-3xl leading-none shrink-0">🟢</span>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-green-700">{summary.green}</p>
              <p className="text-[11px] sm:text-sm text-green-600 truncate">תקינים</p>
            </div>
          </CardContent>
        </Card>
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
        <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <PopoverTrigger asChild>
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
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(calc(100vw-1.5rem),22rem)] p-3 space-y-3"
            align="start"
            dir="rtl"
          >
            {!fixedAgencyId && agencies && agencies.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">סוכנות</Label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="כל הסוכנויות" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[200]">
                    <SelectItem value="all">כל הסוכנויות</SelectItem>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <Label className="text-xs text-muted-foreground">סטטוס</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="כל הסטטוסים" />
                </SelectTrigger>
                <SelectContent className="bg-background z-[200]">
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="red">🔴 דורש טיפול</SelectItem>
                  <SelectItem value="yellow">🟡 לתשומת לב</SelectItem>
                  <SelectItem value="green">🟢 תקין</SelectItem>
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
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop filters — inline row */}
      <div className="hidden md:flex flex-wrap gap-2 items-center">
        {!fixedAgencyId && agencies && agencies.length > 1 && (
          <Select value={selectedAgency} onValueChange={setSelectedAgency}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="כל הסוכנויות" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">כל הסוכנויות</SelectItem>
              {agencies.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="red">🔴 דורש טיפול</SelectItem>
            <SelectItem value="yellow">🟡 לתשומת לב</SelectItem>
            <SelectItem value="green">🟢 תקין</SelectItem>
          </SelectContent>
        </Select>
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

      <Tabs
        value={categoryTab}
        onValueChange={(value) => setCategoryTab(value as Exclude<PulseCampaignGoal, "unknown">)}
        dir="rtl"
      >
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="leads">לידים</TabsTrigger>
          <TabsTrigger value="engagement">אינגייג׳מנט</TabsTrigger>
          <TabsTrigger value="ecommerce">איקומרס</TabsTrigger>
        </TabsList>
      </Tabs>

      {unclassifiedCampaignRows.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>{unclassifiedCampaignRows.length} קמפיינים טעונים סיווג.</strong>
          {" "}הם אינם משויכים אוטומטית ללידים ולא נכללים בסיכומי הקטגוריות.
          <div className="mt-1 text-xs">
            {unclassifiedCampaignRows
              .slice(0, 5)
              .map((row) => `${clientMetaById.get(row.client_id)?.name || "לקוח"} — ${row.campaign_name}`)
              .join(" · ")}
            {unclassifiedCampaignRows.length > 5 ? " · …" : ""}
          </div>
        </div>
      ) : null}

      {(availablePlatforms.hasFacebook || availablePlatforms.hasGoogleAds) && (
        <Tabs value={platformFilter} onValueChange={(value) => setPlatformFilter(value as AgencyPlatformFilter)} dir="rtl">
          <TabsList className="h-auto flex-wrap gap-1">
            <TabsTrigger value="all" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              הכל
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
      )}

      {clientGoalRollups.length > 0 ? (
        <div className="space-y-4 min-w-0">
          {visibleClientGoalRollups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                אין לקוחות בקטגוריה ובסינון שנבחרו
              </CardContent>
            </Card>
          ) : visibleClientGoalRollups.map((rollup) => {
            const meta = clientMetaById.get(rollup.client_id);
            if (!meta) return null;
            const manualOverride = activeOverrideByClient.get(rollup.client_id) ?? null;
            const algorithmOverall = pulseStatusToOverall(rollup.status);
            const overall = manualOverride?.override_status ?? algorithmOverall;
            const pulse = pulseByClient.get(rollup.client_id) ?? null;
            return (
              <PulseClientGoalRollupCard
                key={rollup.rowKey}
                rollup={rollup}
                clientName={meta.name}
                campaignerName={meta.campaignerName}
                period={period}
                overall={overall}
                manualOverride={!!manualOverride}
                onOverride={() =>
                  setOverrideTarget({
                    clientId: rollup.client_id,
                    clientName: meta.name,
                    algorithmOverall,
                    pulse,
                    flags: rollup.flags,
                    activeOverride: manualOverride,
                  })
                }
                onOpenClient={() => openClientCard(rollup.client_id)}
                onCallLog={() => {
                  if (!pulse) return;
                  setCallLogTarget({
                    clientId: rollup.client_id,
                    clientName: meta.name,
                    pulse,
                  });
                }}
                onSaveTarget={
                  isOwner || isTeamManager || isSuperAdmin
                    ? (row, value, kind) => saveCampaignTarget(row, value, kind)
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
      <div className="space-y-4 min-w-0">
        {displayItems.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              אין לקוחות להצגה
            </CardContent>
          </Card>
        ) : (
          displayItems.map((item) => {
            const pulseRow = item.pulseRow;
            const openOverride = () =>
              setOverrideTarget({
                clientId: pulseRow.clientId,
                clientName: pulseRow.name,
                algorithmOverall: pulseRow.algorithmOverall,
                pulse: pulseRow.pulse,
                flags: pulseRow.flags,
                activeOverride: pulseRow.manualOverride,
              });
            const openCallLog = () => {
              if (!pulseRow.pulse) return;
              setCallLogTarget({
                clientId: pulseRow.clientId,
                clientName: pulseRow.name,
                pulse: pulseRow.pulse,
              });
            };

            if (item.kind === "campaign") {
              return (
                <PulseClientCampaignCard
                  key={`${item.card.clientId}-${item.card.tableId}`}
                  data={item.card}
                  goalRow={pulseRow.goalRow}
                  pulse={pulseRow.pulse}
                  overall={pulseRow.overall}
                  manualOverride={!!pulseRow.manualOverride}
                  algorithmOverall={pulseRow.algorithmOverall}
                  flags={pulseRow.flags}
                  campaignerName={pulseRow.campaignerName}
                  period={period}
                  onOverride={openOverride}
                  onOpenClient={() => openClientCard(pulseRow.clientId)}
                  onCallLog={openCallLog}
                />
              );
            }

            const goalRow = pulseRow.goalRow;
            const snapshot = pulseRow.pulse;
            const spend = goalRow?.spend_7d ?? snapshot?.spend_7d ?? null;
            const hasSummary = goalRow || (snapshot && spend !== null);

            return (
              <Card
                key={pulseRow.id}
                className={
                  pulseRow.overall === "red"
                    ? "border-red-200 bg-surface-status-red"
                    : pulseRow.overall === "yellow"
                      ? "border-yellow-200 bg-surface-status-yellow"
                      : ""
                }
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl">
                      {pulseRow.overall === "red" ? "🔴" : pulseRow.overall === "yellow" ? "🟡" : "🟢"}
                    </span>
                    <span className="font-medium">{pulseRow.name}</span>
                    {goalRow ? (
                      <Badge variant="outline" className="text-xs">
                        {platformGoalLabel(goalRow)}
                      </Badge>
                    ) : null}
                  </div>
                  {hasSummary && goalRow ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{pulseSpendColumnLabel(period).split(" ")[0]}: </span>
                        <span className="font-medium tabular-nums">{formatPulseMoney(goalRow.spend_7d)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">לידים/רכישות: </span>
                        <span className="font-medium tabular-nums">{formatGoalOutcomes(goalRow)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPL/ROAS: </span>
                        <span className="font-medium tabular-nums">{formatGoalEfficiency(goalRow)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">שינוי: </span>
                        <span className="font-medium tabular-nums">{formatGoalChange(goalRow)}</span>
                      </div>
                    </div>
                  ) : hasSummary && snapshot ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">הוצאה (snapshot): </span>
                        <span className="font-medium tabular-nums">{formatPulseMoney(snapshot.spend_7d)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">לידים: </span>
                        <span className="font-medium tabular-nums">{snapshot.leads_7d ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">רכישות: </span>
                        <span className="font-medium tabular-nums">{snapshot.purchases_7d ?? "—"}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">אין נתוני קמפיין בטווח הנבחר</p>
                  )}
                  {!goalRow && hasSummary ? (
                    <p className="text-xs text-muted-foreground">סיכום מבדיקת דופק — פירוט קמפיינים לא זמין לטווח</p>
                  ) : null}
                  {pulseRow.flags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {pulseRow.flags.map((flag) => (
                        <Badge key={flag} variant="outline" className="text-xs">{flag}</Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={openOverride}>ערוך צבע</Button>
                    <Button variant="outline" size="sm" onClick={() => openClientCard(pulseRow.clientId)}>פתח כרטיס</Button>
                    {pulseRow.pulse ? (
                      <Button variant="outline" size="sm" onClick={openCallLog}>שיחת לקוח</Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}
      {dataUpdatedAt ? (
        <p className="text-xs text-muted-foreground">
          טבלאות לא מחוברות מוצגות כאן ליד הלקוח (צהוב) — לא נשלחות בוואטסאפ.
          {" "}
          עריכת צבע ידנית נשמרת עם הסבר לכרמן ומשפיעה על הדשבורד (לא על וואטסאפ).
        </p>
      ) : null}

      <PulseStatusOverrideDialog
        open={!!overrideTarget}
        onOpenChange={(open) => {
          if (!open) setOverrideTarget(null);
        }}
        target={overrideTarget}
        onSaved={() => {
          refetchOverrides();
          refetchClients();
        }}
      />

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
