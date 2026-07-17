import { useState } from "react";
import { SitemapTree } from "./SitemapTree";
import { GraphifyView } from "./GraphifyView";
import { Sparkles, Network, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

type WorkspaceView = "graph" | "sitemap";

export function WorkspaceCanvas() {
  const [view, setView] = useState<WorkspaceView>("graph");

  return (
    <div className="flex flex-col h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/5">
      <header className="flex items-center gap-2 px-6 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10" dir="rtl">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Visual Workspace</h1>
          <p className="text-xs text-muted-foreground">
            {view === "graph"
              ? "Graphify — גרף הארכיטקטורה החי של המערכת: קוד, פונקציות, טבלאות והקשרים ביניהם."
              : "מפת המערכת — גרור כרטיסים בין קטגוריות, ערוך שמות בלחיצה כפולה. השינויים נשמרים בתפריט הראשי."}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-background">
          <Button
            variant={view === "graph" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("graph")}
          >
            <Network className="h-4 w-4 ml-1" />
            גרף המערכת
          </Button>
          <Button
            variant={view === "sitemap" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("sitemap")}
          >
            <LayoutGrid className="h-4 w-4 ml-1" />
            מפת תפריט
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        {view === "graph" ? <GraphifyView /> : <SitemapTree />}
      </div>
    </div>
  );
}
