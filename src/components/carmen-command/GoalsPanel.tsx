import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, RefreshCw, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HudPanel } from "./panels";
import {
  ExecutionGoal,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  getExecutionGoal,
  goalExecutionAction,
  listExecutionGoals,
} from "@/lib/goalExecution";

export function GoalsPanel({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: goals = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["execution-goals", tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !tenantId) return [];
      return listExecutionGoals(session.access_token, tenantId);
    },
    enabled: Boolean(tenantId),
    refetchInterval: 30_000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["execution-goal-detail", tenantId, selectedId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !tenantId || !selectedId) return null;
      return getExecutionGoal(session.access_token, tenantId, selectedId);
    },
    enabled: Boolean(tenantId && selectedId),
  });

  const createGoal = useCallback(async () => {
    if (!tenantId || !newTitle.trim()) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      const result = await goalExecutionAction(session.access_token, {
        action: "create",
        tenant_id: tenantId,
        title: newTitle.trim(),
        execution_mode: true,
      }) as { goal: ExecutionGoal; possible_duplicates?: unknown[] };
      if (result.possible_duplicates?.length) {
        toast({ title: "נוצר — ייתכן שיש יעד דומה", description: "בדקי כפילויות לפני פתיחת משימות נוספות." });
      }
      setNewTitle("");
      setSelectedId(result.goal.id);
      await qc.invalidateQueries({ queryKey: ["execution-goals", tenantId] });
    } catch (e: unknown) {
      toast({ title: "שגיאה", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [newTitle, qc, tenantId, toast]);

  return (
    <HudPanel title="יעדי ביצוע" icon={<Target className="h-4 w-4 text-[var(--cc-accent)]" />} className="min-h-0 flex-1">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--cc-text-dim)]">
          כרמן מנהלת יעדים, אבני דרך, חסמים ומשימות — בלי הגבלת מקביליות ב-Cursor
        </p>
        <button type="button" onClick={() => refetch()} className="cc-header-btn ml-auto flex h-8 w-8 items-center justify-center rounded border border-[var(--cc-line)]">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="יעד חדש…"
          className="min-w-0 flex-1 rounded border border-[var(--cc-line)] bg-transparent px-2 py-1.5 text-sm"
          onKeyDown={(e) => e.key === "Enter" && void createGoal()}
        />
        <button type="button" onClick={() => void createGoal()} disabled={busy || !newTitle.trim()}
          className="flex items-center gap-1 rounded border border-[var(--cc-accent)] px-2 py-1 text-xs text-[var(--cc-accent)] disabled:opacity-40">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          צור
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
        <ul className="cc-scroll max-h-[min(50dvh,480px)] space-y-1 overflow-y-auto pr-1">
          {isLoading && <li className="text-sm text-[var(--cc-text-dim)]">טוען…</li>}
          {goals.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setSelectedId(g.id)}
                className={`w-full rounded border p-2 text-right text-xs transition-colors ${selectedId === g.id ? "border-[var(--cc-accent)] bg-[rgba(76,195,255,0.08)]" : "border-[var(--cc-line)] hover:border-[var(--cc-line-strong)]"}`}>
                <p className="font-semibold text-[var(--cc-text)]">{g.title}</p>
                <p className="text-[var(--cc-text-dim)]">
                  {GOAL_STATUS_LABELS[g.status]} · {GOAL_PRIORITY_LABELS[g.priority] || g.priority}
                  {g.due_date ? ` · יעד ${g.due_date}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="cc-scroll max-h-[min(50dvh,480px)] overflow-y-auto rounded border border-[var(--cc-line)] p-3 text-xs">
          {!selectedId && <p className="text-[var(--cc-text-dim)]">בחרי יעד לפרטים</p>}
          {selectedId && detailLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {detail?.goal && (
            <GoalDetailView goal={detail.goal as ExecutionGoal} detail={detail} tenantId={tenantId} />
          )}
        </div>
      </div>
    </HudPanel>
  );
}

function GoalDetailView({
  goal,
  detail,
  tenantId,
}: {
  goal: ExecutionGoal;
  detail: Record<string, unknown>;
  tenantId: string | null;
}) {
  const milestones = (detail.milestones as Array<{ title: string; status: string }>) || [];
  const blockers = (detail.open_blockers as Array<{ title: string }>) || [];
  const next = (detail.next_three_actions as string[]) || [];
  const tasks = (detail.linked_tasks as Array<{ id: string; title: string; status: string }>) || [];
  const devTasks = (detail.linked_dev_tasks as Array<{ id: string; title: string; status: string; pr_url?: string; cursor_session_url?: string }>) || [];
  const approvals = (detail.pending_approvals as Array<{ title: string; tool_name?: string }>) || [];
  const progress = Number(detail.progress_percent ?? goal.progress_percent ?? 0);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--cc-accent)]">{goal.title}</h3>
        {goal.description && <p className="mt-1 text-[var(--cc-text-dim)]">{goal.description}</p>}
        <p className="mt-1">התקדמות: {progress}%</p>
        {goal.next_action && <p className="mt-1 text-[var(--cc-warn)]">הבא: {goal.next_action}</p>}
        {goal.completion_criteria && <p className="mt-1 text-[var(--cc-text-dim)]">קריטריונים: {goal.completion_criteria}</p>}
      </div>

      {milestones.length > 0 && (
        <section>
          <p className="font-semibold">אבני דרך</p>
          <ul className="mt-1 space-y-1">
            {milestones.map((m, i) => (
              <li key={i} className="text-[var(--cc-text-dim)]">• {m.title} ({m.status})</li>
            ))}
          </ul>
        </section>
      )}

      {blockers.length > 0 && (
        <section>
          <p className="font-semibold text-[var(--cc-crit)]">חסמים פתוחים</p>
          <ul className="mt-1 space-y-1">
            {blockers.map((b, i) => <li key={i}>• {b.title}</li>)}
          </ul>
        </section>
      )}

      {next.length > 0 && (
        <section>
          <p className="font-semibold">3 פעולות הבאות</p>
          <ol className="mt-1 list-decimal pr-4">
            {next.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </section>
      )}

      {approvals.length > 0 && (
        <section>
          <p className="font-semibold text-[var(--cc-warn)]">ממתין לאישור דוד</p>
          <ul className="mt-1 space-y-1">
            {approvals.map((a, i) => <li key={i}>• {a.title || a.tool_name}</li>)}
          </ul>
        </section>
      )}

      {(tasks.length > 0 || devTasks.length > 0) && (
        <section>
          <p className="font-semibold">משימות מקושרות</p>
          {tasks.map((t) => <p key={t.id} className="text-[var(--cc-text-dim)]">📋 {t.title} ({t.status})</p>)}
          {devTasks.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              <span>🛠 {d.title} ({d.status})</span>
              {d.cursor_session_url && (
                <a href={d.cursor_session_url} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)]">
                  Cursor <ExternalLink className="inline h-3 w-3" />
                </a>
              )}
              {d.pr_url && <a href={d.pr_url} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)]">PR</a>}
            </div>
          ))}
        </section>
      )}

      {!tenantId && null}
    </div>
  );
}
