import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { Globe, Clock, Users, TrendingUp, Smartphone, Monitor, Tablet, ArrowUp, ArrowDown } from "lucide-react";

interface AnalyticsDashboardProps {
  tenantId: string | null;
  clientId?: string;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function AnalyticsDashboard({ tenantId, clientId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState("7");
  
  const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
  const endDate = endOfDay(new Date());

  // Fetch sessions with aggregated data
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["analytics_sessions", tenantId, clientId, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("site_sessions")
        .select(`
          id,
          started_at,
          duration_seconds,
          page_count,
          utm_source,
          utm_medium,
          utm_campaign,
          referrer,
          device_type,
          browser,
          is_bounce,
          landing_page
        `)
        .eq("tenant_id", tenantId)
        .gte("started_at", startDate.toISOString())
        .lte("started_at", endDate.toISOString())
        .order("started_at", { ascending: false });

      if (clientId) {
        const { data: config } = await supabase
          .from("site_tracking_configs")
          .select("id")
          .eq("client_id", clientId)
          .single();
        
        if (config) {
          query = query.eq("tracking_config_id", config.id);
        }
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch top pages
  const { data: topPages = [] } = useQuery({
    queryKey: ["analytics_top_pages", tenantId, clientId, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("site_pageviews")
        .select("page_path, page_title")
        .eq("tenant_id", tenantId)
        .gte("viewed_at", startDate.toISOString())
        .lte("viewed_at", endDate.toISOString());

      if (clientId) {
        const { data: config } = await supabase
          .from("site_tracking_configs")
          .select("id")
          .eq("client_id", clientId)
          .single();
        
        if (config) {
          query = query.eq("tracking_config_id", config.id);
        }
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;

      // Aggregate by page
      const pageMap = new Map<string, { path: string; title: string; views: number }>();
      data?.forEach((pv) => {
        const key = pv.page_path || "/";
        const existing = pageMap.get(key);
        if (existing) {
          existing.views++;
        } else {
          pageMap.set(key, { path: key, title: pv.page_title || key, views: 1 });
        }
      });

      return Array.from(pageMap.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
    },
    enabled: !!tenantId,
  });

  // Process sessions data
  const processedData = (() => {
    if (!sessionsData) return null;

    // Sessions by day
    const sessionsByDay = new Map<string, number>();
    const days = parseInt(dateRange);
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
      sessionsByDay.set(date, 0);
    }
    
    sessionsData.forEach((session) => {
      const date = format(new Date(session.started_at), "yyyy-MM-dd");
      sessionsByDay.set(date, (sessionsByDay.get(date) || 0) + 1);
    });

    const sessionsChart = Array.from(sessionsByDay.entries()).map(([date, count]) => ({
      date: format(new Date(date), "dd/MM", { locale: he }),
      sessions: count,
    }));

    // Traffic sources
    const sourceMap = new Map<string, number>();
    sessionsData.forEach((session) => {
      const source = session.utm_source || (session.referrer ? new URL(session.referrer).hostname : "ישיר");
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });

    const trafficSources = Array.from(sourceMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    // Device breakdown
    const deviceMap = new Map<string, number>();
    sessionsData.forEach((session) => {
      const device = session.device_type || "unknown";
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
    });

    const devices = Array.from(deviceMap.entries())
      .map(([name, value]) => ({ name, value }));

    // Browser breakdown
    const browserMap = new Map<string, number>();
    sessionsData.forEach((session) => {
      const browser = session.browser || "unknown";
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
    });

    const browsers = Array.from(browserMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Averages
    const totalSessions = sessionsData.length;
    const totalDuration = sessionsData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const totalPages = sessionsData.reduce((sum, s) => sum + (s.page_count || 0), 0);
    const bounces = sessionsData.filter(s => s.is_bounce).length;

    return {
      sessionsChart,
      trafficSources,
      devices,
      browsers,
      avgDuration: totalSessions ? Math.round(totalDuration / totalSessions) : 0,
      avgPages: totalSessions ? (totalPages / totalSessions).toFixed(1) : 0,
      bounceRate: totalSessions ? Math.round((bounces / totalSessions) * 100) : 0,
      totalSessions,
    };
  })();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "mobile": return <Smartphone className="h-4 w-4" />;
      case "tablet": return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">טוען נתונים...</div>;
  }

  if (!processedData || processedData.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">אין נתונים עדיין</h3>
          <p className="text-muted-foreground">
            התקן את קוד המעקב באתר כדי להתחיל לאסוף נתונים
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex justify-end">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 ימים אחרונים</SelectItem>
            <SelectItem value="14">14 ימים אחרונים</SelectItem>
            <SelectItem value="30">30 ימים אחרונים</SelectItem>
            <SelectItem value="90">90 ימים אחרונים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ סשנים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedData.totalSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">זמן שהייה ממוצע</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(processedData.avgDuration)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">דפים לסשן</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedData.avgPages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שיעור נטישה</CardTitle>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedData.bounceRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sessions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">סשנים לפי יום</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={processedData.sessionsChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="sessions" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">מקורות תנועה</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={processedData.trafficSources}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {processedData.trafficSources.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Top Pages */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">דפים פופולריים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPages.map((page, index) => (
                <div key={page.path} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                    <span className="text-sm truncate" title={page.title}>
                      {page.title || page.path}
                    </span>
                  </div>
                  <Badge variant="secondary">{page.views}</Badge>
                </div>
              ))}
              {topPages.length === 0 && (
                <p className="text-muted-foreground text-center py-4">אין נתונים</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedData.devices.map((device) => (
                <div key={device.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(device.name)}
                    <span className="text-sm capitalize">
                      {device.name === "desktop" ? "מחשב" : 
                       device.name === "mobile" ? "נייד" : 
                       device.name === "tablet" ? "טאבלט" : device.name}
                    </span>
                  </div>
                  <Badge variant="secondary">{device.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Browsers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">דפדפנים</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={processedData.browsers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
