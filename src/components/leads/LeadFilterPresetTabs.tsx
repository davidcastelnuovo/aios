import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, Filter, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FilterState } from "./LeadFiltersDialog";

export interface FilterPreset {
  id: string;
  name: string;
  user_id?: string;
  filters: {
    searchQuery?: string | null;
    salesPersonId?: string;
    stageId?: string;
    responseStatus?: string | string[]; // Support both old (string) and new (array) format
    tagId?: string; // Legacy format
    tagIds?: string[]; // New format
    startDate?: string | null;
    endDate?: string | null;
    followUpToday?: boolean; // Filter for leads with follow-up date today
  };
  sort_order: number;
}

interface LeadFilterPresetTabsProps {
  activePresetId: string | null;
  onPresetSelect: (preset: FilterPreset | null) => void;
  onOpenFiltersDialog: () => void;
  onEditPreset: (preset: FilterPreset) => void;
  hasActiveFilters: boolean;
}

export function LeadFilterPresetTabs({
  activePresetId,
  onPresetSelect,
  onOpenFiltersDialog,
  onEditPreset,
  hasActiveFilters,
}: LeadFilterPresetTabsProps) {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ALL presets for the tenant (not just user's)
  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["lead-filter-presets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("lead_filter_presets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as FilterPreset[];
    },
    enabled: !!tenantId,
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from("lead_filter_presets")
        .delete()
        .eq("id", presetId);
      if (error) throw error;
      return presetId;
    },
    onSuccess: (deletedPresetId) => {
      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets"] });
      toast({ title: "פריסט נמחק בהצלחה" });
      if (activePresetId === deletedPresetId) {
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

  const handleEditFiltersClick = (preset: FilterPreset) => {
    onEditPreset(preset);
  };

  const handleDeleteClick = (preset: FilterPreset) => {
    if (confirm(`למחוק את הפריסט "${preset.name}"?`)) {
      deletePresetMutation.mutate(preset.id);
    }
  };

  // Check if current user owns this preset
  const userOwnsPreset = (preset: FilterPreset) => preset.user_id === userId;

  // Get the active preset for display
  const activePreset = presets.find(p => p.id === activePresetId);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Presets Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={activePresetId ? "default" : "outline"}
              size="sm"
              className="gap-2 min-w-[120px]"
            >
              {activePreset ? activePreset.name : "הכל"}
              {presets.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {presets.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover">
            {/* "All" option */}
            <DropdownMenuItem
              onClick={() => onPresetSelect(null)}
              className={cn(
                "gap-2",
                !activePresetId && "bg-accent"
              )}
            >
              הכל
            </DropdownMenuItem>
            
            {presets.length > 0 && (
              <div className="h-px bg-border my-1" />
            )}
            
            {/* Preset list */}
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onPresetSelect(preset)}
                className={cn(
                  "flex items-center justify-between gap-2 group",
                  activePresetId === preset.id && "bg-accent"
                )}
              >
                <span>{preset.name}</span>
                {/* Only show edit/delete for presets owned by current user */}
                {userOwnsPreset(preset) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleEditFiltersClick(preset);
                      }}
                      title="ערוך פילטרים"
                    >
                      <Settings2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteClick(preset);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
    </>
  );
}


