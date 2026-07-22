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

export function UsagePanel({ tenantId }: { tenantId: string | null }) {
  const { data, isLoading, isError } = useUsage(tenantId);
  return (
    <HudPanel title="שימוש ב-API" icon={<BarChart3 className="h-4 w-4 text-[var(--cc-accent)]" />}>
      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוענת נתונים…</p>}
      {isError && <p className="text-sm text-[var(--cc-warn)]">המקור לא זמין כרגע</p>}
      {data && (
        <div className="flex h-full flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="קריאות היום" value={data.callsToday.toLocaleString("he-IL")} />
            <StatTile label="טוקנים · 7 ימים" value={data.tokens7d >= 1000 ? `${(data.tokens7d / 1000).toFixed(1)}K` : `${data.tokens7d}`} />
            <StatTile label="עלות · 30 יום" value={`$${data.cost30d.toFixed(2)}`} sub="ממקורות מנוטרים" />
          </div>
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
