import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Unlink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  filterEntityAssignmentOptions,
  toggleEntityAssignmentId,
  type EntityAssignmentOption,
} from "@/lib/entityAssignment";

export type EntityAssignmentGroup = {
  type: string;
  label: string;
  icon: LucideIcon;
  options: EntityAssignmentOption[];
  multiple?: boolean;
  emptyLabel?: string;
};

export type EntityAssignmentSelection = {
  type: string;
  ids: string[];
} | null;

interface EntityAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  groups: EntityAssignmentGroup[];
  currentSelection: EntityAssignmentSelection;
  onSave: (selection: EntityAssignmentSelection) => void | Promise<void>;
}

/**
 * Shared searchable assignment dialog for any module that links an entity to
 * clients, team members, agencies, or future target types.
 */
export function EntityAssignmentDialog({
  open,
  onOpenChange,
  title = "ניהול שיוך",
  groups,
  currentSelection,
  onSave,
}: EntityAssignmentDialogProps) {
  const [activeType, setActiveType] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const groupTypes = groups.map((group) => group.type).join("|");
  const currentFingerprint = currentSelection
    ? `${currentSelection.type}:${currentSelection.ids.join(",")}`
    : "none";

  useEffect(() => {
    if (!open) return;
    const initialType = currentSelection?.type || groups[0]?.type || "";
    setActiveType(initialType);
    setSelectedIds(currentSelection?.type === initialType ? currentSelection.ids : []);
    setSearch("");
    // Fingerprints avoid resetting a user's in-dialog choices when a parent
    // rebuilds equivalent group/selection objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFingerprint, groupTypes]);

  const activeGroup = groups.find((group) => group.type === activeType) || groups[0];
  const visibleOptions = useMemo(
    () => filterEntityAssignmentOptions(activeGroup?.options || [], search),
    [activeGroup, search],
  );

  const switchType = (type: string) => {
    setActiveType(type);
    setSelectedIds(currentSelection?.type === type ? currentSelection.ids : []);
    setSearch("");
  };

  const submit = async (selection: EntityAssignmentSelection) => {
    setSaving(true);
    try {
      await onSave(selection);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeType} onValueChange={switchType}>
          <TabsList
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, minmax(0, 1fr))` }}
          >
            {groups.map((group) => {
              const Icon = group.icon;
              return (
                <TabsTrigger key={group.type} value={group.type} className="gap-1.5">
                  <Icon className="h-4 w-4" />
                  {group.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`חיפוש ${activeGroup?.label || ""} לפי שם...`}
            className="pr-9"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {visibleOptions.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {activeGroup?.emptyLabel || "לא נמצאו תוצאות"}
            </p>
          ) : (
            visibleOptions.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setSelectedIds((previous) =>
                      toggleEntityAssignmentId(previous, option.id, Boolean(activeGroup?.multiple))
                    )
                  }
                  className={cn(
                    "flex w-full items-center justify-between border-b p-3 text-right last:border-b-0 hover:bg-muted/50 disabled:opacity-50",
                    selected && "bg-primary/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      selected && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={saving}
            onClick={() => submit(null)}
          >
            <Unlink className="ml-1 h-4 w-4" />
            הסר שיוך
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button
              type="button"
              disabled={saving || !activeGroup || selectedIds.length === 0}
              onClick={() => submit({ type: activeGroup.type, ids: selectedIds })}
            >
              {saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              שמור שיוך
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

