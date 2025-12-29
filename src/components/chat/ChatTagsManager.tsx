import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tags, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
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

interface ChatTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
  "#8b5cf6", "#ec4899", "#6b7280", "#1f2937", "#78716c", "#0ea5e9",
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (newColor: string) => {
    onChange(newColor);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-6 h-6 rounded-md border border-border shrink-0 cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              className={`w-6 h-6 rounded-md cursor-pointer hover:scale-110 transition-transform ${
                color === presetColor ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              style={{ backgroundColor: presetColor }}
              onClick={() => handleColorSelect(presetColor)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="w-8 h-8 p-0 border-0 cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsOpen(false);
            }}
            className="flex-1 h-8 text-xs"
            placeholder="#000000"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SortableTagRowProps {
  tag: ChatTag;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}

function SortableTagRow({ tag, onUpdate, onDelete }: SortableTagRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editingName, setEditingName] = useState(tag.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleNameBlur = () => {
    if (editingName.trim() && editingName !== tag.name) {
      onUpdate(tag.id, editingName.trim(), tag.color);
    } else {
      setEditingName(tag.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <ColorPicker
        color={tag.color}
        onChange={(newColor) => onUpdate(tag.id, tag.name, newColor)}
      />

      <Input
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        onBlur={handleNameBlur}
        onKeyDown={handleKeyDown}
        className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-1"
        dir="rtl"
      />

      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => onDelete(tag.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ChatTagsManagerProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function ChatTagsManager({ trigger, open: controlledOpen, onOpenChange, showTrigger = true }: ChatTagsManagerProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [localTags, setLocalTags] = useState<ChatTag[] | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['chat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('chat_tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as ChatTag[];
    },
    enabled: !!tenantId && open,
  });

  const displayTags = localTags ?? tags;

  const createTagMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !newTagName.trim()) throw new Error('Missing data');
      
      const maxSortOrder = Math.max(0, ...displayTags.map((t) => t.sort_order));
      const { error } = await supabase
        .from('chat_tags')
        .insert({
          tenant_id: tenantId,
          name: newTagName.trim(),
          color: newTagColor,
          sort_order: maxSortOrder + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
      setNewTagName("");
      toast.success('התגית נוצרה בהצלחה');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('תגית עם שם זה כבר קיימת');
      } else {
        toast.error('שגיאה ביצירת התגית');
      }
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('chat_tags')
        .update({ name, color })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
    },
    onError: () => {
      toast.error('שגיאה בעדכון התגית');
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chat_tags')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
      toast.success('התגית נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת התגית');
    },
  });

  const updateSortOrdersMutation = useMutation({
    mutationFn: async (orderedTags: ChatTag[]) => {
      for (let i = 0; i < orderedTags.length; i++) {
        const { error } = await supabase
          .from('chat_tags')
          .update({ sort_order: i })
          .eq('id', orderedTags[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
      setLocalTags(null);
    },
    onError: () => {
      toast.error('שגיאה בשמירת הסדר');
      setLocalTags(null);
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayTags.findIndex((t) => t.id === active.id);
      const newIndex = displayTags.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(displayTags, oldIndex, newIndex);
      setLocalTags(newOrder);
      updateSortOrdersMutation.mutate(newOrder);
    }
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-md" dir="rtl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          ניהול תגיות צ'אט
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Add new tag */}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border">
          <ColorPicker color={newTagColor} onChange={setNewTagColor} />
          <Input
            placeholder="שם התגית החדשה..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTagName.trim()) {
                createTagMutation.mutate();
              }
            }}
            className="flex-1 h-8 text-sm"
            dir="rtl"
          />
          <Button
            size="sm"
            onClick={() => createTagMutation.mutate()}
            disabled={!newTagName.trim() || createTagMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Existing tags */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">טוען...</div>
          ) : displayTags.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              אין תגיות עדיין. הוסף תגית חדשה למעלה.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayTags.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {displayTags.map((tag) => (
                  <SortableTagRow
                    key={tag.id}
                    tag={tag}
                    onUpdate={(id, name, color) =>
                      updateTagMutation.mutate({ id, name, color })
                    }
                    onDelete={(id) => deleteTagMutation.mutate(id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </DialogContent>
  );

  if (!showTrigger) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Tags className="h-4 w-4 ml-2" />
            ניהול תגיות
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
