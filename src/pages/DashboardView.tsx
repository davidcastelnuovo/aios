import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Facebook, ShoppingCart, FileSpreadsheet, TrendingUp, TrendingDown, Minus, RefreshCw, Building2 } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";
import { AgencyDashboardContent } from "@/components/dynamic-tables/AgencyDashboardContent";
import { ShareDashboardDialog } from "@/components/dynamic-tables/ShareDashboardDialog";
import { useTenant } from "@/contexts/TenantContext";
import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

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

type CampaignType = 'leads' | 'ecommerce';
type PlatformFilter = 'all' | 'facebook' | 'google_ads' | 'google_analytics';

const getCampaignType = (integrationType?: string | null, integrationSettings?: any): CampaignType => {
  if (integrationType === 'facebook_insights') return 'leads';
  if (integrationType === 'facebook_ecommerce') return 'ecommerce';
  if (integrationType === 'google_ads') {
    return integrationSettings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  }
  return 'leads';
};

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;

const getLeadsFromData = (data: any) =>
  Number(data?.leads) ||
  Number(data?.conversions) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  Number(data?.leadgen_grouped) ||
  Number(data?.lead) ||
  0;

const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getUsersFromData = (data: any) => Number(data?.users) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;

const isAdsPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(source);
const isAnalyticsPlatform = (source: string) => source === 'google_analytics';
const isFacebookPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce'].includes(source);

const matchesPlatformFilter = (integrationType: string, filter: PlatformFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'facebook') return isFacebookPlatform(integrationType);
  if (filter === 'google_ads') return integrationType === 'google_ads';
  if (filter === 'google_analytics') return isAnalyticsPlatform(integrationType);
  return true;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(num % 1 === 0 ? 0 : 2);
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(num);

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
    case 'google_analytics':
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
          <path d="M20.5 18.5v-13c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#F9AB00"/>
          <path d="M13.5 18.5v-7c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#E37400"/>
          <circle cx="5" cy="18.5" r="2.5" fill="#E37400"/>
        </svg>
      );
    default:
      return <FileSpreadsheet className="h-5 w-5" />;
  }
};

export default function DashboardView() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { currentTenantId } = useTenant();
  const [dateFilter, setDateFilter] = useState('last_30_days');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

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

  const isAgencyDashboard = (dashboard as any)?.dashboard_type === 'agency';

  // Fetch tables for the client
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-for-dashboard', dashboard?.client_id],
    queryFn: async () => {
      if (!dashboard?.client_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', { method: 'GET' });
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

      const recordsPromises = tables.map(async (table: any) => {
        const params = new URLSearchParams({ table_id: table.id, date_filter: dateFilter });
        const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, { method: 'GET' });
        if (response.error) {
          console.error('Error fetching records for table', table.id, response.error);
          return [];
        }
        const records = Array.isArray(response.data) ? response.data : [];
        return records.map((r: any) => ({
          ...r,
          _source: table.integration_type,
          _tableName: table.name,
          _integrationType: table.integration_type,
          _campaignType: getCampaignType(table.integration_type, table.integration_settings),
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0,
  });

  // Available platforms for tab rendering
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t: any) => {
      if (t.integration_type) set.add(t.integration_type);
    });
    const platforms: PlatformFilter[] = [];
    if (set.has('facebook_insights') || set.has('facebook_ecommerce')) platforms.push('facebook');
    if (set.has('google_ads')) platforms.push('google_ads');
    if (set.has('google_analytics')) platforms.push('google_analytics');
    return platforms;
  }, [tables]);

  // Filter records by platform tab AND only use daily aggregate records for Analytics
  // IMPORTANT: Use only report_type='daily' for aggregation (KPI, charts).
  // report_type='daily_source' breaks down by traffic source and would cause double-counting.
  const filteredRecords = useMemo(() => {
    return allRecords.filter((record: any) => {
      const source = record._source || 'unknown';
      // Platform filter
      if (!matchesPlatformFilter(source, platformFilter)) return false;
      // For Analytics: only use 'daily' records for accurate totals
      if (isAnalyticsPlatform(source)) {
        const data = record.data || {};
        // Only include report_type='daily' (aggregate per day)
        // Exclude: traffic_source (no date), daily_source (per-source breakdown = double counting), top_pages
        if (data.report_type !== 'daily') return false;
      }
      return true;
    });
  }, [allRecords, platformFilter]);

  // Determine campaign type per platform
  const campaignTypeByPlatform: Record<string, CampaignType> = useMemo(() => {
    const map: Record<string, CampaignType> = {};
    tables.forEach((t: any) => {
      const key = t?.integration_type || 'unknown';
      const ct = getCampaignType(t?.integration_type, t?.integration_settings);
      map[key] = map[key] === 'ecommerce' || ct === 'ecommerce' ? 'ecommerce' : 'leads';
    });
    return map;
  }, [tables]);

  const dashboardCampaignType: CampaignType = useMemo(() => {
    const types = Object.values(campaignTypeByPlatform);
    return types.some((t) => t === 'ecommerce') ? 'ecommerce' : 'leads';
  }, [campaignTypeByPlatform]);

  // Calculate summary metrics by platform (using filtered records)
  const summaryByPlatform = useMemo(() => {
    const platforms: Record<string, any> = {};
    
    filteredRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!platforms[source]) {
        platforms[source] = { spend: 0, impressions: 0, clicks: 0, sessions: 0, users: 0, results: 0, revenue: 0, addToCart: 0, roas: 0, cpl: 0, recordCount: 0 };
      }
      
      const data = record.data || {};
      const campaignType: CampaignType = campaignTypeByPlatform[source] || record._campaignType || 'leads';

      if (isAnalyticsPlatform(source)) {
        platforms[source].sessions += getSessionsFromData(data);
        platforms[source].users += getUsersFromData(data);
        platforms[source].results += getPurchasesFromData(data);
        platforms[source].revenue += getRevenueFromData(data);
        platforms[source].addToCart += getAddToCartFromData(data);
      } else {
        platforms[source].spend += getSpendFromData(data);
        platforms[source].impressions += Number(data.impressions) || 0;
        platforms[source].clicks += Number(data.clicks) || 0;
        if (campaignType === 'ecommerce') {
          platforms[source].results += getPurchasesFromData(data);
          platforms[source].revenue += getRevenueFromData(data);
        } else {
          platforms[source].results += getLeadsFromData(data);
        }
      }
      platforms[source].recordCount += 1;
    });

    Object.keys(platforms).forEach(key => {
      if (isAnalyticsPlatform(key)) return;
      const ct: CampaignType = campaignTypeByPlatform[key] || 'leads';
      if (ct === 'ecommerce') {
        platforms[key].roas = platforms[key].spend > 0 ? platforms[key].revenue / platforms[key].spend : 0;
      } else {
        platforms[key].cpl = platforms[key].results > 0 ? platforms[key].spend / platforms[key].results : 0;
      }
    });

    return platforms;
  }, [filteredRecords, campaignTypeByPlatform]);

  // Calculate total ads spend from ALL records (regardless of platform filter)
  // This ensures Analytics tab can still show spend and ROAS
  const globalAdsMetrics = useMemo(() => {
    let spend = 0, impressions = 0;
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (isAdsPlatform(source)) {
        const data = record.data || {};
        if (data.report_type && data.report_type !== 'daily') return;
        spend += getSpendFromData(data);
        impressions += Number(data.impressions) || 0;
      }
    });
    return { spend, impressions };
  }, [allRecords]);

  // Total summary
  const totalSummary = useMemo(() => {
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0;
    let adsSpend = 0, analyticsRevenue = 0, analyticsPurchases = 0, analyticsAddToCart = 0, analyticsSessions = 0, analyticsUsers = 0;

    Object.entries(summaryByPlatform).forEach(([platform, data]: [string, any]) => {
      if (isAnalyticsPlatform(platform)) {
        analyticsRevenue += data.revenue;
        analyticsPurchases += data.results;
        analyticsAddToCart += data.addToCart;
        analyticsSessions += data.sessions;
        analyticsUsers += data.users || 0;
      } else if (isAdsPlatform(platform)) {
        totalSpend += data.spend;
        totalImpressions += data.impressions;
        totalClicks += data.clicks;
        totalResults += data.results;
        adsSpend += data.spend;
      }
    });

    // When on Analytics tab, ads platforms are filtered out, so use globalAdsMetrics
    const effectiveSpend = totalSpend > 0 ? totalSpend : globalAdsMetrics.spend;
    const effectiveAdsSpend = adsSpend > 0 ? adsSpend : globalAdsMetrics.spend;
    const effectiveImpressions = totalImpressions > 0 ? totalImpressions : globalAdsMetrics.impressions;

    return {
      spend: effectiveSpend, impressions: effectiveImpressions, clicks: totalClicks, results: totalResults,
      revenue: analyticsRevenue, roas_spend: effectiveAdsSpend, roas_value: analyticsRevenue,
      analyticsPurchases, analyticsAddToCart, analyticsSessions, analyticsUsers,
    };
  }, [summaryByPlatform, globalAdsMetrics]);

  const combinedRoas = totalSummary.roas_spend > 0 ? totalSummary.roas_value / totalSummary.roas_spend : 0;
  const combinedCpl = totalSummary.results > 0 ? totalSummary.spend / totalSummary.results : 0;

  // Analytics source breakdown from daily_source records
  const analyticsSourceBreakdown = useMemo(() => {
    const sources: Record<string, { sessions: number; users: number; purchases: number; revenue: number; addToCart: number }> = {};
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAnalyticsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type !== 'daily_source') return;
      
      const sm = data.source_medium || 'Unknown';
      if (!sources[sm]) sources[sm] = { sessions: 0, users: 0, purchases: 0, revenue: 0, addToCart: 0 };
      sources[sm].sessions += Number(data.sessions) || 0;
      sources[sm].users += Number(data.users) || 0;
      sources[sm].purchases += getPurchasesFromData(data);
      sources[sm].revenue += getRevenueFromData(data);
      sources[sm].addToCart += getAddToCartFromData(data);
    });
    return Object.entries(sources)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [allRecords]);

  // Traffic Acquisition by Channel Group
  const channelGroupBreakdown = useMemo(() => {
    const channels: Record<string, { sessions: number; engagedSessions: number; engagementRate: number; avgDuration: number; eventsPerSession: number; users: number; purchases: number; revenue: number; rateSum: number; durationSum: number; eventsSum: number; count: number }> = {};
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAnalyticsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type !== 'channel_group') return;
      
      const ch = data.channel_group || 'Unknown';
      if (!channels[ch]) channels[ch] = { sessions: 0, engagedSessions: 0, engagementRate: 0, avgDuration: 0, eventsPerSession: 0, users: 0, purchases: 0, revenue: 0, rateSum: 0, durationSum: 0, eventsSum: 0, count: 0 };
      channels[ch].sessions += Number(data.sessions) || 0;
      channels[ch].engagedSessions += Number(data.engaged_sessions) || 0;
      channels[ch].users += Number(data.users) || 0;
      channels[ch].purchases += getPurchasesFromData(data);
      channels[ch].revenue += getRevenueFromData(data);
      channels[ch].rateSum += Number(data.engagement_rate) || 0;
      channels[ch].durationSum += Number(data.avg_session_duration) || 0;
      channels[ch].eventsSum += Number(data.events_per_session) || 0;
      channels[ch].count += 1;
    });
    return Object.entries(channels)
      .map(([name, d]) => ({
        name,
        sessions: d.sessions,
        engagedSessions: d.engagedSessions,
        engagementRate: d.count > 0 ? d.rateSum / d.count : 0,
        avgDuration: d.count > 0 ? d.durationSum / d.count : 0,
        eventsPerSession: d.count > 0 ? d.eventsSum / d.count : 0,
        users: d.users,
        purchases: d.purchases,
        revenue: d.revenue,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [allRecords]);

  // Daily chart data
  const dailyChartData = useMemo(() => {
    const byDate: Record<string, any> = {};

    filteredRecords.forEach((record: any) => {
      const date = record.data?.date;
      if (!date) return;
      const source = record._source || 'unknown';
      const data = record.data || {};

      if (!byDate[date]) {
        byDate[date] = { date, spend: 0, revenue: 0, purchases: 0, addToCart: 0, sessions: 0, clicks: 0, impressions: 0, leads: 0 };
      }

      if (isAnalyticsPlatform(source)) {
        byDate[date].revenue += getRevenueFromData(data);
        byDate[date].purchases += getPurchasesFromData(data);
        byDate[date].addToCart += getAddToCartFromData(data);
        byDate[date].sessions += getSessionsFromData(data);
      } else if (isAdsPlatform(source)) {
        byDate[date].spend += getSpendFromData(data);
        byDate[date].clicks += Number(data.clicks) || 0;
        byDate[date].impressions += Number(data.impressions) || 0;
        byDate[date].leads += getLeadsFromData(data);
      }
    });

    return Object.values(byDate)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d: any) => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        roas: d.spend > 0 ? d.revenue / d.spend : 0,
      }));
  }, [filteredRecords]);

  // Campaign breakdown for platform-specific tabs (Facebook, Google Ads)
  const campaignBreakdown = useMemo(() => {
    if (platformFilter === 'all' || platformFilter === 'google_analytics') return [];
    
    const campaigns: Record<string, { campaign: string; spend: number; impressions: number; clicks: number; leads: number; revenue: number; purchases: number }> = {};
    
    filteredRecords.forEach((record: any) => {
      const data = record.data || {};
      const campaignName = data.campaign_name || data.campaign || 'ללא שם קמפיין';
      
      if (!campaigns[campaignName]) {
        campaigns[campaignName] = { campaign: campaignName, spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, purchases: 0 };
      }
      
      campaigns[campaignName].spend += getSpendFromData(data);
      campaigns[campaignName].impressions += Number(data.impressions) || 0;
      campaigns[campaignName].clicks += Number(data.clicks) || Number(data.link_clicks) || 0;
      campaigns[campaignName].leads += getLeadsFromData(data);
      campaigns[campaignName].revenue += getRevenueFromData(data);
      campaigns[campaignName].purchases += getPurchasesFromData(data);
    });
    
    return Object.values(campaigns).sort((a, b) => b.spend - a.spend);
  }, [filteredRecords, platformFilter]);

  const campaignTotals = useMemo(() => {
    return campaignBreakdown.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      leads: acc.leads + c.leads,
      revenue: acc.revenue + c.revenue,
      purchases: acc.purchases + c.purchases,
    }), { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, purchases: 0 });
  }, [campaignBreakdown]);

  // Group records by date for table
  const recordsByDate = useMemo(() => {
    const byDate: Record<string, any[]> = {};
    filteredRecords.forEach((record: any) => {
      const date = record.data?.date || 'unknown';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(record);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 30);
  }, [filteredRecords]);

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

  const showAnalyticsCards = platformFilter === 'all' || platformFilter === 'google_analytics';
  const showAdsCards = platformFilter === 'all' || platformFilter === 'facebook' || platformFilter === 'google_ads';

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath('/dynamic-tables'))} className="mb-2">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{dashboard.name}</h1>
            {isAgencyDashboard && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                דשבורד סוכנות
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            {isAgencyDashboard ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>{(dashboard as any).agencies?.name}</span>
              </>
            ) : (
              <>
                <span>{(dashboard as any).clients?.name}</span>
                {(dashboard as any).agencies?.name && (
                  <>
                    <span>•</span>
                    <span>{(dashboard as any).agencies?.name}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isAgencyDashboard && currentTenantId && (
            <ShareDashboardDialog dashboardId={dashboardId!} dashboardName={dashboard.name} tenantId={currentTenantId} />
          )}
          {!isAgencyDashboard && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`ml-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              רענן נתונים
            </Button>
          )}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Agency Dashboard Content */}
      {isAgencyDashboard ? (
        <AgencyDashboardContent
          agencyId={dashboard.agency_id!}
          agencyName={(dashboard as any).agencies?.name || ''}
          dateFilter={dateFilter}
        />
      ) : (
        <>
          {/* Platform Tabs */}
          {availablePlatforms.length > 0 && (
            <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  📊 הכל
                </TabsTrigger>
                {availablePlatforms.includes('facebook') && (
                  <TabsTrigger value="facebook" className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    Facebook
                  </TabsTrigger>
                )}
                {availablePlatforms.includes('google_ads') && (
                  <TabsTrigger value="google_ads" className="flex items-center gap-2">
                    {getIntegrationIcon('google_ads')}
                    Google Ads
                  </TabsTrigger>
                )}
                {availablePlatforms.includes('google_analytics') && (
                  <TabsTrigger value="google_analytics" className="flex items-center gap-2">
                    {getIntegrationIcon('google_analytics')}
                    Analytics
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          )}

          {tablesLoading || recordsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : tables.length === 0 ? (
            <Card className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">אין טבלאות משויכות ללקוח זה</h3>
              <p className="text-muted-foreground mb-4">צור טבלאות ושייך אותן ללקוח כדי לראות נתונים בדשבורד</p>
              <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>עבור לניהול טבלאות</Button>
            </Card>
          ) : (
            <>
              {/* Summary Cards - only show in All and Analytics tabs */}
              {(platformFilter === 'all' || platformFilter === 'google_analytics') && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 auto-rows-fr">
                {(showAdsCards || showAnalyticsCards) && (
                  <Card className="h-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                      <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
                      <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.spend)}</p>
                    </CardContent>
                  </Card>
                )}
                
                {dashboardCampaignType === 'ecommerce' ? (
                  <>
                    {showAnalyticsCards && (
                      <Card className="h-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">הכנסות (Analytics)</p>
                          <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.revenue)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {showAnalyticsCards && (
                      <Card className="h-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">רכישות (Analytics)</p>
                          <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.analyticsPurchases || totalSummary.results)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {showAnalyticsCards && (
                      <Card className="h-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">הוספה לעגלה (ATC)</p>
                          <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.analyticsAddToCart)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {(platformFilter === 'all' || platformFilter === 'google_analytics') && (
                      <Card className={`h-full bg-gradient-to-br ${combinedRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">ROAS משולב</p>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-3xl font-bold">{combinedRoas.toFixed(2)}</p>
                            {combinedRoas > 1 ? <TrendingUp className="h-6 w-6 text-green-600" /> :
                              combinedRoas < 1 ? <TrendingDown className="h-6 w-6 text-red-600" /> :
                              <Minus className="h-6 w-6 text-muted-foreground" />}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    {showAdsCards && (
                      <Card className="h-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">לידים</p>
                          <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.results)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {showAdsCards && (
                      <Card className="h-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">קליקים</p>
                          <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.clicks)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {showAdsCards && (
                      <Card className="h-full bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                          <p className="text-3xl font-bold mt-2">{formatCurrency(combinedCpl)}</p>
                        </CardContent>
                      </Card>
                    )}

                    {showAnalyticsCards && (
                      <Card className="h-full bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                          <p className="text-sm text-muted-foreground">סשנים (Analytics)</p>
                          <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.analyticsSessions)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
              )}

              {/* Campaign Breakdown - show on platform-specific tabs (Facebook, Google Ads) */}
              {(platformFilter === 'facebook' || platformFilter === 'google_ads') && campaignBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {platformFilter === 'facebook' ? 'קמפיינים - Facebook' : 'קמפיינים - Google Ads'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">קמפיין</TableHead>
                            <TableHead className="text-right">חשיפות</TableHead>
                            <TableHead className="text-right">קליקים</TableHead>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableHead className="text-right">רכישות</TableHead>
                                <TableHead className="text-right">הכנסות</TableHead>
                              </>
                            ) : (
                              <TableHead className="text-right">לידים</TableHead>
                            )}
                            <TableHead className="text-right">הוצאה</TableHead>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <TableHead className="text-right">ROAS</TableHead>
                            ) : (
                              <TableHead className="text-right">עלות לליד</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaignBreakdown.map((c, i) => {
                            const cpl = c.leads > 0 ? c.spend / c.leads : 0;
                            const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium max-w-[300px] truncate">{c.campaign}</TableCell>
                                <TableCell>{formatNumber(c.impressions)}</TableCell>
                                <TableCell>{formatNumber(c.clicks)}</TableCell>
                                {dashboardCampaignType === 'ecommerce' ? (
                                  <>
                                    <TableCell>{formatNumber(c.purchases)}</TableCell>
                                    <TableCell>{formatCurrency(c.revenue)}</TableCell>
                                  </>
                                ) : (
                                  <TableCell className={c.leads > 0 ? 'text-green-600 font-semibold' : ''}>
                                    {formatNumber(c.leads)}
                                  </TableCell>
                                )}
                                <TableCell>{formatCurrency(c.spend)}</TableCell>
                                {dashboardCampaignType === 'ecommerce' ? (
                                  <TableCell>
                                    <span className={roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                                      {roas.toFixed(2)}
                                    </span>
                                  </TableCell>
                                ) : (
                                  <TableCell className={cpl > 0 ? 'text-green-600' : ''}>
                                    {cpl > 0 ? formatCurrency(cpl) : '₪0'}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                          {/* Totals row */}
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell>סה"כ</TableCell>
                            <TableCell>{formatNumber(campaignTotals.impressions)}</TableCell>
                            <TableCell>{formatNumber(campaignTotals.clicks)}</TableCell>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableCell>{formatNumber(campaignTotals.purchases)}</TableCell>
                                <TableCell>{formatCurrency(campaignTotals.revenue)}</TableCell>
                              </>
                            ) : (
                              <TableCell className="text-green-600">{formatNumber(campaignTotals.leads)}</TableCell>
                            )}
                            <TableCell>{formatCurrency(campaignTotals.spend)}</TableCell>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <TableCell>
                                <span className={(campaignTotals.spend > 0 ? campaignTotals.revenue / campaignTotals.spend : 0) >= 1 ? 'text-green-600' : 'text-red-600'}>
                                  {(campaignTotals.spend > 0 ? campaignTotals.revenue / campaignTotals.spend : 0).toFixed(2)}
                                </span>
                              </TableCell>
                            ) : (
                              <TableCell className="text-green-600">
                                {campaignTotals.leads > 0 ? formatCurrency(campaignTotals.spend / campaignTotals.leads) : '₪0'}
                              </TableCell>
                            )}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {Object.keys(summaryByPlatform).length > 0 && (platformFilter === 'all' || platformFilter === 'google_analytics') && (
                <Card>
                  <CardHeader><CardTitle>פירוט לפי פלטפורמה</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">פלטפורמה</TableHead>
                            <TableHead className="text-right">הוצאה</TableHead>
                            <TableHead className="text-right">חשיפות</TableHead>
                            <TableHead className="text-right">סשנים</TableHead>
                            <TableHead className="text-right">סשנים יחודיים</TableHead>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableHead className="text-right">הוספה לעגלה</TableHead>
                                <TableHead className="text-right">רכישות</TableHead>
                                <TableHead className="text-right">הכנסות</TableHead>
                                <TableHead className="text-right">ROAS</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead className="text-right">לידים</TableHead>
                                <TableHead className="text-right">עלות לליד</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(summaryByPlatform).map(([platform, metrics]: [string, any]) => {
                            const config = PLATFORM_CONFIG[platform] || { name: platform, color: 'text-muted-foreground' };
                            const isAnalytics = isAnalyticsPlatform(platform);
                            return (
                              <TableRow key={platform}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {getIntegrationIcon(platform)}
                                    <span className={config.color}>{config.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{isAnalytics ? '-' : formatCurrency(metrics.spend)}</TableCell>
                                <TableCell>{isAnalytics ? '-' : formatNumber(metrics.impressions)}</TableCell>
                                <TableCell>{isAnalytics ? formatNumber(metrics.sessions) : '-'}</TableCell>
                                <TableCell>{isAnalytics ? formatNumber(metrics.users) : '-'}</TableCell>
                                {dashboardCampaignType === 'ecommerce' ? (
                                  <>
                                    <TableCell>{formatNumber(metrics.addToCart)}</TableCell>
                                    <TableCell>{formatNumber(metrics.results)}</TableCell>
                                    <TableCell>{formatCurrency(metrics.revenue)}</TableCell>
                                    <TableCell>
                                      {isAnalytics ? '-' : (
                                        <span className={metrics.roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                                          {metrics.roas.toFixed(2)}
                                        </span>
                                      )}
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell>{formatNumber(metrics.results)}</TableCell>
                                    <TableCell>{isAnalytics ? '-' : formatCurrency(metrics.cpl)}</TableCell>
                                  </>
                                )}
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell>
                              סה"כ
                              {dashboardCampaignType === 'ecommerce' && summaryByPlatform['google_analytics'] && (
                                <span className="text-xs font-normal text-muted-foreground block">הכנסות מ-Analytics / הוצאות פרסום</span>
                              )}
                            </TableCell>
                            <TableCell>{formatCurrency(totalSummary.spend)}</TableCell>
                            <TableCell>{formatNumber(totalSummary.impressions)}</TableCell>
                            <TableCell>{formatNumber(totalSummary.analyticsSessions)}</TableCell>
                            <TableCell>{formatNumber(totalSummary.analyticsUsers)}</TableCell>
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableCell>{formatNumber(totalSummary.analyticsAddToCart)}</TableCell>
                                <TableCell>{formatNumber(totalSummary.analyticsPurchases || totalSummary.results)}</TableCell>
                                <TableCell>{formatCurrency(totalSummary.revenue)}</TableCell>
                                <TableCell>
                                  <span className={combinedRoas >= 1 ? 'text-green-600' : 'text-red-600'}>
                                    {combinedRoas.toFixed(2)}
                                  </span>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell>{formatNumber(totalSummary.results)}</TableCell>
                                <TableCell>{formatCurrency(combinedCpl)}</TableCell>
                              </>
                            )}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Analytics Source Breakdown */}
              {analyticsSourceBreakdown.length > 0 && (platformFilter === 'all' || platformFilter === 'google_analytics') && (
                <Card>
                  <CardHeader><CardTitle>פירוט לפי מקור הגעה (Analytics)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">מקור / מדיום</TableHead>
                            <TableHead className="text-right">הוצאה</TableHead>
                            <TableHead className="text-right">סשנים</TableHead>
                            <TableHead className="text-right">משתמשים יחודיים</TableHead>
                            {dashboardCampaignType === 'ecommerce' && (
                              <>
                                <TableHead className="text-right">הוספה לעגלה</TableHead>
                                <TableHead className="text-right">רכישות</TableHead>
                                <TableHead className="text-right">הכנסות</TableHead>
                                <TableHead className="text-right">ROAS</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analyticsSourceBreakdown.map((source) => {
                            const sourceRoas = totalSummary.spend > 0 ? source.revenue / totalSummary.spend : 0;
                            return (
                              <TableRow key={source.name}>
                                <TableCell className="font-medium">{source.name}</TableCell>
                                <TableCell>{formatCurrency(totalSummary.spend)}</TableCell>
                                <TableCell>{formatNumber(source.sessions)}</TableCell>
                                <TableCell>{formatNumber(source.users)}</TableCell>
                                {dashboardCampaignType === 'ecommerce' && (
                                  <>
                                    <TableCell>{formatNumber(source.addToCart)}</TableCell>
                                    <TableCell>{formatNumber(source.purchases)}</TableCell>
                                    <TableCell>{formatCurrency(source.revenue)}</TableCell>
                                    <TableCell>
                                      <span className={sourceRoas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                                        {sourceRoas.toFixed(2)}
                                      </span>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts - show on all tabs */}
              {dailyChartData.length > 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Revenue vs Spend */}
                  {dashboardCampaignType === 'ecommerce' && (showAdsCards || showAnalyticsCards) && (
                    <Card>
                      <CardHeader><CardTitle>הכנסות מול הוצאות</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Legend />
                            {showAnalyticsCards && <Area type="monotone" dataKey="revenue" name="הכנסות" fill="#22c55e" stroke="#16a34a" fillOpacity={0.3} />}
                            {showAdsCards && <Bar dataKey="spend" name="הוצאה" fill="#3b82f6" />}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Daily ROAS */}
                  {dashboardCampaignType === 'ecommerce' && platformFilter === 'all' && (
                    <Card>
                      <CardHeader><CardTitle>ROAS יומי</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(v: number) => v.toFixed(2)} />
                            <Line type="monotone" dataKey="roas" name="ROAS" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Purchases & ATC */}
                  {dashboardCampaignType === 'ecommerce' && showAnalyticsCards && (
                    <Card>
                      <CardHeader><CardTitle>רכישות והוספה לעגלה</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="purchases" name="רכישות" fill="#22c55e" />
                            <Bar dataKey="addToCart" name="הוספה לעגלה" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Sessions */}
                  {showAnalyticsCards && (
                    <Card>
                      <CardHeader><CardTitle>סשנים יומיים</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Line type="monotone" dataKey="sessions" name="סשנים" stroke="#f97316" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Spend chart for ads-only view */}
                  {!dashboardCampaignType.includes('ecommerce') && showAdsCards && (
                    <Card>
                      <CardHeader><CardTitle>הוצאה יומית</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Bar dataKey="spend" name="הוצאה" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Leads chart for leads campaigns */}
                  {dashboardCampaignType === 'leads' && showAdsCards && (
                    <Card>
                      <CardHeader><CardTitle>לידים יומיים</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Bar dataKey="leads" name="לידים" fill="#22c55e" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Daily Breakdown */}
              <Card>
                <CardHeader><CardTitle>נתונים יומיים</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">הוצאה</TableHead>
                          <TableHead className="text-right">חשיפות</TableHead>
                          <TableHead className="text-right">קליקים</TableHead>
                          {dashboardCampaignType === 'ecommerce' ? (
                            <>
                              <TableHead className="text-right">רכישות</TableHead>
                              <TableHead className="text-right">הכנסות</TableHead>
                              <TableHead className="text-right">ROAS</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-right">לידים</TableHead>
                              <TableHead className="text-right">עלות לליד</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recordsByDate.map(([date, records]) => {
                          const dayMetrics = records.reduce(
                            (acc: any, r: any) => {
                              const data = r.data || {};
                              const source = r._source || 'unknown';
                              if (isAnalyticsPlatform(source)) {
                                return {
                                  ...acc,
                                  analyticsRevenue: acc.analyticsRevenue + getRevenueFromData(data),
                                  analyticsPurchases: acc.analyticsPurchases + getPurchasesFromData(data),
                                };
                              }
                              const spend = getSpendFromData(data);
                              const impressions = Number(data.impressions) || 0;
                              const clicks = Number(data.clicks) || 0;
                              if (dashboardCampaignType === 'ecommerce') {
                                return { ...acc, spend: acc.spend + spend, impressions: acc.impressions + impressions, clicks: acc.clicks + clicks, results: acc.results + getPurchasesFromData(data) };
                              }
                              return { ...acc, spend: acc.spend + spend, impressions: acc.impressions + impressions, clicks: acc.clicks + clicks, results: acc.results + getLeadsFromData(data) };
                            },
                            { spend: 0, impressions: 0, clicks: 0, results: 0, analyticsRevenue: 0, analyticsPurchases: 0 }
                          );
                          const dayRoas = dayMetrics.spend > 0 ? dayMetrics.analyticsRevenue / dayMetrics.spend : 0;
                          const dayCpl = dayMetrics.results > 0 ? dayMetrics.spend / dayMetrics.results : 0;

                          return (
                            <TableRow key={date}>
                              <TableCell className="font-medium">{new Date(date).toLocaleDateString('he-IL')}</TableCell>
                              <TableCell>{formatCurrency(dayMetrics.spend)}</TableCell>
                              <TableCell>{formatNumber(dayMetrics.impressions)}</TableCell>
                              <TableCell>{formatNumber(dayMetrics.clicks)}</TableCell>
                              {dashboardCampaignType === 'ecommerce' ? (
                                <>
                                  <TableCell>{formatNumber(dayMetrics.analyticsPurchases || dayMetrics.results)}</TableCell>
                                  <TableCell>{formatCurrency(dayMetrics.analyticsRevenue)}</TableCell>
                                  <TableCell>
                                    <span className={dayRoas >= 1 ? 'text-green-600' : 'text-red-600'}>{dayRoas.toFixed(2)}</span>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell>{formatNumber(dayMetrics.results)}</TableCell>
                                  <TableCell>{formatCurrency(dayCpl)}</TableCell>
                                </>
                              )}
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
        </>
      )}
    </div>
  );
}
