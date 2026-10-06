import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { generateWorkdayTimeSlots } from "@/lib/taskWorkdayHours";

interface TimeSlotPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const TIME_SLOTS = generateWorkdayTimeSlots();

export function TimeSlotPicker({ value, onChange, disabled }: TimeSlotPickerProps) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(val) => onChange(val === "none" ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full bg-card">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="בחר שעה" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        <SelectItem value="none">ללא שעה</SelectItem>
        {TIME_SLOTS.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {slot}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
