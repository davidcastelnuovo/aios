import { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, Circle, CircleAlert,
  Cpu, Database, HeartPulse, Info, ListTodo, MessageCircle, Mic,
  PlusCircle, ScrollText, Bot, Zap,
} from "lucide-react";
import {
  useCoreOverview, useIntelFeed, useHealth, useCcTasks, useMarkTaskDone,
  useTimeline, Severity, ServiceHealth,
} from "./useCommandData";

/* ---------------- Shared panel shell ---------------- */

export function HudPanel({ title, icon, children, className = "" }: {
  title: string; icon?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`cc-panel flex flex-col p-3 ${className}`}>
      <header className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="cc-panel-title">{title}</h2>
        <span className="cc-title-line" aria-hidden />
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function PanelState({ loading, error, empty, emptyText }: {
  loading?: boolean; error?: boolean; empty?: boolean; emptyText?: string;
}) {
  if (loading) return <p className="text-sm text-[var(--cc-text-dim)]">טוענת נתונים…</p>;
  if (error) return <p className="text-sm text-[var(--cc-warn)]">המקור לא זמין כרגע</p>;
  if (empty) return <p className="text-sm text-[var(--cc-text-dim)]">{emptyText ?? "אין נתונים"}</p>;
  return null;
}

/* ---------------- Core overview ---------------- */

const MOOD_LABELS: Record<string, string> = {
  fun: "מצב רוח: כיפי", focused: "מצב רוח: ממוקד", tired: "מצב רוח: עייף",
  angry: "מצב רוח: זועף", random: "מצב רוח: אקראי",
};

export function CoreOverviewPanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError } = useCoreOverview(tenantId);
  const items = data ? [
    { label: "סטטוס", value: "פעילה", ok: true, icon: <Activity className="h-3.5 w-3.5" /> },
    { label: "זיכרון", value: `${data.memoryCount.toLocaleString("he-IL")} פריטים`, ok: data.memoryCount > 0, icon: <Brain className="h-3.5 w-3.5" /> },
    { label: "קול", value: data.agent?.voice ?? "shimmer", ok: true, icon: <Mic className="h-3.5 w-3.5" /> },
    { label: "סוכנים", value: `${data.agentsCount}`, ok: data.agentsCount > 0, icon: <Bot className="h-3.5 w-3.5" /> },
    { label: "LLM", value: data.llmConfigured ? (data.llmActive ? "מחובר" : "מושבת") : "ברירת מחדל", ok: !data.llmConfigured || data.llmActive, icon: <Cpu className="h-3.5 w-3.5" /> },
    { label: "שיחות WA", value: `${data.activeSessions} פעילות`, ok: true, icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { label: "התקבלו היום", value: `${data.inboundToday.toLocaleString("he-IL")}`, ok: true, icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { label: "נענו היום", value: `${data.outboundToday.toLocaleString("he-IL")}`, ok: true, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ] : [];

  return (
    <HudPanel title="CORE OVERVIEW" icon={<Cpu className="h-4 w-4 text-[var(--cc-accent)]" />}>
      <PanelState loading={isLoading} error={isError} />
      {data && (
        <>
          {data.agent?.mood && MOOD_LABELS[data.agent.mood] && (
            <p className="mb-2 text-xs text-[var(--cc-text-dim)]">{MOOD_LABELS[data.agent.mood]}</p>
          )}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
            {items.map((it) => (
              <li key={it.label} className="flex items-center gap-1.5">
                <span className={it.ok ? "text-[var(--cc-ok)]" : "text-[var(--cc-warn)]"}>{it.icon}</span>
                <span className="text-[var(--cc-text-dim)]">{it.label}:</span>
                <span className="font-medium">{it.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </HudPanel>
  );
}

/* ---------------- Intel feed ---------------- */

const SEV_STYLE: Record<Severity, { icon: ReactNode; color: string; label: string }> = {
  critical: { icon: <CircleAlert className="h-4 w-4" />, color: "var(--cc-crit)", label: "תקלה" },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, color: "var(--cc-warn)", label: "אזהרה" },
  info: { icon: <Info className="h-4 w-4" />, color: "var(--cc-ok)", label: "עדכון" },
};

export function IntelFeedPanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError } = useIntelFeed(tenantId);
  return (
    <HudPanel title="פיד מודיעין חי" icon={<ScrollText className="h-4 w-4 text-[var(--cc-accent)]" />} className="min-h-0">
      <PanelState loading={isLoading} error={isError} empty={data?.length === 0} emptyText="שקט בחזית — אין אזהרות פעילות ✨" />
      <ul className="cc-scroll flex h-full max-h-full flex-col gap-1.5 overflow-y-auto pl-1">
        {data?.map((item) => {
          const s = SEV_STYLE[item.severity];
          return (
            <li key={item.id} className="flex items-start gap-2 rounded-md border border-transparent p-1.5 text-sm hover:border-[var(--cc-line)]">
              <span style={{ color: s.color }} className="mt-0.5 shrink-0" title={s.label}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate leading-snug">{item.title}</p>
                <p className="text-xs text-[var(--cc-text-dim)]">
                  {item.source} · {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: he })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </HudPanel>
  );
}

/* ---------------- Heartbeats / health ---------------- */

const STATUS_META: Record<ServiceHealth["status"], { color: string; label: string; icon: ReactNode }> = {
  ok: { color: "var(--cc-ok)", label: "תקין", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  warn: { color: "var(--cc-warn)", label: "אזהרה", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  down: { color: "var(--cc-crit)", label: "לא זמין", icon: <CircleAlert className="h-3.5 w-3.5" /> },
  unknown: { color: "var(--cc-text-dim)", label: "לא מנוטר", icon: <Circle className="h-3.5 w-3.5" /> },
};

const SERVICE_ICON: Record<string, ReactNode> = {
  db: <Database className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  integrations: <Zap className="h-4 w-4" />,
  mcp: <Cpu className="h-4 w-4" />,
  openai: <Brain className="h-4 w-4" />,
};

function UptimeStrip({ history }: { history: ("ok" | "warn" | "down")[] }) {
  return (
    <div className="mt-1 flex items-end gap-[2px]" dir="ltr" title="היסטוריית זמינות (24 בדיקות אחרונות)">
      {history.map((s, i) => (
        <span
          key={i}
          className="h-2 w-[3px] rounded-sm"
          style={{ background: STATUS_META[s].color, opacity: s === "ok" ? 0.75 : 1 }}
        />
      ))}
    </div>
  );
}

export function HealthPanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError, refetch, isFetching } = useHealth(tenantId);
  return (
    <HudPanel title="בדיקות דופק" icon={<HeartPulse className="h-4 w-4 text-[var(--cc-accent)]" />}>
      <PanelState loading={isLoading} error={isError} />
      {data && (
        <div className="flex h-full flex-col">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {data.services.map((svc) => {
              const m = STATUS_META[svc.status];
              return (
                <li key={svc.key} className="rounded-lg border border-[var(--cc-line)] p-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-[var(--cc-accent)]">{SERVICE_ICON[svc.key]}</span>
                    <span className="font-medium">{svc.label}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: m.color }}>
                    {m.icon}<span>{m.label}</span>
                    {svc.latencyMs != null && <span className="cc-num mr-1 text-[var(--cc-text-dim)]">{svc.latencyMs}ms</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--cc-text-dim)]" title={svc.detail}>{svc.detail}</p>
                  {svc.history && svc.history.length > 0 && <UptimeStrip history={svc.history} />}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--cc-text-dim)]">
            <span>
              דופק אחרון: {data.lastHeartbeat
                ? formatDistanceToNow(new Date(data.lastHeartbeat), { addSuffix: true, locale: he })
                : "אין נתונים"}
            </span>
            <button onClick={() => refetch()} disabled={isFetching} className="text-[var(--cc-accent)] hover:underline disabled:opacity-50">
              {isFetching ? "בודקת…" : "בדיקה עכשיו"}
            </button>
          </div>
        </div>
      )}
    </HudPanel>
  );
}

/* ---------------- Tasks ---------------- */

export function TasksPanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError } = useCcTasks(tenantId);
  const markDone = useMarkTaskDone(tenantId);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <HudPanel title={`משימות${data?.length ? ` · ${data.length}` : ""}`} icon={<ListTodo className="h-4 w-4 text-[var(--cc-accent)]" />} className="min-h-0">
      <PanelState loading={isLoading} error={isError} empty={data?.length === 0} emptyText="אין משימות פתוחות 🎉" />
      <ul className="cc-scroll flex h-full max-h-full flex-col gap-1 overflow-y-auto pl-1">
        {data?.map((t) => {
          const overdue = t.due_date && t.due_date < today;
          return (
            <li key={t.id} className="group flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-[rgba(46,230,166,0.08)]">
              <button
                onClick={() => markDone.mutate(t.id)}
                title="סמן כבוצע"
                className="shrink-0 text-[var(--cc-text-dim)] transition-colors hover:text-[var(--cc-ok)]"
              >
                <Circle className="h-4 w-4 group-hover:hidden" />
                <CheckCircle2 className="hidden h-4 w-4 group-hover:block" />
              </button>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.due_date && (
                <span className={`cc-num shrink-0 text-xs ${overdue ? "text-[var(--cc-crit)]" : "text-[var(--cc-text-dim)]"}`}>
                  {overdue && "⚠ "}{new Date(t.due_date + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </HudPanel>
  );
}

/* ---------------- Daily timeline ---------------- */

export function TimelinePanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError } = useTimeline(tenantId);
  return (
    <HudPanel title="ציר זמן יומי" icon={<Activity className="h-4 w-4 text-[var(--cc-accent)]" />} className="min-h-0">
      <PanelState loading={isLoading} error={isError} empty={data?.length === 0} emptyText="אין אירועים מתוזמנים להיום" />
      <ul className="cc-scroll flex h-full max-h-full flex-col gap-0.5 overflow-y-auto pl-1">
        {data?.map((ev) => (
          <li key={ev.id} className={`flex items-center gap-2 border-r-2 py-1 pr-2 text-sm ${ev.done ? "border-[var(--cc-ok)] opacity-60" : "border-[var(--cc-accent-dim)]"}`}>
            <span className="cc-num w-11 shrink-0 text-xs text-[var(--cc-text-dim)]">{ev.time ?? "—"}</span>
            <span className={`min-w-0 flex-1 truncate ${ev.done ? "line-through" : ""}`}>{ev.title}</span>
          </li>
        ))}
      </ul>
    </HudPanel>
  );
}

/* ---------------- Quick commands ---------------- */

export function QuickCommandsPanel({ onCommand, onVoice, onHealthCheck }: {
  onCommand: (text: string) => void;
  onVoice: () => void;
  onHealthCheck: () => void;
}) {
  const btn = "flex items-center gap-2 rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm transition-colors hover:border-[var(--cc-line-strong)] hover:bg-[rgba(46,230,166,0.1)]";
  return (
    <HudPanel title="פקודות מהירות" icon={<Zap className="h-4 w-4 text-[var(--cc-accent)]" />}>
      <div className="grid grid-cols-2 gap-2">
        <button className={btn} onClick={() => onCommand("צרי לי משימה חדשה: ")}>
          <PlusCircle className="h-4 w-4 text-[var(--cc-accent)]" />משימה חדשה
        </button>
        <button className={btn} onClick={onHealthCheck}>
          <HeartPulse className="h-4 w-4 text-[var(--cc-accent)]" />בדיקת דופק
        </button>
        <button className={btn} onClick={() => onCommand("תני לי דוח יומי מסכם: משימות פתוחות ובאיחור, התראות פעילות, לידים חדשים וסטטוס כללי של המערכת")}>
          <ScrollText className="h-4 w-4 text-[var(--cc-accent)]" />דוח יומי
        </button>
        <button className={btn} onClick={onVoice}>
          <Mic className="h-4 w-4 text-[var(--cc-accent)]" />שיחה קולית
        </button>
      </div>
    </HudPanel>
  );
}
