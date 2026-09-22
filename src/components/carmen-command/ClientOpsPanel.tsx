import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HudPanel } from "./panels";
import {
  ClientOperationRecommendation,
  SEVERITY_LABELS,
  clientOpsAction,
  listClientOperationRecommendations,
  scanTenantClientOperations,
} from "@/lib/clientOperations";

export function ClientOpsPanel({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: recommendations = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["client-ops-rec", tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !tenantId) return [];
      return listClientOperationRecommendations(session.access_token, tenantId);
    },
    enabled: Boolean(tenantId),
    refetchInterval: 45_000,
  });

  const runScan = useCallback(async () => {
    if (!tenantId) return;
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      const result = await scanTenantClientOperations(session.access_token, tenantId, { client_limit: 50 });
      await qc.invalidateQueries({ queryKey: ["client-ops-rec", tenantId] });
      toast({
        title: "סריקה הושלמה",
        description: `${result.scanned} לקוחות · ${result.summary.open_recommendations} המלצות פתוחות`,
      });
    } catch (e: unknown) {
      toast({
        title: "שגיאה",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  }, [qc, tenantId, toast]);

  const dismiss = useCallback(async (rec: ClientOperationRecommendation) => {
    if (!tenantId) return;
    setBusyId(rec.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      await clientOpsAction(session.access_token, {
        action: "update_recommendation",
        tenant_id: tenantId,
        recommendation_id: rec.id,
        status: "dismissed",
      });
      await qc.invalidateQueries({ queryKey: ["client-ops-rec", tenantId] });
    } catch (e: unknown) {
      toast({
        title: "שגיאה",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }, [qc, tenantId, toast]);

  const syncWeekly = useCallback(async (rec: ClientOperationRecommendation) => {
    if (!tenantId) return;
    setBusyId(rec.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      const messageAt = (rec.evidence as { message_at?: string })?.message_at;
      await clientOpsAction(session.access_token, {
        action: "sync_weekly_from_group",
        tenant_id: tenantId,
        client_id: rec.client_id,
        message_at: messageAt,
        dry_run: false,
      });
      await clientOpsAction(session.access_token, {
        action: "update_recommendation",
        tenant_id: tenantId,
        recommendation_id: rec.id,
        status: "resolved",
      });
      await qc.invalidateQueries({ queryKey: ["client-ops-rec", tenantId] });
      toast({ title: "עודכן", description: "עדכון שבועי נמשך לכרטיס הלקוח" });
    } catch (e: unknown) {
      toast({
        title: "שגיאה",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }, [qc, tenantId, toast]);

  const commitmentFollowup = useCallback(async (rec: ClientOperationRecommendation) => {
    if (!tenantId) return;
    setBusyId(rec.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      const messageAt = (rec.evidence as { message_at?: string })?.message_at;
      if (!messageAt) throw new Error("חסר message_at");
      await clientOpsAction(session.access_token, {
        action: "create_commitment_followup",
        tenant_id: tenantId,
        client_id: rec.client_id,
        message_at: messageAt,
      });
      await clientOpsAction(session.access_token, {
        action: "update_recommendation",
        tenant_id: tenantId,
        recommendation_id: rec.id,
        status: "resolved",
      });
      await qc.invalidateQueries({ queryKey: ["client-ops-rec", tenantId] });
      toast({ title: "נוצר", description: "משימה + עדכון בכרטיס" });
    } catch (e: unknown) {
      toast({
        title: "שגיאה",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }, [qc, tenantId, toast]);

  const critical = recommendations.filter((r) => r.severity === "critical");

  return (
    <HudPanel
      title="תפעול לקוחות"
      icon={<ClipboardList className="h-4 w-4 text-[var(--cc-accent)]" />}
      className="min-h-0 flex-1"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--cc-text-dim)]">
          {recommendations.length} המלצות פתוחות
          {critical.length > 0 && (
            <span className="mr-2 text-[var(--cc-warn)]">
              · {critical.length} קריטיות
            </span>
          )}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="cc-header-btn flex h-8 w-8 items-center justify-center rounded border border-[var(--cc-line)]"
            title="רענון"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={runScan}
            disabled={scanning}
            className="cc-header-btn rounded border border-[var(--cc-accent)] px-2 text-xs text-[var(--cc-accent)]"
          >
            {scanning ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : "סריקת לקוחות"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוען…</p>}
      {!isLoading && recommendations.length === 0 && (
        <p className="text-sm text-[var(--cc-text-dim)]">
          אין המלצות. הריצו סריקה או בקשו מכרמן «תמונת תפעול» ללקוח.
        </p>
      )}

      <ul className="cc-scroll max-h-[min(70dvh,720px)] space-y-2 overflow-y-auto pr-1">
        {recommendations.map((rec) => (
          <li
            key={rec.id}
            className="rounded-lg border border-[var(--cc-line)] bg-[var(--cc-panel)] p-3 text-sm"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="font-medium leading-snug">{rec.title}</span>
              <span
                className={`shrink-0 text-[10px] uppercase ${
                  rec.severity === "critical" ? "text-red-400" : "text-[var(--cc-text-dim)]"
                }`}
              >
                {SEVERITY_LABELS[rec.severity] || rec.severity}
              </span>
            </div>
            {rec.client_name && (
              <p className="text-xs text-[var(--cc-text-dim)]">{rec.client_name}</p>
            )}
            {rec.body && (
              <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-dim)]">{rec.body}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {rec.suggested_tool === "sync_weekly_update_from_green_group" && (
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => syncWeekly(rec)}
                  className="rounded border border-[var(--cc-line)] px-2 py-0.5 text-[11px] hover:border-[var(--cc-accent)]"
                >
                  משוך לכרטיס
                </button>
              )}
              {rec.suggested_tool === "create_commitment_followup" && (
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => commitmentFollowup(rec)}
                  className="rounded border border-[var(--cc-line)] px-2 py-0.5 text-[11px] hover:border-[var(--cc-accent)]"
                >
                  משימה + עדכון
                </button>
              )}
              <button
                type="button"
                disabled={busyId === rec.id}
                onClick={() => dismiss(rec)}
                className="rounded border border-[var(--cc-line)] px-2 py-0.5 text-[11px] text-[var(--cc-text-dim)]"
              >
                התעלם
              </button>
            </div>
          </li>
        ))}
      </ul>

      {critical.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--cc-warn)]">
          <AlertTriangle className="h-3 w-3" />
          כרמן תדווח גם ב-WhatsApp לפי skin — Green API קריאה בלבד
        </p>
      )}
    </HudPanel>
  );
}
