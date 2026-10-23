import { Link } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkshopProject = {
  id: string;
  title: string | null;
};

export function WorkshopProjects({
  projects,
  selectedId,
  loading,
  error,
  newHref,
  onSelect,
}: {
  projects: WorkshopProject[];
  selectedId: string | null;
  loading: boolean;
  error: boolean;
  newHref: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">פרויקטים</span>
        {newHref ? (
          <Button size="sm" variant="outline" className="h-7 gap-1" asChild>
            <Link to={newHref}>
              <Plus className="h-3.5 w-3.5" />
              חדש
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <Loader2 className="mx-auto mt-6 h-4 w-4 animate-spin" />
        ) : error ? (
          <p className="p-2 text-sm text-destructive">
            לא הצלחנו לטעון את הפרויקטים
          </p>
        ) : projects.length ? (
          projects.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "mb-1 w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-muted",
                selectedId === item.id && "bg-muted font-medium",
              )}
            >
              {item.title?.trim() || "ללא שם"}
            </button>
          ))
        ) : (
          <p className="p-2 text-sm text-muted-foreground">
            אין פרויקטים עדיין
          </p>
        )}
      </div>
    </aside>
  );
}
