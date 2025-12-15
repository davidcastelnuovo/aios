import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Facebook, BarChart3, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

// Google Ads Icon
const GoogleAdsIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
  </svg>
);

interface CombinedDataViewProps {
  integrations: Array<{
    type: string;
    resourceName?: string;
    propertyName?: string;
    siteUrl?: string;
    adAccountName?: string;
  }>;
  records: Array<{
    id: string;
    data: Record<string, any>;
    source?: string;
  }>;
}

const PLATFORM_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  facebook_insights: { name: 'Facebook', icon: <Facebook className="h-4 w-4" />, color: 'bg-blue-600' },
  google_ads: { name: 'Google Ads', icon: <GoogleAdsIcon />, color: 'bg-blue-500' },
  google_analytics: { name: 'Analytics', icon: <BarChart3 className="h-4 w-4" />, color: 'bg-orange-500' },
  google_search_console: { name: 'Search Console', icon: <Search className="h-4 w-4" />, color: 'bg-green-500' },
};

export function CombinedDataView({ integrations, records }: CombinedDataViewProps) {
  // Group records by date for combined view
  const combinedData = useMemo(() => {
    const byDate: Record<string, Record<string, any>> = {};
    
    records.forEach(record => {
      const date = record.data.date || record.data.day || 'unknown';
      if (!byDate[date]) {
        byDate[date] = { date };
      }
      
      const source = record.source || record.data._source || 'unknown';
      const prefix = source.replace('_insights', '').replace('google_', '').slice(0, 2).toUpperCase();
      
      Object.entries(record.data).forEach(([key, value]) => {
        if (key !== 'date' && key !== 'day' && key !== '_source') {
          byDate[date][`${prefix}_${key}`] = value;
        }
      });
    });
    
    return Object.values(byDate).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [records]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const metrics: Record<string, { total: number; count: number }> = {};
    
    records.forEach(record => {
      Object.entries(record.data).forEach(([key, value]) => {
        if (typeof value === 'number' && key !== 'date') {
          if (!metrics[key]) {
            metrics[key] = { total: 0, count: 0 };
          }
          metrics[key].total += value;
          metrics[key].count += 1;
        }
      });
    });
    
    return metrics;
  }, [records]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(num % 1 === 0 ? 0 : 2);
  };

  if (integrations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>לא נמצאו חיבורים לטבלה זו</p>
        <p className="text-sm mt-2">השתמש בכפתור "הוסף חיבור" להוספת פלטפורמות</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>לא נמצאו נתונים</p>
        <p className="text-sm mt-2">סנכרן את הנתונים מכל פלטפורמה בנפרד</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Platforms */}
      <div className="flex flex-wrap gap-2">
        {integrations.map((integration, idx) => {
          const config = PLATFORM_CONFIG[integration.type];
          if (!config) return null;
          return (
            <Badge key={idx} variant="outline" className="flex items-center gap-2 py-1">
              <div className={`p-1 rounded ${config.color} text-white`}>
                {config.icon}
              </div>
              {integration.resourceName || integration.propertyName || integration.siteUrl || integration.adAccountName || config.name}
            </Badge>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(summaryMetrics).slice(0, 8).map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold">{formatNumber(value.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Combined Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">נתונים משולבים לפי תאריך</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  {Object.keys(combinedData[0] || {})
                    .filter(k => k !== 'date')
                    .slice(0, 10)
                    .map(key => (
                      <TableHead key={key} className="text-right">
                        {key.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedData.slice(0, 30).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {new Date(row.date).toLocaleDateString('he-IL')}
                    </TableCell>
                    {Object.entries(row)
                      .filter(([k]) => k !== 'date')
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <TableCell key={key}>
                          {typeof value === 'number' ? formatNumber(value) : String(value || '-')}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
