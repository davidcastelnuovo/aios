import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe } from "lucide-react";
import type { CitationInsight } from "@/lib/aiVisibilityInsights";

interface CitationSourcesProps {
  citations: CitationInsight[];
}

const typeLabels: Record<CitationInsight["type"], string> = {
  blog: "בלוג",
  review: "ביקורת",
  news: "חדשות",
  directory: "ספרייה",
  social: "רשתות חברתיות",
  docs: "תיעוד",
};

const influenceColors: Record<CitationInsight["influence"], string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export function CitationSources({ citations }: CitationSourcesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">מקורות ציטוט</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          דומיינים שה-AI סומך עליהם כשהוא עונה על הפרומפטים שלכם — כולל כאלה שמופיעים כשאתם מפסידים למתחרה.
        </p>
        <div className="space-y-3">
          {citations.map((citation) => (
            <a
              key={citation.id}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
            >
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium" dir="ltr">{citation.source}</span>
                  <Badge variant="outline" className="shrink-0 text-xs">{typeLabels[citation.type]}</Badge>
                  {citation.lostToCompetitor && <Badge variant="destructive" className="shrink-0 text-[10px]">כשהמתחרה מנצח</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{citation.url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-left">
                  <p className="text-sm font-medium">{citation.mentions} ציטוטים</p>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${influenceColors[citation.influence]}`} />
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
