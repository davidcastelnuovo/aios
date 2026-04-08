/**
 * DMMDashboard — Agency CRM Overview
 *
 * Main screen for the DMM agency CRM.
 * Shows all active clients with:
 *  - Traffic-light status (🟢/🟡/🔴)
 *  - Health Score (0–100)
 *  - Active Flags
 *  - Last communication date
 *  - Quick action buttons (update communication / update SEO)
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { differenceInDays, format } from "date-fns";
import { he } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Search, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  calculateHealthScore,
  FLAG_LABELS,
  FLAG_COLORS,
  OVERALL_STATUS_CONFIG,
  TIER_COLORS,
  SERVICE_LABELS,
  COMMUNICATION_STATUS_LABELS,
  COMMUNICATION_STATUS_COLORS,
  SEO_STATUS_LABELS,
  SEO_STATUS_COLORS,
  type FlagKey,
  type OverallStatus,
} from "@/lib/healthScore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  name: string;
  tier: string | null;
  services: string[];
  mood_status: string | null;
  status: string;
  // joined
  campaignerName: string;
  // computed
  communicationStatus: "normal" | "sensitive" | "complaint" | null;
  lastCommDate: string | null;
  daysSinceComm: number | null;
  seoHistory: Array<"up" | "stable" | "down">;
  performanceChangePct: number | null;
  healthScore: number;
  overallStatus: OverallStatus;
  flags: FlagKey[];
}

type CRMClientFields = {
  id: string;
  tier?: string | null;
  services?: string[] | null;
  mood_status?: string | null;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: OverallStatus }) {
  const cfg = OVERALL_STATUS_CONFIG[status];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xl cursor-default">{cfg.dot}</span>
        </TooltipTrigger>
        <TooltipContent>{cfg.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreBadge({ score, status }: { score: number; status: OverallStatus }) {
  const colors: Record<OverallStatus, string> = {
    green: "bg-green-100 text-green-800 border-green-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    red: "bg-red-100 text-red-800 border-red-300",
  };
  return (
    <Badge variant="outline" className={`font-bold text-base px-2 ${colors[status]}`}>
      {score}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DMMDashboard() {
  const { tenantId } = useCurrentTenant();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { selectedAgency, setSelectedAgency, agencies } = useAgency();
  const { isOwner, isTeamManager, isSuperAdmin, isCampaigner, isSeo, campaignerId } = useUserRole();
  const { userAgencyIds } = useUserAgencies();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | OverallStatus>("all");
  const [filterTier, setFilterTier] = useState<"all" | "A" | "B" | "C">("all");
  const [filterService, setFilterService] = useState<"all" | "performance" | "seo" | "social">("all");

  // Navigate to the client module with the selected client pre-opened
  function openClientCard(clientId: string, tab: "updates" | "details" = "updates") {
    navigate(buildPath(`/clients?clientId=${clientId}&tab=${tab}`));
  }

  // ── Fetch clients (base: always-safe fields) ──────────────────────────────
  const { data: rawClients = [], isLoading: clientsLoading, refetch } = useQuery({
    queryKey: ["dmm-clients", tenantId, selectedAgency, userAgencyIds],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("clients")
        .select(`
          id, name, status, agency_id,
          client_team (
            campaigner_id,
            campaigners ( full_name )
          )
        `)
        .eq("tenant_id", tenantId)
        .in("status", ["active", "onboarding"])
        .order("name");

      // Agency filter
      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      } else if (userAgencyIds && userAgencyIds.length > 0) {
        // Non-owner users: restrict to their agencies
        query = query.in("agency_id", userAgencyIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ── Campaigner client filtering ───────────────────────────────────────────
  const needsCampaignerFilter = (isCampaigner || isSeo) && !isOwner && !isTeamManager && !isSuperAdmin;
  
  const campaignerClientIds = useMemo(() => {
    if (!needsCampaignerFilter || !campaignerId) return null;
    const ids = new Set<string>();
    rawClients.forEach((c: any) => {
      c.client_team?.forEach((ct: any) => {
        if (ct.campaigner_id === campaignerId) {
          ids.add(c.id);
        }
      });
    });
    return ids;
  }, [rawClients, needsCampaignerFilter, campaignerId]);

  const filteredByRole = useMemo(() => {
    if (!needsCampaignerFilter || !campaignerClientIds) return rawClients;
    return rawClients.filter((c: any) => campaignerClientIds.has(c.id));
  }, [rawClients, needsCampaignerFilter, campaignerClientIds]);

  // ── Fetch CRM extended fields (tier, services, mood_status) ────────────────
  // These columns are added by migration 20260407_dmm_crm_adaptation.sql
  // If migration hasn't run yet, errors are silently ignored — fields stay null/empty
  const { data: crmFields = [] } = useQuery({
    queryKey: ["dmm-clients-crm-fields", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id, tier, services, mood_status")
          .eq("tenant_id", tenantId)
          .in("status", ["active", "onboarding"]);
        if (error) return []; // columns not yet created — graceful fallback
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const clientIds = filteredByRole.map((c: any) => c.id);

  // ── Fetch latest communication log per client ──────────────────────────────
  const { data: commLogs = [] } = useQuery({
    queryKey: ["communication-logs-latest", clientIds.join(","), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("communication_logs")
        .select("client_id, status, created_at")
        .in("client_id", clientIds)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 60_000,
  });

  // ── Fetch SEO history per client ───────────────────────────────────────────
  const { data: seoUpdates = [] } = useQuery({
    queryKey: ["seo-monthly-latest", clientIds.join(","), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("seo_monthly_updates")
        .select("client_id, month, status")
        .in("client_id", clientIds)
        .eq("tenant_id", tenantId)
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 60_000,
  });

  // ── Fetch campaign performance data from CRM tables ────────────────────────
  const { data: perfData = {} } = useQuery({
    queryKey: ["dmm-performance-data", clientIds.join(","), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return {};
      // 1. Get all Facebook CRM tables for this tenant
      const { data: crmTables } = await supabase
        .from("crm_tables")
        .select("id, client_id")
        .eq("tenant_id", tenantId)
        .ilike("slug", "%facebook%");
      if (!crmTables?.length) return {};

      // 2. Get records for those tables
      const tableIds = crmTables.map((t: any) => t.id);
      const { data: records } = await supabase
        .from("crm_records")
        .select("table_id, data")
        .in("table_id", tableIds)
        .eq("tenant_id", tenantId);
      if (!records?.length) return {};

      // 3. Build client→table mapping
      const tableToClient: Record<string, string> = {};
      for (const t of crmTables) {
        if (t.client_id) tableToClient[t.id] = t.client_id;
      }

      // 4. Group records by client and compute 7d vs older daily avg spend change
      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      const d7Str = d7.toISOString().split("T")[0];
      const d30Str = d30.toISOString().split("T")[0];

      const byClient: Record<string, { spend7: number; spendOlder: number; days7: number; daysOlder: number }> = {};
      for (const r of records) {
        const clientId = tableToClient[r.table_id];
        if (!clientId) continue;
        const date = (r.data as any)?.date;
        if (!date || date < d30Str) continue;
        if (!byClient[clientId]) byClient[clientId] = { spend7: 0, spendOlder: 0, days7: 0, daysOlder: 0 };
        const spend = parseFloat((r.data as any)?.spend) || 0;
        if (date >= d7Str) {
          byClient[clientId].spend7 += spend;
          byClient[clientId].days7++;
        } else {
          byClient[clientId].spendOlder += spend;
          byClient[clientId].daysOlder++;
        }
      }

      const result: Record<string, number | null> = {};
      for (const [cid, d] of Object.entries(byClient)) {
        if (d.daysOlder > 0 && d.days7 > 0) {
          const dailyAvg7 = d.spend7 / d.days7;
          const dailyAvgOlder = d.spendOlder / d.daysOlder;
          result[cid] = dailyAvgOlder > 0
            ? Math.round((dailyAvg7 - dailyAvgOlder) / dailyAvgOlder * 1000) / 10
            : null;
        } else {
          result[cid] = null;
        }
      }
      return result;
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 120_000,
  });

  // ── Build enriched client rows ─────────────────────────────────────────────
  const clients: ClientRow[] = useMemo(() => {
    return filteredByRole.map((c: any) => {
      // Merge CRM extended fields (tier, services, mood_status)
      // Falls back to null/empty if migration hasn't run yet
      const ext = (crmFields.find((f: any) => f.id === c.id) ?? {}) as CRMClientFields;
      const tier: string | null = ext.tier ?? null;
      const services: string[] = ext.services ?? [];
      const mood_status: string | null = ext.mood_status ?? null;

      // Latest comm log
      const latestComm = commLogs.find((l: any) => l.client_id === c.id) ?? null;
      const daysSinceComm = latestComm
        ? differenceInDays(new Date(), new Date(latestComm.created_at))
        : null;

      // SEO history (last 3 months)
      const seoHistory = seoUpdates
        .filter((s: any) => s.client_id === c.id)
        .slice(0, 3)
        .map((s: any) => s.status as "up" | "stable" | "down");

      // Campaigner name
      const campaignerName =
        c.client_team?.[0]?.campaigners?.full_name ?? "—";

      // Performance change from CRM records
      const performanceChangePct = (perfData as Record<string, number | null>)[c.id] ?? null;

      // Health score — uses mood_status as fallback comm status if no log exists
      const result = calculateHealthScore({
        communicationStatus: latestComm?.status ?? mood_status ?? null,
        daysSinceLastCommunication: daysSinceComm,
        services,
        performanceChangePct,
        daysSinceLastCampaignTouch: null,
        seoHistory,
      });

      return {
        id: c.id,
        name: c.name,
        tier,
        services,
        mood_status,
        status: c.status,
        campaignerName,
        communicationStatus: latestComm?.status ?? mood_status ?? null,
        lastCommDate: latestComm?.created_at ?? null,
        daysSinceComm,
        seoHistory,
        performanceChangePct,
        healthScore: result.score,
        overallStatus: result.status,
        flags: result.flags,
      } as ClientRow;
    });
  }, [filteredByRole, crmFields, commLogs, seoUpdates, perfData]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return clients
      .filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterStatus !== "all" && c.overallStatus !== filterStatus) return false;
        if (filterTier !== "all" && c.tier !== filterTier) return false;
        if (filterService !== "all" && !c.services.includes(filterService)) return false;
        return true;
      })
      .sort((a, b) => a.healthScore - b.healthScore); // worst first
  }, [clients, search, filterStatus, filterTier, filterService]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    red: clients.filter((c) => c.overallStatus === "red").length,
    yellow: clients.filter((c) => c.overallStatus === "yellow").length,
    green: clients.filter((c) => c.overallStatus === "green").length,
  }), [clients]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (clientsLoading) {
    return <div className="flex justify-center p-12 text-muted-foreground">טוען נתוני לקוחות...</div>;
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">דשבורד CRM סוכנות</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {clients.length} לקוחות פעילים
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 ml-1" />
          רענן
        </Button>
      </div>

      {/* Summary Cards */}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Agency filter - uses global AgencyContext */}
        {agencies && agencies.length > 1 && (
          <Select value={selectedAgency} onValueChange={(v) => {
            const { setSelectedAgency } = useAgency();
            setSelectedAgency(v);
          }}>
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
        <Select value={filterTier} onValueChange={(v) => setFilterTier(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="כל הדרגות" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל הדרגות</SelectItem>
            <SelectItem value="A">Tier A</SelectItem>
            <SelectItem value="B">Tier B</SelectItem>
            <SelectItem value="C">Tier C</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterService} onValueChange={(v) => setFilterService(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="כל השירותים" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל השירותים</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="seo">SEO</SelectItem>
            <SelectItem value="social">Social</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-8">סטטוס</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">קמפיינר</TableHead>
                <TableHead className="text-right">שירותים</TableHead>
                <TableHead className="text-right w-16">ציון</TableHead>
                <TableHead className="text-right">Flags</TableHead>
                <TableHead className="text-right">תקשורת</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    אין לקוחות להצגה
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow
                    key={client.id}
                    className={
                      client.overallStatus === "red"
                        ? "bg-red-50/40"
                        : client.overallStatus === "yellow"
                        ? "bg-yellow-50/30"
                        : ""
                    }
                  >
                    {/* Status dot */}
                    <TableCell className="text-center">
                      <StatusDot status={client.overallStatus} />
                    </TableCell>

                    {/* Client name + tier */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{client.name}</span>
                        {client.tier && (
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 ${TIER_COLORS[client.tier] || ""}`}
                          >
                            {client.tier}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Campaigner */}
                    <TableCell className="text-sm text-muted-foreground">
                      {client.campaignerName}
                    </TableCell>

                    {/* Services */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {client.services.map((svc) => (
                          <Badge key={svc} variant="secondary" className="text-xs">
                            {SERVICE_LABELS[svc] || svc}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    {/* Health Score */}
                    <TableCell>
                      <ScoreBadge score={client.healthScore} status={client.overallStatus} />
                    </TableCell>

                    {/* Flags */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {client.flags.slice(0, 4).map((flag) => (
                          <Badge
                            key={flag}
                            variant="outline"
                            className={`text-xs ${FLAG_COLORS[flag] || ""}`}
                          >
                            {FLAG_LABELS[flag]}
                          </Badge>
                        ))}
                        {client.flags.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{client.flags.length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Communication status + date */}
                    <TableCell>
                      <div className="space-y-1">
                        {client.communicationStatus ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              COMMUNICATION_STATUS_COLORS[client.communicationStatus] || ""
                            }`}
                          >
                            {COMMUNICATION_STATUS_LABELS[client.communicationStatus]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            אין רשומה
                          </Badge>
                        )}
                        {client.lastCommDate && (
                          <p className="text-xs text-muted-foreground">
                            {client.daysSinceComm === 0
                              ? "היום"
                              : `לפני ${client.daysSinceComm} ימים`}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions — navigate to client card */}
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 gap-1"
                              onClick={() => openClientCard(client.id, "updates")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="text-xs">פתח כרטיס</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>פתח כרטיס לקוח במודול לקוחות</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
