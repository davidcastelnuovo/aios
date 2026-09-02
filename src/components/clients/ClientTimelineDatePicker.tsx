import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";

interface ClientTimelineDatePickerProps {
  value: string | null | undefined;
  placeholder?: string;
  onChange: (value: string | null) => void;
  align?: "start" | "center" | "end";
}

export function ClientTimelineDatePicker({
  value,
  placeholder = "בחר תאריך",
  onChange,
  align = "end",
}: ClientTimelineDatePickerProps) {
  const selectedDate = value ? new Date(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : null);
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs font-medium gap-1">
          <CalendarIcon className="h-3 w-3" />
          {value ? format(new Date(value), "dd/MM/yyyy", { locale: he }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
          locale={he}
        />
        {value && (
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
