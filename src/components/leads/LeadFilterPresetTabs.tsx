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
import { Trash2, Filter, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface StagePreset {
  id: string;
  label: string;
  hexColor?: string;
}

interface LeadFilterPresetTabsProps {
  activePresetId: string | null;
  onPresetSelect: (preset: FilterPreset | null) => void;
  onOpenFiltersDialog: () => void;
  onEditPreset: (preset: FilterPreset) => void;
  hasActiveFilters: boolean;
  pipelineStages?: StagePreset[];
  activeStageId?: string;
  onStageSelect?: (stageId: string) => void;
  stageCounts?: Record<string, number>;
}

export function LeadFilterPresetTabs({
  activePresetId,
  onPresetSelect,
  onOpenFiltersDialog,
  onEditPreset,
  hasActiveFilters,
  pipelineStages = [],
  activeStageId = "all",
  onStageSelect,
  stageCounts,
}: LeadFilterPresetTabsProps) {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: presets = [] } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets", tenantId] });
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

  const userOwnsPreset = (preset: FilterPreset) => preset.user_id === userId;
  const activePreset = presets.find((p) => p.id === activePresetId);

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
      {pipelineStages.length > 0 && onStageSelect && (
        <>
          <Button
            type="button"
            variant={activeStageId === "all" ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0"
            onClick={() => onStageSelect("all")}
          >
            הכל
            {typeof stageCounts?.all === "number" && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] mr-1">
                {stageCounts.all.toLocaleString()}
              </Badge>
            )}
          </Button>
          {pipelineStages.map((stage) => {
            const count = stageCounts?.[stage.id];
            const isActive = activeStageId === stage.id;
            return (
              <Button
                key={stage.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                style={
                  isActive && stage.hexColor
                    ? { backgroundColor: stage.hexColor, borderColor: stage.hexColor, color: "#fff" }
                    : stage.hexColor
                      ? { borderColor: stage.hexColor }
                      : undefined
                }
                onClick={() => onStageSelect(stage.id)}
              >
                {stage.label}
                {typeof count === "number" && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 px-1.5 text-[10px]",
                      isActive && "bg-white/20 text-inherit hover:bg-white/20",
                    )}
                  >
                    {count.toLocaleString()}
                  </Badge>
                )}
              </Button>
            );
          })}
        </>
      )}

      {presets.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={activePresetId ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 shrink-0"
            >
              {activePreset ? activePreset.name : "פריסטים"}
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {presets.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover">
            {activePresetId && (
              <DropdownMenuItem onClick={() => onPresetSelect(null)} className="gap-2">
                נקה פריסט
              </DropdownMenuItem>
            )}
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onPresetSelect(preset)}
                className={cn(
                  "flex items-center justify-between gap-2 group",
                  activePresetId === preset.id && "bg-accent",
                )}
              >
                <span>{preset.name}</span>
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
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFiltersDialog}
        className={cn(
          "h-9 gap-2 shrink-0",
          hasActiveFilters && "border-primary text-primary",
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
  );
}
