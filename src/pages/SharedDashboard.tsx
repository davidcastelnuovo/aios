import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getLeadsFromData = (data: any) =>
  Number(data?.leads) || Number(data?.conversions) || Number(data?.website_leads) ||
  Number(data?.offsite_conversion) || Number(data?.offsite_conversion_fb_pixel_lead) ||
  Number(data?.leadgen_grouped) || Number(data?.lead) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;
const isAdsPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(s);
const isAnalyticsPlatform = (s: string) => s === 'google_analytics';
const isFacebookPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce'].includes(s);

const matchesPlatformFilter = (integrationType: string, filter: PlatformFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'facebook') return isFacebookPlatform(integrationType);
  if (filter === 'google_ads') return integrationType === 'google_ads';
  if (filter === 'google_analytics') return isAnalyticsPlatform(integrationType);
  return true;
};

type CampaignType = 'leads' | 'ecommerce';
const getCampaignType = (type?: string, settings?: any): CampaignType => {
  if (type === 'facebook_insights') return 'leads';
  if (type === 'facebook_ecommerce') return 'ecommerce';
  if (type === 'google_ads') return settings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  return 'leads';
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(num);
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(num % 1 === 0 ? 0 : 2);
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
  const [dateFilter, setDateFilter] = useState('last_70_days');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-dashboard', shareToken, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ token: shareToken!, date_filter: dateFilter });
      const response = await supabase.functions.invoke(`public-dashboard?${params.toString()}`, { method: 'GET' });
      if (response.error) throw response.error;
      return response.data;
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
        // Only include report_type='daily' to avoid double-counting with daily_source
        if (data.report_type !== 'daily') return false;
      }
      return true;
    });
  }, [records, platformFilter]);

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

  const summaryByPlatform = useMemo(() => {
    const platforms: Record<string, any> = {};
    filteredRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!platforms[source]) {
        platforms[source] = { spend: 0, impressions: 0, clicks: 0, sessions: 0, results: 0, revenue: 0, addToCart: 0, roas: 0, cpl: 0 };
      }
      const d = record.data || {};
      if (isAnalyticsPlatform(source)) {
        platforms[source].sessions += getSessionsFromData(d);
        platforms[source].results += getPurchasesFromData(d);
        platforms[source].revenue += getRevenueFromData(d);
        platforms[source].addToCart += getAddToCartFromData(d);
      } else {
        platforms[source].spend += getSpendFromData(d);
        platforms[source].impressions += Number(d.impressions) || 0;
        platforms[source].clicks += Number(d.clicks) || 0;
        const ct = campaignTypeByPlatform[source] || 'leads';
        if (ct === 'ecommerce') {
          platforms[source].results += getPurchasesFromData(d);
          platforms[source].revenue += getRevenueFromData(d);
        } else {
          platforms[source].results += getLeadsFromData(d);
        }
      }
    });
    Object.keys(platforms).forEach(key => {
      if (isAnalyticsPlatform(key)) return;
      const ct = campaignTypeByPlatform[key] || 'leads';
      if (ct === 'ecommerce') {
        platforms[key].roas = platforms[key].spend > 0 ? platforms[key].revenue / platforms[key].spend : 0;
      } else {
        platforms[key].cpl = platforms[key].results > 0 ? platforms[key].spend / platforms[key].results : 0;
      }
    });
    return platforms;
  }, [filteredRecords, campaignTypeByPlatform]);

  const totalSummary = useMemo(() => {
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0;
    let adsSpend = 0, analyticsRevenue = 0, analyticsPurchases = 0;
    Object.entries(summaryByPlatform).forEach(([platform, d]: [string, any]) => {
      if (isAnalyticsPlatform(platform)) {
        analyticsRevenue += d.revenue;
        analyticsPurchases += d.results;
      } else if (isAdsPlatform(platform)) {
        totalSpend += d.spend;
        totalImpressions += d.impressions;
        totalClicks += d.clicks;
        totalResults += d.results;
        adsSpend += d.spend;
      }
    });
    return { spend: totalSpend, impressions: totalImpressions, clicks: totalClicks, results: totalResults,
      revenue: analyticsRevenue, roas_spend: adsSpend, roas_value: analyticsRevenue, analyticsPurchases };
  }, [summaryByPlatform]);

  const combinedRoas = totalSummary.roas_spend > 0 ? totalSummary.roas_value / totalSummary.roas_spend : 0;
  const combinedCpl = totalSummary.results > 0 ? totalSummary.spend / totalSummary.results : 0;

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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {showAdsCards && (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.spend)}</p>
            </CardContent>
          </Card>
        )}

        {dashboardCampaignType === 'ecommerce' ? (
          <>
            {showAnalyticsCards && (
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">הכנסות (Analytics)</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.revenue)}</p>
                </CardContent>
              </Card>
            )}
            {showAnalyticsCards && (
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">רכישות (Analytics)</p>
                  <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.analyticsPurchases || totalSummary.results)}</p>
                </CardContent>
              </Card>
            )}
            {platformFilter === 'all' && (
              <Card className={`bg-gradient-to-br ${combinedRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
                <CardContent className="p-6">
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
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">לידים</p>
                  <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.results)}</p>
                </CardContent>
              </Card>
            )}
            {showAdsCards && (
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">קליקים</p>
                  <p className="text-3xl font-bold mt-2">{formatNumber(totalSummary.clicks)}</p>
                </CardContent>
              </Card>
            )}
            {showAdsCards && (
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(combinedCpl)}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Platform Breakdown */}
      {Object.keys(summaryByPlatform).length > 0 && (
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
                    <TableHead className="text-right">חשיפות / סשנים</TableHead>
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
                        <TableCell>{formatNumber(isAnalytics ? metrics.sessions : metrics.impressions)}</TableCell>
                        <TableCell>{isAnalytics ? '-' : formatNumber(metrics.clicks)}</TableCell>
                        {dashboardCampaignType === 'ecommerce' ? (
                          <>
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
                    <TableCell>סה"כ</TableCell>
                    <TableCell>{formatCurrency(totalSummary.spend)}</TableCell>
                    <TableCell>{formatNumber(totalSummary.impressions)}</TableCell>
                    <TableCell>{formatNumber(totalSummary.clicks)}</TableCell>
                    {dashboardCampaignType === 'ecommerce' ? (
                      <>
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

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Powered by {data?.dashboard?.agency_name || 'Marketing Captain'}
      </p>
    </div>
  );
}
