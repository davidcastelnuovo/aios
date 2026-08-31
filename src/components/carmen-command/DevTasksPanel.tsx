import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HudPanel } from "./panels";
import {
  DevTask,
  PRIORITY_LABELS,
  STATUS_LABELS,
  devTaskAction,
  listDevTasks,
} from "@/lib/devTasks";

const OPEN_STATUSES = new Set([
  "draft", "approved", "sent_to_cursor", "in_progress", "blocked", "pr_opened", "ready_for_review",
]);

export function DevTasksPanel({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dev-tasks", tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !tenantId) return [];
      return listDevTasks(session.access_token, tenantId);
    },
    enabled: Boolean(tenantId),
    refetchInterval: 30_000,
  });

  const ACTION_LABELS: Record<string, string> = {
    approve: "אושר",
    dispatch: "נשלח ל-Cursor",
    cancel: "בוטל",
    mark_done: "הושלם",
    attach_session: "סשן קושר",
    update: "עודכן",
  };

  const runAction = useCallback(async (id: string, action: string, extra?: Record<string, unknown>) => {
    if (!tenantId) return;
    setBusyId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחובר");
      await devTaskAction(session.access_token, {
        action,
        tenant_id: tenantId,
        id,
        ...extra,
      });
      await qc.invalidateQueries({ queryKey: ["dev-tasks", tenantId] });
      toast({ title: "עודכן", description: ACTION_LABELS[action] || action });
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

  const open = tasks.filter((t) => OPEN_STATUSES.has(t.status));

  return (
    <HudPanel
      title="משימות פיתוח"
      icon={<Wrench className="h-4 w-4 text-[var(--cc-accent)]" />}
      className="min-h-0 flex-1"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--cc-text-dim)]">
          {open.length} פתוחות · ללא הגבלת מקביליות — ניהול לפי עדיפות, סטטוס ודדופ
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="cc-header-btn flex h-8 w-8 items-center justify-center rounded border border-[var(--cc-line)]"
          title="רענון"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוען משימות…</p>}
      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-[var(--cc-text-dim)]">אין משימות פיתוח עדיין. כרמן תיצור אותן מבקשות פיתוח.</p>
      )}

      <ul className="cc-scroll max-h-[min(70dvh,720px)] space-y-2 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <DevTaskCard key={task.id} task={task} busy={busyId === task.id} onAction={runAction} />
        ))}
      </ul>
    </HudPanel>
  );
}

function DevTaskCard({
  task,
  busy,
  onAction,
}: {
  task: DevTask;
  busy: boolean;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [showAttach, setShowAttach] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [prUrl, setPrUrl] = useState(task.pr_url || "");
  const [showPr, setShowPr] = useState(false);

  return (
    <li className="rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.45)] p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--cc-text)]">{task.title}</p>
          <p className="mt-1 text-[var(--cc-text-dim)]">
            {STATUS_LABELS[task.status]} · {PRIORITY_LABELS[task.priority]} · {task.assigned_agent}
            {task.requested_by ? ` · ${task.requested_by}` : ""}
          </p>
          <p className="cc-num mt-0.5 text-[10px] text-[var(--cc-text-dim)]">
            {task.base_branch} / {task.environment} · עודכן {new Date(task.updated_at).toLocaleString("he-IL")}
          </p>
          {task.dispatch_error && (
            <p className="mt-1 text-[var(--cc-warn)]">שגיאת שליחה (ניתן לקשר סשן): {task.dispatch_error.slice(0, 120)}</p>
          )}
        </div>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--cc-accent)]" />}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {task.status === "draft" && (
          <ActionBtn label="אשר" onClick={() => onAction(task.id, "approve")} disabled={busy} />
        )}
        {(task.status === "approved" || task.status === "draft") && !task.cursor_session_id && (
          <ActionBtn label="שלח ל-Cursor" onClick={() => onAction(task.id, "dispatch")} disabled={busy} />
        )}
        {task.dispatch_error && !task.cursor_session_id && (
          <ActionBtn label="נסה שוב" onClick={() => onAction(task.id, "dispatch")} disabled={busy} />
        )}
        {!task.cursor_session_id && (
          <ActionBtn label="קשר סשן" onClick={() => setShowAttach((v) => !v)} disabled={busy} />
        )}
        <ActionBtn label="עדכן PR" onClick={() => setShowPr((v) => !v)} disabled={busy} />
        {task.status !== "done" && task.status !== "cancelled" && (
          <>
            <ActionBtn label="סיים" onClick={() => onAction(task.id, "mark_done")} disabled={busy} />
            <ActionBtn label="בטל" onClick={() => onAction(task.id, "cancel")} disabled={busy} />
          </>
        )}
      </div>

      {showAttach && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="bc-… או URL מלא"
            className="min-w-[12rem] flex-1 rounded border border-[var(--cc-line)] bg-transparent px-2 py-1 text-[10px]"
          />
          <ActionBtn
            label="שמור"
            disabled={busy || !sessionId.trim()}
            onClick={() => {
              const raw = sessionId.trim();
              const match = raw.match(/bc-[a-f0-9-]+/i);
              const id = match ? match[0] : raw;
              onAction(task.id, "attach_session", {
                cursor_session_id: id,
                cursor_session_url: raw.startsWith("http") ? raw : undefined,
              }).then(() => setShowAttach(false));
            }}
          />
        </div>
      )}

      {showPr && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <input
            type="url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/…/pull/…"
            className="min-w-[12rem] flex-1 rounded border border-[var(--cc-line)] bg-transparent px-2 py-1 text-[10px]"
          />
          <ActionBtn
            label="שמור PR"
            disabled={busy || !prUrl.trim()}
            onClick={() =>
              onAction(task.id, "update", { pr_url: prUrl.trim(), status: "pr_opened" }).then(() => setShowPr(false))
            }
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-3">
        {task.cursor_session_url && (
          <a
            href={task.cursor_session_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--cc-accent)] hover:underline"
          >
            סשן Cursor
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {task.pr_url && (
          <a href={task.pr_url} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)] hover:underline">
            PR
          </a>
        )}
      </div>
    </li>
  );
}

function ActionBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[var(--cc-line)] px-2 py-0.5 text-[10px] text-[var(--cc-text)] hover:border-[var(--cc-line-strong)] disabled:opacity-40"
    >
      {label}
    </button>
  );
}
