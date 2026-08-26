import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AiVisibilityScoreProps {
  score: number;
  previousScore: number;
  totalPrompts: number;
  mentionedPrompts: number;
}

export function AiVisibilityScore({ score, previousScore, totalPrompts, mentionedPrompts }: AiVisibilityScoreProps) {
  const change = score - previousScore;
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">ציון נראות AI</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-primary"
                strokeDasharray={`${(score / 100) * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-xs text-muted-foreground">מתוך 100</span>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-5 w-5 ${trendColor}`} />
              <span className={`text-sm font-medium ${trendColor}`}>
                {change > 0 ? "+" : ""}{change} נקודות מהשבוע שעבר
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">פרומפטים עם אזכור</span>
                <span className="font-medium">{mentionedPrompts} / {totalPrompts}</span>
              </div>
              <Progress value={(mentionedPrompts / totalPrompts) * 100} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              הציון מבוסס על אחוז הפרומפטים בהם המותג שלך מוזכר בתשובות AI
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
