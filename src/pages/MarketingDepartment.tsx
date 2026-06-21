import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Workflow, CalendarRange, ArrowRight } from "lucide-react";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { ClientConnectionsBar } from "@/components/marketing/ClientConnectionsBar";
import { PipelineCanvas } from "@/components/marketing/PipelineCanvas";
import { WorkItemSidePanel } from "@/components/marketing/WorkItemSidePanel";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { toast } from "@/hooks/use-toast";
import { MarketingCalendarView } from "@/components/marketing/MarketingCalendarView";

export default function MarketingDepartment() {
  const { tenantSlug, clientId: routeClientId } = useParams<{
    tenantSlug: string;
    clientId?: string;
  }>();
  const navigate = useNavigate();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const clientId = routeClientId ?? null;

  // Ensure pipeline exists once a client is chosen
  const { data: pipeline, refetch: refetchPipeline } = useQuery({
    queryKey: ["marketing-pipeline", clientId],
    enabled: !!clientId && !!tenantId,
    queryFn: async () => {
      if (!clientId || !tenantId) return null;
      return await ensurePipelineForClient({ clientId, tenantId });
    },
  });

  const handleSelectClient = (id: string) => {
    navigate(`/t/${tenantSlug}/marketing/${id}`);
  };

  const handleNewItem = async () => {
    if (!pipeline || !tenantId || !clientId) return;
    // First stage
    const { data: stages } = await supabase
      .from("marketing_pipeline_stages")
      .select("id, sort_order")
      .eq("pipeline_id", pipeline.id)
      .order("sort_order", { ascending: true })
      .limit(1);
    const firstStageId = stages?.[0]?.id ?? null;
    const { data, error } = await supabase
      .from("marketing_work_items")
      .insert({
        pipeline_id: pipeline.id,
        tenant_id: tenantId,
        client_id: clientId,
        current_stage_id: firstStageId,
        title: "פריט תוכן חדש",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "שגיאה ביצירת פריט", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedItemId(data.id);
    refetchPipeline();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overscroll-contain" dir="rtl">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b bg-card/50 px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/t/${tenantSlug}`)}
        >
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="text-lg font-semibold">מחלקת שיווק</h1>
        <div className="mx-2 h-6 w-px bg-border" />
        <ClientSelector
          tenantId={tenantId}
          value={clientId}
          onChange={handleSelectClient}
        />
        {clientId && (
          <>
            <div className="mx-2 h-6 w-px bg-border" />
            <ClientConnectionsBar clientId={clientId} />
          </>
        )}
        <div className="ms-auto flex items-center gap-2">
          {pipeline && (
            <Button onClick={handleNewItem} size="sm">
              <Plus className="ml-1 h-4 w-4" />
              פריט תוכן חדש
            </Button>
          )}
        </div>
      </header>

      {/* Main */}
      {!clientId ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md text-center">
            <Workflow className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">בחר לקוח להתחיל</h2>
            <p className="text-sm text-muted-foreground">
              בחירת לקוח תפתח את פס היצור השיווקי שלו — אסטרטגיה, כתיבה, קריאייטיב, יעד ומדידה.
            </p>
          </div>
        </div>
      ) : !pipeline ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">טוען פס יצור...</div>
        </div>
      ) : (
        <Tabs defaultValue="flow" className="flex flex-1 min-h-0 flex-col">
          <TabsList className="mx-4 my-2 w-fit">
            <TabsTrigger value="flow">
              <Workflow className="ml-1 h-4 w-4" />
              פס יצור
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarRange className="ml-1 h-4 w-4" />
              לוח תוכן
            </TabsTrigger>
          </TabsList>
          <TabsContent value="flow" className="flex-1 min-h-0 m-0">
            <PipelineCanvas
              pipelineId={pipeline.id}
              tenantId={tenantId!}
              clientId={clientId}
              onSelectItem={setSelectedItemId}
            />
          </TabsContent>
          <TabsContent value="calendar" className="flex-1 min-h-0 m-0 overflow-auto">
            <MarketingCalendarView pipelineId={pipeline.id} clientId={clientId} />
          </TabsContent>
        </Tabs>
      )}

      <WorkItemSidePanel
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  );
}
