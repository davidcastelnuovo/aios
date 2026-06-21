import { SitemapTree } from "./SitemapTree";
import { Sparkles } from "lucide-react";

export function WorkspaceCanvas() {
  return (
    <div className="flex flex-col h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/5">
      <header className="flex items-center gap-2 px-6 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10" dir="rtl">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Visual Workspace</h1>
          <p className="text-xs text-muted-foreground">
            מפת המערכת — גרור כרטיסים בין קטגוריות, ערוך שמות בלחיצה כפולה. השינויים נשמרים בתפריט הראשי.
          </p>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <SitemapTree />
      </div>
    </div>
  );
}
