import { useState } from "react";
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
import { Calendar as CalendarIcon, Save, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";

export interface FilterState {
  searchQuery: string;
  salesPersonId: string;
  stageId: string;
  responseStatus: string;
  tagId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
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
}: LeadFiltersDialogProps) {
  const { toast } = useToast();
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync with current filters when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setFilters(currentFilters);
    }
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
      responseStatus: "all",
      tagId: "all",
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
        tagId: filters.tagId,
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

  const hasActiveFilters = 
    filters.salesPersonId !== "all" ||
    filters.stageId !== "all" ||
    filters.responseStatus !== "all" ||
    filters.tagId !== "all" ||
    filters.startDate ||
    filters.endDate;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl">סינון לידים</DialogTitle>
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

            {/* Response Status */}
            <div className="space-y-2">
              <Label>סטטוס תגובה</Label>
              <Select 
                value={filters.responseStatus} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, responseStatus: val }))}
              >
                <SelectTrigger
                  style={{
                    backgroundColor: filters.responseStatus !== "all" && filters.responseStatus !== "none"
                      ? leadStatuses.find(s => s.status_key === filters.responseStatus)?.color
                      : undefined,
                    color: filters.responseStatus !== "all" && filters.responseStatus !== "none" ? "#fff" : undefined,
                  }}
                >
                  <SelectValue placeholder="בחר סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="none">ללא סטטוס</SelectItem>
                  {leadStatuses?.map((status) => (
                    <SelectItem 
                      key={status.status_key} 
                      value={status.status_key}
                      style={{ backgroundColor: status.color, color: "#fff" }}
                    >
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tag */}
            <div className="space-y-2">
              <Label>תגית</Label>
              <Select 
                value={filters.tagId} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, tagId: val }))}
              >
                <SelectTrigger
                  style={{
                    backgroundColor: filters.tagId !== "all" && filters.tagId !== "none"
                      ? allTags.find(t => t.id === filters.tagId)?.color
                      : undefined,
                    color: filters.tagId !== "all" && filters.tagId !== "none" ? "#fff" : undefined,
                  }}
                >
                  <SelectValue placeholder="בחר תגית" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל התגיות</SelectItem>
                  <SelectItem value="none">ללא תגית</SelectItem>
                  {allTags?.map((tag) => (
                    <SelectItem 
                      key={tag.id} 
                      value={tag.id}
                      style={{ backgroundColor: tag.color, color: "#fff" }}
                    >
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
