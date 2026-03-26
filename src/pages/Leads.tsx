import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign, LayoutGrid, Table as TableIcon, GripVertical, ChevronDown, ChevronUp, User, Calendar as CalendarIcon, Search, X, Settings2, CheckSquare, Download, Clock, Tag, Filter, FileSpreadsheet, MessageCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddLeadForm } from "@/components/forms/AddLeadForm";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { ImportLeadsWithMapping } from "@/components/forms/ImportLeadsWithMapping";
import { ManageLeadStatusesDialog } from "@/components/forms/ManageLeadStatusesDialog";
import { ManagePipelineStagesDialog } from "@/components/forms/ManagePipelineStagesDialog";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLeadStatuses, LeadStatus } from "@/hooks/useLeadStatuses";
import { useLeadPipelineStages, LeadPipelineStage } from "@/hooks/useLeadPipelineStages";
import { LeadFiltersDialog, FilterState } from "@/components/leads/LeadFiltersDialog";
import { LeadFilterPresetTabs, FilterPreset } from "@/components/leads/LeadFilterPresetTabs";
import { useViewAs } from "@/contexts/ViewAsContext";
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  defaultDropAnimationSideEffects,
  useDroppable,
  type DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, ReactNode, useRef, useEffect, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizableTable, ColumnConfig } from "@/components/ResizableTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { LeadTagSelector, LeadTagBadges } from "@/components/leads/LeadTagSelector";
import { ChatTagsManager } from "@/components/chat/ChatTagsManager";
import { ImportLeadsSheet } from "@/components/forms/ImportLeadsSheet";
import { FollowUpDatePicker } from "@/components/leads/FollowUpDatePicker";
import { LeadsChatView } from "@/components/leads/LeadsChatView";


const DROP_ANIMATION_MS = 220;

const dropAnimationConfig: DropAnimation = {
  duration: DROP_ANIMATION_MS,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0",
      },
    },
  }),
};


// Helper functions for dynamic pipeline stages
function hexToLightBg(hex: string): string {
  // Convert hex to HSL and make it lighter for background
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.15)`;
}

const SOURCE_LABELS: Record<string, string> = {
  phone: "טלפון",
  website: "אתר",
  facebook: "פייסבוק",
  google: "גוגל",
  referral: "הפניה",
  other: "אחר",
};

const PRODUCT_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  facebook_ads: "פרסום פייסבוק",
  seo: "SEO",
  website_design: "עיצוב אתרים",
  social_media: "ניהול רשתות חברתיות",
  content_marketing: "שיווק תוכן",
  branding: "מיתוג",
  consulting: "ייעוץ שיווקי",
  other: "אחר",
};

// Helper function to get style for a status
function getStatusStyle(statusKey: string | null, statuses: LeadStatus[]) {
  if (!statusKey) return "";
  const status = statuses.find(s => s.status_key === statusKey);
  if (!status) return "";
  return `border-2`;
}

function getStatusColor(statusKey: string | null, statuses: LeadStatus[]) {
  if (!statusKey) return undefined;
  const status = statuses.find(s => s.status_key === statusKey);
  return status?.color;
}

function DroppableStage({ stage, children }: { stage: any; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const leadsCount = Array.isArray(children) 
    ? children.filter(Boolean).length 
    : children ? 1 : 0;

  return (
    <div className="flex flex-col min-h-[600px]">
      <div
        ref={setNodeRef}
        className={`relative transition-all ${
          isOver ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""
        }`}
      >
        <div 
          className="relative p-4 py-3 font-semibold text-center shadow-md overflow-hidden text-white"
          style={{
            backgroundColor: stage.hexColor || stage.color,
            clipPath: "polygon(20px 0, 100% 0, 100% 100%, 20px 100%, 0 50%)"
          }}
        >
          {/* negative tail notch on right side */}
          <div
            className="absolute inset-y-0 right-0 w-5"
            style={{
              background: "hsl(var(--background))",
              clipPath: "polygon(100% 0, 0 50%, 100% 100%)"
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 px-6">
            {stage.label}
          </div>
        </div>
        <div className="bg-muted/30 rounded-b-lg p-4 flex-1 space-y-3 min-h-[550px]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Pure UI component - no drag logic
function LeadCardContent({ 
  lead, 
  onStatusChange, 
  onResponseStatusChange,
  productsLookup = {},
  leadStatuses = [],
  pipelineStages = [],
  isCompanyNameVisible = true,
  allTags = [],
  leadTagIds = [],
  onFollowUpDateUpdate,
  dragHandleProps,
  style,
  innerRef,
}: { 
  lead: any; 
  onStatusChange: (leadId: string, newStatus: string) => void;
  onResponseStatusChange: (leadId: string, responseStatus: string | null) => void;
  productsLookup?: Record<string, { name: string; price: number }>;
  leadStatuses?: LeadStatus[];
  pipelineStages?: Array<{ id: string; label: string; color: string; bgClass: string; borderColor: string; hexColor?: string }>;
  isCompanyNameVisible?: boolean;
  allTags?: Array<{ id: string; name: string; color: string }>;
  leadTagIds?: string[];
  onFollowUpDateUpdate?: (leadId: string, newDate: string | null) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  style?: React.CSSProperties;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stageSelectOpen, setStageSelectOpen] = useState(false);
  const [responseSelectOpen, setResponseSelectOpen] = useState(false);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "ליד נמחק בהצלחה",
      });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "שגיאה במחיקת ליד",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      ref={innerRef}
      style={style}
      className="mb-3 hover:shadow-lg transition-all"
    >
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div 
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setEditDialogOpen(true);
            }}
          >
            <User className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold truncate">{lead.contact_name || 'ללא שם איש קשר'}</span>
          </div>
          {dragHandleProps && (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing" aria-label="גרור כרטיס">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </CardTitle>
        {isCompanyNameVisible && lead.company_name && (
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{lead.company_name}</span>
          </div>
        )}
        {/* Tag Badges */}
        {leadTagIds.length > 0 && (
          <div className="mt-2">
            <LeadTagBadges allTags={allTags} tagIds={leadTagIds} />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="px-4 pb-4 pt-2 space-y-3">
        {/* Phone */}
        {lead.phone && (
          <div className="flex items-center gap-2 text-xs pb-3 border-b">
            <Phone className="h-3 w-3 text-primary shrink-0" />
            <a href={`tel:${lead.phone}`} className="hover:underline font-medium text-primary">
              {lead.phone}
            </a>
          </div>
        )}

        {/* Created At */}
        {lead.created_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {new Date(lead.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {' '}
              {new Date(lead.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Stage/Status Selector */}
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <Select
            value={lead.status}
            onValueChange={(value) => onStatusChange(lead.id, value)}
            open={stageSelectOpen}
            onOpenChange={setStageSelectOpen}
          >
            <SelectTrigger 
              className="h-9 text-sm border-2 font-medium"
              style={{ 
                backgroundColor: pipelineStages.find(s => s.id === lead.status)?.hexColor || undefined,
                color: lead.status ? '#fff' : undefined 
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              {pipelineStages.map((stage) => (
                <SelectItem 
                  key={stage.id} 
                  value={stage.id}
                  style={{ backgroundColor: stage.hexColor, color: '#fff' }}
                >
                  {stage.label}
                </SelectItem>
              ))}
              <div className="border-t mt-1 pt-1">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                  onClick={() => {
                    setStageSelectOpen(false);
                    setManageStagesOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                  ניהול שלבי משפך
                </button>
              </div>
            </SelectContent>
          </Select>
        </div>
        
        {/* Response Status */}
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <Select
            value={lead.response_status || "none"}
            onValueChange={(value) => onResponseStatusChange(lead.id, value === "none" ? null : value)}
            open={responseSelectOpen}
            onOpenChange={setResponseSelectOpen}
          >
            <SelectTrigger 
              className="h-9 text-sm border-2 font-medium"
              style={{ 
                backgroundColor: getStatusColor(lead.response_status, leadStatuses) || undefined,
                color: getStatusColor(lead.response_status, leadStatuses) ? '#fff' : undefined 
              }}
            >
              <SelectValue placeholder={leadStatuses.length === 0 ? "טוען..." : "בחר סטטוס"} />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="none">ללא סטטוס</SelectItem>
              {leadStatuses.map((option) => (
                <SelectItem 
                  key={option.status_key} 
                  value={option.status_key}
                  style={{ backgroundColor: option.color, color: '#fff' }}
                >
                  {option.label}
                </SelectItem>
              ))}
              <div className="border-t mt-1 pt-1">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                  onClick={() => {
                    setResponseSelectOpen(false);
                    setManageStatusesOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                  ניהול סטטוסים
                </button>
              </div>
            </SelectContent>
          </Select>
        </div>

        {/* Follow-up date row */}
        <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <FollowUpDatePicker 
            leadId={lead.id} 
            currentDate={lead.follow_up_date}
            onOptimisticUpdate={onFollowUpDateUpdate}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <EditLeadDialog 
            lead={lead} 
            open={editDialogOpen} 
            onOpenChange={setEditDialogOpen}
          />
          <LeadTagSelector leadId={lead.id} initialTagIds={leadTagIds} />
          <AddTaskForm
            leadId={lead.id}
            agencyId={lead.agency_id || undefined}
            triggerButton={
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="הוסף משימה"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            }
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(lead.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Management dialogs (rendered outside the SelectContent so they don't unmount when the Select closes) */}
        <ManagePipelineStagesDialog
          open={manageStagesOpen}
          onOpenChange={setManageStagesOpen}
          showTrigger={false}
        />
        <ManageLeadStatusesDialog
          open={manageStatusesOpen}
          onOpenChange={setManageStatusesOpen}
          showTrigger={false}
        />
      </CardContent>
    </Card>
  );
}

// Sortable wrapper component - adds drag functionality
function SortableLeadCard({ 
  lead, 
  onStatusChange, 
  onResponseStatusChange,
  productsLookup = {},
  leadStatuses = [],
  pipelineStages = [],
  isCompanyNameVisible = true,
  allTags = [],
  leadTagIds = [],
  onFollowUpDateUpdate,
}: { 
  lead: any; 
  onStatusChange: (leadId: string, newStatus: string) => void;
  onResponseStatusChange: (leadId: string, responseStatus: string | null) => void;
  productsLookup?: Record<string, { name: string; price: number }>;
  leadStatuses?: LeadStatus[];
  pipelineStages?: Array<{ id: string; label: string; color: string; bgClass: string; borderColor: string; hexColor?: string }>;
  isCompanyNameVisible?: boolean;
  allTags?: Array<{ id: string; name: string; color: string }>;
  leadTagIds?: string[];
  onFollowUpDateUpdate?: (leadId: string, newDate: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    animateLayoutChanges: () => false,
  });

  const resolvedTransition = isDragging
    ? undefined
    : transition && !transition.includes("0ms")
      ? transition
      : "transform 200ms ease";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: resolvedTransition,
    opacity: isDragging ? 0.4 : 1,
  };

  const dragHandleProps = { ...attributes, ...listeners };

  return (
    <LeadCardContent
      lead={lead}
      onStatusChange={onStatusChange}
      onResponseStatusChange={onResponseStatusChange}
      productsLookup={productsLookup}
      leadStatuses={leadStatuses}
      pipelineStages={pipelineStages}
      isCompanyNameVisible={isCompanyNameVisible}
      allTags={allTags}
      leadTagIds={leadTagIds}
      onFollowUpDateUpdate={onFollowUpDateUpdate}
      dragHandleProps={dragHandleProps}
      style={style}
      innerRef={setNodeRef}
    />
  );
}

function StageTable({ stage, stageLeads, isOpen, onToggle, totalLeadsCount, overallTotalCount }: { 
  stage: any; 
  stageLeads: any[]; 
  isOpen: boolean; 
  onToggle: (open: boolean) => void;
  totalLeadsCount?: number;
  overallTotalCount?: number;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className={`border-r-4 ${stage.borderColor} bg-card`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-xl flex items-center justify-between">
              <span>{stage.label}</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent>
            {stageLeads.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">אין לידים בשלב זה</p>
            ) : (
              <TableWithStickyScroll stageLeads={stageLeads} totalLeadsCount={totalLeadsCount} overallTotalCount={overallTotalCount} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Bubble pop animation
const playBubbleAnimation = () => {
  // Create bubble sound using Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Bubble pop sound - high freq that drops quickly
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.08);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.08);

  // Faster bubble confetti animation
  const count = 25;
  const defaults = {
    origin: { y: 0.7 },
    shapes: ['circle'],
    gravity: 0.7,
    scalar: 1.1,
    drift: 0,
    ticks: 80,
  };

  function fire(particleRatio: number, opts: any) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: ['#00d4ff', '#00b8e6', '#0099cc', '#7dd3fc', '#38bdf8'],
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 50,
  });

  fire(0.2, {
    spread: 55,
  });

  fire(0.35, {
    spread: 90,
    decay: 0.92,
    scalar: 0.75,
  });

  fire(0.1, {
    spread: 110,
    startVelocity: 22,
    decay: 0.93,
    scalar: 1.1,
  });

  fire(0.1, {
    spread: 110,
    startVelocity: 40,
  });
};

export default function Leads() {
  const { toast } = useToast();
  const { selectedAgency, setSelectedAgency, agencies } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { isOwner } = useUserRole();
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { activeStatuses: leadStatuses } = useLeadStatuses();
  const { activeStages: pipelineStagesData } = useLeadPipelineStages();
  const { isFieldVisible } = useCustomFieldLabels('lead');
  const { isViewingAs, viewAsSalesPersonId, viewAsUserName } = useViewAs();
  const [searchParams, setSearchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get('leadId');
  const [autoOpenLeadId, setAutoOpenLeadId] = useState<string | null>(null);
  
  // Filter states
  const [filterSalesPersonIds, setFilterSalesPersonIds] = useState<string[]>([]);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterResponseStatus, setFilterResponseStatus] = useState<string[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [filterFollowUpToday, setFilterFollowUpToday] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters dialog and preset states
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<{ id: string; name: string } | null>(null);
  
  // Convert dynamic pipeline stages to format compatible with existing code
  const PIPELINE_STAGES = useMemo(() => {
    if (!pipelineStagesData || pipelineStagesData.length === 0) {
      // Fallback to defaults while loading
       return [
         { id: "new", label: "חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300", borderColor: "border-blue-500", hexColor: "#3b82f6" },
         { id: "contacted", label: "יצרנו קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-purple-300", borderColor: "border-purple-500", hexColor: "#a855f7" },
         { id: "meeting_scheduled", label: "נקבעה פגישה", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300", borderColor: "border-yellow-500", hexColor: "#eab308" },
         { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-300", borderColor: "border-orange-500", hexColor: "#f97316" },
         { id: "negotiation", label: "משא ומתן", color: "bg-green-100 dark:bg-green-900", bgClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300", borderColor: "border-green-500", hexColor: "#22c55e" },
         { id: "closed", label: "נסגר", color: "bg-emerald-100 dark:bg-emerald-900", bgClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-300", borderColor: "border-emerald-500", hexColor: "#10b981" },
       ];
    }
    return pipelineStagesData.map(stage => ({
      id: stage.stage_key,
      label: stage.label,
      color: hexToLightBg(stage.color),
      bgClass: `border-2`,
      borderColor: `border-2`,
      hexColor: stage.color,
    }));
  }, [pipelineStagesData]);

  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table" | "chat">("kanban");
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({});
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>("");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const TABLE_LEADS_PER_PAGE = 50;
  const KANBAN_LEADS_PER_STAGE_LIMIT = 50; // How many leads to fetch per stage from DB

  const isKanbanView = viewMode === "kanban" || viewMode === "chat";
  const effectivePage = isKanbanView ? 1 : page;
  const effectiveLimit = TABLE_LEADS_PER_PAGE;

  // Kanban is not paginated (we cap to KANBAN_FETCH_LIMIT); keep page locked to 1 there.
  useEffect(() => {
    if (isKanbanView) setPage(1);
  }, [isKanbanView]);
  
  // Reset page to 1 and clear accumulated leads when filters change
  useEffect(() => {
    setPage(1);
    setStageOffsets({});
    setAccumulatedLeads({});
  }, [selectedAgency, searchQuery, filterSalesPersonIds, filterStage, filterResponseStatus, filterTagIds, filterFollowUpToday, startDate, endDate]);
  
  // Kanban limiting state - how many leads to SHOW per stage initially (can expand)
  const KANBAN_LEADS_PER_STAGE_DISPLAY = 20;
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  
  // Stage-based data for Kanban view
  const [stageLeadsData, setStageLeadsData] = useState<Record<string, { leads: any[]; totalCount: number }>>({});
  
  // Load More state - tracks additional leads fetched beyond initial 50 per stage
  const [stageOffsets, setStageOffsets] = useState<Record<string, number>>({});
  const [accumulatedLeads, setAccumulatedLeads] = useState<Record<string, any[]>>({});
  const [loadingMoreStage, setLoadingMoreStage] = useState<string | null>(null);
  
  // Optimistic status map - instantly shows lead in new column before backend confirms
  const [optimisticStatusByLeadId, setOptimisticStatusByLeadId] = useState<Record<string, string>>({});
  // Optimistic follow-up date update handler
  const handleFollowUpDateUpdate = (leadId: string, newDate: string | null) => {
    // Update accumulatedLeads
    setAccumulatedLeads(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = updated[key].map((l: any) => l.id === leadId ? { ...l, follow_up_date: newDate } : l);
      }
      return updated;
    });
    // Update stageLeadsData
    setStageLeadsData(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        if (updated[key]?.leads) {
          updated[key] = { ...updated[key], leads: updated[key].leads.map((l: any) => l.id === leadId ? { ...l, follow_up_date: newDate } : l) };
        }
      }
      return updated;
    });
  };

  // Fetch lead data for auto-open from URL
  const { data: autoOpenLead } = useQuery({
    queryKey: ["lead-auto-open", autoOpenLeadId],
    queryFn: async () => {
      if (!autoOpenLeadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", autoOpenLeadId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!autoOpenLeadId,
  });

  // Auto-open lead dialog from URL parameter
  useEffect(() => {
    if (leadIdFromUrl) {
      setAutoOpenLeadId(leadIdFromUrl);
      // Clear the URL parameter
      searchParams.delete('leadId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [leadIdFromUrl]);

  // Set default selected mobile stage when stages load
  useEffect(() => {
    if (PIPELINE_STAGES.length > 0 && !selectedMobileStage) {
      setSelectedMobileStage(PIPELINE_STAGES[0].id);
    }
  }, [PIPELINE_STAGES, selectedMobileStage]);

  // Fetch total count for pagination - skip for Kanban view (not needed)
  const { data: totalLeadsCount = 0 } = useQuery({
    queryKey: ["leads-count", tenantId, selectedAgency, searchQuery, filterSalesPersonIds, filterStage, filterResponseStatus, filterTagIds, filterFollowUpToday, startDate?.toISOString(), endDate?.toISOString(), isViewingAs, viewAsSalesPersonId],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      // Use RPC for tag filtering - efficient server-side filtering
      if (filterTagIds.length > 0 && !filterTagIds.includes("none")) {
        const agencyIds = selectedAgency && selectedAgency !== "all" 
          ? [selectedAgency]
          : agencies?.map(a => a.id) || null;
        
        const { data, error } = await supabase.rpc('count_leads_by_tags', {
          p_tenant_id: tenantId,
          p_tag_ids: filterTagIds,
          p_agency_ids: agencyIds
        });
        
        if (error) throw error;
        return data || 0;
      }
      
      let query = supabase
        .from("leads")
        .select("id", { count: 'exact', head: true });

      // Base tenant/agency filter
      if (selectedAgency && selectedAgency !== "all") {
        query = query.or(`tenant_id.eq.${tenantId},agency_id.eq.${selectedAgency}`);
      } else if (agencies && agencies.length > 0) {
        const agencyIds = agencies.map((a) => a.id);
        query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${agencyIds.join(',')})`);
      } else {
        query = query.eq("tenant_id", tenantId);
      }
      
      // Server-side filters
      if (filterStage !== "all") {
        query = query.eq("status", filterStage as any);
      }
      
      // When viewing as a sales person, force filter to their leads
      if (isViewingAs && viewAsSalesPersonId) {
        query = query.eq("sales_person_id", viewAsSalesPersonId);
      } else if (filterSalesPersonIds.length > 0) {
        // Multi-select sales person filter
        if (filterSalesPersonIds.includes("none") && filterSalesPersonIds.length === 1) {
          query = query.is("sales_person_id", null);
        } else if (!filterSalesPersonIds.includes("none")) {
          query = query.in("sales_person_id", filterSalesPersonIds);
        }
      }
      
      // Multi-select response status filter
      if (filterResponseStatus.length > 0) {
        if (filterResponseStatus.includes("none") && filterResponseStatus.length === 1) {
          query = query.is("response_status", null);
        } else if (!filterResponseStatus.includes("none")) {
          query = query.in("response_status", filterResponseStatus);
        }
      }
      
      // Follow-up today filter
      if (filterFollowUpToday) {
        const today = new Date().toISOString().split('T')[0];
        query = query.lte("follow_up_date", today);
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`contact_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenantId && !isKanbanView, // Skip count for Kanban view
    staleTime: 1000 * 60 * 5, // 5 minutes - count rarely changes
  });

  // Kanban view: use RPC that fetches leads per stage
  const { data: kanbanStageData, isLoading: isKanbanLoading, refetch: refetchKanban, isFetching: isKanbanFetching } = useQuery({
    queryKey: ["leads-kanban", tenantId, selectedAgency, searchQuery, filterSalesPersonIds, filterResponseStatus, filterTagIds, filterFollowUpToday, startDate?.toISOString(), endDate?.toISOString(), PIPELINE_STAGES.map(s => s.id).join(','), isViewingAs, viewAsSalesPersonId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const agencyIds = selectedAgency && selectedAgency !== "all" 
        ? [selectedAgency]
        : agencies?.map(a => a.id) || null;
      
      const stageIds = PIPELINE_STAGES.map(s => s.id);
      
      // Build sales person filter - support multi-select
      // When viewing as a sales person, override the filter
      let salesPersonFilter: string[] | null = null;
      if (isViewingAs && viewAsSalesPersonId) {
        // Force filter to the viewed-as sales person
        salesPersonFilter = [viewAsSalesPersonId];
      } else if (filterSalesPersonIds.length > 0 && !filterSalesPersonIds.includes("none")) {
        salesPersonFilter = filterSalesPersonIds;
      }
      
      const { data, error } = await supabase.rpc('get_leads_by_stages', {
        p_tenant_id: tenantId,
        p_agency_ids: agencyIds,
        p_stages: stageIds,
        p_limit_per_stage: KANBAN_LEADS_PER_STAGE_LIMIT,
        p_search_query: searchQuery.trim() || null,
        p_sales_person_ids: salesPersonFilter,
        p_response_statuses: filterResponseStatus.length > 0 && !filterResponseStatus.includes("none") ? filterResponseStatus : null,
        p_follow_up_today: filterFollowUpToday,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate ? new Date(endDate.setHours(23, 59, 59, 999)).toISOString() : null,
        p_tag_ids: filterTagIds.length > 0 && !filterTagIds.includes("none") ? filterTagIds : null
      });
      
      if (error) throw error;
      
      // Transform RPC result to map: { [stageId]: { leads: [...], totalCount: number } }
      const stageMap: Record<string, { leads: any[]; totalCount: number }> = {};
      
      if (data) {
        if (Array.isArray(data)) {
          // TABLE format: array of { stage, leads, total_count }
          for (const stageData of data as any[]) {
            stageMap[stageData.stage] = {
              leads: stageData.leads || [],
              totalCount: stageData.total_count || 0
            };
          }
        } else if (typeof data === 'object') {
          // JSONB format: { [stageKey]: { leads: [...], total_count: number, ... } }
          for (const [stageKey, stageData] of Object.entries(data as Record<string, any>)) {
            stageMap[stageKey] = {
              leads: stageData.leads || [],
              totalCount: stageData.total_count || 0
            };
          }
        }
      }
      
      // Now fetch relations (agencies, sales_people) for all leads
      const allLeadIds: string[] = [];
      for (const stageId of Object.keys(stageMap)) {
        for (const lead of stageMap[stageId].leads) {
          allLeadIds.push(lead.id);
        }
      }
      
      if (allLeadIds.length > 0) {
        const { data: leadsWithRelations } = await supabase
          .from("leads")
          .select(`
            id,
            agencies (name),
            sales_people (full_name)
          `)
          .in("id", allLeadIds);
        
        // Merge relations into leads
        const relationsMap: Record<string, any> = {};
        if (leadsWithRelations) {
          for (const rel of leadsWithRelations) {
            relationsMap[rel.id] = rel;
          }
        }
        
        for (const stageId of Object.keys(stageMap)) {
          stageMap[stageId].leads = stageMap[stageId].leads.map((lead: any) => ({
            ...lead,
            agencies: relationsMap[lead.id]?.agencies || null,
            sales_people: relationsMap[lead.id]?.sales_people || null
          }));
        }
      }
      
      return stageMap;
    },
    enabled: !!tenantId && isKanbanView && PIPELINE_STAGES.length > 0,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  });

  // When kanban data refetches, update accumulated leads with fresh data from DB
  // This handles cases where follow_up_date or other fields were updated on accumulated leads
  useEffect(() => {
    if (!kanbanStageData || Object.keys(accumulatedLeads).length === 0) return;
    
    // Collect all accumulated lead IDs
    const accLeadIds: string[] = [];
    for (const stageLeads of Object.values(accumulatedLeads)) {
      for (const lead of stageLeads) {
        accLeadIds.push(lead.id);
      }
    }
    
    if (accLeadIds.length === 0) return;
    
    // Re-fetch accumulated leads to get fresh data
    const refreshAccumulatedLeads = async () => {
      const { data: freshLeads } = await supabase
        .from("leads")
        .select("*, agencies(name), sales_people(full_name)")
        .in("id", accLeadIds);
      
      if (!freshLeads) return;
      
      const freshMap: Record<string, any> = {};
      for (const lead of freshLeads) {
        freshMap[lead.id] = lead;
      }
      
      setAccumulatedLeads(prev => {
        const updated: Record<string, any[]> = {};
        let changed = false;
        for (const [stageKey, stageLeads] of Object.entries(prev)) {
          updated[stageKey] = stageLeads.map((lead: any) => {
            const fresh = freshMap[lead.id];
            if (fresh && (fresh.follow_up_date !== lead.follow_up_date || fresh.status !== lead.status || fresh.response_status !== lead.response_status)) {
              changed = true;
              return { ...lead, ...fresh };
            }
            return lead;
          });
        }
        return changed ? updated : prev;
      });
    };
    
    refreshAccumulatedLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanbanStageData]);
  
  // Table view: use regular paginated query
  const { data: tableLeads, isLoading: isTableLoading, refetch: refetchTable, isFetching: isTableFetching } = useQuery({
    queryKey: ["leads-table", tenantId, selectedAgency, effectivePage, searchQuery, filterSalesPersonIds, filterStage, filterResponseStatus, filterTagIds, filterFollowUpToday, startDate?.toISOString(), endDate?.toISOString(), isViewingAs, viewAsSalesPersonId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      
      const from = (effectivePage - 1) * effectiveLimit;
      
      // Use RPC for tag filtering - efficient server-side filtering with pagination
      if (filterTagIds.length > 0 && !filterTagIds.includes("none")) {
        const agencyIds = selectedAgency && selectedAgency !== "all" 
          ? [selectedAgency]
          : agencies?.map(a => a.id) || null;
        
        const { data: rpcLeads, error: rpcError } = await supabase.rpc('get_leads_by_tags', {
          p_tenant_id: tenantId,
          p_tag_ids: filterTagIds,
          p_agency_ids: agencyIds,
          p_limit: effectiveLimit,
          p_offset: from
        });
        
        if (rpcError) throw rpcError;
        
        // Fetch related data (agencies, sales_people) for the RPC results
        if (rpcLeads && rpcLeads.length > 0) {
          const leadIds = rpcLeads.map((l: any) => l.id);
          const { data: leadsWithRelations } = await supabase
            .from("leads")
            .select(`
              id,
              tenant_id,
              contact_name,
              company_name,
              phone,
              email,
              status,
              response_status,
              source,
              industry,
              products,
              estimated_deal_value,
              proposal_date,
              sale_date,
              lost_reason,
              folder_link,
              notes,
              agency_id,
              sales_person_id,
              follow_up_date,
              created_at,
              updated_at,
              agencies (name),
              sales_people (full_name)
            `)
            .in("id", leadIds)
            .order("created_at", { ascending: false });
          
          return leadsWithRelations || [];
        }
        
        return [];
      }
      
      const to = from + effectiveLimit - 1;
      
      let query = supabase
        .from("leads")
        .select(`
          id,
          tenant_id,
          contact_name,
          company_name,
          phone,
          email,
          status,
          response_status,
          source,
          industry,
          products,
          estimated_deal_value,
          proposal_date,
          sale_date,
          lost_reason,
          folder_link,
          notes,
          agency_id,
          sales_person_id,
          follow_up_date,
          created_at,
          updated_at,
          agencies (name),
          sales_people (full_name)
        `)
        .order("created_at", { ascending: false });

      // 🔒 CRITICAL SECURITY: Filter by tenant_id OR accessible agencies
      if (selectedAgency && selectedAgency !== "all") {
        query = query.or(`tenant_id.eq.${tenantId},agency_id.eq.${selectedAgency}`);
      } else if (agencies && agencies.length > 0) {
        const agencyIds = agencies.map((a) => a.id);
        query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${agencyIds.join(',')})`);
      } else {
        query = query.eq("tenant_id", tenantId);
      }
      
      // Server-side filters
      if (filterStage !== "all") {
        query = query.eq("status", filterStage as any);
      }
      
      // When viewing as a sales person, force filter to their leads
      if (isViewingAs && viewAsSalesPersonId) {
        query = query.eq("sales_person_id", viewAsSalesPersonId);
      } else if (filterSalesPersonIds.length > 0) {
        // Multi-select sales person filter
        if (filterSalesPersonIds.includes("none") && filterSalesPersonIds.length === 1) {
          query = query.is("sales_person_id", null);
        } else if (!filterSalesPersonIds.includes("none")) {
          query = query.in("sales_person_id", filterSalesPersonIds);
        }
      }
      
      // Multi-select response status filter
      if (filterResponseStatus.length > 0) {
        if (filterResponseStatus.includes("none") && filterResponseStatus.length === 1) {
          query = query.is("response_status", null);
        } else if (!filterResponseStatus.includes("none")) {
          query = query.in("response_status", filterResponseStatus);
        }
      }
      
      // Follow-up today filter
      if (filterFollowUpToday) {
        const today = new Date().toISOString().split('T')[0];
        query = query.lte("follow_up_date", today).order("follow_up_date", { ascending: true });
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`contact_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`);
      }
      
      // Apply pagination
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !isKanbanView,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  });
  
  // Combine loading/fetching states
  const isLoading = isKanbanView ? isKanbanLoading : isTableLoading;
  const isFetching = isKanbanView ? isKanbanFetching : isTableFetching;
  const refetch = isKanbanView ? refetchKanban : refetchTable;
  
  // For table view, use tableLeads directly
  // For kanban view, flatten all stage leads into single array for compatibility
  const leads = useMemo(() => {
    if (!isKanbanView) {
      return tableLeads || [];
    }
    if (!kanbanStageData) return [];
    
    const allLeads: any[] = [];
    for (const stageId of Object.keys(kanbanStageData)) {
      allLeads.push(...kanbanStageData[stageId].leads);
    }
    return allLeads;
  }, [isKanbanView, tableLeads, kanbanStageData]);

  // Calculate total leads count for Kanban view from RPC data
  const kanbanTotalLeadsCount = useMemo(() => {
    if (!kanbanStageData) return 0;
    let total = 0;
    for (const stageId of Object.keys(kanbanStageData)) {
      total += kanbanStageData[stageId].totalCount;
    }
    return total;
  }, [kanbanStageData]);

  // Use appropriate total count based on view mode
  const displayTotalCount = isKanbanView ? kanbanTotalLeadsCount : totalLeadsCount;

  const totalPages = Math.ceil(totalLeadsCount / TABLE_LEADS_PER_PAGE);
  const hasMorePages = page < totalPages;

  // 🔒 SECURITY GUARD: Filter leads by current tenant and accessible agencies
  const secureFilteredLeads = useMemo(() => {
    if (!leads || !tenantId) return [];
    
    return leads.filter(lead => {
      // ALWAYS check tenant match first - strict isolation
      const isTenantMatch = lead.tenant_id === tenantId;
      
      // For owners: only show leads from CURRENT tenant
      if (isOwner) {
        return isTenantMatch;
      }
      
      // For non-owners: allow tenant match OR accessible agency
      if (isTenantMatch) return true;
      if (lead.agency_id && userAgencyIds?.includes(lead.agency_id)) return true;
      
      // Block everything else
      return false;
    });
  }, [leads, tenantId, userAgencyIds, isOwner]);

  // Fetch sales people for filter
  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-filter", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10, // 10 minutes - sales people rarely change
  });

  // Fetch products for lookup
  const { data: allProducts } = useQuery({
    queryKey: ["products-lookup", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10, // 10 minutes - products rarely change
  });

  // Create products lookup map
  const productsLookup = useMemo(() => {
    if (!allProducts) return {};
    return allProducts.reduce((acc, product) => {
      acc[product.id] = { name: product.name, price: product.price };
      return acc;
    }, {} as Record<string, { name: string; price: number }>);
  }, [allProducts]);

  // Fetch all tags for filtering
  const { data: allTags = [] } = useQuery({
    queryKey: ['chat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('chat_tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Get visible lead IDs for tag fetching (to avoid 1000 row limit)
  // Include accumulated leads from "Load More" so their tags are fetched too
  const visibleLeadIds = useMemo(() => {
    const ids = new Set<string>();
    if (secureFilteredLeads) {
      secureFilteredLeads.forEach((lead: any) => ids.add(lead.id));
    }
    // Add IDs from accumulated (Load More) leads across all stages
    Object.values(accumulatedLeads).forEach((stageLeads: any[]) => {
      stageLeads.forEach((lead: any) => ids.add(lead.id));
    });
    return Array.from(ids);
  }, [secureFilteredLeads, accumulatedLeads]);

  // Fetch lead tags in bulk for visible leads only (avoids 1000 row limit)
  const { data: leadsTagsMap = {} } = useQuery({
    queryKey: ['leads-tags-visible', tenantId, visibleLeadIds],
    queryFn: async () => {
      if (!tenantId || visibleLeadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('chat_contact_tags')
        .select('lead_id, tag_id')
        .eq('tenant_id', tenantId)
        .in('lead_id', visibleLeadIds);
      
      if (error) throw error;
      
      // Group by lead_id
      const map: Record<string, string[]> = {};
      data.forEach(item => {
        if (item.lead_id) {
          if (!map[item.lead_id]) map[item.lead_id] = [];
          map[item.lead_id].push(item.tag_id);
        }
      });
      
      console.info('[LeadsTags] Fetched tags for visible leads:', { 
        visibleLeads: visibleLeadIds.length, 
        tagRecords: data.length,
        uniqueLeadsWithTags: Object.keys(map).length
      });
      
      return map;
    },
    enabled: !!tenantId && visibleLeadIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds - refresh more often since it's a smaller query
  });

  // Debug: log how many leads are missing phone/email to verify visibility
  useEffect(() => {
    if (leads) {
      const arr = leads as any[];
      const missingPhone = arr.filter((l: any) => !l.phone).length;
      const missingEmail = arr.filter((l: any) => !l.email).length;
      console.info("Leads fetched", { total: arr.length, missingPhone, missingEmail, sample: arr.slice(0, 3) });
    }
  }, [leads]);

  const updateLeadStatus = useMutation<void, Error, { leadId: string; newStatus: string }, { previousKanban: unknown; previousTable: unknown; kanbanQueryKey: unknown[]; tableQueryKey: unknown[]; leadId: string }>({
    mutationFn: async ({ leadId, newStatus }) => {
      // Get lead data before update to know old status
      const { data: leadBefore } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus as any })
        .eq("id", leadId);

      if (error) throw error;
      
      // Trigger bubble animation when status changes to a final stage (won/lost/closed)
      const finalStages = ['closed', 'won', 'lost'];
      if (finalStages.includes(newStatus)) {
        playBubbleAnimation();
      }

      // Trigger automations if status actually changed
      if (leadBefore && leadBefore.status !== newStatus) {
        try {
          await supabase.functions.invoke('trigger-automation', {
            body: {
              trigger_type: 'lead_status_changed',
              data: {
                id: leadId,
                status: newStatus,
                new_status: newStatus,
                old_status: leadBefore.status,
                contact_name: leadBefore.contact_name,
                company_name: leadBefore.company_name,
                phone: leadBefore.phone,
                email: leadBefore.email,
                agency_id: leadBefore.agency_id,
                sales_person_id: leadBefore.sales_person_id,
                tenant_id: leadBefore.tenant_id
              },
              tenant_id: leadBefore.tenant_id
            }
          });
        } catch (automationError) {
          console.error('Failed to trigger automation:', automationError);
          // Don't fail the mutation if automation fails
        }
      }
    },
    onMutate: async ({ leadId, newStatus }) => {
      // Build query keys for both Kanban and Table views
      const kanbanQueryKey = [
        "leads-kanban",
        tenantId,
        selectedAgency,
        searchQuery,
        filterSalesPersonIds,
        filterResponseStatus,
        filterTagIds,
        filterFollowUpToday,
        startDate?.toISOString(),
        endDate?.toISOString(),
        PIPELINE_STAGES.map(s => s.id).join(','),
      ];
      
      const tableQueryKey = [
        "leads-table",
        tenantId,
        selectedAgency,
        effectivePage,
        searchQuery,
        filterSalesPersonIds,
        filterStage,
        filterResponseStatus,
        filterTagIds,
        filterFollowUpToday,
        startDate?.toISOString(),
        endDate?.toISOString(),
      ];
      
      // Cancel any outgoing refetches for both views
      await queryClient.cancelQueries({ queryKey: kanbanQueryKey });
      await queryClient.cancelQueries({ queryKey: tableQueryKey });

      // Snapshot the previous values
      const previousKanban = queryClient.getQueryData(kanbanQueryKey);
      const previousTable = queryClient.getQueryData(tableQueryKey);

      // Optimistically update Kanban data (nested structure: { [stageKey]: { leads: [...], totalCount } })
      queryClient.setQueryData(kanbanQueryKey, (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        for (const stageKey in updated) {
          if (updated[stageKey]?.leads && Array.isArray(updated[stageKey].leads)) {
            updated[stageKey] = {
              ...updated[stageKey],
              leads: updated[stageKey].leads.map((lead: any) =>
                lead.id === leadId ? { ...lead, status: newStatus } : lead
              ),
            };
          }
        }
        return updated;
      });

      // Optimistically update Table data (flat array)
      queryClient.setQueryData(tableQueryKey, (old: any) => {
        if (!old) return old;
        return old.map((lead: any) => 
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        );
      });

      // Optimistically update accumulatedLeads (move lead from old stage to new stage)
      setAccumulatedLeads(prev => {
        const updated = { ...prev };
        let movedLead: any = null;
        // Find and remove from old stage
        for (const key of Object.keys(updated)) {
          const idx = updated[key].findIndex((l: any) => l.id === leadId);
          if (idx !== -1) {
            movedLead = { ...updated[key][idx], status: newStatus };
            updated[key] = [...updated[key].slice(0, idx), ...updated[key].slice(idx + 1)];
            break;
          }
        }
        // Add to new stage
        if (movedLead) {
          updated[newStatus] = [movedLead, ...(updated[newStatus] || [])];
        }
        return updated;
      });

      // Optimistically update stageLeadsData
      setStageLeadsData(prev => {
        const updated = { ...prev };
        let movedLead: any = null;
        for (const key of Object.keys(updated)) {
          if (updated[key]?.leads) {
            const idx = updated[key].leads.findIndex((l: any) => l.id === leadId);
            if (idx !== -1) {
              movedLead = { ...updated[key].leads[idx], status: newStatus };
              updated[key] = {
                ...updated[key],
                leads: [...updated[key].leads.slice(0, idx), ...updated[key].leads.slice(idx + 1)],
                totalCount: Math.max(0, updated[key].totalCount - 1),
              };
              break;
            }
          }
        }
        if (movedLead) {
          const target = updated[newStatus] || { leads: [], totalCount: 0 };
          updated[newStatus] = {
            ...target,
            leads: [movedLead, ...target.leads],
            totalCount: target.totalCount + 1,
          };
        }
        return updated;
      });

      // Return context with the snapshots for rollback
      return { previousKanban, previousTable, kanbanQueryKey, tableQueryKey, leadId };
    },
    onError: (error: any, variables, context) => {
      // Rollback to the previous values if error
      if (context?.previousKanban && context?.kanbanQueryKey) {
        queryClient.setQueryData(context.kanbanQueryKey, context.previousKanban);
      }
      if (context?.previousTable && context?.tableQueryKey) {
        queryClient.setQueryData(context.tableQueryKey, context.previousTable);
      }
      // Clear the optimistic status on error so lead goes back to original position
      setOptimisticStatusByLeadId(prev => {
        const next = { ...prev };
        delete next[variables.leadId];
        return next;
      });
      // Re-fetch to restore correct state
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      toast({
        title: "שגיאה בעדכון סטטוס",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (_data, variables) => {
      // Clear the optimistic status after successful backend update
      setOptimisticStatusByLeadId(prev => {
        const next = { ...prev };
        delete next[variables.leadId];
        return next;
      });
      toast({
        title: "סטטוס ליד עודכן בהצלחה",
      });
    },
    // No onSettled invalidation - optimistic updates handle the UI
  });

  const updateLeadResponseStatus = useMutation({
    mutationFn: async ({ leadId, responseStatus }: { leadId: string; responseStatus: "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "in_progress" | "denies_contact" | "not_relevant" | null }) => {
      // Get lead data before update for automation
      const { data: leadData } = await supabase
        .from("leads")
        .select("*, agency:agencies(name)")
        .eq("id", leadId)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ response_status: responseStatus })
        .eq("id", leadId);

      if (error) throw error;

      // Trigger automation for lead_status_changed
      if (responseStatus && tenantId && leadData) {
        await supabase.functions.invoke('trigger-automation', {
          body: {
            trigger_type: 'lead_status_changed',
            tenant_id: tenantId,
            data: {
              lead_id: leadId,
              contact_name: leadData.contact_name || '',
              company_name: leadData.company_name || '',
              phone: leadData.phone || '',
              email: leadData.email || '',
              status: responseStatus,
              old_status: leadData.response_status || '',
              agency_name: leadData.agency?.name || '',
            }
          }
        });
      }
    },
    onMutate: async ({ leadId, responseStatus }) => {
      // Optimistically update accumulatedLeads
      setAccumulatedLeads(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map((l: any) => l.id === leadId ? { ...l, response_status: responseStatus } : l);
        }
        return updated;
      });
      // Optimistically update stageLeadsData
      setStageLeadsData(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (updated[key]?.leads) {
            updated[key] = { ...updated[key], leads: updated[key].leads.map((l: any) => l.id === leadId ? { ...l, response_status: responseStatus } : l) };
          }
        }
        return updated;
      });
      // Update kanban cache
      queryClient.setQueriesData({ queryKey: ["leads-kanban"] }, (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        for (const stageKey in updated) {
          if (updated[stageKey]?.leads && Array.isArray(updated[stageKey].leads)) {
            updated[stageKey] = {
              ...updated[stageKey],
              leads: updated[stageKey].leads.map((l: any) => l.id === leadId ? { ...l, response_status: responseStatus } : l),
            };
          }
        }
        return updated;
      });
      // Update table cache
      queryClient.setQueriesData({ queryKey: ["leads-table"] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((l: any) => l.id === leadId ? { ...l, response_status: responseStatus } : l);
      });
    },
    onSuccess: () => {
      // No invalidation - optimistic update already handled the UI
      toast({
        title: "סטטוס תגובה עודכן בהצלחה",
      });
    },
    onError: (error: any) => {
      // Re-fetch to restore correct state on error
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      toast({
        title: "שגיאה בעדכון סטטוס תגובה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync Facebook leads mutation
  const syncFacebookLeadsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-facebook-leads', {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        if (data.synced > 0) {
          toast({
            title: `סונכרנו ${data.synced} לידים חדשים מפייסבוק!`,
          });
          queryClient.invalidateQueries({ queryKey: ["leads", tenantId, selectedAgency] });
          queryClient.invalidateQueries({ queryKey: ["leads-count", tenantId, selectedAgency] });
        } else if (data.skipped > 0) {
          toast({
            title: `לא נמצאו לידים חדשים (${data.skipped} כבר קיימים)`,
          });
        } else {
          toast({
            title: 'לא נמצאו לידים חדשים',
          });
        }
      } else {
        toast({
          title: 'שגיאה בסנכרון',
          description: data?.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה בסנכרון לידים מפייסבוק',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearActiveIdWithDelay = () => {
    window.setTimeout(() => setActiveId(null), DROP_ANIMATION_MS);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      clearActiveIdWithDelay();
      return;
    }

    const leadId = active.id as string;

    // over.id can be either a stage id or another lead id inside a stage.
    let targetStatus = over.id as string;

    // If over.id is not one of the stage IDs, try to resolve it via the lead it hovers over
    if (!PIPELINE_STAGES.some((s) => s.id === targetStatus)) {
      // Check optimistic status first, then actual lead status
      const overLeadOptimisticStatus = optimisticStatusByLeadId[over.id as string];
      if (overLeadOptimisticStatus) {
        targetStatus = overLeadOptimisticStatus;
      } else {
        const overLead = filteredLeads?.find((l: any) => l.id === over.id);
        if (overLead) targetStatus = overLead.status;
      }
    }

    // Validate final status - only update if target is a valid stage
    if (PIPELINE_STAGES.find((stage) => stage.id === targetStatus)) {
      // IMMEDIATELY update optimistic state so lead moves to new column without waiting
      setOptimisticStatusByLeadId(prev => ({ ...prev, [leadId]: targetStatus }));
      
      updateLeadStatus.mutate({
        leadId,
        newStatus: targetStatus,
      });
    }

    // Keep the DragOverlay mounted long enough for dropAnimation to complete.
    clearActiveIdWithDelay();
  };

  // Filters are now applied server-side, but we still need to handle "none" tag filter client-side
  // IMPORTANT: always start from secureFilteredLeads to avoid cross-tenant/agency leakage
  const filteredLeads = useMemo(() => {
    if (!secureFilteredLeads) return [];

    let result = secureFilteredLeads;

    // Client-side filter for "none" tag filter (leads without any tags)
    if (filterTagIds.includes("none")) {
      result = result.filter((lead: any) => {
        const leadTags = leadsTagsMap[lead.id] || [];
        // If only "none" selected, show leads without tags
        if (filterTagIds.length === 1) {
          return leadTags.length === 0;
        }
        // If "none" and other tags selected, show leads without tags OR with selected tags
        const otherTagIds = filterTagIds.filter(t => t !== "none");
        return leadTags.length === 0 || leadTags.some((t: string) => otherTagIds.includes(t));
      });
    }

    // Client-side filter for complex response status (when "none" + other statuses selected)
    if (filterResponseStatus.includes("none") && filterResponseStatus.length > 1) {
      const otherStatuses = filterResponseStatus.filter(s => s !== "none");
      result = result.filter((lead: any) => {
        return lead.response_status === null || otherStatuses.includes(lead.response_status);
      });
    }

    return result;
  }, [secureFilteredLeads, filterTagIds, filterResponseStatus, leadsTagsMap]);

  // Helper to check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filterSalesPersonIds.length > 0 ||
      filterStage !== "all" ||
      filterResponseStatus.length > 0 ||
      filterTagIds.length > 0 ||
      startDate !== undefined ||
      endDate !== undefined ||
      filterFollowUpToday;
  }, [filterSalesPersonIds, filterStage, filterResponseStatus, filterTagIds, startDate, endDate, filterFollowUpToday]);

  // Current filter state for dialog
  const currentFilters: FilterState = useMemo(() => ({
    searchQuery,
    salesPersonIds: filterSalesPersonIds,
    stageId: filterStage,
    responseStatus: filterResponseStatus,
    tagIds: filterTagIds,
    startDate,
    endDate,
    followUpToday: filterFollowUpToday,
  }), [searchQuery, filterSalesPersonIds, filterStage, filterResponseStatus, filterTagIds, startDate, endDate, filterFollowUpToday]);

  // Handle applying filters from dialog
  const handleApplyFilters = (filters: FilterState) => {
    setSearchQuery(filters.searchQuery);
    setFilterSalesPersonIds(filters.salesPersonIds);
    setFilterStage(filters.stageId);
    setFilterResponseStatus(filters.responseStatus);
    setFilterTagIds(filters.tagIds);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setFilterFollowUpToday(filters.followUpToday);
    setActivePresetId(null); // Clear preset when manually applying
  };

  // Handle preset selection
  const handlePresetSelect = (preset: FilterPreset | null) => {
    if (!preset) {
      // Reset all filters
      setFilterSalesPersonIds([]);
      setFilterStage("all");
      setFilterResponseStatus([]);
      setFilterTagIds([]);
      setStartDate(undefined);
      setEndDate(undefined);
      setFilterFollowUpToday(false);
      setSearchQuery("");
      setActivePresetId(null);
    } else {
      // Apply preset filters - handle both old (string) and new (array) format
      const f = preset.filters as Record<string, any>;
      // Handle legacy salesPersonId (string) format and new salesPersonIds (array) format
      if ('salesPersonId' in f && typeof f.salesPersonId === 'string') {
        setFilterSalesPersonIds(f.salesPersonId === 'all' ? [] : [f.salesPersonId]);
      } else if ('salesPersonIds' in f && Array.isArray(f.salesPersonIds)) {
        setFilterSalesPersonIds(f.salesPersonIds);
      } else {
        setFilterSalesPersonIds([]);
      }
      setFilterStage(f.stageId || "all");
      // Handle legacy string format for responseStatus
      if (typeof f.responseStatus === 'string') {
        setFilterResponseStatus(f.responseStatus === 'all' ? [] : [f.responseStatus]);
      } else {
        setFilterResponseStatus(f.responseStatus || []);
      }
      // Handle legacy tagId format
      if ('tagId' in f && typeof f.tagId === 'string') {
        setFilterTagIds(f.tagId === 'all' ? [] : [f.tagId]);
      } else {
        setFilterTagIds(f.tagIds || []);
      }
      setStartDate(f.startDate ? new Date(f.startDate) : undefined);
      setEndDate(f.endDate ? new Date(f.endDate) : undefined);
      setFilterFollowUpToday(f.followUpToday || false);
      setSearchQuery(f.searchQuery || "");
      setActivePresetId(preset.id);
    }
  };

  // Handle editing a preset
  const handleEditPreset = (preset: FilterPreset) => {
    // Apply the preset filters first
    handlePresetSelect(preset);
    // Set the editing state
    setEditingPreset({ id: preset.id, name: preset.name });
    // Open the filters dialog in edit mode
    setFiltersDialogOpen(true);
  };

  // Export filtered leads to CSV
  const handleExportCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast({
        title: "אין נתונים לייצוא",
        description: "לא נמצאו לידים לייצוא",
        variant: "destructive",
      });
      return;
    }

    // Define CSV headers and mapping
    const headers = [
      "שם איש קשר",
      "שם חברה",
      "טלפון",
      "אימייל",
      "שלב",
      "סטטוס תגובה",
      "מקור",
      "תעשייה",
      "ערך עסקה משוער",
      "איש מכירות",
      "סוכנות",
      "הערות",
      "תאריך יצירה",
    ];

    const rows = filteredLeads.map((lead: any) => {
      const stageName = PIPELINE_STAGES.find(s => s.id === lead.status)?.label || lead.status;
      const statusName = leadStatuses.find(s => s.status_key === lead.response_status)?.label || lead.response_status || "";
      const sourceName = SOURCE_LABELS[lead.source] || lead.source || "";
      
      return [
        lead.contact_name || "",
        lead.company_name || "",
        lead.phone || "",
        lead.email || "",
        stageName || "",
        statusName,
        sourceName,
        lead.industry || "",
        lead.estimated_deal_value || "",
        lead.sales_people?.full_name || "",
        lead.agencies?.name || "",
        lead.notes || "",
        lead.created_at ? new Date(lead.created_at).toLocaleDateString('he-IL') : "",
      ];
    });

    // Create CSV content with BOM for Hebrew support
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "הקובץ יוצא בהצלחה",
      description: `${filteredLeads.length} לידים יוצאו לקובץ CSV`,
    });
  };

  // Function to load more leads for a specific stage
  const loadMoreLeads = async (stageId: string) => {
    if (!tenantId || loadingMoreStage) return;
    
    setLoadingMoreStage(stageId);
    
    try {
      const currentOffset = stageOffsets[stageId] || 0;
      const newOffset = currentOffset + KANBAN_LEADS_PER_STAGE_LIMIT;
      
      const agencyIds = selectedAgency && selectedAgency !== "all" 
        ? [selectedAgency]
        : agencies?.map(a => a.id) || null;
      
      // Keep filters aligned with the initial Kanban fetch (incl. View-As override)
      let salesPersonFilter: string[] | null = null;
      if (isViewingAs && viewAsSalesPersonId) {
        salesPersonFilter = [viewAsSalesPersonId];
      } else if (filterSalesPersonIds.length > 0 && !filterSalesPersonIds.includes("none")) {
        salesPersonFilter = filterSalesPersonIds;
      }
      
      const { data, error } = await supabase.rpc('get_leads_by_stages', {
        p_tenant_id: tenantId,
        p_agency_ids: agencyIds,
        p_stages: [stageId],
        p_limit_per_stage: KANBAN_LEADS_PER_STAGE_LIMIT,
        p_offset_per_stage: newOffset,
        p_search_query: searchQuery.trim() || null,
        p_sales_person_ids: salesPersonFilter,
        p_response_statuses: filterResponseStatus.length > 0 && !filterResponseStatus.includes("none") ? filterResponseStatus : null,
        p_follow_up_today: filterFollowUpToday,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate ? new Date(endDate.setHours(23, 59, 59, 999)).toISOString() : null,
        p_tag_ids: filterTagIds.length > 0 && !filterTagIds.includes("none") ? filterTagIds : null
      });
      
      if (error) throw error;
      
      // Extract leads from the response.
      // NOTE: get_leads_by_stages RETURNS jsonb (object keyed by stage_key), not an array.
      const newLeads = (() => {
        if (!data) return [] as any[];

        // Defensive: support legacy/alternate array format too
        if (Array.isArray(data)) {
          const hit = (data as any[]).find((item) => item?.stage === stageId);
          return Array.isArray(hit?.leads) ? hit.leads : [];
        }

        const stagePayload = (data as Record<string, any>)[stageId];
        return Array.isArray(stagePayload?.leads) ? stagePayload.leads : [];
      })();
      
      if (newLeads.length > 0) {
        // Fetch relations for new leads
        const leadIds = newLeads.map((l: any) => l.id);
        const { data: leadsWithRelations } = await supabase
          .from("leads")
          .select(`
            id,
            agencies (name),
            sales_people (full_name)
          `)
          .in("id", leadIds);
        
        const relationsMap: Record<string, any> = {};
        if (leadsWithRelations) {
          for (const rel of leadsWithRelations) {
            relationsMap[rel.id] = rel;
          }
        }
        
        const enrichedLeads = newLeads.map((lead: any) => ({
          ...lead,
          agencies: relationsMap[lead.id]?.agencies || null,
          sales_people: relationsMap[lead.id]?.sales_people || null
        }));
        
        // Add to accumulated leads
        setAccumulatedLeads(prev => ({
          ...prev,
          [stageId]: [...(prev[stageId] || []), ...enrichedLeads]
        }));
        
        setStageOffsets(prev => ({ ...prev, [stageId]: newOffset }));
        
        toast({
          title: `נטענו ${newLeads.length} לידים נוספים`,
        });
      } else {
        toast({
          title: "אין עוד לידים לטעון",
        });
      }
    } catch (error: any) {
      toast({
        title: "שגיאה בטעינת לידים נוספים",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingMoreStage(null);
    }
  };

  // Use effective status (optimistic first, then actual) for stage filtering
  const getLeadsByStage = (stageId: string, limit?: number) => {
    // For Kanban view: use stage data directly from RPC (already pre-filtered per stage)
    if (isKanbanView && kanbanStageData) {
      const stageData = kanbanStageData[stageId];
      if (!stageData) return [];
      
      // Combine initial leads with accumulated leads from "Load more"
      const initialLeads = stageData.leads || [];
      const extraLeads = accumulatedLeads[stageId] || [];
      let allStageLeads = [...initialLeads, ...extraLeads];
      
      // Apply optimistic updates - remove leads moved away
      allStageLeads = allStageLeads.filter((lead: any) => {
        const effectiveStatus = optimisticStatusByLeadId[lead.id];
        // If optimistic status exists and differs from stageId, remove from this stage
        if (effectiveStatus && effectiveStatus !== stageId) return false;
        return true;
      });
      
      // Add leads that were moved here optimistically
      const movedHere = filteredLeads?.filter((lead: any) => {
        const effectiveStatus = optimisticStatusByLeadId[lead.id];
        return effectiveStatus === stageId && lead.status !== stageId;
      }) || [];
      allStageLeads = [...allStageLeads, ...movedHere];
      
      // Remove duplicates (in case a lead appears in both initial and accumulated)
      const seenIds = new Set<string>();
      allStageLeads = allStageLeads.filter((lead: any) => {
        if (seenIds.has(lead.id)) return false;
        seenIds.add(lead.id);
        return true;
      });
      
      if (limit && !expandedStages[stageId]) {
        return allStageLeads.slice(0, limit);
      }
      return allStageLeads;
    }
    
    // For Table view: use filtered leads
    const stageLeads = filteredLeads?.filter((lead: any) => {
      const effectiveStatus = optimisticStatusByLeadId[lead.id] ?? lead.status;
      return effectiveStatus === stageId;
    }) || [];
    if (limit && !expandedStages[stageId]) {
      return stageLeads.slice(0, limit);
    }
    return stageLeads;
  };
  
  // Get loaded count for a stage (initial + accumulated)
  const getLoadedCountByStage = (stageId: string) => {
    if (!kanbanStageData) return 0;
    const stageData = kanbanStageData[stageId];
    const initialCount = stageData?.leads?.length || 0;
    const accumulatedCount = accumulatedLeads[stageId]?.length || 0;
    return initialCount + accumulatedCount;
  };
  
  const getLeadsCountByStage = (stageId: string) => {
    // For Kanban view: use total_count from RPC (includes leads beyond display limit)
    if (isKanbanView && kanbanStageData) {
      const stageData = kanbanStageData[stageId];
      if (!stageData) return 0;
      
      // Adjust for optimistic moves
      let count = stageData.totalCount;
      
      // Count optimistic moves out of this stage
      const movedOut = Object.entries(optimisticStatusByLeadId).filter(([leadId, newStatus]) => {
        const originalLead = stageData.leads.find((l: any) => l.id === leadId);
        return originalLead && newStatus !== stageId;
      }).length;
      
      // Count optimistic moves into this stage
      const movedIn = Object.entries(optimisticStatusByLeadId).filter(([leadId, newStatus]) => {
        if (newStatus !== stageId) return false;
        // Check if lead originally wasn't in this stage
        const inOtherStage = Object.values(kanbanStageData).some((sd: any) => 
          sd !== stageData && sd.leads.some((l: any) => l.id === leadId)
        );
        return inOtherStage;
      }).length;
      
      return count - movedOut + movedIn;
    }
    
    // For Table view
    return filteredLeads?.filter((lead: any) => {
      const effectiveStatus = optimisticStatusByLeadId[lead.id] ?? lead.status;
      return effectiveStatus === stageId;
    })?.length || 0;
  };

  const activeLead = filteredLeads?.find((lead: any) => lead.id === activeId);

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-3 md:p-6">
      {/* View As Banner - shows when viewing as another user */}
      {isViewingAs && (
        <div className="bg-warning/20 border border-warning text-warning-foreground px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <span className="font-medium">📊 מצב צפייה:</span>
          <span>אתה צופה בלידים של <strong>{viewAsUserName}</strong> בלבד</span>
        </div>
      )}
      
      {/* Mobile Header */}
      <div className="block md:hidden space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">לידים - Pipeline</h1>
            <Badge variant="secondary" className="text-sm px-2 py-0.5">
              {isFetching ? (
                '...'
              ) : isKanbanView ? (
                `סה"כ: ${displayTotalCount.toLocaleString()}`
              ) : (
                `${filteredLeads?.length || 0}${totalPages > 1 ? ` / ${totalLeadsCount}` : ''}`
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle (was desktop-only) */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 w-8 p-0"
                title="קנבן"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 w-8 p-0"
                title="טבלה"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "chat" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("chat")}
                className="h-8 w-8 p-0"
                title="תצוגת צ'אט"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Pagination (Table view only) */}
            {!isKanbanView && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                  className="h-8 px-2"
                >
                  ←
                </Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
                  {page}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                  className="h-8 px-2"
                >
                  →
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="חיפוש..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <LeadFilterPresetTabs
            activePresetId={activePresetId}
            onPresetSelect={handlePresetSelect}
            onOpenFiltersDialog={() => {
              setEditingPreset(null);
              setFiltersDialogOpen(true);
            }}
            onEditPreset={handleEditPreset}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncFacebookLeadsMutation.mutate()}
            disabled={syncFacebookLeadsMutation.isPending}
            className="gap-1"
          >
            <Download className={`h-4 w-4 ${syncFacebookLeadsMutation.isPending ? 'animate-spin' : ''}`} />
            {syncFacebookLeadsMutation.isPending ? 'מסנכרן...' : 'סנכרן מפייסבוק'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1"
          >
            <FileSpreadsheet className="h-4 w-4" />
            ייצוא CSV
          </Button>
          <AddLeadForm />
          <ImportLeadsWithMapping />
        </div>
      </div>

      {/* Desktop Header - Sticky */}
      <div className="hidden md:block sticky top-0 z-40 bg-background pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">לידים - Pipeline</h1>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {isFetching ? (
                <span className="animate-pulse">טוען...</span>
              ) : isKanbanView ? (
                <>סה"כ: {displayTotalCount.toLocaleString()}</>
              ) : (
                <>מציג: {filteredLeads?.length || 0} {totalPages > 1 && `(מתוך ${totalLeadsCount})`}</>
              )}
            </Badge>
            
            {/* Pagination controls in header */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 mr-4 border-r pr-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  הקודם →
                </Button>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  עמוד {page} מתוך {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                >
                  ← הבא
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-3 items-center">
            {/* View mode toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "chat" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("chat")}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => syncFacebookLeadsMutation.mutate()}
                disabled={syncFacebookLeadsMutation.isPending}
                className="gap-2"
              >
                <Download className={`h-4 w-4 ${syncFacebookLeadsMutation.isPending ? 'animate-spin' : ''}`} />
                {syncFacebookLeadsMutation.isPending ? 'מסנכרן...' : 'סנכרן מפייסבוק'}
              </Button>
              <ImportLeadsWithMapping />
              {/* <ImportLeadsSheet /> - Hidden temporarily */}
              <AddLeadForm />
            </div>
          </div>
        </div>
        
        {/* Search + Preset Tabs + Filters Button */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="חיפוש לפי שם, טלפון או חברה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-12 h-11 text-base font-medium shadow-sm border-2 focus:border-primary"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Preset Tabs + Filters Button */}
          <div className="flex-1">
            <LeadFilterPresetTabs
              activePresetId={activePresetId}
              onPresetSelect={handlePresetSelect}
              onOpenFiltersDialog={() => {
                setEditingPreset(null); // Clear editing mode when opening fresh
                setFiltersDialogOpen(true);
              }}
              onEditPreset={handleEditPreset}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
          
          {/* Manage Lead Statuses Button */}
          <ManageLeadStatusesDialog 
            trigger={
              <Button variant="outline" size="icon" title="ניהול סטטוסי לידים">
                <Settings2 className="h-4 w-4" />
              </Button>
            }
          />
          
          {/* Manage Tags Button */}
          <ChatTagsManager 
            trigger={
              <Button variant="outline" size="icon" title="ניהול תגיות">
                <Tag className="h-4 w-4" />
              </Button>
            }
          />
          
          {/* Export CSV Button */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleExportCSV}
            title="ייצוא לקובץ CSV"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Filters Dialog */}
      <LeadFiltersDialog
        open={filtersDialogOpen}
        onOpenChange={(open) => {
          setFiltersDialogOpen(open);
          if (!open) {
            setEditingPreset(null); // Clear editing mode when closing
          }
        }}
        currentFilters={currentFilters}
        onApply={handleApplyFilters}
        salesPeople={salesPeople || []}
        pipelineStages={PIPELINE_STAGES}
        leadStatuses={leadStatuses}
        allTags={allTags}
        editingPreset={editingPreset}
        onPresetUpdated={() => {
          setEditingPreset(null);
        }}
      />

      {leads?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              אין עדיין לידים במערכת
            </p>
            <AddLeadForm />
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <>
          {/* Mobile Kanban - Single Stage with Floating Button */}
          <div className="block md:hidden relative pb-20">
            <DndContext
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {PIPELINE_STAGES.map((stage) => {
                if (stage.id !== selectedMobileStage) return null;
                const allStageLeads = getLeadsByStage(stage.id);
                const totalInStage = getLeadsCountByStage(stage.id);
                const loadedCount = getLoadedCountByStage(stage.id);
                const isExpanded = expandedStages[stage.id];
                const displayLimit = isExpanded ? allStageLeads.length : KANBAN_LEADS_PER_STAGE_DISPLAY;
                const stageLeads = allStageLeads.slice(0, displayLimit);
                const hasMoreToShow = !isExpanded && allStageLeads.length > KANBAN_LEADS_PER_STAGE_DISPLAY;
                const remainingToShow = allStageLeads.length - KANBAN_LEADS_PER_STAGE_DISPLAY;
                const hasMoreToLoad = totalInStage > loadedCount;
                const remainingToLoad = totalInStage - loadedCount;
                
                return (
                  <div key={stage.id}>
                    <div className="mb-4">
                      <h2 className="text-xl font-bold flex items-center justify-between">
                        <span>{stage.label}</span>
                        <Badge variant="secondary" className="text-sm">
                          {loadedCount}{totalInStage > loadedCount ? ` / ${totalInStage}` : ''} לידים
                        </Badge>
                      </h2>
                    </div>
                    <DroppableStage stage={stage}>
                      <SortableContext
                        id={stage.id}
                        items={stageLeads.map((l: any) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {stageLeads.map((lead: any) => (
                          <SortableLeadCard 
                            key={lead.id} 
                            lead={lead}
                            productsLookup={productsLookup}
                            leadStatuses={leadStatuses}
                            pipelineStages={PIPELINE_STAGES}
                            isCompanyNameVisible={isFieldVisible('company_name')}
                            allTags={allTags}
                            leadTagIds={leadsTagsMap[lead.id] || []}
                            onStatusChange={(leadId, newStatus) => 
                              updateLeadStatus.mutate({ 
                                leadId, 
                                newStatus
                              })
                            }
                            onResponseStatusChange={(leadId, responseStatus) =>
                              updateLeadResponseStatus.mutate({ 
                                leadId, 
                                responseStatus: responseStatus as "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "denies_contact" | "not_relevant" | null 
                              })
                            }
                            onFollowUpDateUpdate={handleFollowUpDateUpdate}
                          />
                        ))}
                      </SortableContext>
                    </DroppableStage>
                    
                    {/* Mobile Show More Button (shows more from already loaded) */}
                    {hasMoreToShow && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3 gap-2"
                        onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: true }))}
                      >
                        <ChevronDown className="h-4 w-4" />
                        הצג עוד {remainingToShow} לידים
                      </Button>
                    )}
                    
                    {/* Collapse button when expanded */}
                    {isExpanded && allStageLeads.length > KANBAN_LEADS_PER_STAGE_DISPLAY && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-3 gap-2 text-muted-foreground"
                        onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: false }))}
                      >
                        <ChevronUp className="h-4 w-4" />
                        הצג פחות
                      </Button>
                    )}
                    
                    {/* Load More from Server Button */}
                    {hasMoreToLoad && (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full mt-3 gap-2"
                        onClick={() => loadMoreLeads(stage.id)}
                        disabled={loadingMoreStage === stage.id}
                      >
                        {loadingMoreStage === stage.id ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            טוען...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            טען עוד 50 (נותרו {remainingToLoad.toLocaleString()})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
              <DragOverlay dropAnimation={dropAnimationConfig}>
                {activeId && activeLead ? (
                  <LeadCardContent 
                    lead={activeLead}
                    productsLookup={productsLookup}
                    leadStatuses={leadStatuses}
                    pipelineStages={PIPELINE_STAGES}
                    isCompanyNameVisible={isFieldVisible('company_name')}
                    allTags={allTags}
                    leadTagIds={leadsTagsMap[activeLead.id] || []}
                    onStatusChange={() => {}}
                    onResponseStatusChange={() => {}}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Floating Stage Selector Button */}
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  size="lg"
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg z-50 gap-2"
                >
                  <LayoutGrid className="h-5 w-5" />
                  בחר שלב
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[400px]">
                <SheetHeader>
                  <SheetTitle>בחר שלב במשפך</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[320px] mt-6">
                  <div className="grid gap-3 px-1">
                    {PIPELINE_STAGES.map((stage) => {
                      const stageLeads = getLeadsByStage(stage.id);
                      const isSelected = selectedMobileStage === stage.id;
                      return (
                        <Button
                          key={stage.id}
                          variant={isSelected ? "default" : "outline"}
                          size="lg"
                          onClick={() => {
                            setSelectedMobileStage(stage.id);
                            setMobileSheetOpen(false);
                          }}
                          className={`justify-between h-auto py-4 ${stage.bgClass}`}
                        >
                          <span className="text-lg font-semibold">{stage.label}</span>
                          <Badge variant={isSelected ? "secondary" : "default"}>
                            {stageLeads.length}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Kanban - Grid */}
          <DndContext
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div 
              className="hidden md:grid gap-0"
              style={{ 
                gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(0, 1fr))` 
              }}
            >
              {PIPELINE_STAGES.map((stage, index) => {
                const allStageLeads = getLeadsByStage(stage.id);
                const totalInStage = getLeadsCountByStage(stage.id);
                const loadedCount = getLoadedCountByStage(stage.id);
                const isExpanded = expandedStages[stage.id];
                const displayLimit = isExpanded ? allStageLeads.length : KANBAN_LEADS_PER_STAGE_DISPLAY;
                const stageLeads = allStageLeads.slice(0, displayLimit);
                const hasMoreToShow = !isExpanded && allStageLeads.length > KANBAN_LEADS_PER_STAGE_DISPLAY;
                const remainingToShow = allStageLeads.length - KANBAN_LEADS_PER_STAGE_DISPLAY;
                const hasMoreToLoad = totalInStage > loadedCount;
                const remainingToLoad = totalInStage - loadedCount;
                
                return (
                  <div 
                    key={stage.id}
                    className="relative"
                    style={{
                      zIndex: PIPELINE_STAGES.length - index,
                    }}
                  >
                    <DroppableStage stage={stage}>
                      <SortableContext
                        id={stage.id}
                        items={stageLeads.map((l: any) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {stageLeads.map((lead: any) => (
                          <SortableLeadCard 
                            key={lead.id} 
                            lead={lead}
                            productsLookup={productsLookup}
                            leadStatuses={leadStatuses}
                            pipelineStages={PIPELINE_STAGES}
                            isCompanyNameVisible={isFieldVisible('company_name')}
                            allTags={allTags}
                            leadTagIds={leadsTagsMap[lead.id] || []}
                            onStatusChange={(leadId, newStatus) => 
                              updateLeadStatus.mutate({ 
                                leadId, 
                                newStatus: newStatus as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" 
                              })
                            }
                            onResponseStatusChange={(leadId, responseStatus) =>
                              updateLeadResponseStatus.mutate({ 
                                leadId, 
                                responseStatus: responseStatus as "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "denies_contact" | "not_relevant" | null 
                              })
                            }
                            onFollowUpDateUpdate={handleFollowUpDateUpdate}
                          />
                        ))}
                        
                        {/* Show More Button (shows more from already loaded) */}
                        {hasMoreToShow && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: true }))}
                          >
                            הצג עוד {remainingToShow} לידים
                          </Button>
                        )}
                        
                        {/* Collapse button when expanded */}
                        {isExpanded && allStageLeads.length > KANBAN_LEADS_PER_STAGE_DISPLAY && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: false }))}
                          >
                            הצג פחות
                          </Button>
                        )}
                        
                        {/* Load More from Server Button */}
                        {hasMoreToLoad && (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full mt-2 gap-2"
                            onClick={() => loadMoreLeads(stage.id)}
                            disabled={loadingMoreStage === stage.id}
                          >
                            {loadingMoreStage === stage.id ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                טוען...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                טען עוד 50 (נותרו {remainingToLoad.toLocaleString()})
                              </>
                            )}
                          </Button>
                        )}
                      </SortableContext>
                    </DroppableStage>
                  </div>
                );
              })}
            </div>

             <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeId && activeLead ? (
                <LeadCardContent 
                  lead={activeLead}
                  productsLookup={productsLookup}
                  leadStatuses={leadStatuses}
                  pipelineStages={PIPELINE_STAGES}
                  isCompanyNameVisible={isFieldVisible('company_name')}
                  allTags={allTags}
                  leadTagIds={leadsTagsMap[activeLead.id] || []}
                  onStatusChange={() => {}}
                  onResponseStatusChange={() => {}}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      ) : (
        <div className="space-y-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            const stageCount = getLeadsCountByStage(stage.id);
            return (
              <StageTable 
                key={stage.id}
                stage={stage}
                stageLeads={stageLeads}
                isOpen={openTables[stage.id]}
                onToggle={(open) => setOpenTables(prev => ({ ...prev, [stage.id]: open }))}
                totalLeadsCount={stageCount}
                overallTotalCount={totalLeadsCount}
              />
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            הקודם →
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>עמוד {page} מתוך {totalPages}</span>
            {isFetching && <span className="animate-pulse">טוען...</span>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isFetching}
          >
            ← הבא
          </Button>
        </div>
      )}

      {/* Load All Button - for users who want all data */}
      {hasMorePages && !isFetching && (
        <div className="flex justify-center pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(totalPages)}
            className="text-muted-foreground"
          >
            טען את כל {totalLeadsCount} הלידים (עמוד אחרון)
          </Button>
        </div>
      )}

      {/* Auto-open lead dialog from URL parameter */}
      {autoOpenLead && (
        <EditLeadDialog 
          lead={autoOpenLead}
          open={!!autoOpenLeadId}
          onOpenChange={(open) => !open && setAutoOpenLeadId(null)}
        />
      )}
    </div>
  );
}

function TableWithStickyScroll({ stageLeads, totalLeadsCount, overallTotalCount }: { stageLeads: any[]; totalLeadsCount?: number; overallTotalCount?: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectAllMode, setSelectAllMode] = useState<'page' | 'all' | null>(null);
  const [allLeadIds, setAllLeadIds] = useState<string[] | null>(null);
  const [isLoadingAllIds, setIsLoadingAllIds] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSalesPeople, setSelectedSalesPeople] = useState<string[]>([]);
  const { selectedAgency } = useAgency();
  const { activeStatuses: leadStatuses, isLoading: isStatusesLoading } = useLeadStatuses();
  const { activeStages: pipelineStagesData } = useLeadPipelineStages();
  const { isFieldVisible } = useCustomFieldLabels('lead');
  const { tenantId } = useCurrentTenant();

  // Fetch sales people for assignment
  const { data: salesPeople = [] } = useQuery({
    queryKey: ["sales-people-for-assign", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  // Convert dynamic pipeline stages to format compatible with existing code
  const PIPELINE_STAGES = useMemo(() => {
    if (!pipelineStagesData || pipelineStagesData.length === 0) {
      return [
        { id: "new", label: "חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300", borderColor: "border-blue-500", hexColor: "#3b82f6" },
        { id: "contacted", label: "יצרנו קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-purple-300", borderColor: "border-purple-500", hexColor: "#a855f7" },
        { id: "meeting_scheduled", label: "נקבעה פגישה", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300", borderColor: "border-yellow-500", hexColor: "#eab308" },
        { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-300", borderColor: "border-orange-500", hexColor: "#f97316" },
        { id: "negotiation", label: "משא ומתן", color: "bg-green-100 dark:bg-green-900", bgClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300", borderColor: "border-green-500", hexColor: "#22c55e" },
        { id: "closed", label: "נסגר", color: "bg-emerald-100 dark:bg-emerald-900", bgClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-300", borderColor: "border-emerald-500", hexColor: "#10b981" },
      ];
    }
    return pipelineStagesData.map(stage => ({
      id: stage.stage_key,
      label: stage.label,
      color: hexToLightBg(stage.color),
      bgClass: `border-2`,
      borderColor: `border-2`,
      hexColor: stage.color,
    }));
  }, [pipelineStagesData]);

  // Fetch all tags for display in table
  const { data: allTags = [] } = useQuery({
    queryKey: ['chat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('chat_tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Get visible lead IDs from stageLeads prop
  const visibleLeadIds = useMemo(() => {
    if (!stageLeads || stageLeads.length === 0) return [];
    return stageLeads.map((lead: any) => lead.id);
  }, [stageLeads]);

  // Fetch lead tags in bulk for visible leads only (avoids 1000 row limit)
  const { data: leadsTagsMap = {} } = useQuery({
    queryKey: ['leads-tags-table', tenantId, visibleLeadIds],
    queryFn: async () => {
      if (!tenantId || visibleLeadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('chat_contact_tags')
        .select('lead_id, tag_id')
        .eq('tenant_id', tenantId)
        .in('lead_id', visibleLeadIds);
      
      if (error) throw error;
      
      // Group by lead_id
      const map: Record<string, string[]> = {};
      data.forEach(item => {
        if (item.lead_id) {
          if (!map[item.lead_id]) map[item.lead_id] = [];
          map[item.lead_id].push(item.tag_id);
        }
      });
      return map;
    },
    enabled: !!tenantId && visibleLeadIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });
  
  // State for management dialogs
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus as any })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "סטטוס ליד עודכן בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון סטטוס",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLeadResponseStatus = useMutation({
    mutationFn: async ({ leadId, responseStatus }: { leadId: string; responseStatus: string | null }) => {
      // Get lead data before update for automation
      const { data: leadData } = await supabase
        .from("leads")
        .select("*, agency:agencies(name)")
        .eq("id", leadId)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ response_status: responseStatus })
        .eq("id", leadId);

      if (error) throw error;

      // Trigger automation for lead_status_changed
      if (responseStatus && tenantId && leadData) {
        await supabase.functions.invoke('trigger-automation', {
          body: {
            trigger_type: 'lead_status_changed',
            tenant_id: tenantId,
            data: {
              lead_id: leadId,
              contact_name: leadData.contact_name || '',
              company_name: leadData.company_name || '',
              phone: leadData.phone || '',
              email: leadData.email || '',
              status: responseStatus,
              old_status: leadData.response_status || '',
              agency_name: leadData.agency?.name || '',
            }
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "סטטוס תגובה עודכן בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון סטטוס תגובה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: status as any })
        .in("id", leadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setSelectedLeads([]);
      toast({
        title: "לידים עודכנו בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון לידים",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", leadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setSelectedLeads([]);
      toast({
        title: "לידים נמחקו בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במחיקת לידים",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk assign leads to ALL selected sales people (many-to-many)
  const bulkAssignSalesPerson = useMutation({
    mutationFn: async ({ leadIds, salesPersonIds }: { leadIds: string[]; salesPersonIds: string[] }) => {
      // Get tenant_id for all leads to create proper assignments
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, tenant_id")
        .in("id", leadIds);
      
      if (leadsError) throw leadsError;
      if (!leadsData || leadsData.length === 0) throw new Error("לא נמצאו לידים");

      // Create junction table entries for ALL combinations of leads × salespeople
      const assignments: { lead_id: string; sales_person_id: string; tenant_id: string }[] = [];
      for (const lead of leadsData) {
        for (const salesPersonId of salesPersonIds) {
          assignments.push({
            lead_id: lead.id,
            sales_person_id: salesPersonId,
            tenant_id: lead.tenant_id,
          });
        }
      }

      // Insert into junction table (upsert to avoid duplicates)
      const { error: insertError } = await supabase
        .from("lead_sales_people")
        .upsert(assignments, { 
          onConflict: 'lead_id,sales_person_id',
          ignoreDuplicates: true 
        });

      if (insertError) throw insertError;

      // Also update the legacy sales_person_id on leads table (for backwards compatibility)
      // Set to the first selected sales person
      const { error: legacyError } = await supabase
        .from("leads")
        .update({ sales_person_id: salesPersonIds[0] })
        .in("id", leadIds);

      if (legacyError) console.warn("Legacy sales_person_id update failed:", legacyError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["lead-sales-people"] });
      setSelectedLeads([]);
      setAssignDialogOpen(false);
      setSelectedSalesPeople([]);
      toast({
        title: "לידים שויכו בהצלחה",
        description: `כל ${selectedLeads.length} הלידים שויכו ל-${selectedSalesPeople.length} אנשי מכירות`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בשיוך לידים",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(stageLeads.map(lead => lead.id));
      setSelectAllMode('page');
    } else {
      setSelectedLeads([]);
      setSelectAllMode(null);
      setAllLeadIds(null);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
      setSelectAllMode(null);
      setAllLeadIds(null);
    }
  };

  const handleSelectAllLeads = async () => {
    if (!tenantId) return;
    setIsLoadingAllIds(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const allIds = data.map(l => l.id);
      setAllLeadIds(allIds);
      setSelectedLeads(allIds);
      setSelectAllMode('all');
      toast({
        title: `${allIds.length} לידים נבחרו`,
      });
    } catch (error: any) {
      toast({
        title: "שגיאה בטעינת כל הלידים",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAllIds(false);
    }
  };

  const isAllPageSelected = stageLeads.length > 0 && selectedLeads.length >= stageLeads.length;
  const isAllLeadsSelected = selectAllMode === 'all' && allLeadIds && selectedLeads.length === allLeadIds.length;
  const showSelectAllButton = isAllPageSelected && !isAllLeadsSelected && overallTotalCount && overallTotalCount > stageLeads.length;

  return (
    <div className="relative">
      {/* Bulk Actions Toolbar */}
      {selectedLeads.length > 0 && (
        <div className="bg-primary text-primary-foreground p-3 rounded-lg mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selectedLeads.length} לידים נבחרו</span>
              {selectAllMode === 'all' && (
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs">
                  כל הלידים
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLeads([]);
                  setSelectAllMode(null);
                  setAllLeadIds(null);
                }}
                className="h-7 px-2 hover:bg-primary-foreground/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={(value) => bulkUpdateStatus.mutate({ leadIds: selectedLeads, status: value as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" })}>
                <SelectTrigger className="h-8 w-[180px] bg-background text-foreground">
                  <SelectValue placeholder="שנה שלב" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id} className={stage.bgClass}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignDialogOpen(true)}
                className="h-8 bg-background text-foreground"
              >
                <User className="h-4 w-4 mr-1" />
                שייך לאנשי מכירות
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`האם אתה בטוח שברצונך למחוק ${selectedLeads.length} לידים?`)) {
                    bulkDelete.mutate(selectedLeads);
                  }
                }}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                מחק
              </Button>
            </div>
          </div>
          {/* Select All Leads Button */}
          {showSelectAllButton && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectAllLeads}
              disabled={isLoadingAllIds}
              className="w-full bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            >
              {isLoadingAllIds ? (
                <>טוען...</>
              ) : (
                <>בחר את כל {totalLeadsCount?.toLocaleString()} הלידים</>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Resizable Table */}
      <div className="h-[540px]" dir="rtl">
        <ResizableTable
          columns={[
            { 
              id: "name", 
              label: "שם", 
              width: 120, 
              sticky: true,
              render: (lead: any) => (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{lead.contact_name || "-"}</span>
                </div>
              )
            },
            { 
              id: "phone", 
              label: "טלפון", 
              width: 130,
              render: (lead: any) => lead.phone ? (
                <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{lead.phone}</span>
                </a>
              ) : "-"
            },
            ...(isFieldVisible('company_name') ? [{ 
              id: "company", 
              label: "שם חברה", 
              width: 170,
              render: (lead: any) => (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{lead.company_name}</span>
                </div>
              )
            }] : []),
            { 
              id: "status", 
              label: "שלב במשפך", 
              width: 150,
              render: (lead: any) => {
                const stage = PIPELINE_STAGES.find(s => s.id === lead.status);
                return (
                  <Select
                    value={lead.status as string}
                    onValueChange={(value) => {
                      (updateLeadStatus as any).mutate({ 
                        leadId: lead.id, 
                        newStatus: value
                      });
                    }}
                  >
                    <SelectTrigger 
                      className="h-8 w-full border-2"
                      style={{ 
                        backgroundColor: stage?.hexColor || undefined,
                        color: lead.status && stage?.hexColor ? '#fff' : undefined 
                      }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem 
                          key={s.id} 
                          value={s.id}
                          style={{ backgroundColor: s.hexColor, color: s.hexColor ? '#fff' : undefined }}
                        >
                          {s.label}
                        </SelectItem>
                      ))}
                      <div className="border-t mt-1 pt-1">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageStagesOpen(true);
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                          ניהול שלבי משפך
                        </button>
                      </div>
                    </SelectContent>
                  </Select>
                );
              }
            },
            { 
              id: "response_status", 
              label: "סטטוס", 
              width: 150,
              render: (lead: any) => {
                const status = leadStatuses.find(s => s.status_key === lead.response_status);
                const displayLabel = status?.label || (lead.response_status ? lead.response_status : null);
                return (
                  <Select
                    value={lead.response_status || "none"}
                    onValueChange={(value) => 
                      updateLeadResponseStatus.mutate({ 
                        leadId: lead.id, 
                        responseStatus: value === "none" ? null : value as any
                      })
                    }
                  >
                    <SelectTrigger 
                      className="h-8 w-full border-2"
                      style={{ 
                        backgroundColor: status?.color || undefined,
                        color: status?.color ? '#fff' : undefined 
                      }}
                    >
                      {lead.response_status && displayLabel ? (
                        <span className="truncate">{displayLabel}</span>
                      ) : (
                        <SelectValue placeholder={isStatusesLoading ? "טוען..." : "ללא סטטוס"} />
                      )}
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="none">ללא סטטוס</SelectItem>
                      {leadStatuses.map((s) => (
                        <SelectItem 
                          key={s.status_key} 
                          value={s.status_key}
                          style={{ backgroundColor: s.color, color: '#fff' }}
                        >
                          {s.label}
                        </SelectItem>
                      ))}
                      <div className="border-t mt-1 pt-1">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageStatusesOpen(true);
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                          ניהול סטטוסים
                        </button>
                      </div>
                    </SelectContent>
                  </Select>
                );
              }
            },
            { 
              id: "tags", 
              label: "תגיות", 
              width: 200,
              render: (lead: any) => {
                const tagIds = leadsTagsMap[lead.id] || [];
                const hasAssignedTags = tagIds.length > 0;
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {hasAssignedTags ? (
                        <LeadTagBadges allTags={allTags} tagIds={tagIds} />
                      ) : (
                        <span className="text-xs text-muted-foreground">אין תגיות</span>
                      )}
                    </div>
                    <LeadTagSelector leadId={lead.id} initialTagIds={tagIds} />
                  </div>
                );
              }
            },
            { 
              id: "follow_up_date", 
              label: "תאריך לחזרה", 
              width: 150,
              render: (lead: any) => (
                <FollowUpDatePicker 
                  leadId={lead.id} 
                  currentDate={lead.follow_up_date}
                />
              )
            },
            { 
              id: "actions", 
              label: "פעולות", 
              width: 120,
              render: (lead: any) => (
                <div className="flex justify-center gap-1">
                  <EditLeadDialog lead={lead} />
                  <AddTaskForm
                    leadId={lead.id}
                    agencyId={lead.agency_id || undefined}
                    triggerButton={
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="הוסף משימה">
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              )
            },
          ]}
          data={stageLeads}
          getRowClassName={(lead: any, rowIndex: number) => {
            const stage = PIPELINE_STAGES.find(s => s.id === lead.status);
            return stage?.bgClass || (rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10');
          }}
          getStickyCellClassName={(lead: any, rowIndex: number) => 'bg-card'}
          checkboxColumn={{
            checked: stageLeads.map(lead => selectedLeads.includes(lead.id)),
            onCheckedChange: (index, checked) => handleSelectLead(stageLeads[index].id, checked),
            onSelectAll: handleSelectAll
          }}
        />
      </div>
      
      {/* Management dialogs */}
      <ManagePipelineStagesDialog
        open={manageStagesOpen}
        onOpenChange={setManageStagesOpen}
        showTrigger={false}
      />
      <ManageLeadStatusesDialog
        open={manageStatusesOpen}
        onOpenChange={setManageStatusesOpen}
        showTrigger={false}
      />

      {/* Bulk Assign to Sales People Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => {
        setAssignDialogOpen(open);
        if (!open) setSelectedSalesPeople([]);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>שייך {selectedLeads.length} לידים לאנשי מכירות</DialogTitle>
            <DialogDescription>
              {selectedSalesPeople.length > 1 ? (
                <>
                  הלידים יחולקו שווה בשווה בין {selectedSalesPeople.length} אנשי המכירות 
                  (כ-{Math.ceil(selectedLeads.length / selectedSalesPeople.length)} לידים לכל אחד)
                </>
              ) : (
                "בחר איש מכירות אחד או יותר לשיוך הלידים"
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2 py-4">
            {salesPeople.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין אנשי מכירות פעילים</p>
            ) : (
              salesPeople.map((sp) => (
                <div key={sp.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                  <Checkbox
                    id={`sp-${sp.id}`}
                    checked={selectedSalesPeople.includes(sp.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSalesPeople(prev => [...prev, sp.id]);
                      } else {
                        setSelectedSalesPeople(prev => prev.filter(id => id !== sp.id));
                      }
                    }}
                  />
                  <label htmlFor={`sp-${sp.id}`} className="flex-1 cursor-pointer">
                    {sp.full_name}
                  </label>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={() => bulkAssignSalesPerson.mutate({ 
                leadIds: selectedLeads, 
                salesPersonIds: selectedSalesPeople 
              })}
              disabled={selectedSalesPeople.length === 0 || bulkAssignSalesPerson.isPending}
            >
              {bulkAssignSalesPerson.isPending ? "משייך..." : "שייך"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
     </div>
   );
 }
