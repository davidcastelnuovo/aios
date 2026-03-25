import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiDetectionScore } from "@/hooks/useAiDetection";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

interface ScanHistoryProps {
  scores: AiDetectionScore[];
}

export function ScanHistory({ scores }: ScanHistoryProps) {
  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground py-8">
          <p>עדיין לא בוצעו סריקות. לחץ על "הפעל סריקה" כדי להתחיל.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedScores = [...scores].sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">היסטוריית סריקות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedScores.map((score, i) => {
          const prevScore = sortedScores[i + 1];
          const change = prevScore ? score.score - prevScore.score : 0;
          const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
          const trendColor = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground";

          return (
            <div key={score.id} className="flex items-center gap-4 p-3 rounded-lg border">
              <div className="flex items-center gap-2 min-w-[120px]">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {new Date(score.week_start).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold">{score.score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>

                {change !== 0 && (
                  <div className={`flex items-center gap-0.5 ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">{change > 0 ? "+" : ""}{change}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <span>🤖</span> {score.chatgpt_score ?? 0}%
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <span>✨</span> {score.gemini_score ?? 0}%
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <span>🔍</span> {score.perplexity_score ?? 0}%
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground min-w-[80px] text-left">
                {score.mentioned_prompts}/{score.total_prompts} אזכורים
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
