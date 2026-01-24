import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth, subMonths, subYears } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type DatePreset = 
  | "today" 
  | "yesterday" 
  | "this_week" 
  | "7_days" 
  | "14_days" 
  | "30_days" 
  | "this_month" 
  | "last_month" 
  | "3_months" 
  | "year" 
  | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeFilterProps {
  onRangeChange: (range: DateRange, comparisonRange?: DateRange) => void;
  onCompareChange?: (enabled: boolean) => void;
  showComparison?: boolean;
}

const presets: { key: DatePreset; label: string }[] = [
  { key: "today", label: "היום" },
  { key: "yesterday", label: "אתמול" },
  { key: "this_week", label: "השבוע" },
  { key: "7_days", label: "7 ימים" },
  { key: "14_days", label: "14 יום" },
  { key: "30_days", label: "30 יום" },
  { key: "this_month", label: "החודש" },
  { key: "last_month", label: "חודש שעבר" },
  { key: "3_months", label: "3 חודשים" },
  { key: "year", label: "שנה" },
];

function getDateRangeFromPreset(preset: DatePreset): DateRange {
  const now = new Date();
  
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfDay(now) };
    case "7_days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "14_days":
      return { start: startOfDay(subDays(now, 13)), end: endOfDay(now) };
    case "30_days":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "3_months":
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "year":
      return { start: startOfDay(subYears(now, 1)), end: endOfDay(now) };
    default:
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

function getComparisonRange(range: DateRange): DateRange {
  const diff = range.end.getTime() - range.start.getTime();
  const daysInRange = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  return {
    start: startOfDay(subDays(range.start, daysInRange)),
    end: endOfDay(subDays(range.start, 1))
  };
}

export function DateRangeFilter({ onRangeChange, onCompareChange, showComparison = true }: DateRangeFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("7_days");
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === "custom") {
      setIsCustomOpen(true);
      return;
    }
    
    setSelectedPreset(preset);
    const range = getDateRangeFromPreset(preset);
    const comparisonRange = compareEnabled ? getComparisonRange(range) : undefined;
    onRangeChange(range, comparisonRange);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    
    setSelectedPreset("custom");
    setIsCustomOpen(false);
    
    const range = { start: startOfDay(customStart), end: endOfDay(customEnd) };
    const comparisonRange = compareEnabled ? getComparisonRange(range) : undefined;
    onRangeChange(range, comparisonRange);
  };

  const handleCompareToggle = (enabled: boolean) => {
    setCompareEnabled(enabled);
    onCompareChange?.(enabled);
    
    // Re-trigger range change with comparison
    const range = selectedPreset === "custom" && customStart && customEnd
      ? { start: startOfDay(customStart), end: endOfDay(customEnd) }
      : getDateRangeFromPreset(selectedPreset);
    
    const comparisonRange = enabled ? getComparisonRange(range) : undefined;
    onRangeChange(range, comparisonRange);
  };

  const formatCustomRange = () => {
    if (!customStart || !customEnd) return "בחר תאריכים";
    return `${format(customStart, "dd/MM/yy", { locale: he })} - ${format(customEnd, "dd/MM/yy", { locale: he })}`;
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.key}
            variant={selectedPreset === preset.key ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(preset.key)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
        
        {/* Custom date range picker */}
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPreset === "custom" ? "default" : "outline"}
              size="sm"
              className="text-xs gap-1"
            >
              <CalendarIcon className="h-3 w-3" />
              {selectedPreset === "custom" ? formatCustomRange() : "טווח מותאם"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-3">
              <div className="flex gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">מתאריך</Label>
                  <Calendar
                    mode="single"
                    selected={customStart}
                    onSelect={setCustomStart}
                    disabled={(date) => date > new Date() || (customEnd && date > customEnd)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">עד תאריך</Label>
                  <Calendar
                    mode="single"
                    selected={customEnd}
                    onSelect={setCustomEnd}
                    disabled={(date) => date > new Date() || (customStart && date < customStart)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsCustomOpen(false)}>
                  ביטול
                </Button>
                <Button size="sm" onClick={handleCustomApply} disabled={!customStart || !customEnd}>
                  החל
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Comparison toggle */}
      {showComparison && (
        <div className="flex items-center gap-2">
          <Switch
            id="compare"
            checked={compareEnabled}
            onCheckedChange={handleCompareToggle}
          />
          <Label htmlFor="compare" className="text-sm cursor-pointer">
            השווה לתקופה קודמת
          </Label>
        </div>
      )}
    </div>
  );
}

export { getDateRangeFromPreset, getComparisonRange };
