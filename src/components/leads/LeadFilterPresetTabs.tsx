import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Pencil, Trash2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FilterState } from "./LeadFiltersDialog";

interface FilterPreset {
  id: string;
  name: string;
  filters: {
    searchQuery?: string | null;
    salesPersonId?: string;
    stageId?: string;
    responseStatus?: string;
    tagId?: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  sort_order: number;
}

interface LeadFilterPresetTabsProps {
  activePresetId: string | null;
  onPresetSelect: (preset: FilterPreset | null) => void;
  onOpenFiltersDialog: () => void;
  hasActiveFilters: boolean;
}

export function LeadFilterPresetTabs({
  activePresetId,
  onPresetSelect,
  onOpenFiltersDialog,
  hasActiveFilters,
}: LeadFilterPresetTabsProps) {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [editName, setEditName] = useState("");

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["lead-filter-presets", tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return [];
      const { data, error } = await supabase
        .from("lead_filter_presets")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as FilterPreset[];
    },
    enabled: !!tenantId && !!userId,
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from("lead_filter_presets")
        .delete()
        .eq("id", presetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets"] });
      toast({ title: "פריסט נמחק בהצלחה" });
      if (activePresetId === editingPreset?.id) {
        onPresetSelect(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במחיקת פריסט",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("lead_filter_presets")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets"] });
      toast({ title: "פריסט עודכן בהצלחה" });
      setEditDialogOpen(false);
      setEditingPreset(null);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון פריסט",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (preset: FilterPreset) => {
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (preset: FilterPreset) => {
    if (confirm(`למחוק את הפריסט "${preset.name}"?`)) {
      deletePresetMutation.mutate(preset.id);
    }
  };

  const handleSaveEdit = () => {
    if (!editingPreset || !editName.trim()) return;
    updatePresetMutation.mutate({ id: editingPreset.id, name: editName.trim() });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <ScrollArea className="flex-1" dir="rtl">
          <div className="flex items-center gap-2 pb-2">
            {/* All button */}
            <Button
              variant={activePresetId === null && !hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => onPresetSelect(null)}
              className="shrink-0"
            >
              הכל
            </Button>

            {/* Preset tabs */}
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1 shrink-0">
                <Button
                  variant={activePresetId === preset.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPresetSelect(preset)}
                  className="gap-2"
                >
                  {preset.name}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditClick(preset)}>
                      <Pencil className="h-4 w-4 ml-2" />
                      שנה שם
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(preset)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      מחק
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            <ScrollBar orientation="horizontal" />
          </div>
        </ScrollArea>

        {/* Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFiltersDialog}
          className={cn(
            "gap-2 shrink-0",
            hasActiveFilters && "border-primary text-primary"
          )}
        >
          <Filter className="h-4 w-4" />
          פילטרים
          {hasActiveFilters && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs">
              ✓
            </Badge>
          )}
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת שם פריסט</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-name">שם הפריסט</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updatePresetMutation.isPending}
            >
              {updatePresetMutation.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { FilterPreset };
