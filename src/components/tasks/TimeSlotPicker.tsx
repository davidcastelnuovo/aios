import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";

interface TimeSlotPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

// Generate time slots from 06:00 to 23:30 in 30-minute increments
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function TimeSlotPicker({ value, onChange, disabled }: TimeSlotPickerProps) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(val) => onChange(val === "none" ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
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
