import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign, LayoutGrid, Table as TableIcon, GripVertical, ChevronDown, User, Calendar } from "lucide-react";
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
import { UpdateLeadsCompanyName } from "@/components/forms/UpdateLeadsCompanyName";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const PIPELINE_STAGES = [
  { id: "new", label: "ליד חדש", color: "bg-blue-100 dark:bg-blue-900", bgClass: "bg-blue-100/50", borderColor: "border-blue-500" },
  { id: "contacted", label: "נוצר קשר", color: "bg-purple-100 dark:bg-purple-900", bgClass: "bg-purple-100/50", borderColor: "border-purple-500" },
  { id: "follow_up", label: "תהליך פולואפ", color: "bg-yellow-100 dark:bg-yellow-900", bgClass: "bg-yellow-100/50", borderColor: "border-yellow-500" },
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
          className={`${stage.color} relative p-4 py-3 font-semibold text-center shadow-md overflow-visible`}
          style={{
            clipPath: "polygon(25px 0, 100% 0, 100% 100%, 25px 100%, 0 50%)"
          }}
        >
          <div className="relative z-10 px-6">
            {stage.label}
            <span className="mr-2 text-sm">({leadsCount})</span>
          </div>
        </div>
        <div className="bg-muted/30 rounded-b-lg p-4 flex-1 space-y-3 min-h-[550px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, onStatusChange }: { lead: any; onStatusChange: (leadId: string, newStatus: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { toast } = useToast();
  const [openSections, setOpenSections] = useState({
    business: false,
    dates: false,
    management: false,
  });

  const toggleSection = (section: 'business' | 'dates' | 'management') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      <CardHeader className="pb-3 pt-4 bg-muted/30">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-bold">{lead.company_name}</span>
          </div>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" aria-label="גרור כרטיס">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardTitle>
        {lead.contact_name && (
          <p className="text-sm text-muted-foreground font-medium">{lead.contact_name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-3">
        {/* אזור פרטי העסק */}
        <Collapsible open={openSections.business} onOpenChange={() => toggleSection('business')}>
          <div className="space-y-2 pb-3 border-b-2 border-muted">
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wide">פרטי העסק</h4>
              <ChevronDown className={`h-4 w-4 text-primary transition-transform ${openSections.business ? '' : '-rotate-90'}`} />
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-2 pt-2">
              {/* Contact Info */}
              <div className="space-y-1.5">
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
              </div>
              
              {/* Products */}
              {lead.products && (
                <div className="bg-muted/50 p-2 rounded text-xs">
                  <span className="font-semibold text-foreground">מוצרים:</span> {lead.products}
                </div>
              )}
              
              {/* Deal Value */}
              {lead.estimated_deal_value && (
                <div className="bg-primary/10 p-2 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold">שווי עסקה:</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ₪{lead.estimated_deal_value.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              )}
              
              {/* Budget Section */}
              {(lead.monthly_budget || lead.three_month_budget) && (
                <div className="bg-accent/10 p-2 rounded space-y-1">
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
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* אזור תאריכים */}
        {(lead.proposal_date || lead.sale_date) && (
          <Collapsible open={openSections.dates} onOpenChange={() => toggleSection('dates')}>
            <div className="space-y-2 pb-3 border-b-2 border-muted">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wide">תאריכים</h4>
                <ChevronDown className={`h-4 w-4 text-primary transition-transform ${openSections.dates ? '' : '-rotate-90'}`} />
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="space-y-1.5 text-xs pt-2">
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
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* אזור ניהול ומעקב */}
        <Collapsible open={openSections.management} onOpenChange={() => toggleSection('management')}>
          <div className="space-y-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wide">ניהול ומעקב</h4>
              <ChevronDown className={`h-4 w-4 text-primary transition-transform ${openSections.management ? '' : '-rotate-90'}`} />
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-2 pt-2">
              {/* Sales Person and Status */}
              <div className="space-y-2">
                {lead.sales_people?.full_name && (
                  <div className="bg-muted/30 p-2 rounded text-xs">
                    <span className="font-semibold">איש מכירות:</span> {lead.sales_people.full_name}
                  </div>
                )}
                
                {lead.response_status && (
                  <Badge variant="secondary" className="text-xs w-full justify-center">
                    {lead.response_status === 'no_answer_1' && 'אין מענה 1'}
                    {lead.response_status === 'no_answer_2' && 'אין מענה 2'}
                    {lead.response_status === 'no_answer_3' && 'אין מענה 3'}
                    {lead.response_status === 'no_answer_4' && 'אין מענה 4'}
                    {lead.response_status === 'denies_contact' && 'מכחיש פניה'}
                    {lead.response_status === 'not_relevant' && 'לא רלוונטי'}
                  </Badge>
                )}
              </div>
              
              {/* Actions */}
              <div className="space-y-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={lead.status}
                  onValueChange={(value) => onStatusChange(lead.id, value)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
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
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function Leads() {
  const { toast } = useToast();
  const { selectedAgency } = useAgency();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({
    new: false,
    contacted: false,
    follow_up: false,
    proposal_sent: false,
    closed: false,
  });

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["leads", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*, agencies (name), sales_people (full_name)")
        .order("created_at", { ascending: false });

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed";

    // Check if dropped on a valid stage
    if (PIPELINE_STAGES.find((stage) => stage.id === newStatus)) {
      updateLeadStatus.mutate({ leadId, newStatus });
    }
  };

  const getLeadsByStage = (stageId: string) => {
    return leads?.filter((lead: any) => lead.status === stageId) || [];
  };

  const activeLead = leads?.find((lead: any) => lead.id === activeId);

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">לידים - Pipeline</h1>
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
            <UpdateLeadsCompanyName />
            <ImportLeadsCSV />
            <AddLeadForm />
          </div>
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
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-0">
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
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            return (
              <Collapsible 
                key={stage.id}
                open={openTables[stage.id]}
                onOpenChange={(open) => setOpenTables(prev => ({ ...prev, [stage.id]: open }))}
              >
                <Card className={`border-r-4 ${stage.borderColor} bg-card`}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="text-xl flex items-center justify-between">
                        <span>{stage.label} ({stageLeads.length})</span>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openTables[stage.id] ? '' : '-rotate-90'}`} />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {stageLeads.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">אין לידים בשלב זה</p>
                      ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>חברה</TableHead>
                          <TableHead>איש קשר</TableHead>
                          <TableHead>אימייל</TableHead>
                          <TableHead>טלפון</TableHead>
                          <TableHead>שווי משוער</TableHead>
                          <TableHead>איש מכירות</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead className="text-left">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stageLeads.map((lead: any) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {lead.company_name}
                              </div>
                            </TableCell>
                            <TableCell>{lead.contact_name || "-"}</TableCell>
                            <TableCell>
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} className="hover:underline flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {lead.email}
                                </a>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {lead.phone ? (
                                <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone}
                                </a>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {lead.estimated_deal_value ? (
                                <span className="font-semibold text-primary">
                                  ₪{lead.estimated_deal_value.toLocaleString()}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>{lead.sales_people?.full_name || "-"}</TableCell>
                            <TableCell>
                              <Select
                                value={lead.status}
                                onValueChange={(value) => 
                                  updateLeadStatus.mutate({ 
                                    leadId: lead.id, 
                                    newStatus: value as "new" | "contacted" | "follow_up" | "proposal_sent" | "transferred_to_onboarding" | "closed" 
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px]">
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
                            <TableCell>
                              <div className="flex gap-2">
                                <EditLeadDialog lead={lead} />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from("leads")
                                        .delete()
                                        .eq("id", lead.id);

                                      if (error) throw error;

                                      toast({
                                        title: "ליד נמחק בהצלחה",
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["leads"] });
                                    } catch (error: any) {
                                      toast({
                                        title: "שגיאה במחיקת ליד",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
