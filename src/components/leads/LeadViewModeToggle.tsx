import { Check, LayoutGrid, MessageCircle, Star, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  LEAD_VIEW_MODE_LABELS,
  LEAD_VIEW_MODES,
  type LeadViewMode,
} from "@/lib/leadViewMode";

const VIEW_ICONS: Record<LeadViewMode, typeof LayoutGrid> = {
  kanban: LayoutGrid,
  table: TableIcon,
  chat: MessageCircle,
};

export function LeadViewModeToggle({
  viewMode,
  defaultView,
  onViewModeChange,
  onDefaultViewChange,
  compact = false,
  hideDefaultMenu = false,
}: {
  viewMode: LeadViewMode;
  defaultView: LeadViewMode | null;
  onViewModeChange: (mode: LeadViewMode) => void;
  onDefaultViewChange: (mode: LeadViewMode) => void;
  compact?: boolean;
  hideDefaultMenu?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("flex gap-0.5 border rounded-md", compact ? "p-0.5" : "p-1")}>
        {LEAD_VIEW_MODES.map((mode) => {
          const Icon = VIEW_ICONS[mode];
          return (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange(mode)}
              className={compact ? "h-7 w-7 p-0" : undefined}
              title={LEAD_VIEW_MODE_LABELS[mode]}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
      {hideDefaultMenu ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="תצוגת ברירת מחדל"
          >
            <Star className={cn("h-4 w-4", defaultView === viewMode && "fill-current")} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>תצוגת ברירת מחדל</DropdownMenuLabel>
          {LEAD_VIEW_MODES.map((mode) => {
            const Icon = VIEW_ICONS[mode];
            const isDefault = defaultView === mode;
            return (
              <DropdownMenuItem key={mode} className="gap-2" onClick={() => onDefaultViewChange(mode)}>
                <Icon className="h-4 w-4" />
                <span className="flex-1">{LEAD_VIEW_MODE_LABELS[mode]}</span>
                {isDefault ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
}
