import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart3, Code, Globe, Users, MousePointer, TrendingUp, Eye } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { TrackingCodeGenerator } from "@/components/analytics/TrackingCodeGenerator";
import { DateRangeFilter, type DateRange, getDateRangeFromPreset, getComparisonRange } from "@/components/analytics/DateRangeFilter";
import { ImportAnalyticsDialog } from "@/components/analytics/ImportAnalyticsDialog";

export default function SiteAnalytics() {
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset("7_days"));
  const [comparisonRange, setComparisonRange] = useState<DateRange | undefined>();
  const [compareEnabled, setCompareEnabled] = useState(false);

  const handleRangeChange = (range: DateRange, comparison?: DateRange) => {
    setDateRange(range);
    setComparisonRange(comparison);
  };

  const handleCompareChange = (enabled: boolean) => {
    setCompareEnabled(enabled);
    if (enabled) {
      setComparisonRange(getComparisonRange(dateRange));
    } else {
      setComparisonRange(undefined);
    }
  };

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, website")
        .eq("tenant_id", currentTenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch tracking configs
  const { data: trackingConfigs = [] } = useQuery({
    queryKey: ["site_tracking_configs", currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_tracking_configs")
        .select(`
          *,
          clients:client_id (id, name)
        `)
        .eq("tenant_id", currentTenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch summary stats
  const { data: stats } = useQuery({
    queryKey: ["analytics_stats", currentTenantId, selectedClientId],
    queryFn: async () => {
      // Get visitors count
      const { count: visitorsCount } = await supabase
        .from("site_visitors")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId);

      // Get sessions today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: sessionsToday } = await supabase
        .from("site_sessions")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId)
        .gte("started_at", today.toISOString());

      // Get pageviews today
      const { count: pageviewsToday } = await supabase
        .from("site_pageviews")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId)
        .gte("viewed_at", today.toISOString());

      // Get events today
      const { count: eventsToday } = await supabase
        .from("site_events")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId)
        .gte("occurred_at", today.toISOString());

      return {
        totalVisitors: visitorsCount || 0,
        sessionsToday: sessionsToday || 0,
        pageviewsToday: pageviewsToday || 0,
        eventsToday: eventsToday || 0,
      };
    },
    enabled: !!currentTenantId,
  });

  // Create tracking config mutation
  const createConfigMutation = useMutation({
    mutationFn: async ({ clientId, domain }: { clientId: string; domain: string }) => {
      const { data, error } = await supabase
        .from("site_tracking_configs")
        .insert([{
          client_id: clientId,
          tenant_id: currentTenantId!,
          website_domain: domain,
        } as { client_id: string; tenant_id: string; website_domain: string; tracking_id?: string }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_tracking_configs"] });
      toast.success("קוד מעקב נוצר בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה ביצירת קוד מעקב");
      console.error(error);
    },
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            אנליטיקס אתרים
          </h1>
          <p className="text-muted-foreground">
            מעקב אחר תנועה באתרי הלקוחות שלך
          </p>
        </div>
        
        <Select value={selectedClientId || "all"} onValueChange={(val) => setSelectedClientId(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="בחר לקוח לצפייה" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מבקרים כוללים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVisitors || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סשנים היום</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sessionsToday || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">צפיות דפים היום</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pageviewsToday || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">אירועים היום</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.eventsToday || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            דשבורד
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <Code className="h-4 w-4" />
            קודי מעקב
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Date Filters - Above the dashboard cards */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <DateRangeFilter 
              onRangeChange={handleRangeChange}
              onCompareChange={handleCompareChange}
            />
            <ImportAnalyticsDialog tenantId={currentTenantId} />
          </div>

          <AnalyticsDashboard 
            tenantId={currentTenantId} 
            clientId={selectedClientId || undefined}
            dateRange={dateRange}
            comparisonRange={comparisonRange}
            compareEnabled={compareEnabled}
          />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <TrackingCodeGenerator
            clients={clients}
            trackingConfigs={trackingConfigs.map(c => ({
              ...c,
              settings: (c.settings as Record<string, boolean>) || {}
            }))}
            onCreateConfig={createConfigMutation.mutate}
            isCreating={createConfigMutation.isPending}
            onViewDashboard={(clientId) => {
              setSelectedClientId(clientId);
              setActiveTab("dashboard");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
