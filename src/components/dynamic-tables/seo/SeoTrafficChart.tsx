import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

interface SeoTrafficChartProps {
  trafficHistory: any[];
}

export function SeoTrafficChart({ trafficHistory }: SeoTrafficChartProps) {
  const chartData = trafficHistory.map((item: any) => ({
    date: item.date ? format(new Date(item.date), 'MM/yy') : '',
    traffic: item.traffic || 0,
  }));

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">היסטוריית תנועה אורגנית</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), 'תנועה']}
              labelFormatter={(label) => `תאריך: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="traffic"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ fill: "hsl(var(--primary))", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
