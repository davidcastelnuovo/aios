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

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  google_ads: { name: 'Google Ads', color: 'text-red-500', bgColor: 'bg-red-100' },
};

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
          _source: table.integration_type,
          _clientId: table.client_id,
          _tableName: table.name,
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0,
    placeholderData: (previousData) => previousData,
  });

  // Group data by client and platform
  const clientPlatformData = useMemo(() => {
    const result: Record<string, Record<string, any>> = {};
    
    // Initialize for each client
    clients.forEach(client => {
      result[client.id] = {};
    });

    // Aggregate records
    allRecords.forEach((record: any) => {
      const clientId = record._clientId;
      const platform = record._source;
      
      if (!clientId || !platform) return;
      
      if (!result[clientId]) {
        result[clientId] = {};
      }
      
      if (!result[clientId][platform]) {
        result[clientId][platform] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          purchases: 0,
          purchase_value: 0,
        };
      }
      
      const data = record.data || {};
      result[clientId][platform].spend += Number(data.spend) || Number(data.cost) || 0;
      result[clientId][platform].impressions += Number(data.impressions) || 0;
      result[clientId][platform].clicks += Number(data.clicks) || 0;
      result[clientId][platform].conversions += Number(data.conversions) || Number(data.purchases) || 0;
      result[clientId][platform].purchases += Number(data.purchases) || 0;
      result[clientId][platform].purchase_value += 
        Number(data.purchase_value) || 
        Number(data.conversions_value) || 
        Number(data.conversion_value) || 
        0;
    });

    return result;
  }, [clients, allRecords]);

  // Create rows for the table
  const tableRows = useMemo(() => {
    const rows: Array<{
      clientId: string;
      clientName: string;
      platform: string;
      platformName: string;
      spend: number;
      revenue: number;
      roas: number;
      isFirstRow: boolean;
      platformCount: number;
    }> = [];

    clients.forEach(client => {
      const platforms = clientPlatformData[client.id] || {};
      const platformKeys = Object.keys(platforms).filter(p => 
        platforms[p].spend > 0 || platforms[p].purchase_value > 0
      );
      
      if (platformKeys.length === 0) {
        // Client has no data
        return;
      }

      platformKeys.forEach((platform, idx) => {
        const data = platforms[platform];
        const spend = data.spend;
        const revenue = data.purchase_value;
        const roas = spend > 0 ? revenue / spend : 0;

        rows.push({
          clientId: client.id,
          clientName: client.name,
          platform,
          platformName: PLATFORM_CONFIG[platform]?.name || platform,
          spend,
          revenue,
          roas,
          isFirstRow: idx === 0,
          platformCount: platformKeys.length,
        });
      });
    });

    return rows;
  }, [clients, clientPlatformData]);

  // Calculate totals
  const totals = useMemo(() => {
    return tableRows.reduce((acc, row) => ({
      spend: acc.spend + row.spend,
      revenue: acc.revenue + row.revenue,
    }), { spend: 0, revenue: 0 });
  }, [tableRows]);

  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(num);
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

  const isLoading = clientsLoading || tablesLoading || recordsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
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

  if (tableRows.length === 0) {
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(totals.spend)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">הכנסות כוללות</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(totals.revenue)}</p>
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-to-br ${totalRoas >= 1 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">ROAS ממוצע</p>
            <p className="text-3xl font-bold mt-2">{totalRoas.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>פירוט לפי לקוח ופלטפורמה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">לקוח</TableHead>
                  <TableHead className="text-right">פלטפורמה</TableHead>
                  <TableHead className="text-right">הוצאה</TableHead>
                  <TableHead className="text-right">הכנסות</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row, idx) => (
                  <TableRow 
                    key={`${row.clientId}-${row.platform}`}
                    className={row.isFirstRow && idx > 0 ? "border-t-2" : ""}
                  >
                    <TableCell className="font-medium">
                      {row.isFirstRow ? (
                        <Badge variant="outline" className="font-medium">
                          {row.clientName}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getIntegrationIcon(row.platform)}
                        <span className={PLATFORM_CONFIG[row.platform]?.color || ''}>
                          {row.platformName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(row.spend)}</TableCell>
                    <TableCell>{formatCurrency(row.revenue)}</TableCell>
                    <TableCell>
                      <span className={row.roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                        {row.roas.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell>סה"כ</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{formatCurrency(totals.spend)}</TableCell>
                  <TableCell>{formatCurrency(totals.revenue)}</TableCell>
                  <TableCell>
                    <span className={totalRoas >= 1 ? 'text-green-600' : 'text-red-600'}>
                      {totalRoas.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}