import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";

interface GaOrganicMonth {
  month: string; // YYYY-MM
  sessions: number;
}

interface SeoTrafficChartProps {
  trafficHistory: any[];
  /** Monthly organic sessions derived from Google Analytics (optional) */
  gaOrganicByMonth?: GaOrganicMonth[];
}

export function SeoTrafficChart({ trafficHistory, gaOrganicByMonth = [] }: SeoTrafficChartProps) {
  const chartData = useMemo(() => {
    // Build a map of month -> { ahrefs, ga }
    const monthMap = new Map<string, { ahrefs?: number; ga?: number }>();

    // Add Ahrefs data
    for (const item of trafficHistory) {
      if (!item.date) continue;
      const monthKey = String(item.date).substring(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey) || {};
      monthMap.set(monthKey, {
        ...existing,
        ahrefs: item.org_traffic ?? item.traffic ?? 0,
      });
    }

    // Add GA data
    for (const item of gaOrganicByMonth) {
      const existing = monthMap.get(item.month) || {};
      monthMap.set(item.month, { ...existing, ga: item.sessions });
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        date: month.length >= 7 ? `${month.substring(5, 7)}/${month.substring(2, 4)}` : month,
        ahrefs: data.ahrefs ?? null,
        ga: data.ga ?? null,
      }));
  }, [trafficHistory, gaOrganicByMonth]);

  const hasAhrefs = chartData.some(d => d.ahrefs != null);
  const hasGa = chartData.some(d => d.ga != null);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          היסטוריית תנועה אורגנית
          {hasAhrefs && hasGa && (
            <span className="text-xs font-normal text-muted-foreground">
              (Ahrefs + Analytics)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value != null ? value.toLocaleString() : '—',
                name === 'ahrefs' ? 'Ahrefs (תנועה)' : 'Analytics (sessions אורגניים)',
              ]}
              labelFormatter={(label) => `תאריך: ${label}`}
            />
            {(hasAhrefs && hasGa) && (
              <Legend
                formatter={(value) =>
                  value === 'ahrefs' ? 'Ahrefs — תנועה אורגנית' : 'Analytics — Sessions אורגניים'
                }
              />
            )}
            {hasAhrefs && (
              <Line
                type="monotone"
                dataKey="ahrefs"
                name="ahrefs"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
            {hasGa && (
              <Line
                type="monotone"
                dataKey="ga"
                name="ga"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ fill: "#22c55e", r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {hasAhrefs && hasGa && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            הקו הכחול — הערכת Ahrefs לתנועה אורגנית &nbsp;|&nbsp; הקו הירוק — Sessions אורגניים מ-Google Analytics
          </p>
        )}
      </CardContent>
    </Card>
  );
}
