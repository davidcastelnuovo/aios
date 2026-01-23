import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Facebook, ShoppingCart, FileSpreadsheet, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";

const DATE_FILTERS = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
];

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  google_ads: { name: 'Google Ads', color: 'text-red-500', bgColor: 'bg-red-100' },
  google_analytics: { name: 'Analytics', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  google_search_console: { name: 'Search Console', color: 'text-green-500', bgColor: 'bg-green-100' },
};

export default function DashboardView() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [dateFilter, setDateFilter] = useState('last_30_days');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['crm-dashboard', dashboardId],
    queryFn: async () => {
      if (!dashboardId) throw new Error('No dashboard ID');
      const { data, error } = await supabase
        .from('crm_dashboards')
        .select('*, clients(name), agencies(name)')
        .eq('id', dashboardId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!dashboardId,
  });

  // Fetch tables for the client
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-for-dashboard', dashboard?.client_id],
    queryFn: async () => {
      if (!dashboard?.client_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      return allTables.filter((t: any) => t.client_id === dashboard.client_id);
    },
    enabled: !!dashboard?.client_id,
  });

  // Fetch records from all tables
  const { data: allRecords = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['crm-records-dashboard', tables.map((t: any) => t.id).join(','), dateFilter],
    queryFn: async () => {
      if (tables.length === 0) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch records from all tables in parallel using GET with query params
      const recordsPromises = tables.map(async (table: any) => {
        const params = new URLSearchParams({
          table_id: table.id,
          date_filter: dateFilter,
        });
        const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, {
          method: 'GET',
        });
        
        if (response.error) {
          console.error('Error fetching records for table', table.id, response.error);
          return [];
        }
        
        const records = Array.isArray(response.data) ? response.data : [];
        // Add source info to each record
        return records.map((r: any) => ({
          ...r,
          _source: table.integration_type,
          _tableName: table.name,
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0,
  });

  // Calculate summary metrics by platform
  const summaryByPlatform = useMemo(() => {
    const platforms: Record<string, any> = {};
    
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!platforms[source]) {
        platforms[source] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          purchases: 0,
          purchase_value: 0,
          roas: 0,
          recordCount: 0,
        };
      }
      
      const data = record.data || {};
      platforms[source].spend += Number(data.spend) || 0;
      platforms[source].impressions += Number(data.impressions) || 0;
      platforms[source].clicks += Number(data.clicks) || 0;
      platforms[source].conversions += Number(data.conversions) || 0;
      platforms[source].purchases += Number(data.purchases) || 0;
      platforms[source].purchase_value += Number(data.purchase_value) || 0;
      platforms[source].recordCount += 1;
    });

    // Calculate ROAS for each platform
    Object.keys(platforms).forEach(key => {
      if (platforms[key].spend > 0) {
        platforms[key].roas = platforms[key].purchase_value / platforms[key].spend;
      }
    });

    return platforms;
  }, [allRecords]);

  // Calculate total summary
  const totalSummary = useMemo(() => {
    return Object.values(summaryByPlatform).reduce((acc: any, platform: any) => ({
      spend: acc.spend + platform.spend,
      impressions: acc.impressions + platform.impressions,
      clicks: acc.clicks + platform.clicks,
      conversions: acc.conversions + platform.conversions,
      purchases: acc.purchases + platform.purchases,
      purchase_value: acc.purchase_value + platform.purchase_value,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, purchases: 0, purchase_value: 0 });
  }, [summaryByPlatform]);

  // Calculate combined ROAS
  const combinedRoas = totalSummary.spend > 0 
    ? totalSummary.purchase_value / totalSummary.spend 
    : 0;

  // Group records by date
  const recordsByDate = useMemo(() => {
    const byDate: Record<string, any[]> = {};
    
    allRecords.forEach((record: any) => {
      const date = record.data?.date || 'unknown';
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(record);
    });

    // Sort by date descending
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 30); // Limit to 30 days
  }, [allRecords]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(num % 1 === 0 ? 0 : 2);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getIntegrationIcon = (type: string | null) => {
    switch (type) {
      case 'facebook_insights':
      case 'facebook_ecommerce':
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'google_ads':
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
            <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
            <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
          </svg>
        );
      default:
        return <FileSpreadsheet className="h-5 w-5" />;
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchRecords();
      toast.success('הנתונים רועננו');
    } catch (error) {
      toast.error('שגיאה ברענון הנתונים');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (dashboardLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">הדשבורד לא נמצא</h3>
          <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לניהול טבלאות
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(buildPath('/dynamic-tables'))}
            className="mb-2"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה
          </Button>
          <h1 className="text-3xl font-bold">{dashboard.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <span>{(dashboard as any).clients?.name}</span>
            {(dashboard as any).agencies?.name && (
              <>
                <span>•</span>
                <span>{(dashboard as any).agencies?.name}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            רענן נתונים
          </Button>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Connected Platforms */}
      <div className="flex flex-wrap gap-2">
        {tables.map((table: any) => {
          const config = PLATFORM_CONFIG[table.integration_type] || { name: 'טבלה', color: 'text-gray-600', bgColor: 'bg-gray-100' };
          return (
            <Badge
              key={table.id}
              variant="outline"
              className={`flex items-center gap-2 py-1.5 px-3 ${config.bgColor}`}
            >
              {getIntegrationIcon(table.integration_type)}
              <span className={config.color}>{table.name}</span>
            </Badge>
          );
        })}
      </div>

      {tablesLoading || recordsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : tables.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">אין טבלאות משויכות ללקוח זה</h3>
          <p className="text-muted-foreground mb-4">
            צור טבלאות ושייך אותן ללקוח כדי לראות נתונים בדשבורד
          </p>
          <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>
            עבור לניהול טבלאות
          </Button>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.spend)}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">הכנסות</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.purchase_value)}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">רכישות / המרות</p>
                <p className="text-3xl font-bold mt-2">
                  {formatNumber(totalSummary.purchases + totalSummary.conversions)}
                </p>
              </CardContent>
            </Card>
            
            <Card className={`bg-gradient-to-br ${combinedRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">ROAS משולב</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-3xl font-bold">{combinedRoas.toFixed(2)}</p>
                  {combinedRoas > 1 ? (
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  ) : combinedRoas < 1 ? (
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  ) : (
                    <Minus className="h-6 w-6 text-gray-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט לפי פלטפורמה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">פלטפורמה</TableHead>
                      <TableHead className="text-right">הוצאה</TableHead>
                      <TableHead className="text-right">חשיפות</TableHead>
                      <TableHead className="text-right">קליקים</TableHead>
                      <TableHead className="text-right">רכישות/המרות</TableHead>
                      <TableHead className="text-right">הכנסות</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summaryByPlatform).map(([platform, metrics]: [string, any]) => {
                      const config = PLATFORM_CONFIG[platform] || { name: platform, color: 'text-gray-600' };
                      return (
                        <TableRow key={platform}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getIntegrationIcon(platform)}
                              <span className={config.color}>{config.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(metrics.spend)}</TableCell>
                          <TableCell>{formatNumber(metrics.impressions)}</TableCell>
                          <TableCell>{formatNumber(metrics.clicks)}</TableCell>
                          <TableCell>{formatNumber(metrics.purchases + metrics.conversions)}</TableCell>
                          <TableCell>{formatCurrency(metrics.purchase_value)}</TableCell>
                          <TableCell>
                            <span className={metrics.roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                              {metrics.roas.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>סה"כ</TableCell>
                      <TableCell>{formatCurrency(totalSummary.spend)}</TableCell>
                      <TableCell>{formatNumber(totalSummary.impressions)}</TableCell>
                      <TableCell>{formatNumber(totalSummary.clicks)}</TableCell>
                      <TableCell>{formatNumber(totalSummary.purchases + totalSummary.conversions)}</TableCell>
                      <TableCell>{formatCurrency(totalSummary.purchase_value)}</TableCell>
                      <TableCell>
                        <span className={combinedRoas >= 1 ? 'text-green-600' : 'text-red-600'}>
                          {combinedRoas.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>נתונים יומיים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">הוצאה</TableHead>
                      <TableHead className="text-right">חשיפות</TableHead>
                      <TableHead className="text-right">קליקים</TableHead>
                      <TableHead className="text-right">רכישות</TableHead>
                      <TableHead className="text-right">הכנסות</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsByDate.map(([date, records]) => {
                      const dayMetrics = records.reduce((acc: any, r: any) => ({
                        spend: acc.spend + (Number(r.data?.spend) || 0),
                        impressions: acc.impressions + (Number(r.data?.impressions) || 0),
                        clicks: acc.clicks + (Number(r.data?.clicks) || 0),
                        purchases: acc.purchases + (Number(r.data?.purchases) || 0),
                        purchase_value: acc.purchase_value + (Number(r.data?.purchase_value) || 0),
                      }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 });
                      
                      const dayRoas = dayMetrics.spend > 0 ? dayMetrics.purchase_value / dayMetrics.spend : 0;

                      return (
                        <TableRow key={date}>
                          <TableCell className="font-medium">
                            {new Date(date).toLocaleDateString('he-IL')}
                          </TableCell>
                          <TableCell>{formatCurrency(dayMetrics.spend)}</TableCell>
                          <TableCell>{formatNumber(dayMetrics.impressions)}</TableCell>
                          <TableCell>{formatNumber(dayMetrics.clicks)}</TableCell>
                          <TableCell>{formatNumber(dayMetrics.purchases)}</TableCell>
                          <TableCell>{formatCurrency(dayMetrics.purchase_value)}</TableCell>
                          <TableCell>
                            <span className={dayRoas >= 1 ? 'text-green-600' : 'text-red-600'}>
                              {dayRoas.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
