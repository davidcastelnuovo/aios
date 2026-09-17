import { useMemo, useState } from "react";
import { Bookmark, Building2, CalendarDays, Check, Users, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useTerminology } from "@/hooks/useTerminology";
import {
  TASK_PERIOD_OPTIONS,
  type TaskPeriodFilter,
  type TaskRelatedKind,
} from "@/lib/taskFilters";

export type TaskRelatedPick = {
  relatedKind: TaskRelatedKind;
  relatedId: string;
  relatedLabel: string;
};

interface TasksToolbarFiltersProps {
  campaignerFilter: string;
  onCampaignerFilterChange: (value: string) => void;
  campaignerFilterDisabled?: boolean;
  campaignersList: { id: string; full_name: string }[];
  relatedKind: TaskRelatedKind;
  relatedId: string;
  relatedLabel: string;
  onRelatedChange: (value: TaskRelatedPick) => void;
  clientsList: { id: string; name: string }[];
  leadsList: { id: string; company_name: string | null; contact_name: string | null; created_at: string }[];
  period: TaskPeriodFilter;
  onPeriodChange: (value: TaskPeriodFilter) => void;
  onSaveFilterPreset?: () => void;
  saveDisabled?: boolean;
}

function leadDisplayName(lead: { company_name: string | null; contact_name: string | null }): string {
  return (lead.company_name || lead.contact_name || "ליד ללא שם").trim();
}

export function TasksToolbarFilters({
  campaignerFilter,
  onCampaignerFilterChange,
  campaignerFilterDisabled,
  campaignersList,
  relatedKind,
  relatedId,
  relatedLabel,
  onRelatedChange,
  clientsList,
  leadsList,
  period,
  onPeriodChange,
  onSaveFilterPreset,
  saveDisabled,
}: TasksToolbarFiltersProps) {
  const { t } = useTerminology();
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"client" | "lead">(
    relatedKind === "lead" ? "lead" : "client",
  );

  const relatedButtonLabel =
    relatedKind === "client"
      ? relatedLabel || "לקוח"
      : relatedKind === "lead"
        ? relatedLabel || "ליד"
        : relatedKind === "none"
          ? "ללא שיוך"
          : "לקוח או ליד";

  const sortedLeads = useMemo(
    () => [...leadsList].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [leadsList],
  );

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

      <div className="flex items-center">
        <Popover
          open={relatedOpen}
          onOpenChange={(open) => {
            setRelatedOpen(open);
            if (open) setPickerTab(relatedKind === "lead" ? "lead" : "client");
          }}
        >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 min-w-[150px] max-w-[220px] justify-start text-xs bg-card font-normal gap-1.5",
              relatedKind === "all" && "text-muted-foreground",
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{relatedButtonLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start" dir="rtl">
          <div className="grid grid-cols-2 gap-1 p-2 border-b bg-muted/30">
            <Button
              type="button"
              size="sm"
              variant={pickerTab === "client" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setPickerTab("client")}
            >
              לקוח
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pickerTab === "lead" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setPickerTab("lead")}
            >
              ליד
            </Button>
          </div>
          <Command>
            <CommandInput
              placeholder={pickerTab === "client" ? "חיפוש לקוח לפי שם..." : "חיפוש ליד לפי שם..."}
            />
            <CommandList>
              <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all-related"
                  onSelect={() => {
                    onRelatedChange({ relatedKind: "all", relatedId: "", relatedLabel: "" });
                    setRelatedOpen(false);
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5 ms-1", relatedKind === "all" ? "opacity-100" : "opacity-0")} />
                  הכל
                </CommandItem>
                <CommandItem
                  value="none-related"
                  onSelect={() => {
                    onRelatedChange({ relatedKind: "none", relatedId: "", relatedLabel: "ללא שיוך" });
                    setRelatedOpen(false);
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5 ms-1", relatedKind === "none" ? "opacity-100" : "opacity-0")} />
                  ללא שיוך
                </CommandItem>
              </CommandGroup>
              {pickerTab === "client" ? (
                <CommandGroup heading="לקוחות">
                  {clientsList.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`client ${client.id} ${client.name}`}
                      onSelect={() => {
                        onRelatedChange({
                          relatedKind: "client",
                          relatedId: client.id,
                          relatedLabel: client.name,
                        });
                        setRelatedOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 ms-1",
                          relatedKind === "client" && relatedId === client.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{client.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandGroup heading="לידים לפי תאריך">
                  {sortedLeads.map((lead) => {
                    const name = leadDisplayName(lead);
                    const created = lead.created_at ? new Date(lead.created_at) : null;
                    const dateLabel =
                      created && !Number.isNaN(created.getTime())
                        ? format(created, "dd/MM/yy", { locale: he })
                        : "";
                    return (
                      <CommandItem
                        key={lead.id}
                        value={`lead ${lead.id} ${name} ${lead.contact_name || ""}`}
                        onSelect={() => {
                          onRelatedChange({
                            relatedKind: "lead",
                            relatedId: lead.id,
                            relatedLabel: name,
                          });
                          setRelatedOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 ms-1",
                            relatedKind === "lead" && relatedId === lead.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate flex-1">{name}</span>
                        {dateLabel && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{dateLabel}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
        {relatedKind !== "all" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="נקה לקוח או ליד"
            onClick={() => onRelatedChange({ relatedKind: "all", relatedId: "", relatedLabel: "" })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Select value={period} onValueChange={(value) => onPeriodChange(value as TaskPeriodFilter)}>
        <SelectTrigger className="h-9 w-[168px] text-xs bg-card gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder="תקופה" />
        </SelectTrigger>
        <SelectContent>
          {TASK_PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
