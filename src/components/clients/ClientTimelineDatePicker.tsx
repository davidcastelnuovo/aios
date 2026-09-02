import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClientTimelineDatePickerProps {
  clientId: string;
  field: "start_date" | "end_date";
  currentDate: string | null | undefined;
  onUpdate: (clientId: string, field: string, value: string | null) => void | Promise<void>;
  placeholder?: string;
}

export function ClientTimelineDatePicker({
  clientId,
  field,
  currentDate,
  onUpdate,
  placeholder = "בחר תאריך",
}: ClientTimelineDatePickerProps) {
  const handleClear = () => {
    void onUpdate(clientId, field, null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs font-medium gap-1">
          <CalendarIcon className="h-3 w-3" />
          {currentDate
            ? format(new Date(currentDate), "dd/MM/yyyy", { locale: he })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          required={false}
          selected={currentDate ? new Date(currentDate) : undefined}
          onSelect={(date) => {
            void onUpdate(clientId, field, date ? format(date, "yyyy-MM-dd") : null);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
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
