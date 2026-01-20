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
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface FollowUpDatePickerProps {
  leadId: string;
  currentDate: string | null;
  variant?: "icon" | "full";
  onSuccess?: () => void;
}

export function FollowUpDatePicker({
  leadId,
  currentDate,
  variant = "icon",
  onSuccess,
}: FollowUpDatePickerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );

  const updateFollowUpDate = useMutation({
    mutationFn: async (date: Date | null) => {
      let dateString: string | null = null;
      if (date) {
        // Use local date to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
      }
      
      const { error } = await supabase
        .from("leads")
        .update({ follow_up_date: dateString })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      toast({
        title: selectedDate ? "תאריך לחזרה נשמר" : "תאריך לחזרה נמחק",
      });
      setDialogOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון תאריך לחזרה",
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

  const isToday = currentDate && new Date(currentDate).toDateString() === new Date().toDateString();

  if (variant === "full") {
    return (
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-right font-normal",
                !currentDate && "text-muted-foreground",
                isToday && "border-primary bg-primary/10"
              )}
            >
              <CalendarClock className="ml-2 h-4 w-4" />
              {currentDate
                ? format(new Date(currentDate), "dd/MM/yyyy", { locale: he })
                : "בחר תאריך לחזרה"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                if (date) {
                  updateFollowUpDate.mutate(date);
                }
              }}
              initialFocus
              locale={he}
            />
            {currentDate && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4 ml-2" />
                  נקה תאריך
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
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
            isToday && "text-green-600 bg-green-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setDialogOpen(true);
          }}
          title={currentDate ? `תאריך לחזרה: ${format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}` : "הגדר תאריך לחזרה"}
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
        {currentDate && (
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap",
              isToday && "text-green-600 bg-green-100 px-2 py-0.5 rounded-md"
            )}
          >
            {format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}
          </span>
        )}</div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[350px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>תאריך לחזרה</DialogTitle>
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
              <p className="text-sm text-muted-foreground text-center mt-3">
                תאריך נוכחי: {format(new Date(currentDate), "dd/MM/yyyy", { locale: he })}
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
