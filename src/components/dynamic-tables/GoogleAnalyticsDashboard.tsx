import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Users, Eye, MousePointerClick, Clock, TrendingUp, Globe } from "lucide-react";

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface GoogleAnalyticsDashboardProps {
  records: CrmRecord[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

export function GoogleAnalyticsDashboard({ records }: GoogleAnalyticsDashboardProps) {
  const { trafficSources, dailyData, topPages, totals } = useMemo(() => {
    const trafficSources = records
      .filter(r => r.data.report_type === 'traffic_source')
      .map(r => ({
        name: r.data.source_medium || 'Unknown',
        sessions: Number(r.data.sessions) || 0,
        users: Number(r.data.users) || 0,
        newUsers: Number(r.data.new_users) || 0,
        pageviews: Number(r.data.pageviews) || 0,
        bounceRate: Number(r.data.bounce_rate) || 0,
        avgDuration: Number(r.data.avg_session_duration) || 0,
        conversions: Number(r.data.conversions) || 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    const dailyData = records
      .filter(r => r.data.report_type === 'daily')
      .map(r => ({
        date: r.data.date,
        displayDate: r.data.date ? new Date(r.data.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '',
        sessions: Number(r.data.sessions) || 0,
        users: Number(r.data.users) || 0,
        pageviews: Number(r.data.pageviews) || 0,
        conversions: Number(r.data.conversions) || 0,
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const topPages = records
      .filter(r => r.data.report_type === 'top_pages')
      .map(r => ({
        path: r.data.page_path || '/',
        pageviews: Number(r.data.pageviews) || 0,
        sessions: Number(r.data.sessions) || 0,
        avgDuration: Number(r.data.avg_session_duration) || 0,
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);

    const totals = {
      sessions: trafficSources.reduce((sum, s) => sum + s.sessions, 0),
      users: trafficSources.reduce((sum, s) => sum + s.users, 0),
      newUsers: trafficSources.reduce((sum, s) => sum + s.newUsers, 0),
      pageviews: trafficSources.reduce((sum, s) => sum + s.pageviews, 0),
      conversions: trafficSources.reduce((sum, s) => sum + s.conversions, 0),
      avgBounceRate: trafficSources.length > 0 
        ? (trafficSources.reduce((sum, s) => sum + s.bounceRate, 0) / trafficSources.length).toFixed(1)
        : 0,
    };

    return { trafficSources, dailyData, topPages, totals };
  }, [records]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('he-IL').format(num);
  };

  const pieData = trafficSources.slice(0, 6).map((source, index) => ({
    name: source.name.length > 20 ? source.name.substring(0, 20) + '...' : source.name,
    value: source.sessions,
    fill: COLORS[index % COLORS.length],
  }));

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>אין נתונים להצגה. לחץ על "סנכרון" כדי למשוך נתונים מ-Google Analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">משתמשים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.users)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">סשנים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.sessions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">צפיות עמוד</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.pageviews)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">משתמשים חדשים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.newUsers)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">המרות</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.conversions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Bounce Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.avgBounceRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Traffic Sources Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">התפלגות תנועה לפי מקור</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">מגמות יומיות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="displayDate" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sessions" 
                    name="סשנים"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    name="משתמשים"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pageviews" 
                    name="צפיות"
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">מקורות תנועה - סשנים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficSources.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150} 
                  fontSize={11}
                  tick={{ textAnchor: 'end' }}
                />
                <Tooltip 
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                />
                <Bar dataKey="sessions" name="סשנים" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Traffic Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">מקורות תנועה - פירוט</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 font-medium">מקור / ערוץ</th>
                  <th className="text-center py-2 px-3 font-medium">סשנים</th>
                  <th className="text-center py-2 px-3 font-medium">משתמשים</th>
                  <th className="text-center py-2 px-3 font-medium">חדשים</th>
                  <th className="text-center py-2 px-3 font-medium">צפיות</th>
                  <th className="text-center py-2 px-3 font-medium">Bounce</th>
                  <th className="text-center py-2 px-3 font-medium">זמן ממוצע</th>
                  <th className="text-center py-2 px-3 font-medium">המרות</th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.map((source, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{source.name}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.sessions)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.users)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.newUsers)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.pageviews)}</td>
                    <td className="text-center py-2 px-3">{source.bounceRate}%</td>
                    <td className="text-center py-2 px-3">{source.avgDuration}s</td>
                    <td className="text-center py-2 px-3">
                      {source.conversions > 0 && (
                        <Badge variant="secondary">{source.conversions}</Badge>
                      )}
                      {source.conversions === 0 && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">עמודים מובילים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-3 font-medium">נתיב עמוד</th>
                    <th className="text-center py-2 px-3 font-medium">צפיות</th>
                    <th className="text-center py-2 px-3 font-medium">סשנים</th>
                    <th className="text-center py-2 px-3 font-medium">זמן ממוצע</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((page, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-mono text-xs max-w-[300px] truncate">{page.path}</td>
                      <td className="text-center py-2 px-3">{formatNumber(page.pageviews)}</td>
                      <td className="text-center py-2 px-3">{formatNumber(page.sessions)}</td>
                      <td className="text-center py-2 px-3">{page.avgDuration}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
