import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign } from "lucide-react";
import { AddLeadForm } from "@/components/forms/AddLeadForm";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

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

function LeadCard({ lead }: { lead: any }) {
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

        <div className="flex gap-2 pt-2 border-t">
          <EditLeadDialog lead={lead} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(lead.id)}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 ml-2" />
            מחק
          </Button>
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
    return (
      <AppLayout>
        <div className="p-8">טוען...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">לידים - Pipeline</h1>
            <p className="text-muted-foreground mt-2">
              גרור כרטיסים בין השלבים לעדכון סטטוס
            </p>
          </div>
          <AddLeadForm />
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
        ) : (
          <DndContext
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-5 gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageLeads = getLeadsByStage(stage.id);
                return (
                  <SortableContext
                    key={stage.id}
                    id={stage.id}
                    items={stageLeads.map((l: any) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col min-h-[600px]">
                      <div className={`${stage.color} rounded-t-lg p-3 font-semibold text-center`}>
                        {stage.label}
                        <span className="mr-2 text-sm">({stageLeads.length})</span>
                      </div>
                      <div className="bg-muted/30 rounded-b-lg p-3 flex-1 space-y-2">
                        {stageLeads.map((lead: any) => (
                          <LeadCard key={lead.id} lead={lead} />
                        ))}
                      </div>
                    </div>
                  </SortableContext>
                );
              })}
            </div>

            <DragOverlay>
              {activeId && activeLead ? <LeadCard lead={activeLead} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </AppLayout>
  );
}
