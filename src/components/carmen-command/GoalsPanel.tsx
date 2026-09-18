import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ExternalLink, Loader2, Play, Plus, RefreshCw, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HudPanel } from "./panels";
import {
  AutonomousEngineSnapshot,
  CRITERION_STATUS_LABELS,
  ENGINE_STATUS_LABELS,
  ExecutionGoal,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  getExecutionGoal,
  goalExecutionAction,
  listExecutionGoals,
  runGoalIteration,
} from "@/lib/goalExecution";

export function GoalsPanel({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [autonomous, setAutonomous] = useState(true);
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
    refetchInterval: 15_000,
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
        autonomous,
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
  }, [autonomous, newTitle, qc, tenantId, toast]);

  const triggerIteration = useCallback(async (goalId: string) => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      await runGoalIteration(session.access_token, tenantId, goalId);
      await qc.invalidateQueries({ queryKey: ["execution-goal-detail", tenantId, goalId] });
      toast({ title: "איטרציה הורצה" });
    } catch (e: unknown) {
      toast({ title: "שגיאה", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [qc, tenantId, toast]);

  return (
    <HudPanel title="יעדי ביצוע" icon={<Target className="h-4 w-4 text-[var(--cc-accent)]" />} className="min-h-0 flex-1">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--cc-text-dim)]">
          כרמן מנהלת יעדים — ידני או אוטונומי (worker + Completion Gate)
        </p>
        <button type="button" onClick={() => refetch()} className="cc-header-btn ml-auto flex h-8 w-8 items-center justify-center rounded border border-[var(--cc-line)]">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
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
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--cc-text-dim)]">
          <input type="checkbox" checked={autonomous} onChange={(e) => setAutonomous(e.target.checked)} className="rounded" />
          <Bot className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
          יעד אוטונומי — כרמן ממשיכה לעבוד עד שכל הקריטריונים עוברים
        </label>
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
                  {g.autonomous_mode && g.engine_status && (
                    <> · <span className="text-[var(--cc-accent)]">אוטונומי: {ENGINE_STATUS_LABELS[g.engine_status] || g.engine_status}</span></>
                  )}
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
            <GoalDetailView
              goal={detail.goal as ExecutionGoal}
              detail={detail}
              tenantId={tenantId}
              onRunIteration={() => void triggerIteration(selectedId)}
              busy={busy}
            />
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
  onRunIteration,
  busy,
}: {
  goal: ExecutionGoal;
  detail: Record<string, unknown>;
  tenantId: string | null;
  onRunIteration: () => void;
  busy: boolean;
}) {
  const milestones = (detail.milestones as Array<{ title: string; status: string }>) || [];
  const blockers = (detail.open_blockers as Array<{ title: string }>) || [];
  const next = (detail.next_three_actions as string[]) || [];
  const tasks = (detail.linked_tasks as Array<{ id: string; title: string; status: string }>) || [];
  const devTasks = (detail.linked_dev_tasks as Array<{ id: string; title: string; status: string; pr_url?: string; cursor_session_url?: string }>) || [];
  const approvals = (detail.pending_approvals as Array<{ title: string; tool_name?: string }>) || [];
  const progress = Number(detail.progress_percent ?? goal.progress_percent ?? 0);
  const engine = detail.autonomous_engine as AutonomousEngineSnapshot | null | undefined;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-[var(--cc-accent)]">{goal.title}</h3>
          {goal.autonomous_mode && (
            <span className="rounded border border-[var(--cc-accent)] px-1.5 py-0.5 text-[10px] text-[var(--cc-accent)]">
              אוטונומי · {goal.engine_status ? (ENGINE_STATUS_LABELS[goal.engine_status] || goal.engine_status) : "—"}
            </span>
          )}
        </div>
        {goal.description && <p className="mt-1 text-[var(--cc-text-dim)]">{goal.description}</p>}
        {goal.objective && goal.objective !== goal.title && (
          <p className="mt-1 text-[var(--cc-text-dim)]">מטרה: {goal.objective}</p>
        )}
        <p className="mt-1">התקדמות: {progress}%</p>
        {goal.iteration_count != null && goal.autonomous_mode && (
          <p className="text-[var(--cc-text-dim)]">איטרציות: {goal.iteration_count}</p>
        )}
        {goal.next_action && <p className="mt-1 text-[var(--cc-warn)]">הבא: {goal.next_action}</p>}
        {goal.completion_criteria && !goal.autonomous_mode && (
          <p className="mt-1 text-[var(--cc-text-dim)]">קריטריונים: {goal.completion_criteria}</p>
        )}
        {goal.autonomous_mode && goal.engine_status !== "COMPLETED" && (
          <button type="button" onClick={onRunIteration} disabled={busy}
            className="mt-2 flex items-center gap-1 rounded border border-[var(--cc-line)] px-2 py-1 text-[10px] hover:border-[var(--cc-accent)]">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            הרץ איטרציה עכשיו
          </button>
        )}
      </div>

      {engine?.criteria?.length ? (
        <section>
          <p className="font-semibold">קריטריוני הצלחה (Completion Gate)</p>
          <ul className="mt-1 space-y-1">
            {engine.criteria.map((c) => (
              <li key={c.id} className="text-[var(--cc-text-dim)]">
                • {c.description}
                <span className={c.status === "PASS" ? " text-green-400" : c.status === "FAIL" ? " text-red-400" : ""}>
                  {" "}({CRITERION_STATUS_LABELS[c.status]})
                </span>
              </li>
            ))}
          </ul>
          {engine.completion_gate?.complete && (
            <p className="mt-1 text-green-400">✓ כל הקריטריונים עברו — הושלם</p>
          )}
        </section>
      ) : null}

      {engine?.recent_iterations?.length ? (
        <section>
          <p className="font-semibold">איטרציות אחרונות</p>
          <ul className="mt-1 space-y-1">
            {engine.recent_iterations.map((it) => (
              <li key={it.iteration_number} className="text-[var(--cc-text-dim)]">
                #{it.iteration_number} {it.phase} — {it.summary || it.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
