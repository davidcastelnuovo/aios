import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type AudienceFilterMode = "include" | "exclude";

interface Option {
  value: string;
  label: string;
}

interface BroadcastAudienceMultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onSelectedChange: (values: string[]) => void;
  mode: AudienceFilterMode;
  onModeChange: (mode: AudienceFilterMode) => void;
  emptyLabel?: string;
}

export function BroadcastAudienceMultiSelect({
  label,
  options,
  selected,
  onSelectedChange,
  mode,
  onModeChange,
  emptyLabel = "הכל",
}: BroadcastAudienceMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const summary = useMemo(() => {
    if (selected.length === 0) return emptyLabel;
    const labels = selected
      .map((v) => options.find((o) => o.value === v)?.label || v)
      .filter(Boolean);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [selected, options, emptyLabel]);

  const toggle = (value: string) => {
    onSelectedChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const handleScrollWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.scrollTop += e.deltaY;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Select value={mode} onValueChange={(v) => onModeChange(v as AudienceFilterMode)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-[100]">
            <SelectItem value="include">שלח ל...</SelectItem>
            <SelectItem value="exclude">החרג...</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
            <span className="truncate text-right">{summary}</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="mr-2 shrink-0">{selected.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-[200]" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 h-8"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-2 space-y-1" onWheel={handleScrollWheel}>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">לא נמצאו אפשרויות</p>
            ) : (
              filtered.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-md p-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2 flex justify-between text-xs">
              <span className="text-muted-foreground">{selected.length} נבחרו</span>
              <button type="button" className="underline" onClick={() => onSelectedChange([])}>
                נקה
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {mode === "include" ? "ישלח רק לנבחרים" : "לא יישלח לנבחרים"}
        </p>
      )}
    </div>
  );
}
