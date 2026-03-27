import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Facebook, TrendingUp, TrendingDown, Minus } from "lucide-react";

const DATE_FILTERS = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'last_70_days', label: '70 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
];

// --- Helpers (same as SharedDashboard) ---
const getSpendFromData = (d: any) => Number(d?.spend) || Number(d?.cost) || 0;
const getRevenueFromData = (d: any) =>
  Number(d?.purchase_value) || Number(d?.purchaseRevenue) || Number(d?.conversions_value) || Number(d?.conversion_value) || 0;
const getPurchasesFromData = (d: any) => Number(d?.purchases) || Number(d?.ecommercePurchases) || Number(d?.transactions) || 0;
const getLeadsFromData = (d: any) =>
  Number(d?.leads) || Number(d?.conversions) || Number(d?.website_leads) ||
  Number(d?.offsite_conversion) || Number(d?.offsite_conversion_fb_pixel_lead) ||
  Number(d?.leadgen_grouped) || Number(d?.lead) || 0;
const getSessionsFromData = (d: any) => Number(d?.sessions) || 0;
const getAddToCartFromData = (d: any) => Number(d?.add_to_cart) || Number(d?.addToCarts) || 0;

const isAnalyticsPlatform = (s: string) => s === 'google_analytics';
const isAdsPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(s);
const isFacebookPlatform = (s: string) => ['facebook_insights', 'facebook_ecommerce'].includes(s);

const isEcommerceRecord = (d: any) =>
  String(d?.campaign_type || '').toLowerCase() === 'ecommerce' ||
  Number(d?.purchases) > 0 ||
  Number(d?.purchase_value) > 0 ||
  Number(d?.add_to_cart) > 0;

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

export default function SharedTable() {
  const { shareToken } = useParams();
  const [dateFilter, setDateFilter] = useState('last_70_days');

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-table', shareToken, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ token: shareToken!, date_filter: dateFilter });
      const response = await supabase.functions.invoke(`public-table?${params.toString()}`, { method: 'GET' });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: !!shareToken,
    retry: false,
  });

  const integrationType = data?.table?.integration_type;
  const isIntegrationTable = isAdsPlatform(integrationType || '') || isAnalyticsPlatform(integrationType || '');

  // For integration tables: filter only daily records for analytics
  const filteredRecords = useMemo(() => {
    const recs = data?.records || [];
    if (isAnalyticsPlatform(integrationType || '')) {
      return recs.filter((r: any) => r.data?.report_type === 'daily' || !r.data?.report_type);
    }
    return recs;
  }, [data, integrationType]);

  // Summary for integration tables
  const summary = useMemo(() => {
    if (!isIntegrationTable) return null;
    let spend = 0, impressions = 0, clicks = 0, leads = 0, sessions = 0;
    let purchases = 0, revenue = 0, addToCart = 0;

    filteredRecords.forEach((r: any) => {
      const d = r.data || {};
      if (isAnalyticsPlatform(integrationType || '')) {
        sessions += getSessionsFromData(d);
        purchases += getPurchasesFromData(d);
        revenue += getRevenueFromData(d);
        addToCart += getAddToCartFromData(d);
      } else {
        spend += getSpendFromData(d);
        impressions += Number(d.impressions) || 0;
        clicks += Number(d.clicks) || 0;
        // Always aggregate both - we'll display based on what exists
        purchases += getPurchasesFromData(d);
        revenue += getRevenueFromData(d);
        addToCart += getAddToCartFromData(d);
        leads += getLeadsFromData(d);
      }
    });

    const roas = spend > 0 ? revenue / spend : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const hasEcommerce = purchases > 0 || revenue > 0 || addToCart > 0;
    const hasLeads = leads > 0;

    return { spend, impressions, clicks, leads, sessions, purchases, revenue, addToCart, roas, cpl, hasEcommerce, hasLeads };
  }, [filteredRecords, integrationType, isIntegrationTable]);

  // Campaign-level aggregation for Facebook / Google Ads
  const campaignSummary = useMemo(() => {
    if (!isAdsPlatform(integrationType || '')) return { ecommerce: [] as any[], leads: [] as any[], all: [] as any[] };
    const map: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      const d = r.data || {};
      const name = d.campaign_name || d.campaign || 'ללא שם';
      if (!map[name]) {
        map[name] = { name, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0, addToCart: 0 };
      }
      map[name].spend += getSpendFromData(d);
      map[name].impressions += Number(d.impressions) || 0;
      map[name].clicks += Number(d.clicks) || 0;
      // Always aggregate both types
      map[name].purchases += getPurchasesFromData(d);
      map[name].revenue += getRevenueFromData(d);
      map[name].addToCart += getAddToCartFromData(d);
      map[name].leads += getLeadsFromData(d);
    });
    const allCampaigns = Object.values(map).sort((a: any, b: any) => b.spend - a.spend);
    // Classify each campaign
    const ecommerceCampaigns = allCampaigns.filter((c: any) => c.purchases > 0 || c.revenue > 0 || c.addToCart > 0);
    const leadCampaigns = allCampaigns.filter((c: any) => c.leads > 0 && c.purchases === 0 && c.revenue === 0 && c.addToCart === 0);
    // If no clear separation, show all as-is
    if (ecommerceCampaigns.length === 0 && leadCampaigns.length === 0) {
      return { ecommerce: [], leads: allCampaigns, all: allCampaigns };
    }
    return { ecommerce: ecommerceCampaigns, leads: leadCampaigns, all: allCampaigns };
  }, [filteredRecords, integrationType]);

  // Generic table columns from fields or data keys
  const genericColumns = useMemo(() => {
    if (isIntegrationTable) return [];
    if (!data?.records?.length) return data?.fields?.map((f: any) => ({ key: f.field_key, label: f.field_label })) || [];
    if (data?.fields?.length) {
      return data.fields.map((f: any) => ({ key: f.field_key, label: f.field_label }));
    }
    const keys = Object.keys(data.records[0]?.data || {}).filter((k: string) => !k.startsWith('_') && k !== 'report_type');
    return keys.map((k: string) => ({ key: k, label: k }));
  }, [data, isIntegrationTable]);

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="w-full max-w-6xl mx-auto p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Error
  if (error || data?.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold mb-2">הקישור אינו תקין</p>
            <p className="text-sm text-muted-foreground">קישור השיתוף לא נמצא או שאינו פעיל יותר.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.table) return null;

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {getIntegrationIcon(integrationType)}
            <h1 className="text-xl md:text-2xl font-bold">{data.table.name}</h1>
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards for integration tables */}
        {isIntegrationTable && summary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isAdsPlatform(integrationType!) && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(summary.spend)}</p>
                </CardContent>
              </Card>
            )}

            {isAnalyticsPlatform(integrationType!) && (
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">סשנים</p>
                  <p className="text-3xl font-bold mt-2">{formatNumber(summary.sessions)}</p>
                </CardContent>
              </Card>
            )}

            {summary.hasEcommerce || isAnalyticsPlatform(integrationType!) ? (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">הכנסות</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(summary.revenue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">רכישות</p>
                    <p className="text-3xl font-bold mt-2">{formatNumber(summary.purchases)}</p>
                  </CardContent>
                </Card>
                {isAdsPlatform(integrationType!) && (
                  <Card className={`bg-gradient-to-br ${summary.roas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">ROAS</p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-3xl font-bold">{summary.roas.toFixed(2)}</p>
                        {summary.roas > 1 ? <TrendingUp className="h-6 w-6 text-green-600" /> :
                          summary.roas < 1 ? <TrendingDown className="h-6 w-6 text-red-600" /> :
                          <Minus className="h-6 w-6 text-muted-foreground" />}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {summary.hasLeads && (
                  <>
                    <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
                      <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">לידים</p>
                        <p className="text-3xl font-bold mt-2">{formatNumber(summary.leads)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
                      <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                        <p className="text-3xl font-bold mt-2">{formatCurrency(summary.cpl)}</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            ) : (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">לידים</p>
                    <p className="text-3xl font-bold mt-2">{formatNumber(summary.leads)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">קליקים</p>
                    <p className="text-3xl font-bold mt-2">{formatNumber(summary.clicks)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(summary.cpl)}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Campaign Breakdown for Ads platforms - Ecommerce */}
        {isAdsPlatform(integrationType || '') && campaignSummary.ecommerce?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>קמפייני איקומרס</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">קמפיין</TableHead>
                      <TableHead className="text-right">הוצאה</TableHead>
                      <TableHead className="text-right">חשיפות</TableHead>
                      <TableHead className="text-right">קליקים</TableHead>
                      <TableHead className="text-right">הוספות לסל</TableHead>
                      <TableHead className="text-right">רכישות</TableHead>
                      <TableHead className="text-right">הכנסות</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignSummary.ecommerce.map((c: any) => {
                      const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium max-w-[200px] truncate">{c.name}</TableCell>
                          <TableCell>{formatCurrency(c.spend)}</TableCell>
                          <TableCell>{formatNumber(c.impressions)}</TableCell>
                          <TableCell>{formatNumber(c.clicks)}</TableCell>
                          <TableCell>{formatNumber(c.addToCart)}</TableCell>
                          <TableCell>{formatNumber(c.purchases)}</TableCell>
                          <TableCell>{formatCurrency(c.revenue)}</TableCell>
                          <TableCell>
                            <span className={roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                              {roas.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/10 font-bold border-t-2">
                      <TableCell>סה"כ</TableCell>
                      <TableCell>{formatCurrency(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.spend, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.impressions, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.clicks, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.addToCart, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.purchases, 0))}</TableCell>
                      <TableCell>{formatCurrency(campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.revenue, 0))}</TableCell>
                      <TableCell>
                        {(() => {
                          const totalSpend = campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.spend, 0);
                          const totalRevenue = campaignSummary.ecommerce.reduce((s: number, c: any) => s + c.revenue, 0);
                          const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
                          return <span className={roas >= 1 ? 'text-green-600' : 'text-red-600'}>{roas.toFixed(2)}</span>;
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Breakdown for Ads platforms - Leads */}
        {isAdsPlatform(integrationType || '') && campaignSummary.leads?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>קמפייני לידים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">קמפיין</TableHead>
                      <TableHead className="text-right">הוצאה</TableHead>
                      <TableHead className="text-right">חשיפות</TableHead>
                      <TableHead className="text-right">קליקים</TableHead>
                      <TableHead className="text-right">לידים</TableHead>
                      <TableHead className="text-right">עלות לליד</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignSummary.leads.map((c: any) => {
                      const cpl = c.leads > 0 ? c.spend / c.leads : 0;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium max-w-[200px] truncate">{c.name}</TableCell>
                          <TableCell>{formatCurrency(c.spend)}</TableCell>
                          <TableCell>{formatNumber(c.impressions)}</TableCell>
                          <TableCell>{formatNumber(c.clicks)}</TableCell>
                          <TableCell>{formatNumber(c.leads)}</TableCell>
                          <TableCell>{formatCurrency(cpl)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/10 font-bold border-t-2">
                      <TableCell>סה"כ</TableCell>
                      <TableCell>{formatCurrency(campaignSummary.leads.reduce((s: number, c: any) => s + c.spend, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.leads.reduce((s: number, c: any) => s + c.impressions, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.leads.reduce((s: number, c: any) => s + c.clicks, 0))}</TableCell>
                      <TableCell>{formatNumber(campaignSummary.leads.reduce((s: number, c: any) => s + c.leads, 0))}</TableCell>
                      <TableCell>
                        {(() => {
                          const totalSpend = campaignSummary.leads.reduce((s: number, c: any) => s + c.spend, 0);
                          const totalLeads = campaignSummary.leads.reduce((s: number, c: any) => s + c.leads, 0);
                          return formatCurrency(totalLeads > 0 ? totalSpend / totalLeads : 0);
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics table: daily breakdown */}
        {isAnalyticsPlatform(integrationType || '') && filteredRecords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>פירוט יומי</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">סשנים</TableHead>
                      <TableHead className="text-right">צפיות עמוד</TableHead>
                      <TableHead className="text-right">רכישות</TableHead>
                      <TableHead className="text-right">הכנסות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords
                      .sort((a: any, b: any) => (b.data?.date || '').localeCompare(a.data?.date || ''))
                      .slice(0, 60)
                      .map((r: any, i: number) => (
                        <TableRow key={r.id || i}>
                          <TableCell>{r.data?.date || '—'}</TableCell>
                          <TableCell>{formatNumber(getSessionsFromData(r.data))}</TableCell>
                          <TableCell>{formatNumber(Number(r.data?.screenPageViews) || Number(r.data?.pageviews) || 0)}</TableCell>
                          <TableCell>{formatNumber(getPurchasesFromData(r.data))}</TableCell>
                          <TableCell>{formatCurrency(getRevenueFromData(r.data))}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generic table for non-integration tables */}
        {!isIntegrationTable && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {genericColumns.map((col: any) => (
                        <TableHead key={col.key} className="text-right whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={genericColumns.length || 1} className="text-center py-12 text-muted-foreground">
                          אין נתונים לתקופה זו
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record: any, i: number) => (
                        <TableRow key={record.id || i}>
                          {genericColumns.map((col: any) => (
                            <TableCell key={col.key} className="whitespace-nowrap">
                              {formatCellValue(record.data?.[col.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {filteredRecords.length} שורות • {data.table.name} • Powered by {data.table.agency_name || 'Marketing Captain'}
        </p>
      </div>
    </div>
  );
}
