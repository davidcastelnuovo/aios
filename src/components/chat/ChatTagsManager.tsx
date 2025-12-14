import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tags, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ChatTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280',
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 p-0"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-5 gap-2">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              className="h-6 w-6 rounded-full border-2 border-transparent hover:border-foreground transition-colors"
              style={{ backgroundColor: presetColor }}
              onClick={() => onChange(presetColor)}
            />
          ))}
        </div>
        <div className="mt-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full p-0 border-none"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ChatTagsManagerProps {
  trigger?: React.ReactNode;
}

export function ChatTagsManager({ trigger }: ChatTagsManagerProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");

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

  const createTagMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !newTagName.trim()) throw new Error('Missing data');
      
      const { error } = await supabase
        .from('chat_tags')
        .insert({
          tenant_id: tenantId,
          name: newTagName.trim(),
          color: newTagColor,
          sort_order: tags.length,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
      setNewTagName("");
      toast.success('התג נוצר בהצלחה');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('תג עם שם זה כבר קיים');
      } else {
        toast.error('שגיאה ביצירת התג');
      }
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: Partial<ChatTag> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      
      const { error } = await supabase
        .from('chat_tags')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-tags'] });
    },
    onError: () => {
      toast.error('שגיאה בעדכון התג');
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
      toast.success('התג נמחק בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת התג');
    },
  });

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
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול תגיות צ'אט</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add new tag */}
          <div className="flex items-center gap-2">
            <ColorPicker color={newTagColor} onChange={setNewTagColor} />
            <Input
              placeholder="שם התג החדש..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagName.trim()) {
                  createTagMutation.mutate();
                }
              }}
              className="flex-1"
            />
            <Button
              size="icon"
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
            ) : tags.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">אין תגיות עדיין</div>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <ColorPicker
                    color={tag.color}
                    onChange={(color) => updateTagMutation.mutate({ id: tag.id, color })}
                  />
                  <Input
                    value={tag.name}
                    onChange={(e) => updateTagMutation.mutate({ id: tag.id, name: e.target.value })}
                    className="flex-1 h-8"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteTagMutation.mutate(tag.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
