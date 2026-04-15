import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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
    // Prefer GA data; fall back to Ahrefs traffic_history
    if (gaOrganicByMonth.length > 0) {
      return gaOrganicByMonth.map(({ month, sessions }) => ({
        date: `${month.substring(5, 7)}/${month.substring(2, 4)}`,
        sessions,
      }));
    }
    // Fallback: Ahrefs traffic history
    return trafficHistory.map((item: any) => ({
      date: item.date ? String(item.date).substring(5, 7) + '/' + String(item.date).substring(2, 4) : '',
      sessions: item.org_traffic ?? item.traffic ?? 0,
    }));
  }, [gaOrganicByMonth, trafficHistory]);

  const isGaData = gaOrganicByMonth.length > 0;

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          תנועה אורגנית
          <span className="text-xs font-normal text-muted-foreground">
            {isGaData ? '— Sessions אורגניים (Google Analytics)' : '— הערכת Ahrefs'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number) => [
                value != null ? value.toLocaleString() : '—',
                isGaData ? 'Sessions אורגניים' : 'תנועה אורגנית',
              ]}
              labelFormatter={(label) => `תאריך: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="sessions"
              stroke={isGaData ? '#22c55e' : 'hsl(var(--primary))'}
              strokeWidth={2.5}
              dot={{ fill: isGaData ? '#22c55e' : 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
