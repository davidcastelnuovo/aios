import { Card, CardContent } from "@/components/ui/card";

interface DataStatsProps {
  data: Record<string, any>[];
}

export function DataStats({ data }: DataStatsProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">אין נתונים להצגה</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {data.map((stat, i) => (
        <Card key={i} className="border border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {stat.value != null ? String(stat.value) : "0"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.label || stat.title || `מדד ${i + 1}`}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
