import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Search, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AhrefsProject {
  project_id: string;
  project_name: string;
  url: string;
  domain: string;
  keyword_count: number;
}

interface AhrefsProjectPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSyncComplete?: () => void;
}

export function AhrefsProjectPicker({ open, onOpenChange, clientId, onSyncComplete }: AhrefsProjectPickerProps) {
  const [search, setSearch] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ahrefs-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-ahrefs-projects");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any)?.projects as AhrefsProject[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const projects = data || [];
  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.project_name.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q)
    );
  });

  const handleSync = async (project: AhrefsProject) => {
    setSyncingId(project.project_id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ahrefs-snapshot", {
        body: { clientId, domain: project.domain },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`הדוח של ${project.project_name} נטען בהצלחה`);
      onSyncComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("sync from project picker failed:", err);
      toast.error(err?.message || "סנכרון נכשל");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחר פרויקט מ-Ahrefs לסנכרון</DialogTitle>
          <DialogDescription>
            רשימת כל הפרויקטים הזמינים בחשבון ה-Ahrefs המחובר. בחר פרויקט כדי למשוך את הדומיין שלו ללקוח הזה.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם פרויקט או דומיין..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <ScrollArea className="h-[420px] pr-2 -mr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              טוען פרויקטים...
            </div>
          ) : error ? (
            <div className="text-center text-destructive py-8 text-sm">
              שגיאה בטעינת פרויקטים: {(error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {search ? "לא נמצאו פרויקטים תואמים" : "אין פרויקטים זמינים"}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <div
                  key={p.project_id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.project_name}</div>
                      <div className="text-xs text-muted-foreground truncate" dir="ltr">
                        {p.domain}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {p.keyword_count} מילים
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSync(p)}
                    disabled={syncingId !== null}
                    className="shrink-0"
                  >
                    {syncingId === p.project_id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" />
                        מסנכרן...
                      </>
                    ) : (
                      "סנכרן"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
