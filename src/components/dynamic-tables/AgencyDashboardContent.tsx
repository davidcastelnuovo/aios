import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Facebook, FileSpreadsheet, TrendingUp, TrendingDown, Minus, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, Area } from "recharts";

interface AgencyDashboardContentProps {
  agencyId: string;
  agencyName: string;
  dateFilter: string;
}

interface CampaignRecord {
  campaignName: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  spend: number;
  revenue: number;
  addToCart?: number;
}

interface ClientTableData {
  clientId: string;
  clientName: string;
  tableId: string;
  tableName: string;
  integrationType: string;
  campaignType: 'leads' | 'ecommerce';
  records: CampaignRecord[];
  totals: CampaignRecord;
}

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  google_ads: { name: 'Google Ads', color: 'text-red-500', bgColor: 'bg-red-100' },
  google_analytics: { name: 'Analytics', color: 'text-orange-500', bgColor: 'bg-orange-100' },
};

const isAdsPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(source);
const isAnalyticsPlatform = (source: string) => source === 'google_analytics';

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
const getLeadsFromData = (data: any) =>
  Number(data?.leads) || Number(data?.conversions) || Number(data?.website_leads) ||
  Number(data?.offsite_conversion) || Number(data?.offsite_conversion_fb_pixel_lead) || Number(data?.leadgen_grouped) || Number(data?.lead) || 0;
const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;

const getCampaignType = (integrationType: string, integrationSettings?: any): 'leads' | 'ecommerce' => {
  if (integrationType === 'facebook_insights') return 'leads';
  if (integrationType === 'facebook_ecommerce') return 'ecommerce';
  if (integrationType === 'google_ads') {
    return integrationSettings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  }
  return 'leads';
};

const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'facebook_insights':
    case 'facebook_ecommerce':
      return <Facebook className="h-4 w-4 text-blue-600" />;
    case 'google_ads':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
          <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
          <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
        </svg>
      );
    case 'google_analytics':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M20.5 18.5v-13c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#F9AB00"/>
          <path d="M13.5 18.5v-7c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#E37400"/>
          <circle cx="5" cy="18.5" r="2.5" fill="#E37400"/>
        </svg>
      );
    default:
      return <FileSpreadsheet className="h-4 w-4" />;
  }
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('he-IL').format(Math.round(num));
};

// Leads Table Component
function LeadsTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getCPL = (spend: number, leads: number) => leads > 0 ? spend / leads : 0;
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">לידים</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">עלות לליד</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{record.campaignName || 'ללא שם'}</TableCell>
            <TableCell>{formatNumber(record.impressions)}</TableCell>
            <TableCell>{formatNumber(record.clicks)}</TableCell>
            <TableCell>{formatNumber(record.leads)}</TableCell>
            <TableCell>{formatCurrency(record.spend)}</TableCell>
            <TableCell>{formatCurrency(getCPL(record.spend, record.leads))}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.leads)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(getCPL(totals.spend, totals.leads))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Ecommerce Table Component
function EcommerceTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getRoas = (revenue: number, spend: number) => spend > 0 ? revenue / spend : 0;
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">רכישות</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">הכנסה</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => {
          const roas = getRoas(record.revenue, record.spend);
          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{record.campaignName || 'ללא שם'}</TableCell>
              <TableCell>{formatNumber(record.impressions)}</TableCell>
              <TableCell>{formatNumber(record.clicks)}</TableCell>
              <TableCell>{formatNumber(record.purchases)}</TableCell>
              <TableCell>{formatCurrency(record.spend)}</TableCell>
              <TableCell>{formatCurrency(record.revenue)}</TableCell>
              <TableCell>
                <span className={roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                  {roas.toFixed(2)}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.purchases)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(totals.revenue)}</TableCell>
          <TableCell>
            <span className={getRoas(totals.revenue, totals.spend) >= 1 ? 'text-green-600' : 'text-red-600'}>
              {getRoas(totals.revenue, totals.spend).toFixed(2)}
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Analytics Table Component
function AnalyticsTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">מקור / ערוץ</TableHead>
          <TableHead className="text-right">סשנים</TableHead>
          <TableHead className="text-right">הוספות לעגלה</TableHead>
          <TableHead className="text-right">רכישות</TableHead>
          <TableHead className="text-right">הכנסות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{record.campaignName || 'Unknown'}</TableCell>
            <TableCell>{formatNumber(record.impressions)}</TableCell>
            <TableCell>{formatNumber(record.addToCart || 0)}</TableCell>
            <TableCell>{formatNumber(record.purchases)}</TableCell>
            <TableCell>{formatCurrency(record.revenue)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.addToCart || 0)}</TableCell>
          <TableCell>{formatNumber(totals.purchases)}</TableCell>
          <TableCell>{formatCurrency(totals.revenue)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Client Table Card Component
function ClientTableCard({ data }: { data: ClientTableData }) {
  const platformConfig = PLATFORM_CONFIG[data.integrationType];
  const isAnalytics = isAnalyticsPlatform(data.integrationType);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-base">
              {data.clientName}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {getIntegrationIcon(data.integrationType)}
            <span className={`font-medium ${platformConfig?.color || ''}`}>
              {platformConfig?.name || data.integrationType}
            </span>
            {!isAnalytics && (
              <Badge variant="secondary" className="text-xs">
                {data.campaignType === 'leads' ? 'לידים' : 'איקומרס'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {isAnalytics ? (
            <AnalyticsTable records={data.records} totals={data.totals} />
          ) : data.campaignType === 'leads' ? (
            <LeadsTable records={data.records} totals={data.totals} />
          ) : (
            <EcommerceTable records={data.records} totals={data.totals} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgencyDashboardContent({ agencyId, agencyName, dateFilter }: AgencyDashboardContentProps) {
  // Fetch clients for this agency
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-agency', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', agencyId)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  // Fetch all tables for these clients
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-agency', agencyId, clients.map(c => c.id).join(',')],
    queryFn: async () => {
      if (clients.length === 0) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      
      // Filter tables that belong to clients in this agency
      const clientIds = clients.map(c => c.id);
      return allTables.filter((t: any) => 
        t.client_id && clientIds.includes(t.client_id) &&
        ['facebook_insights', 'facebook_ecommerce', 'google_ads', 'google_analytics'].includes(t.integration_type)
      );
    },
    enabled: clients.length > 0,
  });

  // Fetch records for all tables
  const { data: allRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['crm-records-agency-dashboard', tables.map((t: any) => t.id).join(','), dateFilter],
    queryFn: async () => {
      if (tables.length === 0) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

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
        return records.map((r: any) => ({
          ...r,
          _tableId: table.id,
          _tableName: table.name,
          _integrationType: table.integration_type,
          _integrationSettings: table.integration_settings,
          _clientId: table.client_id,
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0,
    placeholderData: (previousData) => previousData,
  });

  // Group data by client and table with campaign-level detail
  const clientTableDataList = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const tableDataMap = new Map<string, ClientTableData>();

    allRecords.forEach((record: any) => {
      const tableId = record._tableId;
      const clientId = record._clientId;
      const integrationType = record._integrationType;
      const integrationSettings = record._integrationSettings;
      
      if (!tableId || !clientId) return;

      const key = `${clientId}-${tableId}`;
      
      if (!tableDataMap.has(key)) {
        tableDataMap.set(key, {
          clientId,
          clientName: clientMap.get(clientId) || 'לקוח לא ידוע',
          tableId,
          tableName: record._tableName,
          integrationType,
          campaignType: getCampaignType(integrationType, integrationSettings),
          records: [],
          totals: {
            campaignName: 'סה"כ',
            impressions: 0,
            clicks: 0,
            leads: 0,
            purchases: 0,
            spend: 0,
            revenue: 0,
            addToCart: 0,
          },
        });
      }

      const tableData = tableDataMap.get(key)!;
      const data = record.data || {};
      
      // For Analytics, only use traffic_source records for the table (skip daily/top_pages)
      if (isAnalyticsPlatform(integrationType)) {
        if (data.report_type !== 'traffic_source') return;
      }
      
      // Extract campaign name - for Analytics use source_medium
      const campaignName = isAnalyticsPlatform(integrationType) 
        ? (data.source_medium || 'Unknown')
        : (data.campaign_name || data.campaignName || data.name || 'ללא שם');
      
      let campaignRecord = tableData.records.find(r => r.campaignName === campaignName);
      
      if (!campaignRecord) {
        campaignRecord = {
          campaignName,
          impressions: 0,
          clicks: 0,
          leads: 0,
          purchases: 0,
          spend: 0,
          revenue: 0,
          addToCart: 0,
        };
        tableData.records.push(campaignRecord);
      }

      if (isAnalyticsPlatform(integrationType)) {
        const sessions = getSessionsFromData(data);
        const purchases = getPurchasesFromData(data);
        const revenue = getRevenueFromData(data);
        const addToCart = getAddToCartFromData(data);
        
        campaignRecord.impressions += sessions;
        campaignRecord.purchases += purchases;
        campaignRecord.revenue += revenue;
        campaignRecord.addToCart = (campaignRecord.addToCart || 0) + addToCart;
        
        tableData.totals.impressions += sessions;
        tableData.totals.purchases += purchases;
        tableData.totals.revenue += revenue;
        tableData.totals.addToCart = (tableData.totals.addToCart || 0) + addToCart;
      } else {
        const impressions = Number(data.impressions) || 0;
        const clicks = Number(data.clicks) || 0;
        const leads = getLeadsFromData(data);
        const purchases = getPurchasesFromData(data);
        const spend = getSpendFromData(data);
        const revenue = getRevenueFromData(data);

        campaignRecord.impressions += impressions;
        campaignRecord.clicks += clicks;
        campaignRecord.leads += leads;
        campaignRecord.purchases += purchases;
        campaignRecord.spend += spend;
        campaignRecord.revenue += revenue;

        tableData.totals.impressions += impressions;
        tableData.totals.clicks += clicks;
        tableData.totals.leads += leads;
        tableData.totals.purchases += purchases;
        tableData.totals.spend += spend;
        tableData.totals.revenue += revenue;
      }
    });

    return Array.from(tableDataMap.values())
      .filter(d => d.records.length > 0)
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he'));
  }, [clients, allRecords]);

  // Build daily chart data from daily records (Analytics + Ads)
  const dailyChartData = useMemo(() => {
    const byDate: Record<string, { 
      date: string; adsSpend: number; analyticsRevenue: number; 
      analyticsPurchases: number; analyticsAddToCart: number;
      analyticsSessions: number; adsLeads: number;
    }> = {};

    allRecords.forEach((record: any) => {
      const data = record.data || {};
      const date = data.date;
      if (!date) return;
      
      const integrationType = record._integrationType;
      
      if (!byDate[date]) {
        byDate[date] = { 
          date, adsSpend: 0, analyticsRevenue: 0, 
          analyticsPurchases: 0, analyticsAddToCart: 0,
          analyticsSessions: 0, adsLeads: 0,
        };
      }
      
      if (isAnalyticsPlatform(integrationType)) {
        // Use daily records for chart (not traffic_source)
        if (data.report_type === 'daily') {
          byDate[date].analyticsRevenue += getRevenueFromData(data);
          byDate[date].analyticsPurchases += getPurchasesFromData(data);
          byDate[date].analyticsAddToCart += getAddToCartFromData(data);
          byDate[date].analyticsSessions += getSessionsFromData(data);
        }
      } else if (isAdsPlatform(integrationType)) {
        byDate[date].adsSpend += getSpendFromData(data);
        byDate[date].adsLeads += getLeadsFromData(data);
      }
    });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        roas: d.adsSpend > 0 ? +(d.analyticsRevenue / d.adsSpend).toFixed(2) : 0,
      }));
  }, [allRecords]);

  // Calculate overall totals - ROAS uses Analytics revenue / Ads spend
  const overallTotals = useMemo(() => {
    let adsSpend = 0;
    let adsLeads = 0;
    let adsPurchases = 0;
    let analyticsRevenue = 0;
    let analyticsPurchases = 0;
    let analyticsSessions = 0;
    let analyticsAddToCart = 0;

    clientTableDataList.forEach((data) => {
      if (isAnalyticsPlatform(data.integrationType)) {
        analyticsRevenue += data.totals.revenue;
        analyticsPurchases += data.totals.purchases;
        analyticsSessions += data.totals.impressions;
        analyticsAddToCart += (data.totals.addToCart || 0);
      } else if (isAdsPlatform(data.integrationType)) {
        adsSpend += data.totals.spend;
        adsLeads += data.totals.leads;
        adsPurchases += data.totals.purchases;
      }
    });

    return { adsSpend, adsLeads, adsPurchases, analyticsRevenue, analyticsPurchases, analyticsSessions, analyticsAddToCart };
  }, [clientTableDataList]);

  const hasAnalytics = clientTableDataList.some(d => isAnalyticsPlatform(d.integrationType));
  const combinedRoas = overallTotals.adsSpend > 0 ? overallTotals.analyticsRevenue / overallTotals.adsSpend : 0;
  const totalCPL = overallTotals.adsLeads > 0 ? overallTotals.adsSpend / overallTotals.adsLeads : 0;

  const isLoading = clientsLoading || tablesLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">אין לקוחות פעילים בסוכנות זו</h3>
        <p className="text-muted-foreground">הוסף לקוחות פעילים לסוכנות כדי לראות נתונים בדשבורד</p>
      </Card>
    );
  }

  if (clientTableDataList.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">אין נתונים להצגה</h3>
        <p className="text-muted-foreground">הוסף טבלאות Facebook, Google Ads או Analytics ללקוחות הסוכנות</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">הוצאת פרסום</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(overallTotals.adsSpend)}</p>
          </CardContent>
        </Card>

        {hasAnalytics ? (
          <>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">הכנסות (Analytics)</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(overallTotals.analyticsRevenue)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">רכישות</p>
                    <p className="text-3xl font-bold mt-2">{formatNumber(overallTotals.analyticsPurchases)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> הוספות לעגלה
                    </p>
                    <p className="text-xl font-bold mt-2">{formatNumber(overallTotals.analyticsAddToCart)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${combinedRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">ROAS כולל</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-3xl font-bold">{combinedRoas.toFixed(2)}</p>
                  {combinedRoas > 1 ? (
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  ) : combinedRoas < 1 && combinedRoas > 0 ? (
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  ) : (
                    <Minus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">הכנסות Analytics / הוצאות פרסום</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">לידים</p>
                <p className="text-3xl font-bold mt-2">{formatNumber(overallTotals.adsLeads)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">רכישות</p>
                <p className="text-3xl font-bold mt-2">{formatNumber(overallTotals.adsPurchases)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totalCPL)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Daily Charts */}
      {dailyChartData.length > 0 && (
        <>
          {/* Revenue vs Spend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">הכנסות מול הוצאות - יומי</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrency(value), 
                      name === 'analyticsRevenue' ? 'הכנסות' : name === 'adsSpend' ? 'הוצאות' : name
                    ]}
                    labelFormatter={(label) => `תאריך: ${label}`}
                  />
                  <Legend formatter={(value) => value === 'analyticsRevenue' ? 'הכנסות (Analytics)' : value === 'adsSpend' ? 'הוצאות פרסום' : value} />
                  <Area type="monotone" dataKey="analyticsRevenue" fill="#22c55e" fillOpacity={0.15} stroke="#22c55e" strokeWidth={2} />
                  <Bar dataKey="adsSpend" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ROAS Daily Chart */}
          {hasAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ROAS יומי</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value.toFixed(2), 'ROAS']}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="roas" 
                      stroke="#8b5cf6" 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      name="ROAS"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Purchases & Add to Cart Chart */}
          {hasAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  רכישות והוספות לעגלה - יומי
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatNumber(value), 
                        name === 'analyticsPurchases' ? 'רכישות' : name === 'analyticsAddToCart' ? 'הוספות לעגלה' : name
                      ]}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Legend formatter={(value) => value === 'analyticsPurchases' ? 'רכישות' : value === 'analyticsAddToCart' ? 'הוספות לעגלה' : value} />
                    <Bar dataKey="analyticsAddToCart" fill="#f59e0b" radius={[4, 4, 0, 0]} name="analyticsAddToCart" />
                    <Bar dataKey="analyticsPurchases" fill="#22c55e" radius={[4, 4, 0, 0]} name="analyticsPurchases" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Sessions Chart */}
          {hasAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">סשנים יומיים (Analytics)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatNumber(value), 'סשנים']}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Bar dataKey="analyticsSessions" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Platform Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פירוט לפי פלטפורמה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">פלטפורמה</TableHead>
                  <TableHead className="text-right">הוצאה</TableHead>
                  <TableHead className="text-right">סשנים / חשיפות</TableHead>
                  <TableHead className="text-right">הוספות לעגלה</TableHead>
                  <TableHead className="text-right">רכישות</TableHead>
                  <TableHead className="text-right">הכנסות</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Aggregate by platform */}
                {(() => {
                  const platformTotals: Record<string, { spend: number; impressions: number; addToCart: number; purchases: number; revenue: number }> = {};
                  clientTableDataList.forEach(d => {
                    const key = d.integrationType;
                    if (!platformTotals[key]) platformTotals[key] = { spend: 0, impressions: 0, addToCart: 0, purchases: 0, revenue: 0 };
                    platformTotals[key].impressions += d.totals.impressions;
                    platformTotals[key].addToCart += (d.totals.addToCart || 0);
                    platformTotals[key].purchases += d.totals.purchases;
                    platformTotals[key].revenue += d.totals.revenue;
                    if (!isAnalyticsPlatform(key)) {
                      platformTotals[key].spend += d.totals.spend;
                    }
                  });
                  return Object.entries(platformTotals).map(([platform, metrics]) => {
                    const config = PLATFORM_CONFIG[platform] || { name: platform, color: 'text-muted-foreground' };
                    const isAnalytics = isAnalyticsPlatform(platform);
                    const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;
                    return (
                      <TableRow key={platform}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getIntegrationIcon(platform)}
                            <span className={config.color}>{config.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{isAnalytics ? '-' : formatCurrency(metrics.spend)}</TableCell>
                        <TableCell>{formatNumber(metrics.impressions)}</TableCell>
                        <TableCell>{isAnalytics ? formatNumber(metrics.addToCart) : '-'}</TableCell>
                        <TableCell>{formatNumber(metrics.purchases)}</TableCell>
                        <TableCell>{formatCurrency(metrics.revenue)}</TableCell>
                        <TableCell>
                          {isAnalytics ? '-' : (
                            <span className={roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                              {roas.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {/* Total row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell>
                    סה"כ
                    {hasAnalytics && (
                      <span className="text-xs font-normal text-muted-foreground block">
                        ROAS = הכנסות Analytics / הוצאות פרסום
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(overallTotals.adsSpend)}</TableCell>
                  <TableCell>{formatNumber(overallTotals.analyticsSessions || 0)}</TableCell>
                  <TableCell>{formatNumber(overallTotals.analyticsAddToCart)}</TableCell>
                  <TableCell>{formatNumber(overallTotals.analyticsPurchases || overallTotals.adsPurchases)}</TableCell>
                  <TableCell>{formatCurrency(overallTotals.analyticsRevenue)}</TableCell>
                  <TableCell>
                    <span className={combinedRoas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                      {combinedRoas.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Client Cards */}
      {clientTableDataList.map((data) => (
        <ClientTableCard key={`${data.clientId}-${data.tableId}`} data={data} />
      ))}
    </div>
  );
}
