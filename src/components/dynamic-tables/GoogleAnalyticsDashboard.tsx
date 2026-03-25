import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Users, Eye, MousePointerClick, Clock, TrendingUp, Globe, CalendarIcon, ArrowUp, ArrowDown, ShoppingCart, CreditCard } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { he } from "date-fns/locale";

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface GoogleAnalyticsDashboardProps {
  records: CrmRecord[];
}

// Explicit colorful chart colors
const COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
];

type DateRangePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month' | 'last_month' | 'last_90_days' | 'custom';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function GoogleAnalyticsDashboard({ records }: GoogleAnalyticsDashboardProps) {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [showComparison, setShowComparison] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Calculate date range based on preset
  const getDateRange = (preset: DateRangePreset): { start: Date; end: Date } => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    switch (preset) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return { start: todayStart, end: today };
      case 'yesterday':
        const yesterdayStart = subDays(today, 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = subDays(today, 1);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: yesterdayStart, end: yesterdayEnd };
      case 'last_7_days':
        return { start: subDays(today, 6), end: today };
      case 'last_14_days':
        return { start: subDays(today, 13), end: today };
      case 'last_30_days':
        return { start: subDays(today, 29), end: today };
      case 'this_month':
        return { start: startOfMonth(today), end: today };
      case 'last_month':
        const lastMonth = subMonths(today, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_90_days':
        return { start: subDays(today, 89), end: today };
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return { start: subDays(today, 29), end: today };
      default:
        return { start: subDays(today, 29), end: today };
    }
  };

  const currentRange = getDateRange(datePreset);
  
  // Calculate previous period range (same duration, before current range)
  const getPreviousRange = (currentStart: Date, currentEnd: Date): { start: Date; end: Date } => {
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start: prevStart, end: prevEnd };
  };

  const previousRange = getPreviousRange(currentRange.start, currentRange.end);

  // Filter records by date range - only filter records that have a date field
  const filterRecordsByDate = (records: CrmRecord[], startDate: Date, endDate: Date) => {
    return records.filter(r => {
      // If record has no date field, include it (aggregated data)
      if (!r.data.date) return true;
      
      // Try to parse the date
      try {
        const recordDate = parseISO(r.data.date);
        // Set time boundaries properly
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(recordDate, { start, end });
      } catch {
        // If date parsing fails, include the record
        return true;
      }
    });
  };

  // Normalize source names - provide meaningful Hebrew labels
  const normalizeSourceName = (name: string): string => {
    if (!name) return 'מקור לא ידוע';
    
    const lowerName = name.toLowerCase();
    
    // Direct/none cases
    if (lowerName === '(not set)' || lowerName === 'not set' || lowerName === '(direct) / (none)') {
      return 'תנועה ישירה (Direct)';
    }
    
    // Null/null - likely untagged traffic
    if (lowerName === 'null / null' || lowerName === '(not set) / (not set)') {
      return 'מקור לא ידוע';
    }
    
    // Data not available
    if (lowerName.includes('data not available')) {
      return 'מידע לא זמין';
    }
    
    return name;
  };

  const { trafficSources, dailyData, topPages, totals, prevTotals } = useMemo(() => {
    // Filter daily records by selected date range
    const currentDailyRecords = records.filter(r => {
      if (r.data.report_type !== 'daily') return false;
      if (!r.data.date) return false;
      
      try {
        const recordDate = parseISO(r.data.date);
        const start = new Date(currentRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentRange.end);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(recordDate, { start, end });
      } catch {
        return false;
      }
    });

    const previousDailyRecords = showComparison ? records.filter(r => {
      if (r.data.report_type !== 'daily') return false;
      if (!r.data.date) return false;
      
      try {
        const recordDate = parseISO(r.data.date);
        const start = new Date(previousRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(previousRange.end);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(recordDate, { start, end });
      } catch {
        return false;
      }
    }) : [];

    // Traffic sources - use all (they're aggregated without dates)
    const trafficSources = records
      .filter(r =>
        r.data.report_type === 'traffic_source' ||
        (!r.data.report_type && (r.data.source_medium || r.data.source || r.data.medium))
      )
      .map(r => ({
        name: normalizeSourceName(
          r.data.source_medium ||
          (r.data.source && r.data.medium ? `${r.data.source} / ${r.data.medium}` : r.data.source) ||
          'Unknown'
        ),
        sessions: toNumber(r.data.sessions),
        users: toNumber(r.data.users),
        newUsers: toNumber(r.data.new_users),
        pageviews: toNumber(r.data.pageviews),
        bounceRate: toNumber(r.data.bounce_rate),
        avgDuration: toNumber(r.data.avg_session_duration),
        conversions: toNumber(r.data.conversions ?? r.data.transactions ?? r.data.purchases),
        addToCart: toNumber(r.data.add_to_cart ?? r.data.add_to_carts),
        purchases: toNumber(r.data.purchases ?? r.data.transactions ?? r.data.conversions),
        purchaseValue: toNumber(r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue ?? r.data.total_revenue),
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Daily data for chart - filtered by selected date range
    const dailyData = currentDailyRecords
      .map(r => ({
        date: r.data.date,
        displayDate: r.data.date ? new Date(r.data.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '',
        sessions: toNumber(r.data.sessions),
        users: toNumber(r.data.users),
        pageviews: toNumber(r.data.pageviews),
        conversions: toNumber(r.data.conversions ?? r.data.transactions ?? r.data.purchases),
        addToCart: toNumber(r.data.add_to_cart ?? r.data.add_to_carts),
        purchases: toNumber(r.data.purchases ?? r.data.transactions ?? r.data.conversions),
        purchaseValue: toNumber(r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue ?? r.data.total_revenue),
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Previous period daily data
    const prevDailyData = previousDailyRecords
      .map(r => ({
        sessions: toNumber(r.data.sessions),
        users: toNumber(r.data.users),
        pageviews: toNumber(r.data.pageviews),
        conversions: toNumber(r.data.conversions ?? r.data.transactions ?? r.data.purchases),
        addToCart: toNumber(r.data.add_to_cart ?? r.data.add_to_carts),
        purchases: toNumber(r.data.purchases ?? r.data.transactions ?? r.data.conversions),
        purchaseValue: toNumber(r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue ?? r.data.total_revenue),
      }));

    const topPages = records
      .filter(r => r.data.report_type === 'top_pages')
      .map(r => ({
        path: r.data.page_path || '/',
        pageviews: toNumber(r.data.pageviews),
        sessions: toNumber(r.data.sessions),
        avgDuration: toNumber(r.data.avg_session_duration),
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);

    // Calculate totals from DAILY data (which has dates and can be filtered)
    const calculateTotalsFromDaily = (data: typeof dailyData) => ({
      sessions: data.reduce((sum, d) => sum + d.sessions, 0),
      users: data.reduce((sum, d) => sum + d.users, 0),
      newUsers: 0, // Not available in daily data
      pageviews: data.reduce((sum, d) => sum + d.pageviews, 0),
      conversions: data.reduce((sum, d) => sum + d.conversions, 0),
      addToCart: data.reduce((sum, d) => sum + d.addToCart, 0),
      purchases: data.reduce((sum, d) => sum + d.purchases, 0),
      purchaseValue: data.reduce((sum, d) => sum + d.purchaseValue, 0),
      avgBounceRate: '0', // Not available in daily data
    });

    // If we have filtered daily data, use it for totals. Otherwise fall back to traffic sources
    const totals = dailyData.length > 0 
      ? calculateTotalsFromDaily(dailyData)
      : {
          sessions: trafficSources.reduce((sum, s) => sum + s.sessions, 0),
          users: trafficSources.reduce((sum, s) => sum + s.users, 0),
          newUsers: trafficSources.reduce((sum, s) => sum + s.newUsers, 0),
          pageviews: trafficSources.reduce((sum, s) => sum + s.pageviews, 0),
          conversions: trafficSources.reduce((sum, s) => sum + s.conversions, 0),
          addToCart: trafficSources.reduce((sum, s) => sum + s.addToCart, 0),
          purchases: trafficSources.reduce((sum, s) => sum + s.purchases, 0),
          purchaseValue: trafficSources.reduce((sum, s) => sum + s.purchaseValue, 0),
          avgBounceRate: trafficSources.length > 0 
            ? (trafficSources.reduce((sum, s) => sum + s.bounceRate, 0) / trafficSources.length).toFixed(1)
            : '0',
        };

    const prevTotals = showComparison && prevDailyData.length > 0
      ? calculateTotalsFromDaily(prevDailyData as any)
      : null;

    return { trafficSources, dailyData, topPages, totals, prevTotals };
  }, [records, currentRange.start, currentRange.end, previousRange.start, previousRange.end, showComparison]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('he-IL').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const calculateChange = (current: number, previous: number | undefined): { value: number; positive: boolean } | null => {
    if (!showComparison || previous === undefined || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), positive: change >= 0 };
  };

  const pieData = trafficSources
    .filter((source) => source.sessions > 0)
    .slice(0, 6)
    .map((source, index) => ({
    name: source.name.length > 20 ? source.name.substring(0, 20) + '...' : source.name,
    value: source.sessions,
    fill: COLORS[index % COLORS.length],
  }));

  const datePresetOptions = [
    { value: 'today', label: 'היום' },
    { value: 'yesterday', label: 'אתמול' },
    { value: 'last_7_days', label: '7 ימים אחרונים' },
    { value: 'last_14_days', label: '14 יום אחרונים' },
    { value: 'last_30_days', label: '30 יום אחרונים' },
    { value: 'this_month', label: 'החודש' },
    { value: 'last_month', label: 'חודש שעבר' },
    { value: 'last_90_days', label: '90 יום אחרונים' },
    { value: 'custom', label: 'בחירה ידנית' },
  ];

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>אין נתונים להצגה. לחץ על "סנכרון" כדי למשוך נתונים מ-Google Analytics.</p>
      </div>
    );
  }

  const ChangeIndicator = ({ current, previous }: { current: number; previous: number | undefined }) => {
    const change = calculateChange(current, previous);
    if (!change) return null;
    
    return (
      <div className={`flex items-center gap-1 text-xs ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
        {change.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{change.value.toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">תקופה:</Label>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {datePresetOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {datePreset === 'custom' && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {customDateRange.from && customDateRange.to ? (
                  <>
                    {format(customDateRange.from, 'dd/MM/yyyy', { locale: he })} - {format(customDateRange.to, 'dd/MM/yyyy', { locale: he })}
                  </>
                ) : (
                  'בחר תאריכים'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={customDateRange.from}
                selected={{ from: customDateRange.from, to: customDateRange.to }}
                onSelect={(range) => {
                  setCustomDateRange({ from: range?.from, to: range?.to });
                  if (range?.from && range?.to) {
                    setCalendarOpen(false);
                  }
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-2 mr-auto">
          <Switch
            id="comparison-toggle"
            checked={showComparison}
            onCheckedChange={setShowComparison}
          />
          <Label htmlFor="comparison-toggle" className="text-sm cursor-pointer">
            השוואה לתקופה קודמת
          </Label>
        </div>

        {showComparison && (
          <Badge variant="outline" className="text-xs">
            תקופה קודמת: {format(previousRange.start, 'dd/MM', { locale: he })} - {format(previousRange.end, 'dd/MM', { locale: he })}
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-9 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">משתמשים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.users)}</p>
            <ChangeIndicator current={totals.users} previous={prevTotals?.users} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">סשנים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.sessions)}</p>
            <ChangeIndicator current={totals.sessions} previous={prevTotals?.sessions} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">צפיות עמוד</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.pageviews)}</p>
            <ChangeIndicator current={totals.pageviews} previous={prevTotals?.pageviews} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-muted-foreground">משתמשים חדשים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.newUsers)}</p>
            <ChangeIndicator current={totals.newUsers} previous={prevTotals?.newUsers} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-500" />
              <span className="text-sm text-muted-foreground">המרות</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.conversions)}</p>
            <ChangeIndicator current={totals.conversions} previous={prevTotals?.conversions} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Bounce Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.avgBounceRate}%</p>
            {showComparison && prevTotals && (
              <div className={`flex items-center gap-1 text-xs ${Number(totals.avgBounceRate) <= Number(prevTotals.avgBounceRate) ? 'text-green-600' : 'text-red-600'}`}>
                {Number(totals.avgBounceRate) <= Number(prevTotals.avgBounceRate) ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                <span>{Math.abs(Number(totals.avgBounceRate) - Number(prevTotals.avgBounceRate)).toFixed(1)}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">הוספה לעגלה</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.addToCart)}</p>
            <ChangeIndicator current={totals.addToCart} previous={prevTotals?.addToCart} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">רכישות</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.purchases)}</p>
            <ChangeIndicator current={totals.purchases} previous={prevTotals?.purchases} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">שווי רכישות</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.purchaseValue)}</p>
            <ChangeIndicator current={totals.purchaseValue} previous={prevTotals?.purchaseValue} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Traffic Sources Pie Chart with Legend Below */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">התפלגות תנועה לפי מקור</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  אין נתוני מקורות תנועה לתקופה הזו
                </div>
              )}
            </div>
            {/* Legend Below */}
            {pieData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span>{entry.name}</span>
                    <span className="text-muted-foreground">({formatNumber(entry.value)})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">מגמות יומיות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="displayDate" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sessions" 
                    name="סשנים"
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    name="משתמשים"
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pageviews" 
                    name="צפיות"
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="purchases" 
                    name="רכישות"
                    stroke="hsl(var(--chart-4))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">מקורות תנועה - סשנים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficSources.slice(0, 10)} layout="vertical" margin={{ left: 150, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={140} 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  orientation="right"
                  tick={{ fill: 'currentColor', textAnchor: 'start' }}
                />
                <Tooltip 
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                />
                <Bar dataKey="sessions" name="סשנים" radius={[0, 4, 4, 0]}>
                  {trafficSources.slice(0, 10).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Traffic Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">מקורות תנועה - פירוט</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 font-medium">מקור / ערוץ</th>
                  <th className="text-center py-2 px-3 font-medium">סשנים</th>
                  <th className="text-center py-2 px-3 font-medium">משתמשים</th>
                  <th className="text-center py-2 px-3 font-medium">חדשים</th>
                  <th className="text-center py-2 px-3 font-medium">צפיות</th>
                  <th className="text-center py-2 px-3 font-medium">Bounce</th>
                  <th className="text-center py-2 px-3 font-medium">זמן ממוצע</th>
                  <th className="text-center py-2 px-3 font-medium">המרות</th>
                  <th className="text-center py-2 px-3 font-medium">הוספה לעגלה</th>
                  <th className="text-center py-2 px-3 font-medium">רכישות</th>
                  <th className="text-center py-2 px-3 font-medium">שווי רכישות</th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.map((source, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {source.name}
                      </div>
                    </td>
                    <td className="text-center py-2 px-3">{formatNumber(source.sessions)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.users)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.newUsers)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.pageviews)}</td>
                    <td className="text-center py-2 px-3">{source.bounceRate}%</td>
                    <td className="text-center py-2 px-3">{source.avgDuration}s</td>
                    <td className="text-center py-2 px-3">
                      {source.conversions > 0 && (
                        <Badge variant="secondary">{source.conversions}</Badge>
                      )}
                      {source.conversions === 0 && '-'}
                    </td>
                    <td className="text-center py-2 px-3">{formatNumber(source.addToCart)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(source.purchases)}</td>
                    <td className="text-center py-2 px-3">{formatCurrency(source.purchaseValue)}</td>
                  </tr>
                ))}
                {trafficSources.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-muted-foreground">
                      אין נתוני מקורות תנועה להצגה בטווח הנוכחי
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">עמודים מובילים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-3 font-medium">נתיב עמוד</th>
                    <th className="text-center py-2 px-3 font-medium">צפיות</th>
                    <th className="text-center py-2 px-3 font-medium">סשנים</th>
                    <th className="text-center py-2 px-3 font-medium">זמן ממוצע</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((page, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-mono text-xs max-w-[300px] truncate">{page.path}</td>
                      <td className="text-center py-2 px-3">{formatNumber(page.pageviews)}</td>
                      <td className="text-center py-2 px-3">{formatNumber(page.sessions)}</td>
                      <td className="text-center py-2 px-3">{page.avgDuration}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
