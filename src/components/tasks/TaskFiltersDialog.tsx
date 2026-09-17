import { useState, useEffect, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { defaultTaskFilters, resolveMineTaskAssignee, type TaskFilterState } from "@/lib/taskFilters";

export { defaultTaskFilters, resolveMineTaskAssignee, type TaskFilterState };

interface TaskFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: TaskFilterState;
  onApply: (filters: TaskFilterState) => void;
  /** Campaigner / client-lead / period controls — used on mobile so one icon holds every filter. */
  toolbarFilters?: ReactNode;
}

export function TaskFiltersDialog({
  open,
  onOpenChange,
  currentFilters,
  onApply,
  toolbarFilters,
}: TaskFiltersDialogProps) {
  const [filters, setFilters] = useState<TaskFilterState>(currentFilters);

  useEffect(() => {
    if (open) {
      setFilters(currentFilters);
    }
  }, [open, currentFilters]);

  const handleApply = () => {
    onApply(filters);
    onOpenChange(false);
  };

  const handleReset = () => {
    setFilters(defaultTaskFilters);
    onApply(defaultTaskFilters);
    onOpenChange(false);
  };

  const taskTypes = [
    { value: "campaign", label: "קמפיין" },
    { value: "creative", label: "קריאייטיב" },
    { value: "collection", label: "קולקשן" },
    { value: "other", label: "אחר / SEO" },
  ];

  const associationOptions = [
    { value: "all", label: "הכל" },
    { value: "clients", label: "לקוחות בלבד" },
    { value: "leads", label: "לידים בלבד" },
    { value: "general", label: "משימות כלליות (ללא שיוך)" },
    { value: "unassigned", label: "לא משוייכות ללקוח" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">{toolbarFilters ? "פילטרים" : "סינון מתקדם"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {toolbarFilters && (
            <div className="space-y-2">
              <Label>סינון מהיר</Label>
              {toolbarFilters}
            </div>
          )}
          <div className="space-y-2">
            <Label>סוג משימה</Label>
            <Select
              value={filters.taskType}
              onValueChange={(val) =>
                setFilters((prev) => ({ ...prev, taskType: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג משימה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                {taskTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>שיוך</Label>
            <Select
              value={filters.association}
              onValueChange={(val) =>
                setFilters((prev) => ({ ...prev, association: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג שיוך" />
              </SelectTrigger>
              <SelectContent>
                {associationOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            איפוס
          </Button>
          <Button onClick={handleApply} className="gap-2">
            החל פילטרים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
