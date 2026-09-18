import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, GripVertical, Plus, Trash2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLeadPipelineStages, useLeadPipelineStageMutations, LeadPipelineStage } from "@/hooks/useLeadPipelineStages";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
          type="button"
          className="w-6 h-6 rounded border border-border shrink-0"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
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

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: LeadPipelineStage;
  onUpdate: (updates: Partial<LeadPipelineStage>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(stage.label);
  useEffect(() => {
    setLabel(stage.label);
  }, [stage.label]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleBlur = () => {
    if (label !== stage.label) {
      onUpdate({ label });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded border border-border bg-background",
        isDragging && "shadow-lg ring-2 ring-primary/20 z-10",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="גרור לשינוי סדר"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
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

interface ManagePipelineStagesDialogProps {
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

export function ManagePipelineStagesDialog({
  trigger,
  onDialogOpen,
  open: controlledOpen,
  onOpenChange: onControlledOpenChange,
  showTrigger = true,
}: ManagePipelineStagesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onControlledOpenChange ?? setInternalOpen;

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [searchQuery, setSearchQuery] = useState("");
  const [localStages, setLocalStages] = useState<LeadPipelineStage[]>([]);

  const { stages, isLoading } = useLeadPipelineStages();
  const { updateStage, createStage, deleteStage, updateSortOrders } = useLeadPipelineStageMutations();

  useEffect(() => {
    setLocalStages(stages);
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visibleStages = localStages.filter((stage) =>
    stage.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localStages.findIndex((stage) => stage.id === active.id);
    const newIndex = localStages.findIndex((stage) => stage.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(localStages, oldIndex, newIndex);
    setLocalStages(newOrder);
    updateSortOrders.mutate(newOrder.map((stage, index) => ({
      id: stage.id,
      sort_order: index,
    })));
  };

  const handleAddStage = () => {
    if (!newLabel.trim()) return;
    createStage.mutate({ label: newLabel.trim(), color: newColor });
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
            <Button variant="outline" size="sm">
              <Settings2 className="w-4 h-4 ml-2" />
              ניהול שלבי משפך
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול שלבי משפך</DialogTitle>
        </DialogHeader>
        
        {localStages.length > 3 && (
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש שלב..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 h-9 text-sm"
              dir="rtl"
            />
          </div>
        )}
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוען...</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleStages.map((stage) => stage.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleStages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onUpdate={(updates) => updateStage.mutate({ id: stage.id, ...updates })}
                    onDelete={() => deleteStage.mutate(stage.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
