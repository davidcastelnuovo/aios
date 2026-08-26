import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe } from "lucide-react";

interface Citation {
  id: string;
  source: string;
  url: string;
  mentions: number;
  influence: "high" | "medium" | "low";
  type: "blog" | "review" | "news" | "directory" | "social" | "docs";
}

interface CitationSourcesProps {
  citations: Citation[];
}

const typeLabels: Record<Citation["type"], string> = {
  blog: "בלוג",
  review: "ביקורת",
  news: "חדשות",
  directory: "ספרייה",
  social: "רשתות חברתיות",
  docs: "תיעוד",
};

const influenceColors: Record<Citation["influence"], string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

const influenceLabels: Record<Citation["influence"], string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

export function CitationSources({ citations }: CitationSourcesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">מקורות ציטוט</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          מקורות שמשפיעים על האופן שבו AI ממליץ על המותג שלך
        </p>
        <div className="space-y-3">
          {citations.map((citation) => (
            <div key={citation.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{citation.source}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{typeLabels[citation.type]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{citation.url}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-left">
                  <p className="text-sm font-medium">{citation.mentions} אזכורים</p>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${influenceColors[citation.influence]}`} />
                    <span className="text-xs text-muted-foreground">השפעה {influenceLabels[citation.influence]}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
