import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Workflow, CalendarRange, ArrowRight, Megaphone, Search, Share2, Coins, Palette, Settings2, BarChart2, ExternalLink } from "lucide-react";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { ClientConnectionsBar } from "@/components/marketing/ClientConnectionsBar";
import { MarketingPipelineBoard } from "@/components/marketing/MarketingPipelineBoard";
import { GlobalStageSettings } from "@/components/marketing/GlobalStageSettings";
import { WorkItemSidePanel } from "@/components/marketing/WorkItemSidePanel";
import { CreativeBoard } from "@/components/marketing/CreativeBoard";
import { UsagePanel } from "@/components/marketing/UsagePanel";
import {
  ensurePipelineForClient,
  TRACK_LABELS,
  type MarketingTrack,
} from "@/components/marketing/lib/ensurePipeline";
import { toast } from "@/hooks/use-toast";
import { MarketingCalendarView } from "@/components/marketing/MarketingCalendarView";
import { SocialContentGantt } from "@/components/marketing/SocialContentGantt";

const TRACKS: { value: MarketingTrack; icon: typeof Megaphone }[] = [
  { value: "campaigns", icon: Megaphone },
  { value: "seo_geo", icon: Search },
  { value: "social_organic", icon: Share2 },
];

export default function MarketingDepartment() {
  const { tenantSlug, clientId: routeClientId } = useParams<{
    tenantSlug: string;
    clientId?: string;
  }>();
  const navigate = useNavigate();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<MarketingTrack | "calendar" | "creative" | "usage" | "dashboard">("campaigns");
  const [calendarTrack, setCalendarTrack] = useState<MarketingTrack>("campaigns");
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const track: MarketingTrack = topTab === "calendar"
    ? calendarTrack
    : (topTab === "creative" || topTab === "usage" || topTab === "dashboard" ? "campaigns" : topTab);

  const clientId = routeClientId ?? null;

  // Load the client's linked crm_dashboard for the iframe embed
  const { data: clientDashboard } = useQuery({
    queryKey: ["client-dashboard-for-marketing", clientId],
    enabled: !!clientId && topTab === "dashboard",
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_dashboards")
        .select("id, name, dashboard_type")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: pipeline, refetch: refetchPipeline } = useQuery({
    queryKey: ["marketing-pipeline", clientId, track],
    enabled: !!clientId && !!tenantId,
    queryFn: async () => {
      if (!clientId || !tenantId) return null;
      return await ensurePipelineForClient({ clientId, tenantId, track });
    },
  });

  const handleSelectClient = (id: string) => {
    navigate(`/t/${tenantSlug}/marketing/${id}`);
  };

  const handleNewItem = async () => {
    if (!pipeline || !tenantId || !clientId) return;
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
      <header className="flex items-center gap-3 border-b bg-card/50 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/t/${tenantSlug}`)}>
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="text-lg font-semibold">מחלקת שיווק</h1>
        <div className="mx-2 h-6 w-px bg-border" />
        <ClientSelector tenantId={tenantId} value={clientId} onChange={handleSelectClient} />
        {clientId && (
          <>
            <div className="mx-2 h-6 w-px bg-border" />
            <ClientConnectionsBar clientId={clientId} />
          </>
        )}
        <div className="ms-auto flex items-center gap-2">
          {pipeline && (
            <Button onClick={handleNewItem} size="sm" variant="outline" className="gap-1">
              <Plus className="h-4 w-4" />
              פריט חדש
            </Button>
          )}
          {tenantId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGlobalSettingsOpen(true)}
              title="הגדרות גלובליות לפס הייצור"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {!clientId ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md text-center">
            <Workflow className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">בחר לקוח להתחיל</h2>
            <p className="text-sm text-muted-foreground">
              בחירת לקוח תפתח את פסי היצור השיווקיים — קמפיינים, SEO/GEO וסושיאל אורגני.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col">
          {/* Top-level tabs: 3 tracks + content calendar */}
          <Tabs
            value={topTab}
            onValueChange={(v) => setTopTab(v as any)}
            className="flex flex-1 min-h-0 flex-col"
          >
            <TabsList className="mx-4 mt-2 w-fit">
              {TRACKS.map(({ value, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon className="ml-1 h-4 w-4" />
                  {TRACK_LABELS[value]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="calendar">
                <CalendarRange className="ml-1 h-4 w-4" />
                לוח תוכן
              </TabsTrigger>
              <TabsTrigger value="creative">
                <Palette className="ml-1 h-4 w-4" />
                קריאייטיב
              </TabsTrigger>
              <TabsTrigger value="usage">
                <Coins className="ml-1 h-4 w-4" />
                שימוש בטוקנים
              </TabsTrigger>
              <TabsTrigger value="dashboard">
                <BarChart2 className="ml-1 h-4 w-4" />
                דשבורד
              </TabsTrigger>
            </TabsList>

            {!pipeline ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  <span className="text-sm">טוען פס ייצור...</span>
                </div>
              </div>
            ) : (
              <>
                {TRACKS.map(({ value }) => (
                  <TabsContent key={value} value={value} className="flex-1 min-h-0 m-0">
                    <MarketingPipelineBoard
                      pipelineId={pipeline.id}
                      tenantId={tenantId!}
                      clientId={clientId}
                      track={value}
                      onSelectItem={setSelectedItemId}
                    />
                  </TabsContent>
                ))}
                <TabsContent value="calendar" className="flex-1 min-h-0 m-0 flex flex-col">
                  <Tabs
                    value={calendarTrack}
                    onValueChange={(v) => setCalendarTrack(v as MarketingTrack)}
                    className="flex flex-1 min-h-0 flex-col"
                  >
                    <TabsList className="mx-4 my-2 w-fit">
                      {TRACKS.map(({ value, icon: Icon }) => (
                        <TabsTrigger key={value} value={value}>
                          <Icon className="ml-1 h-4 w-4" />
                          {TRACK_LABELS[value]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {TRACKS.map(({ value }) => (
                      <TabsContent
                        key={value}
                        value={value}
                        className="flex-1 min-h-0 m-0 overflow-auto"
                      >
                        {value === "social_organic" ? (
                          <SocialContentGantt
                            pipelineId={pipeline.id}
                            tenantId={tenantId!}
                            clientId={clientId!}
                            onSelectItem={setSelectedItemId}
                          />
                        ) : (
                          <MarketingCalendarView pipelineId={pipeline.id} clientId={clientId} onSelectItem={setSelectedItemId} />
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </TabsContent>
                <TabsContent value="usage" className="flex-1 min-h-0 m-0 overflow-auto">
                  <UsagePanel tenantId={tenantId!} clientId={clientId} />
                </TabsContent>
                <TabsContent value="creative" className="flex-1 min-h-0 m-0 overflow-auto">
                  <CreativeBoard clientId={clientId} onSelectItem={setSelectedItemId} />
                </TabsContent>
                <TabsContent value="dashboard" className="flex-1 min-h-0 m-0 overflow-hidden">
                  {clientDashboard ? (
                    <div className="flex h-full flex-col">
                      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-sm">
                        <BarChart2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{clientDashboard.name}</span>
                        <a
                          href={`/t/${tenantSlug}/dashboard/${clientDashboard.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          פתח בחלון נפרד
                        </a>
                      </div>
                      <iframe
                        src={`/t/${tenantSlug}/dashboard/${clientDashboard.id}`}
                        className="flex-1 w-full border-0"
                        title={`דשבורד — ${clientDashboard.name}`}
                        allow="fullscreen"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                      <BarChart2 className="h-12 w-12 opacity-30" />
                      <div className="text-center">
                        <p className="text-sm font-medium">אין דשבורד מקושר ללקוח זה</p>
                        <p className="mt-1 text-xs">צור דשבורד חדש מתוך עמוד הלקוח ויופיע כאן אוטומטית</p>
                      </div>
                      <a
                        href={`/t/${tenantSlug}/clients`}
                        className="text-xs text-primary hover:underline"
                      >
                        עבור לניהול לקוחות ←
                      </a>
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      )}


      <WorkItemSidePanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />

      {tenantId && (
        <GlobalStageSettings
          open={globalSettingsOpen}
          onClose={() => setGlobalSettingsOpen(false)}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}
