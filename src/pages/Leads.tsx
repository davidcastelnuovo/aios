import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign, LayoutGrid, Table as TableIcon, GripVertical, ChevronDown, User, Calendar, Search, X } from "lucide-react";
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
import { ImportLeadsCSV } from "@/components/forms/ImportLeadsCSV";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
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

const PIPELINE_STAGES = [
  { id: "new", label: "ליד חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100/50", borderColor: "border-blue-500" },
  { id: "contacted", label: "נוצר קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100/50", borderColor: "border-purple-500" },
  { id: "follow_up", label: "בתהליך", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100/50", borderColor: "border-yellow-500" },
  { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900", bgClass: "bg-orange-100/50", borderColor: "border-orange-500" },
  { id: "closed", label: "נסגר", color: "bg-green-100 dark:bg-green-900", bgClass: "bg-green-100/50", borderColor: "border-green-500" },
];

const SOURCE_LABELS: Record<string, string> = {
  website: "אתר",
  referral: "הפניה",
  social_media: "מדיה חברתית",
  paid_ads: "מודעות ממומנות",
  cold_call: "שיחה קרה",
  email_campaign: "קמפיין אימייל",
  event: "אירוע",
  other: "אחר",
};

const RESPONSE_STATUS_OPTIONS = [
  { id: "no_answer_1", label: "אין מענה 1", color: "bg-amber-100 dark:bg-amber-900 border-amber-300" },
  { id: "no_answer_2", label: "אין מענה 2", color: "bg-amber-200 dark:bg-amber-800 border-amber-400" },
  { id: "no_answer_3", label: "אין מענה 3", color: "bg-orange-200 dark:bg-orange-800 border-orange-400" },
  { id: "no_answer_4", label: "אין מענה 4", color: "bg-red-200 dark:bg-red-800 border-red-400" },
  { id: "denies_contact", label: "מכחיש פניה", color: "bg-gray-200 dark:bg-gray-700 border-gray-400" },
  { id: "not_relevant", label: "לא רלוונטי", color: "bg-slate-200 dark:bg-slate-700 border-slate-400" },
];

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
          className={`${stage.color} relative p-4 py-3 font-semibold text-center shadow-md overflow-hidden`}
          style={{
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
  onResponseStatusChange 
}: { 
  lead: any; 
  onStatusChange: (leadId: string, newStatus: string) => void;
  onResponseStatusChange: (leadId: string, responseStatus: string | null) => void;
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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <User className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold truncate">{lead.contact_name || 'ללא שם איש קשר'}</span>
          </div>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" aria-label="גרור כרטיס">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <div className="flex items-center gap-2 mt-1">
          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{lead.company_name}</span>
        </div>
        {/* Phone in mobile - visible upfront */}
        {isMobile && lead.phone && (
          <div className="flex items-center gap-2 mt-2">
            <Phone className="h-3 w-3 text-primary shrink-0" />
            <a href={`tel:${lead.phone}`} className="text-xs hover:underline font-medium text-primary">
              {lead.phone}
            </a>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="px-4 pb-4 pt-2 space-y-3">
        {/* Stage/Status Selector - Mobile: prominent at top */}
        {isMobile && (
          <div className="space-y-1.5 -mt-1 mb-3" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-semibold text-muted-foreground">שלב במשפך</label>
            <Select
              value={lead.status}
              onValueChange={(value) => onStatusChange(lead.id, value)}
            >
              <SelectTrigger className={`h-9 text-sm border-2 ${
                PIPELINE_STAGES.find(s => s.id === lead.status)?.bgClass || ""
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]">
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem 
                    key={stage.id} 
                    value={stage.id}
                    className={stage.bgClass}
                  >
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Response Status - Mobile */}
        {isMobile && (
          <div className="space-y-1.5 -mt-1 mb-3" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-semibold text-muted-foreground">סטטוס תגובה</label>
            <Select
              value={lead.response_status || "none"}
              onValueChange={(value) => onResponseStatusChange(lead.id, value === "none" ? null : value)}
            >
              <SelectTrigger className={`h-9 text-sm border-2 font-medium ${
                lead.response_status 
                  ? RESPONSE_STATUS_OPTIONS.find(s => s.id === lead.response_status)?.color || ""
                  : "bg-background"
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]">
                <SelectItem value="none">ללא סטטוס</SelectItem>
                {RESPONSE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id} className={option.color}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Contact Information - Always Visible */}
        <div className="space-y-2 pb-3 border-b">
          {lead.email && (
            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3 w-3 text-primary shrink-0" />
              <a href={`mailto:${lead.email}`} className="hover:underline truncate">
                {lead.email}
              </a>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3 w-3 text-primary shrink-0" />
              <a href={`tel:${lead.phone}`} className="hover:underline">
                {lead.phone}
              </a>
            </div>
          )}
          
          {/* Budget Info */}
          {(lead.monthly_budget || lead.three_month_budget) && (
            <div className="bg-accent/10 p-2 rounded space-y-1 mt-2">
              {lead.monthly_budget && (
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">הצעה חודשית:</span>
                  <span className="font-bold text-primary">₪{lead.monthly_budget.toLocaleString()}</span>
                </div>
              )}
              {lead.three_month_budget && (
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">הצעת 3 חודשים:</span>
                  <span className="font-bold text-primary">₪{lead.three_month_budget.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stage Selector - Desktop */}
        {!isMobile && (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-semibold text-muted-foreground">שלב במשפך</label>
            <Select
              value={lead.status}
              onValueChange={(value) => onStatusChange(lead.id, value)}
            >
              <SelectTrigger className={`h-8 text-sm border-2 ${
                PIPELINE_STAGES.find(s => s.id === lead.status)?.bgClass || ""
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]">
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem 
                    key={stage.id} 
                    value={stage.id}
                    className={stage.bgClass}
                  >
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Response Status Selector - Desktop only (mobile shown above) */}
        {!isMobile && (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-semibold text-muted-foreground">סטטוס תגובה</label>
            <Select
              value={lead.response_status || "none"}
              onValueChange={(value) => onResponseStatusChange(lead.id, value === "none" ? null : value)}
            >
              <SelectTrigger className={`h-8 text-sm border-2 ${
                lead.response_status 
                  ? RESPONSE_STATUS_OPTIONS.find(s => s.id === lead.response_status)?.color || ""
                  : "bg-background"
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]">
                <SelectItem value="none">ללא סטטוס</SelectItem>
                {RESPONSE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id} className={option.color}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Collapsible Details Section */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity pb-2">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wide">פרטים נוספים</h4>
            <ChevronDown className={`h-4 w-4 text-primary transition-transform ${detailsOpen ? '' : '-rotate-90'}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Lead Details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {lead.source && (
                <div className="bg-muted/30 p-2 rounded">
                  <span className="font-semibold block text-muted-foreground mb-1">מקור הגעה</span>
                  <span className="font-medium">{SOURCE_LABELS[lead.source] || lead.source}</span>
                </div>
              )}
              
              <div className="bg-muted/30 p-2 rounded">
                <span className="font-semibold block text-muted-foreground mb-1">שלב במשפך</span>
                <span className="font-medium">
                  {PIPELINE_STAGES.find(s => s.id === lead.status)?.label || lead.status}
                </span>
              </div>
              
              <div className="bg-muted/30 p-2 rounded col-span-2">
                <span className="font-semibold block text-muted-foreground mb-1">תאריך יצירה</span>
                <span className="font-medium">{new Date(lead.created_at).toLocaleDateString('he-IL')}</span>
              </div>
            </div>

            {/* Additional dates if exist */}
            {(lead.proposal_date || lead.sale_date) && (
              <div className="space-y-1.5 text-xs pt-2 border-t">
                {lead.proposal_date && (
                  <div className="flex justify-between items-center bg-muted/30 p-1.5 rounded">
                    <span className="font-semibold">תאריך הצעה:</span>
                    <span className="font-medium">{new Date(lead.proposal_date).toLocaleDateString('he-IL')}</span>
                  </div>
                )}
                {lead.sale_date && (
                  <div className="flex justify-between items-center bg-muted/30 p-1.5 rounded">
                    <span className="font-semibold">תאריך מכירה:</span>
                    <span className="font-medium">{new Date(lead.sale_date).toLocaleDateString('he-IL')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sales Person */}
            {lead.sales_people?.full_name && (
              <div className="bg-muted/30 p-2 rounded text-xs">
                <span className="font-semibold">איש מכירות:</span> {lead.sales_people.full_name}
              </div>
            )}

            {/* Products */}
            {lead.products && (
              <div className="bg-muted/50 p-2 rounded text-xs">
                <span className="font-semibold text-foreground">מוצרים:</span> {lead.products}
              </div>
            )}
            
            {/* Actions */}
            <div className="space-y-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2">
                <EditLeadDialog lead={lead} />
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
            </div>
          </CollapsibleContent>
        </Collapsible>
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
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterResponseStatus, setFilterResponseStatus] = useState<string>("all");
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({
    new: false,
    contacted: false,
    follow_up: false,
    proposal_sent: false,
    closed: false,
  });
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>("new");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["leads", selectedAgency],
    queryFn: async () => {
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
          monthly_budget,
          three_month_budget,
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

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
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

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;
      
      // Trigger bubble animation when status changes to "closed"
      if (newStatus === "closed") {
        playBubbleAnimation();
      }
    },
    onMutate: async ({ leadId, newStatus }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["leads", selectedAgency] });

      // Snapshot the previous value
      const previousLeads = queryClient.getQueryData(["leads", selectedAgency]);

      // Optimistically update to the new value
      queryClient.setQueryData(["leads", selectedAgency], (old: any) => {
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
        queryClient.setQueryData(["leads", selectedAgency], context.previousLeads);
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
      queryClient.invalidateQueries({ queryKey: ["leads", selectedAgency] });
    },
  });

  const updateLeadResponseStatus = useMutation({
    mutationFn: async ({ leadId, responseStatus }: { leadId: string; responseStatus: "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "denies_contact" | "not_relevant" | null }) => {
      const { error } = await supabase
        .from("leads")
        .update({ response_status: responseStatus })
        .eq("id", leadId);

      if (error) throw error;
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
      
      return true;
    });
  }, [leads, searchQuery, filterStage, filterResponseStatus]);

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
        <h1 className="text-2xl font-bold">לידים - Pipeline</h1>
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
          <Select value={selectedAgency || "all"} onValueChange={setSelectedAgency}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="סוכנות" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסוכנויות</SelectItem>
              {agencies?.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
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
            <SelectTrigger className={`flex-1 border-2 ${
              filterResponseStatus !== "all" 
                ? filterResponseStatus === "none"
                  ? "bg-background"
                  : RESPONSE_STATUS_OPTIONS.find(s => s.id === filterResponseStatus)?.color || "bg-background"
                : "bg-background"
            }`}>
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="none">ללא סטטוס</SelectItem>
              {RESPONSE_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.id} value={status.id} className={status.color}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AddLeadForm />
          <ImportLeadsCSV />
        </div>
      </div>

      {/* Desktop Header - Sticky */}
      <div className="hidden md:block sticky top-0 z-40 bg-background pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">לידים - Pipeline</h1>
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
              <ImportLeadsCSV />
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
          <Select value={selectedAgency || "all"} onValueChange={setSelectedAgency}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="כל הסוכנויות" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסוכנויות</SelectItem>
              {agencies?.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
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
            <SelectTrigger className={`w-[180px] border-2 ${
              filterResponseStatus !== "all" 
                ? filterResponseStatus === "none"
                  ? "bg-background"
                  : RESPONSE_STATUS_OPTIONS.find(s => s.id === filterResponseStatus)?.color || "bg-background"
                : "bg-background"
            }`}>
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="none">ללא סטטוס</SelectItem>
              {RESPONSE_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.id} value={status.id} className={status.color}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </div>
  );
}

function TableWithStickyScroll({ stageLeads }: { stageLeads: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const { selectedAgency } = useAgency();

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
    mutationFn: async ({ leadId, responseStatus }: { leadId: string; responseStatus: "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "denies_contact" | "not_relevant" | null }) => {
      const { error } = await supabase
        .from("leads")
        .update({ response_status: responseStatus })
        .eq("id", leadId);

      if (error) throw error;
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

      {/* Scroll container with visible scrollbars */}
      <ScrollArea className="w-full h-[540px] rounded-md border" dir="rtl">
        <div className="min-w-full">
          <Table className="min-w-[750px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="whitespace-nowrap">
                <TableHead className="text-center sticky right-0 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-20 w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="בחר הכל"
                  />
                </TableHead>
                <TableHead className="text-right sticky right-[50px] bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-20 w-[110px]">שם</TableHead>
                <TableHead className="text-right bg-background w-[130px]">טלפון</TableHead>
                <TableHead className="text-right bg-background w-[170px]">שם חברה</TableHead>
                <TableHead className="text-right bg-background w-[130px]">שלב במשפך</TableHead>
                <TableHead className="text-right bg-background w-[130px]">סטטוס</TableHead>
                <TableHead className="text-right bg-background w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {stageLeads.map((lead: any) => (
              <TableRow key={lead.id} className="whitespace-nowrap">
                <TableCell className="text-center sticky right-0 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 w-[50px]">
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                    aria-label={`בחר ${lead.contact_name || lead.company_name}`}
                  />
                </TableCell>
                <TableCell className="font-medium sticky right-[50px] bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 w-[110px]">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">{lead.contact_name || "-"}</span>
                  </div>
                </TableCell>
                <TableCell className="w-[130px]">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.phone}</span>
                    </a>
                  ) : "-"}
                </TableCell>
                <TableCell className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{lead.company_name}</span>
                  </div>
                </TableCell>
                <TableCell className="w-[140px]">
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
                </TableCell>
                <TableCell className="w-[140px]">
                  <Select
                    value={lead.response_status || "none"}
                    onValueChange={(value) => 
                      updateLeadResponseStatus.mutate({ 
                        leadId: lead.id, 
                        responseStatus: value === "none" ? null : value as "no_answer_1" | "no_answer_2" | "no_answer_3" | "no_answer_4" | "denies_contact" | "not_relevant"
                      })
                    }
                  >
                    <SelectTrigger className={`h-8 w-full border-2 ${
                      lead.response_status 
                        ? RESPONSE_STATUS_OPTIONS.find(s => s.id === lead.response_status)?.color || ""
                        : "bg-background"
                    }`}>
                      <SelectValue placeholder="בחר סטטוס" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="none">ללא סטטוס</SelectItem>
                      {RESPONSE_STATUS_OPTIONS.map((status) => (
                        <SelectItem 
                          key={status.id} 
                          value={status.id}
                          className={status.color}
                        >
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                 </TableCell>
                 <TableCell className="w-[80px]">
                   <div className="flex justify-center">
                     <EditLeadDialog lead={lead} />
                   </div>
                 </TableCell>
               </TableRow>
             ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" className="h-3" />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
     </div>
   );
 }
