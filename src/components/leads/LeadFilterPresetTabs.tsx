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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Filter, Settings2, ChevronDown, Check } from "lucide-react";
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

  const activePreset = presets.find((p) => p.id === activePresetId) ?? null;
  const activeStage =
    activeStageId === "all"
      ? null
      : pipelineStages.find((s) => s.id === activeStageId) ?? null;

  const pipelineTriggerLabel =
    activeStageId === "all" ? "הכל" : activeStage?.label ?? "פייפליין";
  const pipelineTriggerCount =
    activeStageId === "all"
      ? stageCounts?.all
      : stageCounts?.[activeStageId];

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={activePresetId ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0 gap-1.5"
          >
            {activePreset?.name ?? "פריסט"}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 bg-popover">
          {presets.length === 0 ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              אין פריסטים שמורים
            </DropdownMenuLabel>
          ) : (
            presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() =>
                  onPresetSelect(activePresetId === preset.id ? null : preset)
                }
                className="justify-between gap-2"
              >
                <span>{preset.name}</span>
                {activePresetId === preset.id && <Check className="h-4 w-4 shrink-0" />}
              </DropdownMenuItem>
            ))
          )}
          {activePreset && userOwnsPreset(activePreset) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleEditFiltersClick(activePreset)}
                className="gap-2"
              >
                <Settings2 className="h-3.5 w-3.5" />
                ערוך פריסט
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteClick(activePreset)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחק פריסט
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFiltersDialog}
        className={cn(
          "h-9 shrink-0 gap-2",
          hasActiveFilters && "border-primary text-primary",
        )}
      >
        <Filter className="h-4 w-4" />
        פילטרים
        {hasActiveFilters && (
          <Badge
            variant="secondary"
            className="flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
          >
            ✓
          </Badge>
        )}
      </Button>

      {pipelineStages.length > 0 && onStageSelect && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              style={
                activeStage?.hexColor
                  ? {
                      backgroundColor: activeStage.hexColor,
                      borderColor: activeStage.hexColor,
                      color: "#fff",
                    }
                  : undefined
              }
            >
              <span>פייפליין</span>
              <span className="opacity-90">·</span>
              <span>{pipelineTriggerLabel}</span>
              {typeof pipelineTriggerCount === "number" && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 px-1.5 text-[10px]",
                    activeStage?.hexColor && "bg-white/20 text-inherit hover:bg-white/20",
                  )}
                >
                  {pipelineTriggerCount.toLocaleString()}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 opacity-60",
                  activeStage?.hexColor && "text-inherit",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover p-1.5">
            <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
              שלבי פייפליין
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onStageSelect("all")}
              className={cn(
                "mb-1 justify-between gap-2 rounded-md",
                activeStageId === "all" && "bg-accent",
              )}
            >
              <span>הכל</span>
              <span className="flex items-center gap-2">
                {typeof stageCounts?.all === "number" && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {stageCounts.all.toLocaleString()}
                  </Badge>
                )}
                {activeStageId === "all" && <Check className="h-4 w-4 shrink-0" />}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            {pipelineStages.map((stage) => {
              const count = stageCounts?.[stage.id];
              const isActive = activeStageId === stage.id;
              return (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => onStageSelect(stage.id)}
                  className="mb-1 justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 focus:text-inherit"
                  style={
                    stage.hexColor
                      ? {
                          backgroundColor: stage.hexColor,
                          color: "#fff",
                        }
                      : undefined
                  }
                >
                  <span>{stage.label}</span>
                  <span className="flex items-center gap-2">
                    {typeof count === "number" && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 px-1.5 text-[10px]",
                          stage.hexColor && "bg-white/20 text-inherit hover:bg-white/20",
                        )}
                      >
                        {count.toLocaleString()}
                      </Badge>
                    )}
                    {isActive && <Check className="h-4 w-4 shrink-0" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
