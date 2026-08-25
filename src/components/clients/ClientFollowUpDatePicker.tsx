import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarClock, X } from "lucide-react";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface ClientFollowUpDatePickerProps {
  clientId: string;
  currentDate: string | null;
  variant?: "icon" | "full";
  onSuccess?: () => void;
  onOptimisticUpdate?: (clientId: string, newDate: string | null) => void;
}

function getOverdueInfo(dateStr: string | null) {
  if (!dateStr) return { isOverdue: false, isToday: false, daysLate: 0 };
  const today = startOfDay(new Date());
  const followUp = startOfDay(new Date(dateStr));
  const diff = differenceInCalendarDays(today, followUp);
  return {
    isOverdue: diff > 0,
    isToday: diff === 0,
    daysLate: diff,
  };
}

export function ClientFollowUpDatePicker({
  clientId,
  currentDate,
  variant = "icon",
  onSuccess,
  onOptimisticUpdate,
}: ClientFollowUpDatePickerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );

  const { isOverdue, isToday, daysLate } = getOverdueInfo(currentDate);

  const updateFollowUpDate = useMutation({
    mutationFn: async (date: Date | null) => {
      let dateString: string | null = null;
      if (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        dateString = `${year}-${month}-${day}`;
      }

      const { error } = await supabase
        .from("clients")
        .update({ follow_up_date: dateString })
        .eq("id", clientId);

      if (error) throw error;
    },
    onSuccess: (_data, dateArg) => {
      let dateString: string | null = null;
      if (dateArg) {
        const year = dateArg.getFullYear();
        const month = String(dateArg.getMonth() + 1).padStart(2, "0");
        const day = String(dateArg.getDate()).padStart(2, "0");
        dateString = `${year}-${month}-${day}`;
      }

      if (onOptimisticUpdate) {
        onOptimisticUpdate(clientId, dateString);
      } else {
        queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
      }

      toast({
        title: dateString ? "תאריך לשיחה נשמר" : "תאריך לשיחה נמחק",
      });
      setDialogOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון תאריך לשיחה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateFollowUpDate.mutate(selectedDate || null);
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    updateFollowUpDate.mutate(null);
  };

  if (variant === "full") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-right font-normal",
              !currentDate && "text-muted-foreground",
              isToday && "border-primary bg-primary/10",
              isOverdue && "border-destructive bg-destructive/10 text-destructive"
            )}
          >
            <CalendarClock className="ml-2 h-4 w-4" />
            {currentDate
              ? isOverdue
                ? `איחור ${daysLate} ${daysLate === 1 ? "יום" : "ימים"}`
                : format(new Date(currentDate), "dd/MM/yyyy", { locale: he })
              : "תאריך לשיחה"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              if (date) updateFollowUpDate.mutate(date);
            }}
            initialFocus
            locale={he}
          />
          {currentDate && (
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full" onClick={handleClear}>
                <X className="h-4 w-4 ml-2" />
                נקה תאריך
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 relative shrink-0",
            isToday && "text-green-600 bg-green-100",
            isOverdue && "text-destructive bg-destructive/10"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setDialogOpen(true);
          }}
          title={
            currentDate
              ? isOverdue
                ? `איחור ${daysLate} ימים`
                : `תאריך לשיחה: ${format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}`
              : "הגדר תאריך לשיחה"
          }
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
        {currentDate && (
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap",
              isToday && "text-green-600 bg-green-100 px-2 py-0.5 rounded-md",
              isOverdue && "text-destructive bg-destructive/10 px-2 py-0.5 rounded-md"
            )}
          >
            {isOverdue
              ? `איחור ${daysLate} ${daysLate === 1 ? "יום" : "ימים"}`
              : format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}
          </span>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[350px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>תאריך לשיחה עם הלקוח</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              locale={he}
              className="rounded-md border mx-auto"
            />

            {currentDate && (
              <p
                className={cn(
                  "text-sm text-center mt-3",
                  isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                {isOverdue
                  ? `תאריך מקורי: ${format(new Date(currentDate), "dd/MM/yyyy", { locale: he })} — איחור ${daysLate} ${daysLate === 1 ? "יום" : "ימים"}`
                  : `תאריך נוכחי: ${format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}`}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {currentDate && (
              <Button variant="outline" onClick={handleClear} className="gap-2">
                <X className="h-4 w-4" />
                נקה
              </Button>
            )}
            <Button onClick={handleSave} disabled={updateFollowUpDate.isPending}>
              {updateFollowUpDate.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
