import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign, LayoutGrid, Table as TableIcon } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, ReactNode } from "react";

const PIPELINE_STAGES = [
  { id: "new", label: "ליד חדש", color: "bg-blue-100 dark:bg-blue-900" },
  { id: "contacted", label: "נוצר קשר", color: "bg-purple-100 dark:bg-purple-900" },
  { id: "follow_up", label: "תהליך פולואפ", color: "bg-yellow-100 dark:bg-yellow-900" },
  { id: "proposal_sent", label: "נשלחה הצעה", color: "bg-orange-100 dark:bg-orange-900" },
  { id: "closed", label: "נסגר", color: "bg-green-100 dark:bg-green-900" },
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
          className={`${stage.color} p-3 font-semibold text-center relative`}
          style={{
            clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 0 100%, 20px 50%)",
            marginLeft: "-10px",
            marginRight: "10px",
          }}
        >
          <div className="relative z-10">
            {stage.label}
            <span className="mr-2 text-sm">({leadsCount})</span>
          </div>
        </div>
        <div className="bg-muted/30 rounded-b-lg p-3 flex-1 space-y-2 min-h-[550px]">
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
      className="mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      {...attributes}
      {...listeners}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {lead.company_name}
        </CardTitle>
        {lead.contact_name && (
          <p className="text-sm text-muted-foreground">{lead.contact_name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {lead.estimated_deal_value && (
          <div className="flex items-center gap-1 font-semibold text-primary">
            <DollarSign className="h-3 w-3" />
            ₪{lead.estimated_deal_value.toLocaleString()}
          </div>
        )}

        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <a href={`mailto:${lead.email}`} className="hover:underline truncate">
              {lead.email}
            </a>
          </div>
        )}

        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <a href={`tel:${lead.phone}`} className="hover:underline">
              {lead.phone}
            </a>
          </div>
        )}

        {lead.sales_people?.full_name && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            איש מכירות: {lead.sales_people.full_name}
          </p>
        )}

        <div className="pt-2 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={lead.status}
            onValueChange={(value) => onStatusChange(lead.id, value)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
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
              onClick={() => handleDelete(lead.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: "new" | "contacted" | "follow_up" | "proposal_sent" | "closed" }) => {
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
    const newStatus = over.id as "new" | "contacted" | "follow_up" | "proposal_sent" | "closed";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">לידים - Pipeline</h1>
          <p className="text-muted-foreground mt-2">
            גרור כרטיסים בין השלבים לעדכון סטטוס
          </p>
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
          <AddLeadForm />
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
                              newStatus: newStatus as "new" | "contacted" | "follow_up" | "proposal_sent" | "closed" 
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
              <Card key={stage.id} className={`${stage.color}`}>
                <CardHeader>
                  <CardTitle className="text-xl">
                    {stage.label} ({stageLeads.length})
                  </CardTitle>
                </CardHeader>
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
                                    newStatus: value as "new" | "contacted" | "follow_up" | "proposal_sent" | "closed" 
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PIPELINE_STAGES.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
