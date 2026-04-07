/**
 * CRMAlerts
 *
 * Displays CRM health alerts for all active clients in the current tenant.
 * Shows only clients that are 🟡 or 🔴 (health score < 80).
 * Designed to be embedded in the existing alerts panel or dashboard header.
 *
 * Usage:
 *   <CRMAlerts />
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import {
  calculateHealthScore,
  FLAG_LABELS,
  FLAG_COLORS,
  OVERALL_STATUS_CONFIG,
  type FlagKey,
  type OverallStatus,
} from "@/lib/healthScore";
import { CommunicationUpdateModal } from "@/components/clients/CommunicationUpdateModal";
import { SeoUpdateModal } from "@/components/clients/SeoUpdateModal";

export function CRMAlerts() {
  const { tenantId } = useCurrentTenant();
  const [expanded, setExpanded] = useState(true);
  const [commModal, setCommModal] = useState<{ clientId: string; clientName: string } | null>(null);
  const [seoModal, setSeoModal] = useState<{ clientId: string; clientName: string } | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["crm-alerts-clients", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, tier, services")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "onboarding"]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const clientIds = clients.map((c: any) => c.id);

  const { data: commLogs = [] } = useQuery({
    queryKey: ["crm-alerts-comm", clientIds.join(","), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await supabase
        .from("communication_logs")
        .select("client_id, status, created_at")
        .in("client_id", clientIds)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 120_000,
  });

  const { data: seoUpdates = [] } = useQuery({
    queryKey: ["crm-alerts-seo", clientIds.join(","), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await supabase
        .from("seo_monthly_updates")
        .select("client_id, month, status")
        .in("client_id", clientIds)
        .eq("tenant_id", tenantId)
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 120_000,
  });

  // Build alert rows — only yellow/red clients
  const alertRows = useMemo(() => {
    return clients
      .map((c: any) => {
        const latestComm = commLogs.find((l: any) => l.client_id === c.id) ?? null;
        const daysSinceComm = latestComm
          ? differenceInDays(new Date(), new Date(latestComm.created_at))
          : null;
        const seoHistory = seoUpdates
          .filter((s: any) => s.client_id === c.id)
          .slice(0, 3)
          .map((s: any) => s.status as "up" | "stable" | "down");
        const result = calculateHealthScore({
          communicationStatus: latestComm?.status ?? null,
          daysSinceLastCommunication: daysSinceComm,
          services: c.services ?? [],
          performanceChangePct: null,
          daysSinceLastCampaignTouch: null,
          seoHistory,
        });
        return {
          ...c,
          score: result.score,
          overallStatus: result.status,
          flags: result.flags,
          daysSinceComm,
          communicationStatus: latestComm?.status ?? null,
        };
      })
      .filter((c: any) => c.overallStatus !== "green")
      .sort((a: any, b: any) => a.score - b.score);
  }, [clients, commLogs, seoUpdates]);

  if (alertRows.length === 0) return null;

  const redCount = alertRows.filter((r: any) => r.overallStatus === "red").length;
  const yellowCount = alertRows.filter((r: any) => r.overallStatus === "yellow").length;

  return (
    <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/10" dir="rtl">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            התראות CRM
            <div className="flex gap-1">
              {redCount > 0 && (
                <Badge variant="destructive" className="text-xs h-5 px-1.5">
                  🔴 {redCount}
                </Badge>
              )}
              {yellowCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs h-5 px-1.5 bg-yellow-100 text-yellow-800 border-yellow-300"
                >
                  🟡 {yellowCount}
                </Badge>
              )}
            </div>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-2">
            {alertRows.map((client: any) => (
              <div
                key={client.id}
                className={`flex items-start justify-between gap-2 p-2 rounded-md border text-sm ${
                  client.overallStatus === "red"
                    ? "bg-red-50 border-red-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-base mt-0.5 shrink-0">
                    {OVERALL_STATUS_CONFIG[client.overallStatus as OverallStatus]?.dot}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{client.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs h-4 px-1 ${
                          client.overallStatus === "red"
                            ? "bg-red-100 text-red-700 border-red-300"
                            : "bg-yellow-100 text-yellow-700 border-yellow-300"
                        }`}
                      >
                        {client.score}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(client.flags as FlagKey[]).slice(0, 3).map((flag: FlagKey) => (
                        <Badge
                          key={flag}
                          variant="outline"
                          className={`text-xs h-4 px-1 ${FLAG_COLORS[flag] || ""}`}
                        >
                          {FLAG_LABELS[flag]}
                        </Badge>
                      ))}
                      {client.flags.length > 3 && (
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          +{client.flags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setCommModal({ clientId: client.id, clientName: client.name })
                    }
                  >
                    <MessageSquare className="h-3 w-3 ml-1" />
                    תקשורת
                  </Button>
                  {(client.services ?? []).includes("seo") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setSeoModal({ clientId: client.id, clientName: client.name })
                      }
                    >
                      🔍 SEO
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {/* Modals */}
      {commModal && (
        <CommunicationUpdateModal
          clientId={commModal.clientId}
          clientName={commModal.clientName}
          open={!!commModal}
          onOpenChange={(open) => !open && setCommModal(null)}
        />
      )}
      {seoModal && (
        <SeoUpdateModal
          clientId={seoModal.clientId}
          clientName={seoModal.clientName}
          open={!!seoModal}
          onOpenChange={(open) => !open && setSeoModal(null)}
        />
      )}
    </Card>
  );
}
