import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Coins, Activity, Clock, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { he } from "date-fns/locale";

type Range = "7d" | "30d";

interface LogRow {
  created_at: string;
  status: string;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  model: string | null;
  action_type: string;
}

export function CostTab({ agent }: { agent: { id: string; tenant_id: string } }) {
  const [range, setRange] = useState<Range>("7d");

  const days = range === "7d" ? 7 : 30;
  const fromDate = useMemo(
    () => startOfDay(subDays(new Date(), days - 1)).toISOString(),
    [days]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["agent-cost", agent.id, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_action_log" as any)
        .select(
          "created_at,status,tokens_in,tokens_out,cost_usd,duration_ms,model,action_type"
        )
        .eq("agent_id", agent.id)
        .eq("tenant_id", agent.tenant_id)
        .gte("created_at", fromDate)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data || []) as unknown as LogRow[];
    },
  });

  const stats = useMemo(() => {
    const rows = data || [];
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let durationMs = 0;
    let errors = 0;
    const byDay: Record<string, { date: string; cost: number; tokens: number; calls: number }> = {};
    const byModel: Record<string, { model: string; cost: number; tokens: number; calls: number }> = {};

    // Pre-fill days for chart continuity
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
      byDay[d] = { date: d, cost: 0, tokens: 0, calls: 0 };
    }

    for (const r of rows) {
      const ti = r.tokens_in || 0;
      const to = r.tokens_out || 0;
      const c = Number(r.cost_usd) || 0;
      tokensIn += ti;
      tokensOut += to;
      costUsd += c;
      durationMs += r.duration_ms || 0;
      if (r.status === "error") errors++;

      const day = format(new Date(r.created_at), "yyyy-MM-dd");
      if (!byDay[day]) byDay[day] = { date: day, cost: 0, tokens: 0, calls: 0 };
      byDay[day].cost += c;
      byDay[day].tokens += ti + to;
      byDay[day].calls += 1;

      const m = r.model || "—";
      if (!byModel[m]) byModel[m] = { model: m, cost: 0, tokens: 0, calls: 0 };
      byModel[m].cost += c;
      byModel[m].tokens += ti + to;
      byModel[m].calls += 1;
    }

    return {
      tokensIn,
      tokensOut,
      costUsd,
      durationMs,
      errors,
      calls: rows.length,
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      byModel: Object.values(byModel).sort((a, b) => b.cost - a.cost),
    };
  }, [data, days]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fmtUsd = (n: number) => `$${n.toFixed(4)}`;
  const fmtNum = (n: number) => n.toLocaleString("he-IL");

  return (
    <div className="space-y-4" dir="rtl">
      {/* טווח */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">דשבורד עלות</h3>
          <p className="text-xs text-muted-foreground">
            מבוסס על agent_action_log — מתעדכן כאשר ריצות מתעדות tokens/cost
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="7d">7 ימים</TabsTrigger>
            <TabsTrigger value="30d">30 ימים</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
          label="עלות כוללת"
          value={fmtUsd(stats.costUsd)}
          sub={`${stats.calls} ריצות`}
        />
        <KpiCard
          icon={<Coins className="h-4 w-4 text-amber-500" />}
          label="טוקנים"
          value={fmtNum(stats.tokensIn + stats.tokensOut)}
          sub={`${fmtNum(stats.tokensIn)} in · ${fmtNum(stats.tokensOut)} out`}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="זמן ממוצע"
          value={
            stats.calls
              ? `${Math.round(stats.durationMs / stats.calls)}ms`
              : "—"
          }
          sub={`${(stats.durationMs / 1000).toFixed(1)}s סה״כ`}
        />
        <KpiCard
          icon={
            stats.errors > 0 ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Activity className="h-4 w-4 text-green-500" />
            )
          }
          label="שגיאות"
          value={`${stats.errors}`}
          sub={
            stats.calls
              ? `${((stats.errors / stats.calls) * 100).toFixed(1)}% שגיאה`
              : "—"
          }
        />
      </div>

      {/* Cost over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">עלות יומית ($)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    format(new Date(d), "d/M", { locale: he })
                  }
                  fontSize={11}
                />
                <YAxis fontSize={11} />
                <Tooltip
                  labelFormatter={(d) =>
                    format(new Date(d as string), "EEEE d/M", { locale: he })
                  }
                  formatter={(v: any, name: string) =>
                    name === "cost" ? fmtUsd(v as number) : fmtNum(v as number)
                  }
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cost" name="עלות $" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By model */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">פילוח לפי מודל</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              אין נתונים בטווח הנבחר. ריצות חדשות שיתעדו model/cost יופיעו כאן.
            </p>
          ) : (
            stats.byModel.map((m) => (
              <div
                key={m.model}
                className="flex items-center justify-between p-2 rounded-md border bg-card"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {m.model}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.calls} ריצות · {fmtNum(m.tokens)} טוקנים
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtUsd(m.cost)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
