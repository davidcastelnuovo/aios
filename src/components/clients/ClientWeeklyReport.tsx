import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface ClientWeeklyReportProps {
  clientId: string;
  clientName: string;
}

const DATE_FILTERS = [
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
];

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
const getLeadsFromData = (data: any) => Number(data?.leads) || Number(data?.conversions) || 0;
const getImpressionsFromData = (data: any) => Number(data?.impressions) || 0;
const getClicksFromData = (data: any) => Number(data?.clicks) || Number(data?.link_clicks) || 0;

export function ClientWeeklyReport({ clientId, clientName }: ClientWeeklyReportProps) {
  const tenantPath = useTenantPath();
  const [dateFilter, setDateFilter] = useState('last_7_days');

  // Find dashboard for this client
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['client-dashboard', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_dashboards')
        .select('*')
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch tables for the client
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-client-report', clientId],
    queryFn: async () => {
      const response = await supabase.functions.invoke('crm-tables', { method: 'GET' });
      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      return allTables.filter((t: any) => t.client_id === clientId);
    },
    enabled: !!clientId,
  });

  // Fetch records
  const { data: allRecords = [], isLoading: recordsLoading, refetch } = useQuery({
    queryKey: ['crm-records-client-report', tables.map((t: any) => t.id).join(','), dateFilter],
    queryFn: async () => {
      if (tables.length === 0) return [];
      const recordsPromises = tables.map(async (table: any) => {
        const params = new URLSearchParams({ table_id: table.id, date_filter: dateFilter });
        const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, { method: 'GET' });
        if (response.error) return [];
        const records = Array.isArray(response.data) ? response.data : [];
        return records.map((r: any) => ({
          ...r,
          _source: table.integration_type,
          _tableName: table.name,
        }));
      });
      return (await Promise.all(recordsPromises)).flat();
    },
    enabled: tables.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Calculate summary KPIs
  const summary = useMemo(() => {
    const dailyRecords = allRecords.filter((r: any) => r.data?.report_type === 'daily' || !r.data?.report_type);
    let totalSpend = 0, totalRevenue = 0, totalLeads = 0, totalImpressions = 0, totalClicks = 0;
    dailyRecords.forEach((r: any) => {
      totalSpend += getSpendFromData(r.data);
      totalRevenue += getRevenueFromData(r.data);
      totalLeads += getLeadsFromData(r.data);
      totalImpressions += getImpressionsFromData(r.data);
      totalClicks += getClicksFromData(r.data);
    });
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    return { totalSpend, totalRevenue, totalLeads, totalImpressions, totalClicks, ctr, cpl, roas };
  }, [allRecords]);

  // Daily chart data
  const chartData = useMemo(() => {
    const dailyRecords = allRecords.filter((r: any) => r.data?.report_type === 'daily' || !r.data?.report_type);
    const byDate: Record<string, { date: string; spend: number; leads: number; revenue: number }> = {};
    dailyRecords.forEach((r: any) => {
      const date = r.data?.date || r.data?.date_start;
      if (!date) return;
      const d = date.substring(0, 10);
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, leads: 0, revenue: 0 };
      byDate[d].spend += getSpendFromData(r.data);
      byDate[d].leads += getLeadsFromData(r.data);
      byDate[d].revenue += getRevenueFromData(r.data);
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [allRecords]);

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    const byPlatform: Record<string, { name: string; spend: number; leads: number; revenue: number }> = {};
    const dailyRecords = allRecords.filter((r: any) => r.data?.report_type === 'daily' || !r.data?.report_type);
    dailyRecords.forEach((r: any) => {
      const platform = r._source || 'other';
      const name = r._tableName || platform;
      if (!byPlatform[platform]) byPlatform[platform] = { name, spend: 0, leads: 0, revenue: 0 };
      byPlatform[platform].spend += getSpendFromData(r.data);
      byPlatform[platform].leads += getLeadsFromData(r.data);
      byPlatform[platform].revenue += getRevenueFromData(r.data);
    });
    return Object.values(byPlatform);
  }, [allRecords]);

  if (dashboardLoading || tablesLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (tables.length === 0 && !dashboard) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
        <BarChart3 className="h-12 w-12 opacity-30" />
        <p className="text-sm">אין דשבורד או טבלאות נתונים עבור לקוח זה</p>
        {dashboard && (
          <Button variant="outline" size="sm" asChild>
            <a href={`${tenantPath}/dynamic-tables/${dashboard.id}`}>
              <ExternalLink className="h-3.5 w-3.5 ml-1" />
              פתח דשבורד מלא
            </a>
          </Button>
        )}
      </div>
    );
  }

  const isLoading = recordsLoading;
  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : n.toFixed(n % 1 === 0 ? 0 : 2);

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          דוח {clientName}
        </h3>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">הוצאה</p>
                <p className="text-lg font-bold">₪{fmt(summary.totalSpend)}</p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">לידים</p>
                <p className="text-lg font-bold">{summary.totalLeads}</p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">עלות לליד</p>
                <p className="text-lg font-bold">₪{fmt(summary.cpl)}</p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-lg font-bold">{summary.ctr.toFixed(2)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="border">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs text-muted-foreground">הוצאה ולידים לפי יום</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.substring(5)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, direction: 'rtl' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="spend" name="הוצאה" fill="hsl(var(--primary))" radius={[2,2,0,0]} />
                    <Bar yAxisId="right" dataKey="leads" name="לידים" fill="hsl(var(--accent))" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Platform breakdown */}
          {platformBreakdown.length > 0 && (
            <Card className="border">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs text-muted-foreground">פירוט לפי פלטפורמה</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right text-xs">פלטפורמה</TableHead>
                      <TableHead className="text-right text-xs">הוצאה</TableHead>
                      <TableHead className="text-right text-xs">לידים</TableHead>
                      <TableHead className="text-right text-xs">עלות לליד</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platformBreakdown.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs">₪{fmt(p.spend)}</TableCell>
                        <TableCell className="text-xs">{p.leads}</TableCell>
                        <TableCell className="text-xs">₪{p.leads > 0 ? fmt(p.spend / p.leads) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Link to full dashboard */}
          {dashboard && (
            <div className="text-center">
              <Button variant="outline" size="sm" asChild>
                <a href={`${tenantPath}/dynamic-tables/${dashboard.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  פתח דשבורד מלא
                </a>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
