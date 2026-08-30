import { BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { HudPanel } from "./panels";
import { useUsage, UsageDay } from "./useCommandData";

// Series color validated for the dark HUD surface (see command-center.css)
const SERIES_BLUE = "#3B82F6";

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
      <p><span className="text-[var(--cc-text-dim)]">עלות: </span><span className="cc-num">${d.cost.toFixed(3)}</span></p>
    </div>
  );
}

export function UsagePanel({ tenantId, className }: { tenantId: string | null; className?: string }) {
  const { data, isLoading, isError } = useUsage(tenantId);
  return (
    <HudPanel title="שימוש ב-API" icon={<BarChart3 className="h-4 w-4 text-[var(--cc-accent)]" />} className={className ?? ""}>
      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוענת נתונים…</p>}
      {isError && <p className="text-sm text-[var(--cc-warn)]">המקור לא זמין כרגע</p>}
      {data && (
        <div className="flex h-full flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="קריאות היום" value={data.callsToday.toLocaleString("he-IL")} />
            <StatTile label="טוקנים · 7 ימים" value={data.tokens7d >= 1000 ? `${(data.tokens7d / 1000).toFixed(1)}K` : `${data.tokens7d}`} />
            <StatTile label="עלות · 30 יום" value={`$${data.cost30d.toFixed(2)}`} sub="ממקורות מנוטרים" />
          </div>
          {data.monthlyBudget ? (
            (() => {
              const pct = Math.min(100, (data.costMtd / data.monthlyBudget) * 100);
              const barColor = pct >= 95 ? "var(--cc-crit)" : pct >= 80 ? "var(--cc-warn)" : "var(--cc-ok)";
              return (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--cc-text-dim)]">תקציב חודשי</span>
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
              💡 לא הוגדר תקציב חודשי — הוסף <span className="cc-num">monthly_budget_usd</span> בהגדרות ה-LLM כדי לקבל התראות 80%/95% לפני שהקרדיט נגמר.
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
            <p>כרמן פנימית — OpenAI API (מפתח הארגון). זה הקרדיט של OpenAI, לא של Cursor.</p>
            <p>Cursor Direct ו-Codex Direct — אותו חשבון Cursor Cloud. לא קרדיט OpenAI ולא מנוי ChatGPT.</p>
            <p>ChatGPT Work Agent — מנוי/workspace של ChatGPT. נפרד מ-Codex.</p>
            <p>Grok Bot — הבוט שכבר פתוח. בלי סוכן רקע חדש.</p>
          </div>
          {!data.tracked && (
            <p className="text-[11px] leading-snug text-[var(--cc-text-dim)]">
              ⚠️ מעקב טוקנים מלא עדיין לא פעיל בצ'אט הראשי — הנתונים כאן חלקיים (סוכנים ושיווק בלבד).
            </p>
          )}
        </div>
      )}
    </HudPanel>
  );
}
