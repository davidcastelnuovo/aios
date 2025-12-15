import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, MousePointerClick, Eye, Target, ArrowUpDown, Minus, Award } from "lucide-react";

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface SearchConsoleDashboardProps {
  records: CrmRecord[];
}

export function SearchConsoleDashboard({ records }: SearchConsoleDashboardProps) {
  const [comparisonMode, setComparisonMode] = useState<string>("none");
  const [sortBy, setSortBy] = useState<string>("clicks");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { queryData, totals, comparison, firstPageQueries } = useMemo(() => {
    // Get date range from records
    const dates = records.map(r => r.data.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    // Calculate period length
    const periodStart = new Date(minDate);
    const periodEnd = new Date(maxDate);
    const periodLength = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Split data for comparison if needed
    let currentRecords = records;
    let previousRecords: CrmRecord[] = [];
    
    if (comparisonMode === "previous_period" && dates.length > 0) {
      const midPoint = new Date(periodStart.getTime() + (periodLength / 2) * 24 * 60 * 60 * 1000);
      const midDateStr = midPoint.toISOString().split('T')[0];
      
      currentRecords = records.filter(r => r.data.date >= midDateStr);
      previousRecords = records.filter(r => r.data.date < midDateStr);
    }

    // Aggregate by query
    const queryMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>();
    
    currentRecords.forEach(r => {
      const query = r.data.query || '';
      const existing = queryMap.get(query) || { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
      
      queryMap.set(query, {
        clicks: existing.clicks + (Number(r.data.clicks) || 0),
        impressions: existing.impressions + (Number(r.data.impressions) || 0),
        ctr: existing.ctr + (Number(r.data.ctr) || 0),
        position: existing.position + (Number(r.data.position) || 0),
        count: existing.count + 1,
      });
    });

    // Previous period aggregation for comparison
    const previousQueryMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>();
    
    previousRecords.forEach(r => {
      const query = r.data.query || '';
      const existing = previousQueryMap.get(query) || { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
      
      previousQueryMap.set(query, {
        clicks: existing.clicks + (Number(r.data.clicks) || 0),
        impressions: existing.impressions + (Number(r.data.impressions) || 0),
        ctr: existing.ctr + (Number(r.data.ctr) || 0),
        position: existing.position + (Number(r.data.position) || 0),
        count: existing.count + 1,
      });
    });

    const queryData = Array.from(queryMap.entries()).map(([query, data]) => {
      const prev = previousQueryMap.get(query);
      const avgCtr = data.count > 0 ? data.ctr / data.count : 0;
      const avgPosition = data.count > 0 ? data.position / data.count : 0;
      const prevAvgCtr = prev && prev.count > 0 ? prev.ctr / prev.count : 0;
      const prevAvgPosition = prev && prev.count > 0 ? prev.position / prev.count : 0;
      
      return {
        query: query.length > 40 ? query.substring(0, 40) + '...' : query,
        fullQuery: query,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: avgCtr,
        position: avgPosition,
        prevClicks: prev?.clicks || 0,
        prevImpressions: prev?.impressions || 0,
        prevCtr: prevAvgCtr,
        prevPosition: prevAvgPosition,
        clicksChange: prev ? data.clicks - prev.clicks : 0,
        impressionsChange: prev ? data.impressions - prev.impressions : 0,
        ctrChange: prev ? avgCtr - prevAvgCtr : 0,
        positionChange: prev ? prevAvgPosition - avgPosition : 0, // Lower is better
      };
    });

    // Sort
    queryData.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number;
      const bVal = b[sortBy as keyof typeof b] as number;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

    // Count queries on first page (position <= 10)
    const firstPageQueries = queryData.filter(q => q.position <= 10 && q.position > 0).length;
    const prevFirstPageQueries = comparisonMode !== "none" 
      ? Array.from(previousQueryMap.entries()).filter(([_, data]) => {
          const avgPos = data.count > 0 ? data.position / data.count : 0;
          return avgPos <= 10 && avgPos > 0;
        }).length
      : 0;

    // Totals
    const totals = {
      clicks: queryData.reduce((sum, q) => sum + q.clicks, 0),
      impressions: queryData.reduce((sum, q) => sum + q.impressions, 0),
      avgCtr: queryData.length > 0 ? queryData.reduce((sum, q) => sum + q.ctr, 0) / queryData.length : 0,
      firstPageQueries,
    };

    const prevTotals = {
      clicks: queryData.reduce((sum, q) => sum + q.prevClicks, 0),
      impressions: queryData.reduce((sum, q) => sum + q.prevImpressions, 0),
      avgCtr: queryData.length > 0 ? queryData.reduce((sum, q) => sum + q.prevCtr, 0) / queryData.length : 0,
      firstPageQueries: prevFirstPageQueries,
    };

    const comparison = {
      clicksChange: totals.clicks - prevTotals.clicks,
      impressionsChange: totals.impressions - prevTotals.impressions,
      ctrChange: totals.avgCtr - prevTotals.avgCtr,
      firstPageChange: totals.firstPageQueries - prevTotals.firstPageQueries,
    };

    return { queryData: queryData.slice(0, 50), totals, comparison, firstPageQueries };
  }, [records, comparisonMode, sortBy, sortOrder]);

  const formatNumber = (num: number) => new Intl.NumberFormat('he-IL').format(num);
  
  const renderChangeIndicator = (value: number, inverted = false) => {
    const isPositive = inverted ? value < 0 : value > 0;
    const isNegative = inverted ? value > 0 : value < 0;
    
    if (Math.abs(value) < 0.01) return <Minus className="h-3 w-3 text-muted-foreground" />;
    
    return isPositive ? (
      <TrendingUp className="h-3 w-3 text-green-500" />
    ) : isNegative ? (
      <TrendingDown className="h-3 w-3 text-red-500" />
    ) : null;
  };

  // Get top 25 queries sorted by impressions for the sidebar list
  const top25Queries = useMemo(() => {
    return [...queryData]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25);
  }, [queryData]);

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>אין נתונים להצגה. לחץ על "סנכרון" כדי למשוך נתונים מ-Google Search Console.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">השוואה:</span>
          <Select value={comparisonMode} onValueChange={setComparisonMode}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא השוואה</SelectItem>
              <SelectItem value="previous_period">תקופה קודמת</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">קליקים</span>
              </div>
              {comparisonMode !== "none" && renderChangeIndicator(comparison.clicksChange)}
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.clicks)}</p>
            {comparisonMode !== "none" && (
              <p className={`text-xs ${comparison.clicksChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {comparison.clicksChange >= 0 ? '+' : ''}{formatNumber(comparison.clicksChange)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">חשיפות</span>
              </div>
              {comparisonMode !== "none" && renderChangeIndicator(comparison.impressionsChange)}
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.impressions)}</p>
            {comparisonMode !== "none" && (
              <p className={`text-xs ${comparison.impressionsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {comparison.impressionsChange >= 0 ? '+' : ''}{formatNumber(comparison.impressionsChange)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">CTR ממוצע</span>
              </div>
              {comparisonMode !== "none" && renderChangeIndicator(comparison.ctrChange)}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.avgCtr.toFixed(2)}%</p>
            {comparisonMode !== "none" && (
              <p className={`text-xs ${comparison.ctrChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {comparison.ctrChange >= 0 ? '+' : ''}{comparison.ctrChange.toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">ביטויים בעמוד הראשון</span>
              </div>
              {comparisonMode !== "none" && renderChangeIndicator(comparison.firstPageChange)}
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.firstPageQueries)}</p>
            {comparisonMode !== "none" && (
              <p className={`text-xs ${comparison.firstPageChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {comparison.firstPageChange >= 0 ? '+' : ''}{formatNumber(comparison.firstPageChange)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 25 Queries List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">25 ביטויים מובילים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {top25Queries.map((query, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground w-6 text-center">
                    {index + 1}
                  </span>
                  <span className="text-sm truncate flex-1" title={query.fullQuery}>
                    {query.fullQuery}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <div className="text-center min-w-[60px]">
                    <span className="text-muted-foreground text-xs">חשיפות</span>
                    <p className="font-medium">{formatNumber(query.impressions)}</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <span className="text-muted-foreground text-xs">קליקים</span>
                    <p className="font-medium">{formatNumber(query.clicks)}</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <span className="text-muted-foreground text-xs">CTR</span>
                    <p className="font-medium">{query.ctr.toFixed(2)}%</p>
                  </div>
                  <Badge variant={query.position <= 10 ? "default" : query.position <= 20 ? "secondary" : "outline"}>
                    {query.position.toFixed(1)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Queries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>ביטויי חיפוש</span>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clicks">קליקים</SelectItem>
                  <SelectItem value="impressions">חשיפות</SelectItem>
                  <SelectItem value="ctr">CTR</SelectItem>
                  <SelectItem value="position">מיקום</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 font-medium">ביטוי</th>
                  <th className="text-center py-2 px-3 font-medium">קליקים</th>
                  <th className="text-center py-2 px-3 font-medium">חשיפות</th>
                  <th className="text-center py-2 px-3 font-medium">CTR</th>
                  <th className="text-center py-2 px-3 font-medium">מיקום</th>
                  {comparisonMode !== "none" && (
                    <th className="text-center py-2 px-3 font-medium">שינוי</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {queryData.map((query, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium max-w-[250px] truncate" title={query.fullQuery}>
                      {query.query}
                    </td>
                    <td className="text-center py-2 px-3">{formatNumber(query.clicks)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(query.impressions)}</td>
                    <td className="text-center py-2 px-3">{query.ctr.toFixed(2)}%</td>
                    <td className="text-center py-2 px-3">
                      <Badge variant={query.position <= 10 ? "default" : query.position <= 20 ? "secondary" : "outline"}>
                        {query.position.toFixed(1)}
                      </Badge>
                    </td>
                    {comparisonMode !== "none" && (
                      <td className="text-center py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {renderChangeIndicator(query.clicksChange)}
                          <span className={`text-xs ${query.clicksChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {query.clicksChange >= 0 ? '+' : ''}{query.clicksChange}
                          </span>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
