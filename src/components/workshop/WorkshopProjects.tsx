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
  onCreate,
  onSelect,
}: {
  projects: WorkshopProject[];
  selectedId: string | null;
  loading: boolean;
  error: boolean;
  onCreate: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-row items-center gap-2 border-b px-2 py-1.5 md:min-h-0 md:w-72 md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:border-b-0 md:border-l md:px-0 md:py-0">
      <div className="flex shrink-0 items-center justify-between gap-2 md:border-b md:px-3 md:py-2">
        <span className="text-sm font-medium">פרויקטים</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1"
          onClick={onCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          חדש
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:min-h-0 md:w-full md:flex-col md:overflow-y-auto md:p-2">
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
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-right text-sm hover:bg-muted md:mb-1 md:w-full md:whitespace-normal",
                selectedId === item.id && "bg-muted font-medium",
              )}
            >
              {item.title?.trim() || "ללא שם"}
            </button>
          ))
        ) : (
          <p className="shrink-0 p-2 text-sm text-muted-foreground">
            אין פרויקטים עדיין
          </p>
        )}
      </div>
    </aside>
  );
}
