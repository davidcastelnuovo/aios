import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Competitor {
  name: string;
  score: number;
  change: number;
  topCategories: string[];
}

interface CompetitorAnalysisProps {
  brandName: string;
  brandScore: number;
  competitors: Competitor[];
}

export function CompetitorAnalysis({ brandName, brandScore, competitors }: CompetitorAnalysisProps) {
  const allEntries = [
    { name: brandName, score: brandScore, change: 0, topCategories: [], isBrand: true },
    ...competitors.map(c => ({ ...c, isBrand: false })),
  ].sort((a, b) => b.score - a.score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ניתוח מתחרים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allEntries.map((entry, index) => (
          <div
            key={entry.name}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              entry.isBrand ? "bg-primary/5 border-primary/20" : ""
            }`}
          >
            <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{entry.name}</span>
                {entry.isBrand && <Badge variant="default" className="text-xs">אתה</Badge>}
              </div>
              <Progress value={entry.score} className="h-1.5" />
            </div>
            <div className="text-left min-w-[60px]">
              <span className="text-sm font-bold">{entry.score}%</span>
              {!entry.isBrand && (
                <p className={`text-xs ${entry.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {entry.change > 0 ? "+" : ""}{entry.change}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
