import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ArrowUpRight, Globe, FileText, Share2 } from "lucide-react";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  type: "onsite" | "offsite" | "content" | "technical";
}

interface RecommendationsProps {
  recommendations: Recommendation[];
}

const typeIcons: Record<Recommendation["type"], typeof Globe> = {
  onsite: Globe,
  offsite: Share2,
  content: FileText,
  technical: ArrowUpRight,
};

const typeLabels: Record<Recommendation["type"], string> = {
  onsite: "באתר",
  offsite: "מחוץ לאתר",
  content: "תוכן",
  technical: "טכני",
};

const impactColors: Record<Recommendation["impact"], string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const impactLabels: Record<Recommendation["impact"], string> = {
  high: "השפעה גבוהה",
  medium: "השפעה בינונית",
  low: "השפעה נמוכה",
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg">המלצות לשיפור</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const Icon = typeIcons[rec.type];
          return (
            <div key={rec.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{rec.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{typeLabels[rec.type]}</Badge>
                  <Badge className={`text-xs ${impactColors[rec.impact]}`}>{impactLabels[rec.impact]}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
