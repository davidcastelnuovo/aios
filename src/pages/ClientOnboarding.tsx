import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, User, Plus } from "lucide-react";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useAgency } from "@/contexts/AgencyContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddOnboardingForm from "@/components/forms/AddOnboardingForm";
import EditOnboardingDialog from "@/components/forms/EditOnboardingDialog";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { Button } from "@/components/ui/button";

type OnboardingStatus = "research_meeting" | "receiving_access" | "setup_and_content" | "campaign_live";

interface OnboardingItem {
  id: string;
  client_id: string;
  campaigner_id: string;
  agency_id: string;
  status: OnboardingStatus;
  title: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string } | null;
  campaigners: { full_name: string } | null;
}

interface Campaigner {
  id: string;
  full_name: string;
}

export default function ClientOnboarding() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const { selectedAgency } = useAgency();
  const [editingItem, setEditingItem] = useState<OnboardingItem | null>(null);
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: onboardingItems, isLoading } = useQuery({
    queryKey: ["client-onboarding", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("client_onboarding")
        .select(`
          *,
          clients (name),
          campaigners (full_name)
        `)
        .order("created_at", { ascending: false });

      // Filter by selected agency
      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OnboardingItem[];
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data as Campaigner[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OnboardingStatus }) => {
      const { error } = await supabase
        .from("client_onboarding")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success("סטטוס עודכן בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בעדכון הסטטוס");
      console.error(error);
    },
  });

  const filteredItems = onboardingItems?.filter((item) => {
    if (selectedCampaigner !== "all" && item.campaigner_id !== selectedCampaigner) {
      return false;
    }
    return true;
  });

  const itemsByStatus: Record<OnboardingStatus, OnboardingItem[]> = {
    research_meeting: [],
    receiving_access: [],
    setup_and_content: [],
    campaign_live: [],
  };

  filteredItems?.forEach((item) => {
    itemsByStatus[item.status].push(item);
  });

  const getStatusText = (status: OnboardingStatus) => {
    const statusMap = {
      research_meeting: "פגישת מחקר",
      receiving_access: "קבלת גישות וחומרים",
      setup_and_content: "הקמות ויצירת תוכן",
      campaign_live: "קמפיין באוויר",
    };
    return statusMap[status];
  };

  const getStatusColor = (status: OnboardingStatus) => {
    const colorMap = {
      research_meeting: "bg-blue-500",
      receiving_access: "bg-yellow-500",
      setup_and_content: "bg-orange-500",
      campaign_live: "bg-green-500",
    };
    return colorMap[status];
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith("droppable-")) {
      const newStatus = overId.replace("droppable-", "") as OnboardingStatus;
      updateStatusMutation.mutate({ id: activeId, status: newStatus });
    }
  }

  const DroppableColumn = ({ status, children }: { status: OnboardingStatus; children: React.ReactNode }) => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
          <h3 className="font-semibold">{getStatusText(status)}</h3>
          <Badge variant="secondary">{itemsByStatus[status].length}</Badge>
        </div>
        <SortableContext id={`droppable-${status}`} items={itemsByStatus[status].map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/20">
            {children}
          </div>
        </SortableContext>
      </div>
    );
  };

  const DraggableCard = ({ item }: { item: OnboardingItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-move hover:shadow-md transition-shadow"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[role='combobox']") || 
              (e.target as HTMLElement).closest("[role='dialog']") ||
              (e.target as HTMLElement).closest("button")) return;
          setEditingItem(item);
        }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{item.title}</CardTitle>
          {item.clients && <CardDescription>{item.clients.name}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-2">
          {item.campaigners && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{item.campaigners.full_name}</span>
            </div>
          )}
          {item.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(item.due_date), "dd/MM/yyyy")}</span>
            </div>
          )}
          
          <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-muted-foreground mb-1">שנה סטטוס:</p>
            <Select
              value={item.status}
              onValueChange={(value: OnboardingStatus) => 
                updateStatusMutation.mutate({ id: item.id, status: value })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="research_meeting">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    פגישת מחקר
                  </div>
                </SelectItem>
                <SelectItem value="receiving_access">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                    קבלת גישות וחומרים
                  </div>
                </SelectItem>
                <SelectItem value="setup_and_content">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                    הקמות ויצירת תוכן
                  </div>
                </SelectItem>
                <SelectItem value="campaign_live">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    קמפיין באוויר
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t mt-2" onClick={(e) => e.stopPropagation()}>
            <AddTaskForm 
              clientId={item.client_id}
              agencyId={item.agency_id}
              triggerButton={
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  הוסף משימה
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">טוען...</div>;
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      <h1 className="text-2xl font-bold">לקוחות בקליטה</h1>
      
      <div className="flex items-center justify-end gap-4">
        <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="סנן לפי איש צוות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל אנשי הצוות</SelectItem>
            {campaigners?.map((campaigner) => (
              <SelectItem key={campaigner.id} value={campaigner.id}>
                {campaigner.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddOnboardingForm />
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(["research_meeting", "receiving_access", "setup_and_content", "campaign_live"] as OnboardingStatus[]).map((status) => (
            <DroppableColumn key={status} status={status}>
              {itemsByStatus[status].map((item) => (
                <DraggableCard key={item.id} item={item} />
              ))}
            </DroppableColumn>
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <Card className="cursor-move shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {filteredItems?.find((t) => t.id === activeId)?.title}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingItem && (
        <EditOnboardingDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
        />
      )}
    </div>
  );
}
