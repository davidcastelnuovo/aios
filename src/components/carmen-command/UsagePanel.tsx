import { AlertTriangle, BarChart3, DollarSign } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";
import { HudPanel } from "./panels";
import { useOpenAiBilling, useUsage, UsageDay, OpenAiBillingDay } from "./useCommandData";
import { CursorSessionsPanel } from "./CursorSessionsPanel";

const SERIES_BLUE = "#3B82F6";
const SERIES_GREEN = "#22C55E";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--cc-line)] p-2 text-center">
      <p className="cc-num text-lg font-bold leading-tight">{value}</p>
      <p className="text-xs text-[var(--cc-text-dim)]">{label}</p>
      {sub && <p className="text-[10px] text-[var(--cc-text-dim)]">{sub}</p>}
    </div>
  );
}

function UsageTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: UsageDay = payload[0].payload;
  return (
    <div dir="rtl" className="cc-panel p-2 text-xs">
      <p className="font-medium">{new Date(d.date + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" })}</p>
      <p><span className="text-[var(--cc-text-dim)]">טוקנים: </span><span className="cc-num">{d.tokens.toLocaleString("he-IL")}</span></p>
      <p><span className="text-[var(--cc-text-dim)]">קריאות: </span><span className="cc-num">{d.calls.toLocaleString("he-IL")}</span></p>
      <p><span className="text-[var(--cc-text-dim)]">עלות משוערת: </span><span className="cc-num">${d.cost.toFixed(3)}</span></p>
    </div>
  );
}

function AdminCostTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: OpenAiBillingDay = payload[0].payload;
  return (
    <div dir="rtl" className="cc-panel p-2 text-xs">
      <p className="font-medium">{new Date(d.date + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" })}</p>
      <p><span className="text-[var(--cc-text-dim)]">עלות OpenAI: </span><span className="cc-num">${d.cost.toFixed(3)}</span></p>
      {d.total_tokens != null && (
        <p><span className="text-[var(--cc-text-dim)]">טוקנים: </span><span className="cc-num">{d.total_tokens.toLocaleString("he-IL")}</span></p>
      )}
    </div>
  );
}

function mergeAdminDaily(
  costs: Array<{ date: string; cost: number }> = [],
  usage: Array<{ date: string; total_tokens: number; num_model_requests: number }> = [],
): OpenAiBillingDay[] {
  const byDate = new Map<string, OpenAiBillingDay>();
  for (const c of costs) {
    byDate.set(c.date, { date: c.date, cost: c.cost });
  }
  for (const u of usage) {
    const row = byDate.get(u.date) || { date: u.date, cost: 0 };
    row.total_tokens = u.total_tokens;
    row.num_model_requests = u.num_model_requests;
    byDate.set(u.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function UsagePanel({ tenantId, className }: { tenantId: string | null; className?: string }) {
  const { data, isLoading, isError } = useUsage(tenantId);
  const billing = useOpenAiBilling(tenantId);

  const adminDays = mergeAdminDaily(billing.data?.daily_costs, billing.data?.daily_usage);
  const adminMtd = billing.data?.current_month_usage_cost;
  const adminTokens = billing.data?.current_month_usage_tokens;
  const adminUnavailable = !billing.isLoading && (!billing.data?.admin_available || billing.isError);

  return (
    <HudPanel title="שימוש ועלות AI" icon={<BarChart3 className="h-4 w-4 text-[var(--cc-accent)]" />} className={className ?? ""}>
      {(isLoading || billing.isLoading) && <p className="text-sm text-[var(--cc-text-dim)]">טוענת נתונים…</p>}

      {adminUnavailable && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-[var(--cc-warn)]/40 bg-[var(--cc-warn)]/10 p-2 text-[11px] leading-snug text-[var(--cc-warn)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">נתוני חיוב Admin של OpenAI לא זמינים</p>
            <p>{billing.data?.error || billing.data?.errors?.costs || "הגדר OPENAI_ADMIN_KEY ב-Supabase (Staging) או openai_admin_api_key באינטגרציית llm."}</p>
            <p className="mt-1 text-[var(--cc-text-dim)]">יתרת קרדיט prepaid לא נחשפת ב-API הרשמי — רק בדשבורד OpenAI.</p>
          </div>
        </div>
      )}

      {billing.data?.admin_available && (
        <div className="mb-2 space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--cc-text)]">
            <DollarSign className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
            OpenAI Admin · {billing.data.period || "החודש"}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="עלות החודש"
              value={adminMtd != null ? `$${adminMtd.toFixed(2)}` : "—"}
              sub="מ-organization/costs"
            />
            <StatTile
              label="טוקנים · completions"
              value={adminTokens ? (adminTokens.total_tokens >= 1000 ? `${(adminTokens.total_tokens / 1000).toFixed(1)}K` : `${adminTokens.total_tokens}`) : "—"}
              sub={adminTokens ? `${adminTokens.num_model_requests} בקשות` : undefined}
            />
            <StatTile
              label="יתרת קרדיט"
              value="לא ב-API"
              sub="dashboard בלבד"
            />
          </div>
          {adminDays.length > 0 && (
            <div className="min-h-[90px]" dir="ltr">
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={adminDays} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="rgba(76,195,255,0.12)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#8fa3c4", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                    tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
                    interval={6}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8fa3c4", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                    tickFormatter={(v: number) => `$${v}`}
                    width={36}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<AdminCostTooltip />} />
                  <Line type="monotone" dataKey="cost" stroke={SERIES_GREEN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {billing.data.line_items && billing.data.line_items.length > 0 && (
            <div className="rounded-md border border-[var(--cc-line)] p-2 text-[11px]">
              <p className="mb-1 font-medium text-[var(--cc-text)]">פילוח line items (OpenAI)</p>
              {billing.data.line_items.slice(0, 6).map((li) => (
                <p key={li.name} className="flex justify-between gap-2 text-[var(--cc-text-dim)]">
                  <span>{li.name}</span>
                  <span className="cc-num">${li.value.toFixed(2)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {isError && <p className="text-sm text-[var(--cc-warn)]">מעקב פנימי לא זמין כרגע</p>}
      {data && (
        <div className="flex h-full flex-col gap-2">
          <p className="text-[11px] font-medium text-[var(--cc-text-dim)]">מעקב פנימי (AIOS logs)</p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="קריאות היום" value={data.callsToday.toLocaleString("he-IL")} />
            <StatTile label="טוקנים · 7 ימים" value={data.tokens7d >= 1000 ? `${(data.tokens7d / 1000).toFixed(1)}K` : `${data.tokens7d}`} />
            <StatTile label="עלות משוערת · 30 יום" value={`$${data.cost30d.toFixed(2)}`} sub="מ-ai_usage_log / agents" />
          </div>
          {data.monthlyBudget ? (
            (() => {
              const pct = Math.min(100, (data.costMtd / data.monthlyBudget) * 100);
              const barColor = pct >= 95 ? "var(--cc-crit)" : pct >= 80 ? "var(--cc-warn)" : "var(--cc-ok)";
              return (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--cc-text-dim)]">תקציב חודשי (הגדרות LLM)</span>
                    <span className="cc-num">${data.costMtd.toFixed(2)} / ${data.monthlyBudget} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-[var(--cc-line)]" dir="ltr">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${barColor}` }} />
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-[11px] text-[var(--cc-text-dim)]">
              💡 לא הוגדר תקציב חודשי — הוסף <span className="cc-num">monthly_budget_usd</span> בהגדרות ה-LLM להתראות 80%/95%.
            </p>
          )}
          <div className="min-h-[110px] flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(76,195,255,0.12)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#8fa3c4", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                  tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
                  interval={6} axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8fa3c4", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}K` : `${v}`)}
                  width={34} axisLine={false} tickLine={false}
                />
                <Tooltip content={<UsageTooltip />} cursor={{ fill: "rgba(76,195,255,0.08)" }} />
                <Bar dataKey="tokens" name="טוקנים ליום" fill={SERIES_BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-md border border-[var(--cc-line)] p-2 text-[11px] leading-snug text-[var(--cc-text-dim)]">
            <p className="mb-1 font-medium text-[var(--cc-text)]">איפה כל מושב מחויב</p>
            <p>כרמן פנימית — OpenAI/Gemini API (מפתח הארגון).</p>
            <p>Cursor Direct — Cursor Cloud (sticky כש-CARMEN_LIGHTWEIGHT_BRAIN=true).</p>
            <p>Codex Direct — Cursor Cloud, או OpenAI API כש-CODEX_USE_OPENAI_API=true.</p>
            <p>Grok Bot — webhook קיים.</p>
          </div>
          {!data.tracked && (
            <p className="text-[11px] leading-snug text-[var(--cc-text-dim)]">
              ⚠️ מעקב טוקנים מלא עדיין לא פעיל בצ'אט הראשי — הנתונים כאן חלקיים.
            </p>
          )}
          <CursorSessionsPanel tenantId={tenantId} />
        </div>
      )}
    </HudPanel>
  );
}
