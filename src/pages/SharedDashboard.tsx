import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Facebook, FileSpreadsheet, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { GoogleAnalyticsDashboard } from "@/components/dynamic-tables/GoogleAnalyticsDashboard";
import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const DATE_FILTERS = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'last_70_days', label: '70 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
];

const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600' },
  google_ads: { name: 'Google Ads', color: 'text-red-500' },
  google_analytics: { name: 'Analytics', color: 'text-orange-500' },
};

type PlatformFilter = 'all' | 'facebook' | 'google_ads' | 'google_analytics';
type CampaignType = 'leads' | 'ecommerce';

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getLeadsFromData = (data: any) =>
  Number(data?.leads) || Number(data?.conversions) || Number(data?.website_leads) ||
  Number(data?.offsite_conversion) || Number(data?.offsite_conversion_fb_pixel_lead) ||
  Number(data?.leadgen_grouped) || Number(data?.lead) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getUsersFromData = (data: any) => Number(data?.users) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;
const isAdsPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(s);
const isAnalyticsPlatform = (s: string) => s === 'google_analytics';
const isFacebookPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce'].includes(s);
const normalizePlatformKey = (s: string) => isFacebookPlatform(s) ? 'facebook_insights' : s;

const matchesPlatformFilter = (integrationType: string, filter: PlatformFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'facebook') return isFacebookPlatform(integrationType);
  if (filter === 'google_ads') return integrationType === 'google_ads';
  if (filter === 'google_analytics') return isAnalyticsPlatform(integrationType);
  return true;
};

const getCampaignType = (type?: string, settings?: any): CampaignType => {
  if (type === 'facebook_ecommerce') return 'ecommerce';
  if (type === 'google_ads') return settings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  return 'leads';
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(num);
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(num % 1 === 0 ? 0 : 1);
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

export default function SharedDashboard() {
  const { shareToken } = useParams();
  const [dateFilter, setDateFilter] = useState('last_7_days');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-dashboard', shareToken, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ token: shareToken!, date_filter: dateFilter });
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-dashboard`;
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!shareToken,
    retry: false,
  });

  const tables = data?.tables || [];
  const records = data?.records || [];

  // Available platforms
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t: any) => { if (t?.integration_type) set.add(t.integration_type); });
    const platforms: PlatformFilter[] = [];
    if (set.has('facebook_insights') || set.has('facebook_ecommerce')) platforms.push('facebook');
    if (set.has('google_ads')) platforms.push('google_ads');
    if (set.has('google_analytics')) platforms.push('google_analytics');
    return platforms;
  }, [tables]);

  // Filter records: platform filter + only use 'daily' aggregate records for Analytics
  const filteredRecords = useMemo(() => {
    return records.filter((record: any) => {
      const source = record._source || 'unknown';
      if (!matchesPlatformFilter(source, platformFilter)) return false;
      if (isAnalyticsPlatform(source)) {
        const data = record.data || {};
        if (data.report_type !== 'daily') return false;
      }
      return true;
    });
  }, [records, platformFilter]);

  // All analytics records (unfiltered by report_type) for GoogleAnalyticsDashboard
  const allAnalyticsRecords = useMemo(() => {
    return records
      .filter((r: any) => isAnalyticsPlatform(r._source || ''))
      .map((r: any) => ({ id: r.id, data: r.data }));
  }, [records]);

  const campaignTypeByPlatform: Record<string, CampaignType> = useMemo(() => {
    const map: Record<string, CampaignType> = {};
    tables.forEach((t: any) => {
      const key = t?.integration_type || 'unknown';
      const ct = getCampaignType(t?.integration_type, t?.integration_settings);
      if (ct === 'ecommerce') map[key] = 'ecommerce';
    });
    // Scan data for ecommerce signals
    records.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (map[source] === 'ecommerce') return;
      const d = record.data || {};
      if (Number(d.purchases) > 0 || Number(d.purchase_value) > 0 || Number(d.add_to_cart) > 0 ||
          String(d.campaign_type || '').toLowerCase() === 'ecommerce') {
        map[source] = 'ecommerce';
      }
    });
    tables.forEach((t: any) => {
      const key = t?.integration_type || 'unknown';
      if (!map[key]) map[key] = 'leads';
    });
    return map;
  }, [tables, records]);

  const dashboardCampaignType: CampaignType = useMemo(() => {
    const types = Object.values(campaignTypeByPlatform);
    return types.some((t) => t === 'ecommerce') ? 'ecommerce' : 'leads';
  }, [campaignTypeByPlatform]);

  const summaryByPlatform = useMemo(() => {
    const platforms: Record<string, any> = {};
    filteredRecords.forEach((record: any) => {
      const rawSource = record._source || 'unknown';
      const source = normalizePlatformKey(rawSource);
      if (!platforms[source]) {
        platforms[source] = { spend: 0, impressions: 0, clicks: 0, sessions: 0, users: 0, results: 0, leads: 0, revenue: 0, addToCart: 0, roas: 0, cpl: 0 };
      }
      const d = record.data || {};
      if (isAnalyticsPlatform(source)) {
        platforms[source].sessions += getSessionsFromData(d);
        platforms[source].users += getUsersFromData(d);
        platforms[source].results += getPurchasesFromData(d);
        platforms[source].revenue += getRevenueFromData(d);
        platforms[source].addToCart += getAddToCartFromData(d);
      } else {
        platforms[source].spend += getSpendFromData(d);
        platforms[source].impressions += Number(d.impressions) || 0;
        platforms[source].clicks += Number(d.clicks) || 0;
        const ct = campaignTypeByPlatform[rawSource] || campaignTypeByPlatform[source] || 'leads';
        if (ct === 'ecommerce') {
          platforms[source].results += getPurchasesFromData(d);
          platforms[source].revenue += getRevenueFromData(d);
          const explicitLeads = Number(d.leads) || Number(d.website_leads) || Number(d.leadgen_grouped) || Number(d.lead) || 0;
          platforms[source].leads += explicitLeads;
        } else {
          const leads = getLeadsFromData(d);
          platforms[source].leads += leads;
          platforms[source].results += leads;
        }
      }
    });
    Object.keys(platforms).forEach(key => {
      if (isAnalyticsPlatform(key)) return;
      // For merged Facebook platform, check if any Facebook type was ecommerce
      const ct = isFacebookPlatform(key) 
        ? (campaignTypeByPlatform['facebook_insights'] === 'ecommerce' || campaignTypeByPlatform['facebook_ecommerce'] === 'ecommerce' ? 'ecommerce' : 'leads')
        : (campaignTypeByPlatform[key] || 'leads');
      if (ct === 'ecommerce') {
        platforms[key].roas = platforms[key].spend > 0 ? platforms[key].revenue / platforms[key].spend : 0;
      } else {
        platforms[key].cpl = platforms[key].results > 0 ? platforms[key].spend / platforms[key].results : 0;
      }
    });
    return platforms;
  }, [filteredRecords, campaignTypeByPlatform]);

  // Global ads metrics (regardless of platform filter) for Analytics tab ROAS
  const globalAdsMetrics = useMemo(() => {
    let spend = 0, impressions = 0;
    records.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (isAdsPlatform(source)) {
        const data = record.data || {};
        if (data.report_type && data.report_type !== 'daily') return;
        spend += getSpendFromData(data);
        impressions += Number(data.impressions) || 0;
      }
    });
    return { spend, impressions };
  }, [records]);

  const totalSummary = useMemo(() => {
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0, totalLeads = 0;
    let adsSpend = 0, analyticsRevenue = 0, analyticsPurchases = 0, analyticsAddToCart = 0, analyticsSessions = 0, analyticsUsers = 0;
    Object.entries(summaryByPlatform).forEach(([platform, d]: [string, any]) => {
      if (isAnalyticsPlatform(platform)) {
        analyticsRevenue += d.revenue;
        analyticsPurchases += d.results;
        analyticsAddToCart += d.addToCart;
        analyticsSessions += d.sessions;
        analyticsUsers += d.users || 0;
      } else if (isAdsPlatform(platform)) {
        totalSpend += d.spend;
        totalImpressions += d.impressions;
        totalClicks += d.clicks;
        totalResults += d.results;
        totalLeads += d.leads || 0;
        adsSpend += d.spend;
      }
    });
    const effectiveSpend = totalSpend > 0 ? totalSpend : globalAdsMetrics.spend;
    const effectiveAdsSpend = adsSpend > 0 ? adsSpend : globalAdsMetrics.spend;
    const effectiveImpressions = totalImpressions > 0 ? totalImpressions : globalAdsMetrics.impressions;
    return {
      spend: effectiveSpend, impressions: effectiveImpressions, clicks: totalClicks, results: totalResults, leads: totalLeads,
      revenue: analyticsRevenue, roas_spend: effectiveAdsSpend, roas_value: analyticsRevenue,
      analyticsPurchases, analyticsAddToCart, analyticsSessions, analyticsUsers,
    };
  }, [summaryByPlatform, globalAdsMetrics]);

  const combinedRoas = totalSummary.roas_spend > 0 ? totalSummary.roas_value / totalSummary.roas_spend : 0;
  const combinedCpl = totalSummary.results > 0 ? totalSummary.spend / totalSummary.results : 0;

  // Analytics source breakdown
  const analyticsSourceBreakdown = useMemo(() => {
    const categorize = (sourceMedium: string): string => {
      const sm = sourceMedium.toLowerCase();
      if (sm.includes('facebook') || sm.includes('fb')) {
        if (sm.includes('paid') || sm.includes('cpc') || sm.includes('cpm')) return 'Facebook ממומן';
        return 'Facebook אורגני';
      }
      if (sm.includes('instagram') || sm.includes('ig')) {
        if (sm.includes('paid') || sm.includes('cpc') || sm.includes('cpm')) return 'Instagram ממומן';
        return 'Instagram אורגני';
      }
      if (sm.includes('google') || sm.includes('googleads')) {
        if (sm.includes('organic')) return 'Google אורגני';
        if (sm.includes('cpc') || sm.includes('paid') || sm.includes('ads')) return 'Google ממומן';
        return 'Google';
      }
      if (sm.includes('email') || sm.includes('newsletter') || sm.includes('mailchimp') || sm.includes('klaviyo') || sm.includes('activetrail')) return 'דיוור';
      if (sm.includes('whatsapp') || sm.includes('wa.me')) return 'WhatsApp';
      if (sm.includes('organic') || sm.includes('seo')) return 'אורגני';
      if (sm === '(direct) / (none)' || sm === 'direct' || sm.includes('(direct)') || sm.includes('(none)')) return 'ישיר (Direct)';
      if (sm.includes('referral')) return 'הפניות (Referral)';
      return 'אחר';
    };

    const sources: Record<string, { sessions: number; users: number; purchases: number; revenue: number; addToCart: number }> = {};
    records.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAnalyticsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type !== 'daily_source') return;
      const sm = data.source_medium || 'Unknown';
      const category = categorize(sm);
      if (!sources[category]) sources[category] = { sessions: 0, users: 0, purchases: 0, revenue: 0, addToCart: 0 };
      sources[category].sessions += Number(data.sessions) || 0;
      sources[category].users += Number(data.users) || 0;
      sources[category].purchases += getPurchasesFromData(data);
      sources[category].revenue += getRevenueFromData(data);
      sources[category].addToCart += getAddToCartFromData(data);
    });
    return Object.entries(sources)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [records]);

  // Traffic Acquisition by Channel Group
  const channelGroupBreakdown = useMemo(() => {
    const channels: Record<string, { sessions: number; engagedSessions: number; users: number; purchases: number; revenue: number; rateSum: number; durationSum: number; eventsSum: number; count: number }> = {};
    records.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAnalyticsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type !== 'channel_group') return;
      const ch = data.channel_group || 'Unknown';
      if (!channels[ch]) channels[ch] = { sessions: 0, engagedSessions: 0, users: 0, purchases: 0, revenue: 0, rateSum: 0, durationSum: 0, eventsSum: 0, count: 0 };
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
  }, [records]);

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

  // Facebook campaign summary
  const facebookCampaignSummary = useMemo(() => {
    if (platformFilter !== 'facebook') return [];
    const map: Record<string, { name: string; impressions: number; clicks: number; spend: number; addToCart: number; purchases: number; revenue: number }> = {};
    const fbRecords = records.filter((r: any) => isFacebookPlatform(r._source || ''));
    fbRecords.forEach((r: any) => {
      const d = r.data || {};
      const name = d.campaign_name || d.campaign || 'ללא שם';
      if (!map[name]) map[name] = { name, impressions: 0, clicks: 0, spend: 0, addToCart: 0, purchases: 0, revenue: 0 };
      map[name].impressions += Number(d.impressions) || 0;
      map[name].clicks += Number(d.clicks) || 0;
      map[name].spend += getSpendFromData(d);
      map[name].addToCart += getAddToCartFromData(d);
      map[name].purchases += getPurchasesFromData(d);
      map[name].revenue += getRevenueFromData(d);
    });
    return Object.values(map).sort((a, b) => b.spend - a.spend);
  }, [platformFilter, records]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (error || !data?.dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold mb-2">הקישור אינו תקין</h2>
            <p className="text-muted-foreground">קישור השיתוף אינו פעיל או שפג תוקפו.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dashboard = data.dashboard;
  const showAnalyticsCards = platformFilter === 'all' || platformFilter === 'google_analytics';
  const showAdsCards = platformFilter === 'all' || platformFilter === 'facebook' || platformFilter === 'google_ads';

  return (
    <div className="container mx-auto py-8 px-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">{dashboard.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <span>{dashboard.client_name}</span>
            {dashboard.agency_name && (
              <>
                <span>•</span>
                <span>{dashboard.agency_name}</span>
              </>
            )}
          </div>
        </div>
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

      {/* Platform Tabs */}
      {availablePlatforms.length > 0 && (
        <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">📊 הכל</TabsTrigger>
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

      {/* Analytics Tab → Full GoogleAnalyticsDashboard */}
      {platformFilter === 'google_analytics' ? (
        <GoogleAnalyticsDashboard
          records={allAnalyticsRecords}
          externalDateFilter={dateFilter}
        />
      ) : (
        <>
          {/* Summary Cards - "All" tab: 7 KPI cards like DashboardView */}
          {platformFilter === 'all' && (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 auto-rows-fr">
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
                  {showAdsCards && totalSummary.leads > 0 && (
                    <Card className="h-full bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
                      <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-muted-foreground">לידים</p>
                        <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.leads)}</p>
                      </CardContent>
                    </Card>
                  )}
                  {showAdsCards && totalSummary.leads > 0 && (
                    <Card className="h-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
                      <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                        <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.leads > 0 ? totalSummary.spend / totalSummary.leads : 0)}</p>
                      </CardContent>
                    </Card>
                  )}
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


          {/* Facebook Campaign Summary Table */}
          {platformFilter === 'facebook' && facebookCampaignSummary.length > 0 && (() => {
            const totals = facebookCampaignSummary.reduce((acc, c) => ({
              impressions: acc.impressions + c.impressions,
              clicks: acc.clicks + c.clicks,
              spend: acc.spend + c.spend,
              addToCart: acc.addToCart + c.addToCart,
              purchases: acc.purchases + c.purchases,
              revenue: acc.revenue + c.revenue,
            }), { impressions: 0, clicks: 0, spend: 0, addToCart: 0, purchases: 0, revenue: 0 });
            const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
            const isEcom = totals.purchases > 0 || totals.revenue > 0 || totals.addToCart > 0;

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Facebook className="h-5 w-5 text-blue-600" />
                    סיכום קמפיינים - Facebook
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
                          <TableHead className="text-right">הוצאה</TableHead>
                          {isEcom ? (
                            <>
                              <TableHead className="text-right">הוספות לעגלה</TableHead>
                              <TableHead className="text-right">רכישות</TableHead>
                              <TableHead className="text-right">ערך רכישות</TableHead>
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
                        {facebookCampaignSummary.map((c, i) => {
                          const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                          const leads = getLeadsFromData(records
                            .filter((r: any) => isFacebookPlatform(r._source || '') && (r.data?.campaign_name === c.name || r.data?.campaign === c.name))
                            .reduce((acc: any, r: any) => {
                              const d = r.data || {};
                              return {
                                leads: (acc.leads || 0) + (Number(d.leads) || 0),
                                conversions: (acc.conversions || 0) + (Number(d.conversions) || 0),
                                website_leads: (acc.website_leads || 0) + (Number(d.website_leads) || 0),
                                offsite_conversion: (acc.offsite_conversion || 0) + (Number(d.offsite_conversion) || 0),
                                offsite_conversion_fb_pixel_lead: (acc.offsite_conversion_fb_pixel_lead || 0) + (Number(d.offsite_conversion_fb_pixel_lead) || 0),
                                leadgen_grouped: (acc.leadgen_grouped || 0) + (Number(d.leadgen_grouped) || 0),
                                lead: (acc.lead || 0) + (Number(d.lead) || 0),
                              };
                            }, {}));
                          const cpl = leads > 0 ? c.spend / leads : 0;

                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium max-w-[300px]">{c.name}</TableCell>
                              <TableCell>{formatNumber(c.impressions)}</TableCell>
                              <TableCell>{formatNumber(c.clicks)}</TableCell>
                              <TableCell>{formatCurrency(c.spend)}</TableCell>
                              {isEcom ? (
                                <>
                                  <TableCell className={c.addToCart > 0 ? 'text-orange-600 font-medium' : ''}>{formatNumber(c.addToCart)}</TableCell>
                                  <TableCell className={c.purchases > 0 ? 'text-green-600 font-medium' : ''}>{formatNumber(c.purchases)}</TableCell>
                                  <TableCell className={c.revenue > 0 ? 'text-green-600 font-medium' : ''}>{formatCurrency(c.revenue)}</TableCell>
                                  <TableCell>
                                    <span className={roas >= 1 ? 'text-green-600 font-semibold' : roas > 0 ? 'text-red-600' : ''}>
                                      {roas > 0 ? roas.toFixed(2) + 'x' : '0x'}
                                    </span>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className={leads > 0 ? 'text-green-600 font-medium' : ''}>{formatNumber(leads)}</TableCell>
                                  <TableCell>{cpl > 0 ? formatCurrency(cpl) : '-'}</TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell>סה"כ</TableCell>
                          <TableCell>{formatNumber(totals.impressions)}</TableCell>
                          <TableCell>{formatNumber(totals.clicks)}</TableCell>
                          <TableCell>{formatCurrency(totals.spend)}</TableCell>
                          {isEcom ? (
                            <>
                              <TableCell className="text-orange-600">{formatNumber(totals.addToCart)}</TableCell>
                              <TableCell className="text-green-600">{formatNumber(totals.purchases)}</TableCell>
                              <TableCell className="text-green-600">{formatCurrency(totals.revenue)}</TableCell>
                              <TableCell>
                                <span className={totalRoas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                                  {totalRoas.toFixed(2)}x
                                </span>
                              </TableCell>
                            </>
                          ) : (() => {
                            const totalLeads = facebookCampaignSummary.reduce((sum, c) => {
                              return sum + getLeadsFromData(records
                                .filter((r: any) => isFacebookPlatform(r._source || '') && (r.data?.campaign_name === c.name || r.data?.campaign === c.name))
                                .reduce((acc: any, r: any) => {
                                  const d = r.data || {};
                                  return { leads: (acc.leads || 0) + (Number(d.leads) || 0), conversions: (acc.conversions || 0) + (Number(d.conversions) || 0), website_leads: (acc.website_leads || 0) + (Number(d.website_leads) || 0), offsite_conversion: (acc.offsite_conversion || 0) + (Number(d.offsite_conversion) || 0), offsite_conversion_fb_pixel_lead: (acc.offsite_conversion_fb_pixel_lead || 0) + (Number(d.offsite_conversion_fb_pixel_lead) || 0), leadgen_grouped: (acc.leadgen_grouped || 0) + (Number(d.leadgen_grouped) || 0), lead: (acc.lead || 0) + (Number(d.lead) || 0) };
                                }, {}));
                            }, 0);
                            const totalCpl = totalLeads > 0 ? totals.spend / totalLeads : 0;
                            return (
                              <>
                                <TableCell className="text-green-600">{formatNumber(totalLeads)}</TableCell>
                                <TableCell>{totalCpl > 0 ? formatCurrency(totalCpl) : '-'}</TableCell>
                              </>
                            );
                          })()}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Platform Breakdown Table */}
          {Object.keys(summaryByPlatform).length > 0 && platformFilter === 'all' && (
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
          {analyticsSourceBreakdown.length > 0 && platformFilter === 'all' && (
            <Card>
              <CardHeader><CardTitle>פירוט לפי מקור הגעה (Analytics)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">מקור / מדיום</TableHead>
                        <TableHead className="text-right">סשנים</TableHead>
                        <TableHead className="text-right">משתמשים יחודיים</TableHead>
                        {dashboardCampaignType === 'ecommerce' && (
                          <>
                            <TableHead className="text-right">הוספה לעגלה</TableHead>
                            <TableHead className="text-right">רכישות</TableHead>
                            <TableHead className="text-right">הכנסות</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsSourceBreakdown.map((source) => (
                        <TableRow key={source.name}>
                          <TableCell className="font-medium">{source.name}</TableCell>
                          <TableCell>{formatNumber(source.sessions)}</TableCell>
                          <TableCell>{formatNumber(source.users)}</TableCell>
                          {dashboardCampaignType === 'ecommerce' && (
                            <>
                              <TableCell>{formatNumber(source.addToCart)}</TableCell>
                              <TableCell>{formatNumber(source.purchases)}</TableCell>
                              <TableCell>{formatCurrency(source.revenue)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Traffic Acquisition by Channel Group */}
          {channelGroupBreakdown.length > 0 && platformFilter === 'all' && (
            <Card>
              <CardHeader><CardTitle>טרפיק לפי ערוץ (Traffic Acquisition)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Channel Group</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Engaged Sessions</TableHead>
                        <TableHead className="text-right">Engagement Rate</TableHead>
                        <TableHead className="text-right">Avg. Engagement Time</TableHead>
                        <TableHead className="text-right">Events / Session</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                        {dashboardCampaignType === 'ecommerce' && (
                          <>
                            <TableHead className="text-right">רכישות</TableHead>
                            <TableHead className="text-right">הכנסות</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelGroupBreakdown.map((ch) => {
                        const mins = Math.floor(ch.avgDuration / 60);
                        const secs = Math.round(ch.avgDuration % 60);
                        return (
                          <TableRow key={ch.name}>
                            <TableCell className="font-medium">{ch.name}</TableCell>
                            <TableCell>{formatNumber(ch.sessions)}</TableCell>
                            <TableCell>{formatNumber(ch.engagedSessions)}</TableCell>
                            <TableCell>{Number(ch.engagementRate).toFixed(1)}%</TableCell>
                            <TableCell>{mins}:{secs.toString().padStart(2, '0')}</TableCell>
                            <TableCell>{Number(ch.eventsPerSession).toFixed(2)}</TableCell>
                            <TableCell>{formatNumber(ch.users)}</TableCell>
                            {dashboardCampaignType === 'ecommerce' && (
                              <>
                                <TableCell>{formatNumber(ch.purchases)}</TableCell>
                                <TableCell>{formatCurrency(ch.revenue)}</TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                      {(() => {
                        const totals = channelGroupBreakdown.reduce((acc, ch) => ({
                          sessions: acc.sessions + ch.sessions,
                          engagedSessions: acc.engagedSessions + ch.engagedSessions,
                          users: acc.users + ch.users,
                          purchases: acc.purchases + ch.purchases,
                          revenue: acc.revenue + ch.revenue,
                        }), { sessions: 0, engagedSessions: 0, users: 0, purchases: 0, revenue: 0 });
                        const totalRate = totals.sessions > 0 ? (totals.engagedSessions / totals.sessions * 100) : 0;
                        return (
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell>סה"כ</TableCell>
                            <TableCell>{formatNumber(totals.sessions)}</TableCell>
                            <TableCell>{formatNumber(totals.engagedSessions)}</TableCell>
                            <TableCell>{totalRate.toFixed(1)}%</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{formatNumber(totals.users)}</TableCell>
                            {dashboardCampaignType === 'ecommerce' && (
                              <>
                                <TableCell>{formatNumber(totals.purchases)}</TableCell>
                                <TableCell>{formatCurrency(totals.revenue)}</TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          {dailyChartData.length > 1 && platformFilter === 'all' && (
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
              {dashboardCampaignType === 'ecommerce' && (
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

              {/* Spend chart for leads */}
              {dashboardCampaignType === 'leads' && showAdsCards && (
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

              {/* Leads chart */}
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
        </>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Powered by {data?.dashboard?.agency_name || 'Marketing Captain'}
      </p>
    </div>
  );
}
