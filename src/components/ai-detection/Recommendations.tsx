import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowUpRight, Globe, FileText, Share2, Plus } from "lucide-react";
import type { VisibilityTip } from "@/lib/aiVisibilityInsights";

interface RecommendationsProps {
  recommendations: VisibilityTip[];
  onCreateTask?: (tip: VisibilityTip) => void;
  creatingId?: string | null;
}

const typeIcons = {
  onsite: Globe,
  offsite: Share2,
  content: FileText,
  technical: ArrowUpRight,
};

const typeLabels = {
  onsite: "באתר",
  offsite: "מחוץ לאתר",
  content: "תוכן",
  technical: "טכני",
};

const impactColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const impactLabels = {
  high: "השפעה גבוהה",
  medium: "השפעה בינונית",
  low: "השפעה נמוכה",
};

export function Recommendations({ recommendations, onCreateTask, creatingId }: RecommendationsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg">תוכנית פעולה מהסריקה</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">כל טיפ מחובר לפרומפט או מקור ציטוט אמיתי. לחיצה יוצרת משימה במחלקת SEO.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">הפעילו סריקה כדי לקבל תוכנית פעולה מנתונים, לא מהמלצות גנריות.</p>
        ) : recommendations.map((rec) => {
          const Icon = typeIcons[rec.type];
          return (
            <div key={rec.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{rec.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs">{typeLabels[rec.type]}</Badge>
                  <Badge className={`text-xs ${impactColors[rec.impact]}`}>{impactLabels[rec.impact]}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              <p className="text-[11px] text-muted-foreground">ראיה: {rec.evidence}</p>
              {onCreateTask && (
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={creatingId === rec.id} onClick={() => onCreateTask(rec)}>
                  <Plus className="ml-1 h-3 w-3" />
                  {creatingId === rec.id ? "יוצר משימה..." : "צור משימת תוכן ב-SEO"}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
