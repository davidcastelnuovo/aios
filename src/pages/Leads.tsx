import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign, LayoutGrid, Table as TableIcon, GripVertical, ChevronDown, User, Calendar as CalendarIcon, Search, X, Settings2, CheckSquare, Download, Clock } from "lucide-react";
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
import { useLeadStatuses, LeadStatus } from "@/hooks/useLeadStatuses";
import { useLeadPipelineStages, LeadPipelineStage } from "@/hooks/useLeadPipelineStages";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable } from "@dnd-kit/core";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizableTable, ColumnConfig } from "@/components/ResizableTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";

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

function LeadCard({ 
  lead, 
  onStatusChange, 
  onResponseStatusChange,
  productsLookup = {},
  leadStatuses = [],
  pipelineStages = [],
  isCompanyNameVisible = true
}: { 
  lead: any; 
  onStatusChange: (leadId: string, newStatus: string) => void;
  onResponseStatusChange: (leadId: string, responseStatus: string | null) => void;
  productsLookup?: Record<string, { name: string; price: number }>;
  leadStatuses?: LeadStatus[];
  pipelineStages?: Array<{ id: string; label: string; color: string; bgClass: string; borderColor: string; hexColor?: string }>;
  isCompanyNameVisible?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { toast } = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const isMobile = useIsMobile();

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
      ref={setNodeRef}
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
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" aria-label="גרור כרטיס">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardTitle>
        {isCompanyNameVisible && lead.company_name && (
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{lead.company_name}</span>
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
                <ManagePipelineStagesDialog 
                  trigger={
                    <button 
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                    >
                      <Settings2 className="h-4 w-4" />
                      ניהול שלבי משפך
                    </button>
                  }
                />
              </div>
            </SelectContent>
          </Select>
        </div>
        
        {/* Response Status */}
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <Select
            value={lead.response_status || "none"}
            onValueChange={(value) => onResponseStatusChange(lead.id, value === "none" ? null : value)}
          >
            <SelectTrigger 
              className="h-9 text-sm border-2 font-medium"
              style={{ 
                backgroundColor: getStatusColor(lead.response_status, leadStatuses) || undefined,
                color: lead.response_status ? '#fff' : undefined 
              }}
            >
              <SelectValue />
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
                <ManageLeadStatusesDialog 
                  trigger={
                    <button 
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                    >
                      <Settings2 className="h-4 w-4" />
                      ניהול סטטוסים
                    </button>
                  }
                />
              </div>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <EditLeadDialog 
            lead={lead} 
            open={editDialogOpen} 
            onOpenChange={setEditDialogOpen}
          />
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
      </CardContent>
    </Card>
  );
}

function StageTable({ stage, stageLeads, isOpen, onToggle }: { 
  stage: any; 
  stageLeads: any[]; 
  isOpen: boolean; 
  onToggle: (open: boolean) => void;
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
              <TableWithStickyScroll stageLeads={stageLeads} />
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
  const { activeStatuses: leadStatuses } = useLeadStatuses();
  const { activeStages: pipelineStagesData } = useLeadPipelineStages();
  const { isFieldVisible } = useCustomFieldLabels('lead');
  const [filterSalesPerson, setFilterSalesPerson] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get('leadId');
  const [autoOpenLeadId, setAutoOpenLeadId] = useState<string | null>(null);
  
  // Convert dynamic pipeline stages to format compatible with existing code
  const PIPELINE_STAGES = useMemo(() => {
    if (!pipelineStagesData || pipelineStagesData.length === 0) {
      // Fallback to defaults while loading
      return [
        { id: "new", label: "חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300", borderColor: "border-blue-500" },
        { id: "contacted", label: "יצרנו קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-purple-300", borderColor: "border-purple-500" },
        { id: "meeting_scheduled", label: "נקבעה פגישה", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300", borderColor: "border-yellow-500" },
        { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-300", borderColor: "border-orange-500" },
        { id: "negotiation", label: "משא ומתן", color: "bg-green-100 dark:bg-green-900", bgClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300", borderColor: "border-green-500" },
        { id: "won", label: "נסגר בהצלחה", color: "bg-emerald-100 dark:bg-emerald-900", bgClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-300", borderColor: "border-emerald-500" },
        { id: "lost", label: "אבוד", color: "bg-red-100 dark:bg-red-900", bgClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-300", borderColor: "border-red-500" },
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
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterResponseStatus, setFilterResponseStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({});
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>("");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

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

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["leads", tenantId, selectedAgency],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      let query = supabase
        .from("leads")
        .select(`
          id,
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

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

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
  });

  // Create products lookup map
  const productsLookup = useMemo(() => {
    if (!allProducts) return {};
    return allProducts.reduce((acc, product) => {
      acc[product.id] = { name: product.name, price: product.price };
      return acc;
    }, {} as Record<string, { name: string; price: number }>);
  }, [allProducts]);

  // Debug: log how many leads are missing phone/email to verify visibility
  useEffect(() => {
    if (leads) {
      const arr = leads as any[];
      const missingPhone = arr.filter((l: any) => !l.phone).length;
      const missingEmail = arr.filter((l: any) => !l.email).length;
      console.info("Leads fetched", { total: arr.length, missingPhone, missingEmail, sample: arr.slice(0, 3) });
    }
  }, [leads]);

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" }) => {
      // Get lead data before update to know old status
      const { data: leadBefore } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;
      
      // Trigger bubble animation when status changes to "closed"
      if (newStatus === "closed") {
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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["leads", tenantId, selectedAgency] });

      // Snapshot the previous value
      const previousLeads = queryClient.getQueryData(["leads", tenantId, selectedAgency]);

      // Optimistically update to the new value
      queryClient.setQueryData(["leads", tenantId, selectedAgency], (old: any) => {
        if (!old) return old;
        return old.map((lead: any) => 
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        );
      });

      // Return context with the snapshot
      return { previousLeads };
    },
    onError: (error: any, variables, context) => {
      // Rollback to the previous value if error
      if (context?.previousLeads) {
        queryClient.setQueryData(["leads", tenantId, selectedAgency], context.previousLeads);
      }
      toast({
        title: "שגיאה בעדכון סטטוס",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "סטטוס ליד עודכן בהצלחה",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["leads", tenantId, selectedAgency] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", tenantId, selectedAgency] });
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;

    // over.id can be either a stage id or another lead id inside a stage.
    let targetStatus = over.id as string;

    // If over.id is not one of the stage IDs, try to resolve it via the lead it hovers over
    if (!PIPELINE_STAGES.some((s) => s.id === targetStatus)) {
      const overLead = filteredLeads?.find((l: any) => l.id === over.id);
      if (overLead) targetStatus = overLead.status;
    }

    // Validate final status
    if (PIPELINE_STAGES.find((stage) => stage.id === targetStatus)) {
      updateLeadStatus.mutate({
        leadId,
        newStatus: targetStatus as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed",
      });
    }
  };

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    return leads.filter((lead: any) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const contactName = lead.contact_name?.toLowerCase() || "";
        const companyName = lead.company_name?.toLowerCase() || "";
        const phone = lead.phone?.toLowerCase() || "";
        
        const matchesSearch = contactName.includes(query) || 
               companyName.includes(query) || 
               phone.includes(query);
        
        if (!matchesSearch) return false;
      }
      
      // Sales person filter
      if (filterSalesPerson !== "all") {
        if (filterSalesPerson === "none" && lead.sales_person_id !== null) {
          return false;
        } else if (filterSalesPerson !== "none" && lead.sales_person_id !== filterSalesPerson) {
          return false;
        }
      }
      
      // Stage filter
      if (filterStage !== "all" && lead.status !== filterStage) {
        return false;
      }
      
      // Response status filter
      if (filterResponseStatus !== "all") {
        if (filterResponseStatus === "none" && lead.response_status !== null) {
          return false;
        } else if (filterResponseStatus !== "none" && lead.response_status !== filterResponseStatus) {
          return false;
        }
      }
      
      // Date range filter
      if (startDate || endDate) {
        const leadDate = new Date(lead.created_at);
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (leadDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (leadDate > end) return false;
        }
      }
      
      return true;
    });
  }, [leads, searchQuery, filterSalesPerson, filterStage, filterResponseStatus, startDate, endDate]);

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads?.filter((lead: any) => lead.status === stageId) || [];
  };

  const activeLead = filteredLeads?.find((lead: any) => lead.id === activeId);

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-3 md:p-6">
      {/* Mobile Header */}
      <div className="block md:hidden space-y-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">לידים - Pipeline</h1>
          <Badge variant="secondary" className="text-sm px-2 py-0.5">
            {filteredLeads?.length || 0}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterSalesPerson} onValueChange={setFilterSalesPerson}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="איש מכירות" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל אנשי המכירות</SelectItem>
              <SelectItem value="none">ללא שיוך</SelectItem>
              {salesPeople?.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className={`flex-1 border-2 ${
              filterStage !== "all" 
                ? PIPELINE_STAGES.find(s => s.id === filterStage)?.bgClass || "bg-background"
                : "bg-background"
            }`}>
              <SelectValue placeholder="שלב" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל השלבים</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id} className={stage.bgClass}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResponseStatus} onValueChange={setFilterResponseStatus}>
            <SelectTrigger 
              className="flex-1 border-2"
              style={{ 
                backgroundColor: filterResponseStatus !== "all" && filterResponseStatus !== "none" 
                  ? getStatusColor(filterResponseStatus, leadStatuses) || undefined 
                  : undefined,
                color: filterResponseStatus !== "all" && filterResponseStatus !== "none" ? '#fff' : undefined
              }}
            >
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="none">ללא סטטוס</SelectItem>
              {leadStatuses.map((status) => (
                <SelectItem 
                  key={status.status_key} 
                  value={status.status_key}
                  style={{ backgroundColor: status.color, color: '#fff' }}
                >
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Date Range Filters */}
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-right font-normal border-2",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "מתאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-right font-normal border-2",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "עד תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
              }}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
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
              סה"כ: {filteredLeads?.length || 0}
            </Badge>
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
              <AddLeadForm />
            </div>
          </div>
        </div>
        
        {/* Search and Filters in one row */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-xl">
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
          <Select value={filterSalesPerson} onValueChange={setFilterSalesPerson}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="איש מכירות" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל אנשי המכירות</SelectItem>
              <SelectItem value="none">ללא שיוך</SelectItem>
              {salesPeople?.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className={`w-[180px] border-2 ${
              filterStage !== "all" 
                ? PIPELINE_STAGES.find(s => s.id === filterStage)?.bgClass || "bg-background"
                : "bg-background"
            }`}>
              <SelectValue placeholder="כל השלבים" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל השלבים</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id} className={stage.bgClass}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResponseStatus} onValueChange={setFilterResponseStatus}>
            <SelectTrigger 
              className="w-[160px] border-2"
              style={{ 
                backgroundColor: filterResponseStatus !== "all" && filterResponseStatus !== "none" 
                  ? getStatusColor(filterResponseStatus, leadStatuses) || undefined 
                  : undefined,
                color: filterResponseStatus !== "all" && filterResponseStatus !== "none" ? '#fff' : undefined
              }}
            >
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="none">ללא סטטוס</SelectItem>
              {leadStatuses.map((status) => (
                <SelectItem 
                  key={status.status_key} 
                  value={status.status_key}
                  style={{ backgroundColor: status.color, color: '#fff' }}
                >
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Manage Lead Statuses Button */}
          <ManageLeadStatusesDialog 
            trigger={
              <Button variant="outline" size="icon" title="ניהול סטטוסי לידים">
                <Settings2 className="h-4 w-4" />
              </Button>
            }
          />
          
          {/* Date Range Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-right font-normal border-2",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yy") : "מתאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-right font-normal border-2",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yy") : "עד תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
              }}
              title="נקה סינון תאריכים"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

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
            >
              {PIPELINE_STAGES.map((stage) => {
                if (stage.id !== selectedMobileStage) return null;
                const stageLeads = getLeadsByStage(stage.id);
                return (
                  <div key={stage.id}>
                    <div className="mb-4">
                      <h2 className="text-xl font-bold flex items-center justify-between">
                        <span>{stage.label}</span>
                        <Badge variant="secondary" className="text-sm">
                          {stageLeads.length} לידים
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
                          <LeadCard 
                            key={lead.id} 
                            lead={lead}
                            productsLookup={productsLookup}
                            leadStatuses={leadStatuses}
                            pipelineStages={PIPELINE_STAGES}
                            isCompanyNameVisible={isFieldVisible('company_name')}
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
                          />
                        ))}
                      </SortableContext>
                    </DroppableStage>
                  </div>
                );
              })}
              <DragOverlay>
                {activeId && activeLead ? (
                  <LeadCard 
                    lead={activeLead}
                    productsLookup={productsLookup}
                    leadStatuses={leadStatuses}
                    pipelineStages={PIPELINE_STAGES}
                    isCompanyNameVisible={isFieldVisible('company_name')}
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
          >
            <div className="hidden md:grid grid-cols-5 gap-0">
              {PIPELINE_STAGES.map((stage, index) => {
                const stageLeads = getLeadsByStage(stage.id);
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
                          <LeadCard 
                            key={lead.id} 
                            lead={lead}
                            productsLookup={productsLookup}
                            leadStatuses={leadStatuses}
                            pipelineStages={PIPELINE_STAGES}
                            isCompanyNameVisible={isFieldVisible('company_name')}
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
                          />
                        ))}
                      </SortableContext>
                    </DroppableStage>
                  </div>
                );
              })}
            </div>

            <DragOverlay>
              {activeId && activeLead ? (
                <LeadCard 
                  lead={activeLead}
                  productsLookup={productsLookup}
                  leadStatuses={leadStatuses}
                  pipelineStages={PIPELINE_STAGES}
                  isCompanyNameVisible={isFieldVisible('company_name')}
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
            return (
              <StageTable 
                key={stage.id}
                stage={stage}
                stageLeads={stageLeads}
                isOpen={openTables[stage.id]}
                onToggle={(open) => setOpenTables(prev => ({ ...prev, [stage.id]: open }))}
              />
            );
          })}
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

function TableWithStickyScroll({ stageLeads }: { stageLeads: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const { selectedAgency } = useAgency();
  const { activeStatuses: leadStatuses } = useLeadStatuses();
  const { activeStages: pipelineStagesData } = useLeadPipelineStages();
  const { isFieldVisible } = useCustomFieldLabels('lead');
  const { tenantId } = useCurrentTenant();
  
  // Convert dynamic pipeline stages to format compatible with existing code
  const PIPELINE_STAGES = useMemo(() => {
    if (!pipelineStagesData || pipelineStagesData.length === 0) {
      return [
        { id: "new", label: "חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300", borderColor: "border-blue-500" },
        { id: "contacted", label: "יצרנו קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-purple-300", borderColor: "border-purple-500" },
        { id: "meeting_scheduled", label: "נקבעה פגישה", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300", borderColor: "border-yellow-500" },
        { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-300", borderColor: "border-orange-500" },
        { id: "negotiation", label: "משא ומתן", color: "bg-green-100 dark:bg-green-900", bgClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300", borderColor: "border-green-500" },
        { id: "won", label: "נסגר בהצלחה", color: "bg-emerald-100 dark:bg-emerald-900", bgClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-300", borderColor: "border-emerald-500" },
        { id: "lost", label: "אבוד", color: "bg-red-100 dark:bg-red-900", bgClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-300", borderColor: "border-red-500" },
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

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
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
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status })
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(stageLeads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const isAllSelected = stageLeads.length > 0 && selectedLeads.length === stageLeads.length;

  return (
    <div className="relative">
      {/* Bulk Actions Toolbar */}
      {selectedLeads.length > 0 && (
        <div className="bg-primary text-primary-foreground p-3 rounded-lg mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedLeads.length} לידים נבחרו</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLeads([])}
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
              render: (lead: any) => (
                <Select
                  value={lead.status}
                  onValueChange={(value) => 
                    updateLeadStatus.mutate({ 
                      leadId: lead.id, 
                      newStatus: value as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" 
                    })
                  }
                >
                  <SelectTrigger className={`h-8 w-full border-2 ${
                    PIPELINE_STAGES.find(s => s.id === lead.status)?.bgClass || ""
                  }`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem 
                        key={s.id} 
                        value={s.id}
                        className={s.bgClass}
                      >
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            },
            { 
              id: "response_status", 
              label: "סטטוס", 
              width: 150,
              render: (lead: any) => {
                const status = leadStatuses.find(s => s.status_key === lead.response_status);
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
                        color: lead.response_status ? '#fff' : undefined 
                      }}
                    >
                      <SelectValue placeholder="בחר סטטוס" />
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
                    </SelectContent>
                  </Select>
                );
              }
            },
            { 
              id: "actions", 
              label: "פעולות", 
              width: 90,
              render: (lead: any) => (
                <div className="flex justify-center">
                  <EditLeadDialog lead={lead} />
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
     </div>
   );
 }
