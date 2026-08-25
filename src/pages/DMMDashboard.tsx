/**
 * דשבורד בדיקת דופק — deterministic campaign pulse from campaign_pulse_snapshots.
 * Format matches Carmen's get_latest_campaign_pulse table.
 */

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Link2, Pencil, RefreshCw, Search } from "lucide-react";
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
  aggregatePulseMetricsFromRecords,
  applyPeriodMetricsToSnapshot,
  buildPulseDashboardUrl,
  clientHasCampaignService,
  expandPulseSnapshotToGoalRows,
  formatGoalChange,
  formatGoalEfficiency,
  formatGoalOutcomes,
  formatLastClientCall,
  formatMetaChangeDetails,
  formatPulseMoney,
  getPulsePeriodBounds,
  goalLabel,
  metaChangeSummary,
  overallStatusLabel,
  PULSE_PERIOD_OPTIONS,
  pulseSpendColumnLabel,
  pulseStatusLabel,
  pulseStatusToOverall,
  type PulseGoalDisplayRow,
  type PulseOverrideRow,
  type PulsePeriod,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";

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
  goalRow: PulseGoalDisplayRow | null;
  algorithmOverall: OverallStatus;
  overall: OverallStatus;
  manualOverride: PulseOverrideRow | null;
  flags: string[];
};

function StatusDot({ status }: { status: OverallStatus }) {
  const label = status === "red" ? "דורש טיפול" : status === "yellow" ? "לתשומת לב" : "תקין";
  const dot = status === "red" ? "🔴" : status === "yellow" ? "🟡" : "🟢";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xl cursor-default">{dot}</span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function DMMDashboard() {
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
  const [period, setPeriod] = useState<PulsePeriod>("last_7_days");
  const [overrideTarget, setOverrideTarget] = useState<PulseStatusOverrideTarget | null>(null);
  const [callLogTarget, setCallLogTarget] = useState<PulseClientCallTarget | null>(null);
  const periodBounds = useMemo(() => getPulsePeriodBounds(period), [period]);

  // Sync agency from shareable URL (?agency=...)
  useEffect(() => {
    const agencyFromUrl = searchParams.get("agency");
    if (agencyFromUrl && agencyFromUrl !== selectedAgency) {
      setSelectedAgency(agencyFromUrl);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
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
  }, [selectedAgency]); // eslint-disable-line react-hooks/exhaustive-deps

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
      selectedAgency && selectedAgency !== "all" ? selectedAgency : null,
    );
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        selectedAgency && selectedAgency !== "all"
          ? "קישור הסוכנות הועתק"
          : "קישור הדשבורד הועתק",
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
    if (needsCampaignerFilter && campaignerId) {
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
        "client_id, agency_id, status, campaign_goal_mode, is_ecommerce, spend_7d, lead_spend_7d, ecommerce_spend_7d, leads_7d, cpl_7d, cpl_change_pct, purchases_7d, revenue_7d, roas_7d, roas_change_pct, lead_goal_status, ecommerce_goal_status, flags, data_fresh_through, calculated_at, last_meta_change_at, last_meta_change_type, last_meta_change_actor, last_meta_change_object, meta_change_availability";
      const load = (columns: string) =>
        (supabase as any)
          .from("campaign_pulse_snapshots")
          .select(columns)
          .in("client_id", clientIds);
      let { data, error } = await load(`${baseColumns}, last_client_call_at, last_client_call_by`);
      if (error && /last_client_call/.test(error.message ?? "")) {
        ({ data, error } = await load(baseColumns));
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

  // Calendar periods (השבוע / שבוע שעבר) re-aggregate from crm_records.
  // last_7_days keeps the deterministic snapshot (matches WA digest).
  const needsPeriodOverride = period !== "last_7_days";
  const { data: periodMetricsByClient = new Map<string, ReturnType<typeof aggregatePulseMetricsFromRecords>>(), refetch: refetchPeriod } = useQuery({
    queryKey: [
      "pulse-dash-period",
      tenantId,
      clientIds.join(","),
      period,
      periodBounds.startDate,
      periodBounds.endDate,
      periodBounds.prevStartDate,
    ],
    queryFn: async () => {
      const empty = new Map<string, ReturnType<typeof aggregatePulseMetricsFromRecords>>();
      if (!tenantId || !clientIds.length || !needsPeriodOverride) return empty;

      const { data: tables, error: tablesError } = await supabase
        .from("crm_tables")
        .select("id, client_id")
        .in("client_id", clientIds)
        .in("integration_type", ["facebook_insights", "facebook_ecommerce", "google_ads"]);
      if (tablesError) throw tablesError;
      if (!tables?.length) return empty;

      const tableIds = tables.map((t) => t.id);
      const tableToClient = new Map(tables.map((t) => [t.id, t.client_id as string]));

      const { data: records, error: recordsError } = await supabase
        .from("crm_records")
        .select("table_id, data")
        .in("table_id", tableIds)
        .filter("data->>date", "gte", periodBounds.prevStartDate)
        .filter("data->>date", "lte", periodBounds.endDate)
        .limit(20000);
      if (recordsError) throw recordsError;

      const byClient = new Map<string, { data?: Record<string, unknown> | null }[]>();
      for (const row of records ?? []) {
        const clientId = tableToClient.get(row.table_id);
        if (!clientId) continue;
        const list = byClient.get(clientId) || [];
        list.push({ data: (row.data as Record<string, unknown>) ?? null });
        byClient.set(clientId, list);
      }

      const ecommerceByClient = new Map<string, boolean>();
      for (const snap of pulseRows) {
        ecommerceByClient.set(snap.client_id, !!snap.is_ecommerce);
      }

      const out = new Map<string, ReturnType<typeof aggregatePulseMetricsFromRecords>>();
      for (const [clientId, clientRecords] of byClient) {
        out.set(
          clientId,
          aggregatePulseMetricsFromRecords(
            clientRecords,
            periodBounds,
            ecommerceByClient.get(clientId) ?? false,
          ),
        );
      }
      return out;
    },
    enabled: !!tenantId && clientIds.length > 0 && needsPeriodOverride,
    staleTime: 30_000,
  });

  const pulseByClient = useMemo(() => {
    const map = new Map<string, PulseSnapshotRow>();
    for (const row of pulseRows) {
      const prev = map.get(row.client_id);
      if (!prev || String(row.calculated_at || "") > String(prev.calculated_at || "")) {
        map.set(row.client_id, row);
      }
    }
    if (needsPeriodOverride) {
      for (const [clientId, base] of map) {
        const metrics = periodMetricsByClient.get(clientId) ?? {
          spend_7d: 0,
          leads_7d: 0,
          cpl_7d: null,
          cpl_change_pct: null,
          purchases_7d: 0,
          revenue_7d: 0,
          roas_7d: null,
          data_fresh_through: null,
          record_count: 0,
        };
        map.set(clientId, applyPeriodMetricsToSnapshot(base, metrics));
      }
    }
    return map;
  }, [pulseRows, periodMetricsByClient, needsPeriodOverride]);

  const rows: PulseRow[] = useMemo(() => {
    const expanded: PulseRow[] = [];
    for (const c of filteredByRole) {
      const services: string[] = Array.isArray(c.services) ? [...c.services] : [];
      if (c.is_seo_client === true && !services.includes("seo")) services.push("seo");
      const pulse = pulseByClient.get(c.id) ?? null;
      const hasCampaign = clientHasCampaignService(services);
      const manualOverride = activeOverrideByClient.get(c.id) ?? null;
      const goalRows = pulse ? expandPulseSnapshotToGoalRows(pulse) : [null];
      for (const goalRow of goalRows) {
        const algorithmOverall = goalRow
          ? pulseStatusToOverall(goalRow.status)
          : hasCampaign
            ? "yellow"
            : "green";
        const overall = manualOverride?.override_status ?? algorithmOverall;
        const flags = [
          ...(goalRow?.flags || pulse?.flags || []),
          ...(!pulse && hasCampaign ? ["ממתין לבדיקת דופק"] : []),
        ];
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
  }, [filteredByRole, pulseByClient, activeOverrideByClient]);

  const filtered = useMemo(() => {
    return rows
      .filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterStatus !== "all" && c.overall !== filterStatus) return false;
        if (filterService === "campaign" && !clientHasCampaignService(c.services)) return false;
        if (filterService !== "all" && filterService !== "campaign" && !c.services.includes(filterService)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rank = (s: OverallStatus) => (s === "red" ? 0 : s === "yellow" ? 1 : 2);
        return rank(a.overall) - rank(b.overall) || a.name.localeCompare(b.name, "he");
      });
  }, [rows, search, filterStatus, filterService]);

  const summary = useMemo(() => {
    const base = filterService === "campaign"
      ? rows.filter((c) => clientHasCampaignService(c.services))
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
  }, [rows, filterService]);

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

  if (clientsLoading) {
    return <div className="flex justify-center p-12 text-muted-foreground">טוען בדיקת דופק...</div>;
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">דשבורד בדיקת דופק</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {summary.total} לקוחות קמפיין פעילים
            {` · ${periodBounds.label}`}
            {period !== "last_7_days"
              ? ` (${periodBounds.startDate}–${periodBounds.endDate})`
              : ""}
            {freshness ? ` · עודכן ${freshness}` : ""}
            {summary.missingPulse > 0 ? ` · ${summary.missingPulse} ממתינים לחישוב` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => copyShareLink()}>
            <Link2 className="h-4 w-4 ml-1" />
            העתק קישור
            {selectedAgency && selectedAgency !== "all" ? " לסוכנות" : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchClients();
              refetchPulse();
              refetchOverrides();
              if (needsPeriodOverride) refetchPeriod();
            }}
          >
            <RefreshCw className="h-4 w-4 ml-1" />
            רענן
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50"
          onClick={() => setFilterStatus(filterStatus === "red" ? "all" : "red")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-3xl">🔴</span>
            <div>
              <p className="text-2xl font-bold text-red-700">{summary.red}</p>
              <p className="text-sm text-red-600">דורשים טיפול</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50"
          onClick={() => setFilterStatus(filterStatus === "yellow" ? "all" : "yellow")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-3xl">🟡</span>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{summary.yellow}</p>
              <p className="text-sm text-yellow-600">לתשומת לב</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-green-200 bg-green-50"
          onClick={() => setFilterStatus(filterStatus === "green" ? "all" : "green")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-3xl">🟢</span>
            <div>
              <p className="text-2xl font-bold text-green-700">{summary.green}</p>
              <p className="text-sm text-green-600">תקינים</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {agencies && agencies.length > 1 && (
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

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-8">סטטוס</TableHead>
                <TableHead className="text-right">סוכנות</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">יעד</TableHead>
                <TableHead className="text-right">קמפיינר</TableHead>
                <TableHead className="text-right">{pulseSpendColumnLabel(period)}</TableHead>
                <TableHead className="text-right">לידים/רכישות</TableHead>
                <TableHead className="text-right">CPL/ROAS</TableHead>
                <TableHead className="text-right">שינוי</TableHead>
                <TableHead className="text-right">שיחת לקוח אחרונה</TableHead>
                <TableHead className="text-right">שינוי במטה</TableHead>
                <TableHead className="text-right">הערה</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                    אין לקוחות להצגה
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => {
                  const pulse = client.pulse;
                  const goalRow = client.goalRow;
                  const metaSource = goalRow || pulse;
                  return (
                    <TableRow
                      key={client.id}
                      className={
                        client.overall === "red"
                          ? "bg-red-50/40"
                          : client.overall === "yellow"
                            ? "bg-yellow-50/30"
                            : ""
                      }
                    >
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusDot status={client.overall} />
                          {client.manualOverride ? (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              ידני
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {client.agencyName}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{client.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {client.manualOverride
                            ? `${goalRow ? pulseStatusLabel(goalRow.status) : pulse ? pulseStatusLabel(pulse.status) : overallStatusLabel(client.algorithmOverall)} → ${overallStatusLabel(client.overall)}`
                            : goalRow
                              ? pulseStatusLabel(goalRow.status)
                              : pulse
                                ? pulseStatusLabel(pulse.status)
                                : "🟡 ממתין לבדיקה"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {goalRow ? (
                          <Badge variant="outline" className="text-xs">
                            {goalLabel(goalRow.goal)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {client.campaignerName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {goalRow ? formatPulseMoney(goalRow.spend_7d) : pulse ? formatPulseMoney(pulse.spend_7d) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {goalRow ? formatGoalOutcomes(goalRow) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {goalRow ? formatGoalEfficiency(goalRow) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {goalRow ? formatGoalChange(goalRow) : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {pulse ? (
                          <button
                            type="button"
                            className={`text-right hover:text-primary ${
                              pulse.last_client_call_at
                                ? "underline decoration-dotted underline-offset-2"
                                : "text-amber-700 underline decoration-dotted underline-offset-2 font-medium"
                            }`}
                            onClick={() =>
                              setCallLogTarget({
                                clientId: client.clientId,
                                clientName: client.name,
                                pulse,
                              })
                            }
                          >
                            {formatLastClientCall(pulse)}
                          </button>
                        ) : (
                          "—"
                        )}
                        {pulse?.last_client_call_by ? (
                          <div className="text-muted-foreground">תיעד/ה: {pulse.last_client_call_by}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px]">
                        {metaSource ? (
                          metaSource.last_meta_change_at ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="underline decoration-dotted underline-offset-2 hover:text-primary"
                                >
                                  {metaChangeSummary(metaSource)}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 text-sm whitespace-pre-wrap" align="start">
                                {formatMetaChangeDetails(metaSource)}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            metaChangeSummary(metaSource)
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {client.flags.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            client.flags.slice(0, 4).map((flag) => (
                              <Badge
                                key={flag}
                                variant="outline"
                                className={`text-xs ${
                                  flag.includes("אין טבלת") || flag.includes("ממתין")
                                    ? "bg-amber-100 text-amber-900 border-amber-300"
                                    : ""
                                }`}
                              >
                                {flag}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 gap-1"
                            onClick={() =>
                              setOverrideTarget({
                                clientId: client.clientId,
                                clientName: client.name,
                                algorithmOverall: client.algorithmOverall,
                                pulse: client.pulse,
                                flags: client.flags,
                                activeOverride: client.manualOverride,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="text-xs">ערוך צבע</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 gap-1"
                            onClick={() => openClientCard(client.clientId)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="text-xs">פתח כרטיס</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
                ? {
                    ...row,
                    last_client_call_at: lastClientCallAt,
                    last_client_call_by: lastClientCallBy,
                  }
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
