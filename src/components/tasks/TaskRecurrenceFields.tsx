import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeSlotPicker } from "./TimeSlotPicker";
import {
  RECURRENCE_FREQUENCY_LABELS,
  WEEKDAY_OPTIONS,
  type RecurrenceFrequency,
} from "@/lib/taskRecurrence";
import { cn } from "@/lib/utils";

export interface TaskRecurrenceValue {
  frequency: RecurrenceFrequency | null;
  weekday: number | null;
  monthday: number | null;
  time: string | null;
}

interface TaskRecurrenceFieldsProps {
  value: TaskRecurrenceValue;
  onChange: (next: TaskRecurrenceValue) => void;
  className?: string;
  compact?: boolean;
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function TaskRecurrenceFields({
  value,
  onChange,
  className,
  compact = false,
}: TaskRecurrenceFieldsProps) {
  const patch = (partial: Partial<TaskRecurrenceValue>) => onChange({ ...value, ...partial });

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(compact ? "space-y-1.5" : "grid gap-3 sm:grid-cols-2")}>
        <div className="space-y-1">
          {!compact && <Label className="text-xs">תדירות</Label>}
          <Select
            value={value.frequency ?? "none"}
            onValueChange={(next) =>
              patch({
                frequency: next === "none" ? null : (next as RecurrenceFrequency),
                weekday:
                  next === "weekly"
                    ? value.weekday ?? new Date().getDay()
                    : next === "none"
                      ? null
                      : value.weekday,
                monthday:
                  next === "monthly"
                    ? value.monthday ?? new Date().getDate()
                    : next === "none"
                      ? null
                      : value.monthday,
              })
            }
          >
            <SelectTrigger className={cn(compact && "h-8 text-xs")}>
              <SelectValue placeholder="לא חוזרת" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">לא חוזרת</SelectItem>
              {(Object.keys(RECURRENCE_FREQUENCY_LABELS) as RecurrenceFrequency[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {RECURRENCE_FREQUENCY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value.frequency === "weekly" && (
          <div className="space-y-1">
            {!compact && <Label className="text-xs">ביום</Label>}
            <Select
              value={String(value.weekday ?? new Date().getDay())}
              onValueChange={(next) => patch({ weekday: Number(next) })}
            >
              <SelectTrigger className={cn(compact && "h-8 text-xs")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {value.frequency === "monthly" && (
          <div className="space-y-1">
            {!compact && <Label className="text-xs">ביום בחודש</Label>}
            <Select
              value={String(value.monthday ?? new Date().getDate())}
              onValueChange={(next) => patch({ monthday: Number(next) })}
            >
              <SelectTrigger className={cn(compact && "h-8 text-xs")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {MONTH_DAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {value.frequency && (
          <div className="space-y-1 sm:col-span-2">
            {!compact && <Label className="text-xs">שעה ליצירת המשימה</Label>}
            <TimeSlotPicker
              value={value.time}
              onChange={(time) => patch({ time })}
            />
          </div>
        )}
      </div>
      {value.frequency && (
        <p className="text-[11px] text-muted-foreground">
          בסימון בוצע יישמר המופע הנוכחי ותיפתח משימה חדשה לפי התדירות, היום והשעה שנבחרו.
        </p>
      )}
    </div>
  );
}
