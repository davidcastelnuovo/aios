import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HandoffWorkItem } from "@/components/marketing/copyHandoff";
import { Loader2, Plus, Send } from "lucide-react";

const NEW_TARGET = "new";

const projectKind = (item: HandoffWorkItem) => {
  const payload = item.payload ?? {};
  if (payload.project_type === "video" || Array.isArray(payload.storyboard)) return "וידאו";
  return "סטטי";
};

const linkedToCopy = (item: HandoffWorkItem, copyId: string) =>
  String(item.payload?.linked_copy_item_id ?? "") === copyId
  || String(item.payload?.handoff_from ?? "") === "copy";

interface Props {
  open: boolean;
  copyId: string;
  copyTitle: string | null;
  projects: HandoffWorkItem[];
  selectedId: string;
  pending: boolean;
  onSelectedIdChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CopyHandoffDialog({
  open,
  copyId,
  copyTitle,
  projects,
  selectedId,
  pending,
  onSelectedIdChange,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && !pending && onClose()}>
      <DialogContent className="max-w-md p-0" dir="rtl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>שיוך לקריאייטיב</DialogTitle>
          <p className="pt-1 text-sm text-muted-foreground">
            ללקוח הזה כבר יש פרויקט קריאייטיב פתוח. אפשר לשייך את הקונספטים של «{copyTitle || "בלי שם"}» לפרויקט קיים, או לפתוח חדש.
          </p>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="space-y-2 p-4">
            {projects.map((project) => {
              const selected = selectedId === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onSelectedIdChange(project.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-right transition-colors",
                    selected ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300 dark:bg-violet-950/30" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto">
                        {project.title || "ללא כותרת"}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="h-5 font-normal">{projectKind(project)}</Badge>
                        {linkedToCopy(project, copyId) && (
                          <Badge variant="outline" className="h-5 font-normal">מקושר לקופי הזה</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              disabled={pending}
              onClick={() => onSelectedIdChange(NEW_TARGET)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border border-dashed p-3 text-right transition-colors",
                selectedId === NEW_TARGET ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300 dark:bg-violet-950/30" : "hover:bg-muted/50",
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">פרויקט קריאייטיב חדש</span>
            </button>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>ביטול</Button>
          <Button type="button" className="gap-1.5" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {selectedId === NEW_TARGET ? "פתח פרויקט חדש" : "שייך לפרויקט"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const COPY_HANDOFF_NEW_TARGET = NEW_TARGET;
