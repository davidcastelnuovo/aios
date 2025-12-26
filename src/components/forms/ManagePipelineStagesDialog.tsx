import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, GripVertical, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLeadPipelineStages, useLeadPipelineStageMutations, LeadPipelineStage } from "@/hooks/useLeadPipelineStages";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#6b7280", "#374151", "#111827"
];

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-6 h-6 rounded border border-border shrink-0"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
        <Input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 h-8 text-xs"
          placeholder="#hexcode"
        />
      </PopoverContent>
    </Popover>
  );
}

function StageRow({ 
  stage, 
  onUpdate, 
  onDelete 
}: { 
  stage: LeadPipelineStage; 
  onUpdate: (updates: Partial<LeadPipelineStage>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(stage.label);

  const handleBlur = () => {
    if (label !== stage.label) {
      onUpdate({ label });
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border bg-background">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      <ColorPicker
        color={stage.color}
        onChange={(color) => onUpdate({ color })}
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={handleBlur}
        className="h-8 flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function ManagePipelineStagesDialog({ trigger, onDialogOpen }: { trigger?: React.ReactNode; onDialogOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  
  const { stages, isLoading } = useLeadPipelineStages();
  const { updateStage, createStage, deleteStage } = useLeadPipelineStageMutations();

  const handleAddStage = () => {
    if (!newLabel.trim()) return;
    createStage.mutate({ label: newLabel.trim(), color: newColor });
    setNewLabel("");
    setNewColor("#3b82f6");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && onDialogOpen) {
      onDialogOpen();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings2 className="w-4 h-4 ml-2" />
            ניהול שלבי משפך
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול שלבי משפך</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוען...</p>
          ) : (
            stages.map((stage) => (
              <StageRow
                key={stage.id}
                stage={stage}
                onUpdate={(updates) => updateStage.mutate({ id: stage.id, ...updates })}
                onDelete={() => deleteStage.mutate(stage.id)}
              />
            ))
          )}
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <ColorPicker color={newColor} onChange={setNewColor} />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="שם שלב חדש..."
            className="h-8 flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
          />
          <Button size="sm" onClick={handleAddStage} disabled={!newLabel.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
