import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Save, RotateCcw, X, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

import { Badge } from "@/components/ui/badge";

export interface FilterState {
  searchQuery: string;
  salesPersonId: string;
  stageId: string;
  responseStatus: string[]; // Changed to array for multi-select
  tagIds: string[]; // Changed from tagId to tagIds for multi-select
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface EditingPreset {
  id: string;
  name: string;
}

interface LeadFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: FilterState;
  onApply: (filters: FilterState) => void;
  salesPeople: Array<{ id: string; full_name: string }>;
  pipelineStages: Array<{ id: string; label: string; color?: string; hexColor?: string }>;
  leadStatuses: Array<{ status_key: string; label: string; color: string }>;
  allTags: Array<{ id: string; name: string; color: string }>;
  editingPreset?: EditingPreset | null;
  onPresetUpdated?: () => void;
}

export function LeadFiltersDialog({
  open,
  onOpenChange,
  currentFilters,
  onApply,
  salesPeople,
  pipelineStages,
  leadStatuses,
  allTags,
  editingPreset,
  onPresetUpdated,
}: LeadFiltersDialogProps) {
  const { toast } = useToast();
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Search states for multi-select dropdowns
  const [statusSearch, setStatusSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  
  // Popover open states
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Handle wheel scroll inside popover
  const handleScrollWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.scrollTop += e.deltaY;
  };

  // Filtered options based on search
  const filteredStatuses = useMemo(() => {
    if (!statusSearch.trim()) return leadStatuses;
    const searchLower = statusSearch.toLowerCase();
    return leadStatuses.filter(s => s.label.toLowerCase().includes(searchLower));
  }, [leadStatuses, statusSearch]);

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return allTags;
    const searchLower = tagSearch.toLowerCase();
    return allTags.filter(t => t.name.toLowerCase().includes(searchLower));
  }, [allTags, tagSearch]);

  // Sync with current filters when dialog opens or when currentFilters change while dialog is open
  useEffect(() => {
    if (open) {
      setFilters(currentFilters);
      setStatusSearch("");
      setTagSearch("");
    }
  }, [open, currentFilters]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleApply = () => {
    onApply(filters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: FilterState = {
      searchQuery: "",
      salesPersonId: "all",
      stageId: "all",
      responseStatus: [],
      tagIds: [],
      startDate: undefined,
      endDate: undefined,
    };
    setFilters(resetFilters);
    onApply(resetFilters);
    onOpenChange(false);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || !tenantId || !userId) {
      toast({
        title: "נא להזין שם לפריסט",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const filtersToSave = {
        searchQuery: filters.searchQuery || null,
        salesPersonId: filters.salesPersonId,
        stageId: filters.stageId,
        responseStatus: filters.responseStatus,
        tagIds: filters.tagIds,
        startDate: filters.startDate?.toISOString() || null,
        endDate: filters.endDate?.toISOString() || null,
      };

      const { error } = await supabase
        .from("lead_filter_presets")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          name: presetName.trim(),
          filters: filtersToSave,
        });

      if (error) throw error;

      toast({
        title: "פריסט נשמר בהצלחה",
      });

      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets"] });
      setSaveDialogOpen(false);
      setPresetName("");
    } catch (error: any) {
      toast({
        title: "שגיאה בשמירת פריסט",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update existing preset
  const handleUpdatePreset = async () => {
    if (!editingPreset || !tenantId) return;

    setIsUpdating(true);
    try {
      const filtersToSave = {
        searchQuery: filters.searchQuery || null,
        salesPersonId: filters.salesPersonId,
        stageId: filters.stageId,
        responseStatus: filters.responseStatus,
        tagIds: filters.tagIds,
        startDate: filters.startDate?.toISOString() || null,
        endDate: filters.endDate?.toISOString() || null,
      };

      const { error } = await supabase
        .from("lead_filter_presets")
        .update({ filters: filtersToSave })
        .eq("id", editingPreset.id);

      if (error) throw error;

      toast({
        title: "פריסט עודכן בהצלחה",
      });

      queryClient.invalidateQueries({ queryKey: ["lead-filter-presets"] });
      onPresetUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "שגיאה בעדכון פריסט",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle status selection
  const toggleStatus = (statusKey: string) => {
    setFilters(prev => {
      const currentStatuses = prev.responseStatus;
      if (currentStatuses.includes(statusKey)) {
        return { ...prev, responseStatus: currentStatuses.filter(s => s !== statusKey) };
      } else {
        return { ...prev, responseStatus: [...currentStatuses, statusKey] };
      }
    });
  };

  // Toggle tag selection
  const toggleTag = (tagId: string) => {
    setFilters(prev => {
      const currentTags = prev.tagIds;
      if (currentTags.includes(tagId)) {
        return { ...prev, tagIds: currentTags.filter(t => t !== tagId) };
      } else {
        return { ...prev, tagIds: [...currentTags, tagId] };
      }
    });
  };

  // Get selected status labels for display - show max 2 items then "+X"
  const selectedStatusLabels = useMemo(() => {
    if (filters.responseStatus.length === 0) return "כל הסטטוסים";
    
    const labels: string[] = [];
    if (filters.responseStatus.includes("none")) {
      labels.push("ללא סטטוס");
    }
    const otherLabels = filters.responseStatus
      .filter(s => s !== "none")
      .map(s => leadStatuses.find(ls => ls.status_key === s)?.label)
      .filter(Boolean) as string[];
    labels.push(...otherLabels);
    
    if (labels.length <= 2) {
      return labels.join(", ");
    }
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [filters.responseStatus, leadStatuses]);

  // Get selected tag labels for display - show max 2 items then "+X"
  const selectedTagLabels = useMemo(() => {
    if (filters.tagIds.length === 0) return "כל התגיות";
    
    const labels: string[] = [];
    if (filters.tagIds.includes("none")) {
      labels.push("ללא תגית");
    }
    const otherLabels = filters.tagIds
      .filter(t => t !== "none")
      .map(t => allTags.find(at => at.id === t)?.name)
      .filter(Boolean) as string[];
    labels.push(...otherLabels);
    
    if (labels.length <= 2) {
      return labels.join(", ");
    }
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [filters.tagIds, allTags]);

  const hasActiveFilters = 
    filters.salesPersonId !== "all" ||
    filters.stageId !== "all" ||
    filters.responseStatus.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.startDate ||
    filters.endDate;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingPreset ? `עריכת פריסט: ${editingPreset.name}` : "סינון לידים"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Sales Person */}
            <div className="space-y-2">
              <Label>איש מכירות</Label>
              <Select 
                value={filters.salesPersonId} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, salesPersonId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר איש מכירות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל אנשי המכירות</SelectItem>
                  <SelectItem value="none">ללא שיוך</SelectItem>
                  {salesPeople?.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pipeline Stage */}
            <div className="space-y-2">
              <Label>שלב Pipeline</Label>
              <Select 
                value={filters.stageId} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, stageId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר שלב" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השלבים</SelectItem>
                  {pipelineStages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Response Status - Multi-select with search */}
            <div className="space-y-2">
              <Label>סטטוס תגובה</Label>
              <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedStatusLabels}</span>
                    {filters.responseStatus.length > 0 && (
                      <Badge variant="secondary" className="mr-2 shrink-0">
                        {filters.responseStatus.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-popover z-[200]" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="חיפוש סטטוס..."
                        value={statusSearch}
                        onChange={(e) => setStatusSearch(e.target.value)}
                        className="pr-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto" onWheel={handleScrollWheel}>
                    <div className="p-2 space-y-1">
                      {/* "None" option */}
                      <label
                        className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={filters.responseStatus.includes("none")}
                          onCheckedChange={() => toggleStatus("none")}
                        />
                        <span>ללא סטטוס</span>
                      </label>
                      {filteredStatuses.map((status) => (
                        <label
                          key={status.status_key}
                          className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent"
                        >
                          <Checkbox
                            checked={filters.responseStatus.includes(status.status_key)}
                            onCheckedChange={() => toggleStatus(status.status_key)}
                          />
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span>{status.label}</span>
                        </label>
                      ))}
                      {filteredStatuses.length === 0 && (
                        <div className="text-center text-muted-foreground py-2">
                          לא נמצאו סטטוסים
                        </div>
                      )}
                    </div>
                  </div>
                  {filters.responseStatus.length > 0 && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setFilters(prev => ({ ...prev, responseStatus: [] }))}
                      >
                        <X className="h-4 w-4 ml-2" />
                        נקה בחירה
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags - Multi-select with search */}
            <div className="space-y-2">
              <Label>תגית</Label>
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedTagLabels}</span>
                    {filters.tagIds.length > 0 && (
                      <Badge variant="secondary" className="mr-2 shrink-0">
                        {filters.tagIds.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-popover z-[200]" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="חיפוש תגית..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="pr-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto" onWheel={handleScrollWheel}>
                    <div className="p-2 space-y-1">
                      {/* "None" option */}
                      <label
                        className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={filters.tagIds.includes("none")}
                          onCheckedChange={() => toggleTag("none")}
                        />
                        <span>ללא תגית</span>
                      </label>
                      {filteredTags.map((tag) => (
                        <label
                          key={tag.id}
                          className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent"
                        >
                          <Checkbox
                            checked={filters.tagIds.includes(tag.id)}
                            onCheckedChange={() => toggleTag(tag.id)}
                          />
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>{tag.name}</span>
                        </label>
                      ))}
                      {filteredTags.length === 0 && (
                        <div className="text-center text-muted-foreground py-2">
                          לא נמצאו תגיות
                        </div>
                      )}
                    </div>
                  </div>
                  {filters.tagIds.length > 0 && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setFilters(prev => ({ ...prev, tagIds: [] }))}
                      >
                        <X className="h-4 w-4 ml-2" />
                        נקה בחירה
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>טווח תאריכים</Label>
              <div className="flex gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-right font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : "מתאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-right font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : "עד תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {(filters.startDate || filters.endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              איפוס
            </Button>
            {editingPreset ? (
              <Button 
                onClick={handleUpdatePreset} 
                disabled={isUpdating}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isUpdating ? "מעדכן..." : "עדכן פריסט"}
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!hasActiveFilters}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  שמור כפריסט
                </Button>
                <Button onClick={handleApply} className="gap-2">
                  החל פילטרים
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>שמירת פריסט פילטרים</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="preset-name">שם הפריסט</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="לדוגמה: לידים חמים"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSavePreset} disabled={isSaving}>
              {isSaving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
