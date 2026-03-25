import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendDataPoint {
  date: string;
  score: number;
  chatgpt: number;
  gemini: number;
  perplexity: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg">מגמת נראות לאורך זמן</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  direction: "rtl",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} name="ציון כולל" dot={false} />
              <Line type="monotone" dataKey="chatgpt" stroke="#10a37f" strokeWidth={2} name="ChatGPT" dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="gemini" stroke="#4285f4" strokeWidth={2} name="Gemini" dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="perplexity" stroke="#7c3aed" strokeWidth={2} name="Perplexity" dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
