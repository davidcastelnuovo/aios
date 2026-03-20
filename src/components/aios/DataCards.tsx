import { Card, CardContent } from "@/components/ui/card";

interface DataCardsProps {
  data: Record<string, any>[];
}

export function DataCards({ data }: DataCardsProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">אין נתונים להצגה</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map((item, i) => (
        <Card key={i} className="border border-border">
          <CardContent className="p-4 space-y-1">
            {Object.entries(item).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">{value != null ? String(value) : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
