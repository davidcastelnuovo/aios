import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HudPanel } from "./panels";
import {
  listOperationRuns,
  OP_TYPE_LABELS,
  ROLLUP_LABELS,
  syncDevTaskOperationRuns,
} from "@/lib/operationControl";

export function CoclRunsPanel({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cocl-runs", tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !tenantId) return { runs: [], summary: { count: 0, needs_attention: 0 } };
      return listOperationRuns(session.access_token, tenantId, { since_hours: 168 });
    },
    enabled: Boolean(tenantId),
    refetchInterval: 60_000,
  });

  const runs = data?.runs ?? [];
  const needsAttention = data?.summary?.needs_attention ?? 0;

  const syncFromDevTasks = useCallback(async () => {
    if (!tenantId) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      const result = await syncDevTaskOperationRuns(session.access_token, tenantId);
      await qc.invalidateQueries({ queryKey: ["cocl-runs", tenantId] });
      toast({
        title: "סנכרון COCL",
        description: `${result.synced} dispatch מ-dev_tasks`,
      });
    } catch (e: unknown) {
      toast({
        title: "שגיאה",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [qc, tenantId, toast]);

  return (
    <HudPanel
      title="ריצות COCL (PEVR)"
      icon={<Activity className="h-4 w-4 text-[var(--cc-accent)]" />}
      className="min-h-0 flex-1"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--cc-text-dim)]">
          {runs.length} ריצות · 7 ימים
          {needsAttention > 0 && (
            <span className="mr-2 text-[var(--cc-warn)]"> · {needsAttention} דורשות טיפול</span>
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
            onClick={syncFromDevTasks}
            disabled={syncing}
            className="cc-header-btn rounded border border-[var(--cc-line)] px-2 text-xs"
          >
            {syncing ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : "סנכרון dispatch"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוען…</p>}
      {!isLoading && runs.length === 0 && (
        <p className="text-sm text-[var(--cc-text-dim)]">
          אין ריצות עדיין. אחרי מיגרציה — «סנכרון dispatch» או dispatch חדש מכרמן.
        </p>
      )}

      <ul className="cc-scroll max-h-[min(70dvh,720px)] space-y-2 overflow-y-auto pr-1">
        {runs.map((run) => {
          const opType = run.operation_plans?.operation_type || "custom";
          const sessionUrl = run.metadata?.session_url;
          return (
            <li
              key={run.id}
              className="rounded-lg border border-[var(--cc-line)] bg-[var(--cc-panel)] p-3 text-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-medium leading-snug">{run.title || run.id.slice(0, 8)}</span>
                <span
                  className={`shrink-0 text-[10px] ${
                    run.rollup_status === "needs_attention" ? "text-[var(--cc-warn)]" : "text-[var(--cc-text-dim)]"
                  }`}
                >
                  {ROLLUP_LABELS[run.rollup_status] || run.rollup_status}
                </span>
              </div>
              <p className="text-[11px] text-[var(--cc-text-dim)]">
                {OP_TYPE_LABELS[opType] || opType} · {run.status}
              </p>
              {run.summary && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-dim)]">{run.summary}</p>
              )}
              {sessionUrl && (
                <a
                  href={sessionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--cc-accent)]"
                >
                  Cursor session
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </HudPanel>
  );
}
