import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Facebook, FileSpreadsheet } from "lucide-react";

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
};

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
        {/* Total Row */}
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
        {/* Total Row */}
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

// Client Table Card Component
function ClientTableCard({ data }: { data: ClientTableData }) {
  const platformConfig = PLATFORM_CONFIG[data.integrationType];
  
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
            <Badge variant="secondary" className="text-xs">
              {data.campaignType === 'leads' ? 'לידים' : 'איקומרס'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {data.campaignType === 'leads' ? (
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
        ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(t.integration_type)
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
          },
        });
      }

      const tableData = tableDataMap.get(key)!;
      const data = record.data || {};
      
      // Extract campaign name
      const campaignName = data.campaign_name || data.campaignName || data.name || 'ללא שם';
      
      // Find existing campaign record or create new one
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
        };
        tableData.records.push(campaignRecord);
      }

      // Aggregate data
      const impressions = Number(data.impressions) || 0;
      const clicks = Number(data.clicks) || 0;
      const leads = Number(data.leads) || Number(data.conversions) || 0;
      const purchases = Number(data.purchases) || 0;
      const spend = Number(data.spend) || Number(data.cost) || 0;
      const revenue = Number(data.purchase_value) || Number(data.conversions_value) || Number(data.conversion_value) || 0;

      campaignRecord.impressions += impressions;
      campaignRecord.clicks += clicks;
      campaignRecord.leads += leads;
      campaignRecord.purchases += purchases;
      campaignRecord.spend += spend;
      campaignRecord.revenue += revenue;

      // Update totals
      tableData.totals.impressions += impressions;
      tableData.totals.clicks += clicks;
      tableData.totals.leads += leads;
      tableData.totals.purchases += purchases;
      tableData.totals.spend += spend;
      tableData.totals.revenue += revenue;
    });

    // Convert to array and sort by client name
    return Array.from(tableDataMap.values())
      .filter(d => d.records.length > 0)
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he'));
  }, [clients, allRecords]);

  // Calculate overall totals
  const overallTotals = useMemo(() => {
    return clientTableDataList.reduce(
      (acc, data) => ({
        spend: acc.spend + data.totals.spend,
        revenue: acc.revenue + data.totals.revenue,
        leads: acc.leads + data.totals.leads,
        purchases: acc.purchases + data.totals.purchases,
      }),
      { spend: 0, revenue: 0, leads: 0, purchases: 0 }
    );
  }, [clientTableDataList]);

  const totalRoas = overallTotals.spend > 0 ? overallTotals.revenue / overallTotals.spend : 0;
  const totalCPL = overallTotals.leads > 0 ? overallTotals.spend / overallTotals.leads : 0;

  const isLoading = clientsLoading || tablesLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">אין לקוחות פעילים בסוכנות זו</h3>
        <p className="text-muted-foreground">
          הוסף לקוחות פעילים לסוכנות כדי לראות נתונים בדשבורד
        </p>
      </Card>
    );
  }

  if (clientTableDataList.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">אין נתונים להצגה</h3>
        <p className="text-muted-foreground">
          הוסף טבלאות Facebook או Google Ads ללקוחות הסוכנות כדי לראות נתונים כאן
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(overallTotals.spend)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">הכנסות כוללות</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(overallTotals.revenue)}</p>
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-to-br ${totalRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">ROAS ממוצע</p>
            <p className="text-3xl font-bold mt-2">{totalRoas.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">לידים / עלות ממוצעת</p>
            <p className="text-3xl font-bold mt-2">
              {formatNumber(overallTotals.leads)} / {formatCurrency(totalCPL)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Client Cards */}
      {clientTableDataList.map((data) => (
        <ClientTableCard key={`${data.clientId}-${data.tableId}`} data={data} />
      ))}
    </div>
  );
}
