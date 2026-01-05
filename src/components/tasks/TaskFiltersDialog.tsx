import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Checkbox } from "@/components/ui/checkbox";

export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  showUnscheduled: boolean;
}

export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "all",
  taskType: "all",
  association: "all",
  startDate: undefined,
  endDate: undefined,
  showUnscheduled: false,
};

interface TaskFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: TaskFilterState;
  onApply: (filters: TaskFilterState) => void;
}

export function TaskFiltersDialog({
  open,
  onOpenChange,
  currentFilters,
  onApply,
}: TaskFiltersDialogProps) {
  const { tenantId } = useCurrentTenant();
  const [filters, setFilters] = useState<TaskFilterState>(currentFilters);

  // Sync with current filters when dialog opens
  useEffect(() => {
    if (open) {
      setFilters(currentFilters);
    }
  }, [open, currentFilters]);

  // Fetch campaigners for the tenant
  const { data: campaigners = [] } = useQuery({
    queryKey: ["campaigners-for-filter", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
  });

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
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">סינון משימות</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Campaigner */}
          <div className="space-y-2">
            <Label>קמפיינר</Label>
            <Select
              value={filters.campaignerId}
              onValueChange={(val) =>
                setFilters((prev) => ({ ...prev, campaignerId: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קמפיינר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקמפיינרים</SelectItem>
                <SelectItem value="mine">שלי בלבד</SelectItem>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {campaigners?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Type */}
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

          {/* Association */}
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

          {/* Date Range */}
          <div className="space-y-2">
            <Label>טווח תאריכים</Label>
            <div className="flex gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-right font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {filters.startDate
                      ? format(filters.startDate, "dd/MM/yyyy")
                      : "מתאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) =>
                      setFilters((prev) => ({ ...prev, startDate: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-right font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {filters.endDate
                      ? format(filters.endDate, "dd/MM/yyyy")
                      : "עד תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) =>
                      setFilters((prev) => ({ ...prev, endDate: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {(filters.startDate || filters.endDate) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: undefined,
                      endDate: undefined,
                    }))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Show Unscheduled */}
          <div className="flex items-center gap-3 pt-2">
            <Checkbox
              id="showUnscheduled"
              checked={filters.showUnscheduled}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({
                  ...prev,
                  showUnscheduled: checked === true,
                }))
              }
            />
            <Label htmlFor="showUnscheduled" className="cursor-pointer">
              הצג משימות ללא תאריך יעד
            </Label>
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
