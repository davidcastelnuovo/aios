import { Bookmark, Building2, CalendarDays, Users, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTerminology } from "@/hooks/useTerminology";

interface TasksToolbarFiltersProps {
  campaignerFilter: string;
  onCampaignerFilterChange: (value: string) => void;
  campaignerFilterDisabled?: boolean;
  campaignersList: { id: string; full_name: string }[];
  clientFilter: string;
  onClientFilterChange: (value: string) => void;
  clientsList: { id: string; name: string }[];
  startDate?: Date;
  endDate?: Date;
  onDateRangeChange: (range: { startDate?: Date; endDate?: Date }) => void;
  onSaveFilterPreset?: () => void;
  saveDisabled?: boolean;
}

export function TasksToolbarFilters({
  campaignerFilter,
  onCampaignerFilterChange,
  campaignerFilterDisabled,
  campaignersList,
  clientFilter,
  onClientFilterChange,
  clientsList,
  startDate,
  endDate,
  onDateRangeChange,
  onSaveFilterPreset,
  saveDisabled,
}: TasksToolbarFiltersProps) {
  const { t } = useTerminology();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={campaignerFilter}
        onValueChange={onCampaignerFilterChange}
        disabled={campaignerFilterDisabled}
      >
        <SelectTrigger className="h-9 w-[168px] text-xs bg-card gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder={t("role_campaigner")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mine_assigned">שלי וששייכתי</SelectItem>
          <SelectItem value="mine">שלי בלבד</SelectItem>
          <SelectItem value="all">כל ה{t("role_campaigner", true)}</SelectItem>
          <SelectItem value="none">ללא שיוך</SelectItem>
          {campaignersList.map((campaigner) => (
            <SelectItem key={campaigner.id} value={campaigner.id}>
              {campaigner.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={clientFilter} onValueChange={onClientFilterChange}>
        <SelectTrigger className="h-9 w-[150px] text-xs bg-card gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder="לקוח" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הלקוחות</SelectItem>
          <SelectItem value="none">ללא לקוח</SelectItem>
          {clientsList.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-[118px] justify-start text-xs bg-card font-normal",
              !startDate && "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 ms-1" />
            {startDate ? format(startDate, "dd/MM", { locale: he }) : "מתאריך"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={(date) => onDateRangeChange({ startDate: date, endDate })}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-[118px] justify-start text-xs bg-card font-normal",
              !endDate && "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 ms-1" />
            {endDate ? format(endDate, "dd/MM", { locale: he }) : "עד תאריך"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={(date) => onDateRangeChange({ startDate, endDate: date })}
          />
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onDateRangeChange({ startDate: undefined, endDate: undefined })}
          aria-label="נקה תאריך"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {onSaveFilterPreset && (
        <Button
          variant="outline"
          className="h-9 gap-1.5 text-xs"
          onClick={onSaveFilterPreset}
          disabled={saveDisabled}
        >
          <Bookmark className="h-3.5 w-3.5" />
          שמור כברירת מחדל
        </Button>
      )}
    </div>
  );
}
