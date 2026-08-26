import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ChevronLeft, Calendar, BarChart3, Trash2 } from "lucide-react";
import { AiDetectionBrand } from "@/hooks/useAiDetection";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface ProjectListProps {
  projects: AiDetectionBrand[];
  onSelect: (project: AiDetectionBrand) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectList({ projects, onSelect, onDelete }: ProjectListProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <Card key={project.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => onSelect(project)}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{project.brand_name}</h3>
                {project.url && (
                  <div className="flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate" dir="ltr">{project.url}</span>
                  </div>
                )}
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>

            {project.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
            )}

            <div className="flex flex-wrap gap-1 mb-3">
              {project.keywords.slice(0, 3).map((kw) => (
                <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
              ))}
              {project.keywords.length > 3 && (
                <Badge variant="outline" className="text-xs">+{project.keywords.length - 3}</Badge>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>נוצר {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: he })}</span>
              </div>
              <div className="flex items-center gap-2">
                {project.competitor_names.length > 0 && (
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    <span>{project.competitor_names.length} מתחרים</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
