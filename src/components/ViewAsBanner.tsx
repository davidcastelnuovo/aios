import { useViewAs } from "@/contexts/ViewAsContext";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

export function ViewAsBanner() {
  const { isViewingAs, viewAsUserName, clearViewAs } = useViewAs();

  if (!isViewingAs) return null;

  return (
    <div className="sticky top-0 z-[60] bg-warning text-warning-foreground px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          צופה בתור: <strong>{viewAsUserName}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearViewAs}
        className="h-7 px-2 text-warning-foreground hover:bg-warning/80 hover:text-warning-foreground"
      >
        <X className="h-4 w-4 mr-1" />
        צא ממצב צפייה
      </Button>
    </div>
  );
}
