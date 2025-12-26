import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Plus, Trash2, GripVertical, Check } from "lucide-react";
import { useLeadStatuses, useLeadStatusMutations, LeadStatus } from "@/hooks/useLeadStatuses";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#9ca3af", // gray
  "#fbbf24", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#dc2626", // dark red
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-8 h-8 rounded-md border-2 border-border flex-shrink-0 transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              className={cn(
                "w-8 h-8 rounded-md border-2 transition-transform hover:scale-110",
                color === presetColor ? "border-primary ring-2 ring-primary/30" : "border-border"
              )}
              style={{ backgroundColor: presetColor }}
              onClick={() => {
                onChange(presetColor);
                setOpen(false);
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="h-8 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StatusRowProps {
  status: LeadStatus;
  onUpdate: (id: string, label: string, color: string) => void;
  onDelete: (id: string) => void;
}

function StatusRow({ status, onUpdate, onDelete }: StatusRowProps) {
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (label !== status.label || color !== status.color) {
      onUpdate(status.id, label, color);
    }
    setIsEditing(false);
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onUpdate(status.id, label, newColor);
  };

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 group">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      
      <ColorPicker color={color} onChange={handleColorChange} />
      
      <div className="flex-1">
        {isEditing ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="h-8"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-right w-full px-2 py-1 rounded hover:bg-muted text-sm font-medium"
          >
            {status.label}
          </button>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={() => onDelete(status.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ManageLeadStatusesDialogProps {
  trigger?: React.ReactNode;
  /**
   * Optional: called when the dialog is opened. Useful when the trigger lives inside another overlay (e.g. Select).
   */
  onDialogOpen?: () => void;
  /** Controlled open state */
  open?: boolean;
  /** Controlled open handler */
  onOpenChange?: (open: boolean) => void;
  /** Hide the default trigger button (useful when controlling open externally) */
  showTrigger?: boolean;
}

export function ManageLeadStatusesDialog({
  trigger,
  onDialogOpen,
  open: controlledOpen,
  onOpenChange: onControlledOpenChange,
  showTrigger = true,
}: ManageLeadStatusesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onControlledOpenChange ?? setInternalOpen;

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const { statuses } = useLeadStatuses();
  const { updateStatus, createStatus, deleteStatus } = useLeadStatusMutations();

  const handleUpdate = (id: string, label: string, color: string) => {
    updateStatus.mutate({ id, label, color });
  };

  const handleDelete = (id: string) => {
    deleteStatus.mutate(id);
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    createStatus.mutate({ label: newLabel.trim(), color: newColor });
    setNewLabel("");
    setNewColor("#3b82f6");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && onDialogOpen) onDialogOpen();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              ניהול סטטוסים
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול סטטוסי תגובה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {statuses.map((status) => (
            <StatusRow
              key={status.id}
              status={status}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <ColorPicker color={newColor} onChange={setNewColor} />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="שם סטטוס חדש..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} size="sm" className="gap-2" disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4" />
            הוסף
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
