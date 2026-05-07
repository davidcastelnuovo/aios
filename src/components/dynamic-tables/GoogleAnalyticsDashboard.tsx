import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Users, Eye, MousePointerClick, Clock, TrendingUp, Globe, CalendarIcon, ArrowUp, ArrowDown, ShoppingCart, CreditCard, UserCheck, Target, Leaf, Megaphone } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { he } from "date-fns/locale";

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface GoogleAnalyticsDashboardProps {
  records: CrmRecord[];
  externalDateFilter?: string;
  externalCustomDateRange?: { from: Date | undefined; to: Date | undefined };
  tableId?: string;
  dashboardId?: string;
  defaultReportMode?: 'ecommerce' | 'leads';
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

type DateRangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'last_90_days'
  | 'last_180_days'
  | 'last_365_days'
  | 'custom';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function GoogleAnalyticsDashboard({
  records,
  externalDateFilter,
  externalCustomDateRange,
  tableId,
  dashboardId,
  defaultReportMode,
}: GoogleAnalyticsDashboardProps) {
  const mapExternalPreset = (ext?: string): DateRangePreset => {
    if (!ext) return 'last_7_days';
    const map: Record<string, DateRangePreset> = {
      'all': 'all',
      'today': 'today',
      'yesterday': 'yesterday',
      'this_week': 'this_week',
      'last_week': 'last_week',
      'last_7_days': 'last_7_days',
      'last_14_days': 'last_14_days',
      'last_30_days': 'last_30_days',
      'this_month': 'this_month',
      'last_month': 'last_month',
      'last_90_days': 'last_90_days',
      'last_180_days': 'last_180_days',
      'last_365_days': 'last_365_days',
      'custom': 'custom',
    };
    return map[ext] || 'last_7_days';
  };

  const usesExternalFilter = typeof externalDateFilter === 'string';
  const [datePreset, setDatePreset] = useState<DateRangePreset>(mapExternalPreset(externalDateFilter));
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // Sync with external date filter when it changes
  useEffect(() => {
    if (externalDateFilter) {
      setDatePreset(mapExternalPreset(externalDateFilter));
    }
  }, [externalDateFilter]);
  const [showComparison, setShowComparison] = useState(false);
  const [reportMode, setReportMode] = useState<'ecommerce' | 'leads'>(defaultReportMode || 'ecommerce');
  // Keep local mode in sync when the persisted default arrives (async parent load)
  // or when switching between dashboards/tables with different defaults.
  useEffect(() => {
    if (defaultReportMode && defaultReportMode !== reportMode) {
      setReportMode(defaultReportMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultReportMode, dashboardId, tableId]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Calculate date range based on preset.
  // STANDARD (mem://ui/date-range-calculation-standard):
  // Relative ranges (last_N_days) END YESTERDAY (today excluded — partial data),
  // matching Google Ads, GA's own "Last N days", crm-records, WooCommerceDashboard,
  // and DashboardView.wooDateRange. Absolute presets (today, this_week, this_month)
  // include today as appropriate.
  const getDateRange = (preset: DateRangePreset): { start: Date; end: Date } => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const yesterday = subDays(today, 1);
    yesterday.setHours(23, 59, 59, 999);

    switch (preset) {
      case 'all': {
        const allStart = new Date('2020-01-01');
        allStart.setHours(0, 0, 0, 0);
        return { start: allStart, end: today };
      }
      case 'today': {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return { start: todayStart, end: today };
      }
      case 'yesterday': {
        const yesterdayStart = subDays(today, 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        return { start: yesterdayStart, end: yesterday };
      }
      case 'this_week':
        return { start: startOfWeek(today, { weekStartsOn: 0 }), end: today };
      case 'last_week': {
        const prevWeekRef = subDays(today, 7);
        return {
          start: startOfWeek(prevWeekRef, { weekStartsOn: 0 }),
          end: endOfWeek(prevWeekRef, { weekStartsOn: 0 }),
        };
      }
      case 'last_7_days':
        return { start: subDays(today, 7), end: yesterday };
      case 'last_14_days':
        return { start: subDays(today, 14), end: yesterday };
      case 'last_30_days':
        return { start: subDays(today, 30), end: yesterday };
      case 'this_month':
        return { start: startOfMonth(today), end: today };
      case 'last_month': {
        const lastMonth = subMonths(today, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'last_90_days':
        return { start: subDays(today, 90), end: yesterday };
      case 'last_180_days':
        return { start: subDays(today, 180), end: yesterday };
      case 'last_365_days':
        return { start: subDays(today, 365), end: yesterday };
      case 'custom':
        if (usesExternalFilter && externalCustomDateRange?.from && externalCustomDateRange?.to) {
          return { start: externalCustomDateRange.from, end: externalCustomDateRange.to };
        }
        if (customDateRange.from && customDateRange.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return { start: subDays(today, 30), end: yesterday };
      default:
        return { start: subDays(today, 30), end: yesterday };
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

  const { trafficSources, dailyData, topPages, totals, prevTotals, trafficBreakdown, phoneCallEvents } = useMemo(() => {
    const aggregateTrafficSources = (sourceRecords: CrmRecord[]) => {
      const sourceMap = new Map<string, {
        sessions: number;
        users: number;
        newUsers: number;
        pageviews: number;
        bounceRate: number;
        bounceCount: number;
        avgDuration: number;
        conversions: number;
        addToCart: number;
        purchases: number;
        purchaseValue: number;
      }>();

      for (const r of sourceRecords) {
        const name = normalizeSourceName(
          r.data.source_medium ||
          (r.data.source && r.data.medium ? `${r.data.source} / ${r.data.medium}` : r.data.source) ||
          'Unknown'
        );

        const existing = sourceMap.get(name) || {
          sessions: 0,
          users: 0,
          newUsers: 0,
          pageviews: 0,
          bounceRate: 0,
          bounceCount: 0,
          avgDuration: 0,
          conversions: 0,
          addToCart: 0,
          purchases: 0,
          purchaseValue: 0,
        };

        existing.sessions += toNumber(r.data.sessions);
        existing.users += toNumber(r.data.users);
        existing.newUsers += toNumber(r.data.new_users);
        existing.pageviews += toNumber(r.data.pageviews);
        existing.bounceRate += toNumber(r.data.bounce_rate);
        existing.bounceCount += 1;
        existing.avgDuration += toNumber(r.data.avg_session_duration);
        existing.conversions += toNumber(r.data.conversions ?? r.data.transactions ?? r.data.purchases);
        existing.addToCart += toNumber(r.data.add_to_cart ?? r.data.add_to_carts);
        existing.purchases += toNumber(r.data.purchases ?? r.data.transactions ?? r.data.conversions);
        existing.purchaseValue += toNumber(r.data.total_revenue ?? r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue);
        sourceMap.set(name, existing);
      }

      return Array.from(sourceMap.entries())
        .map(([name, data]) => ({
          name,
          sessions: data.sessions,
          users: data.users,
          newUsers: data.newUsers,
          pageviews: data.pageviews,
          bounceRate: data.bounceCount > 0 ? data.bounceRate / data.bounceCount : 0,
          avgDuration: data.bounceCount > 0 ? data.avgDuration / data.bounceCount : 0,
          conversions: data.conversions,
          addToCart: data.addToCart,
          purchases: data.purchases,
          purchaseValue: data.purchaseValue,
        }))
        .sort((a, b) => b.sessions - a.sessions);
    };

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

    // Date-synced source rows (new schema)
    const currentDailySourceRecords = records.filter(r => {
      if (r.data.report_type !== 'daily_source') return false;
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

    // Traffic sources - aggregate from date-filtered daily records that have source info
    const legacyDailySourceRecords = currentDailyRecords.filter(r =>
      r.data.source_medium || r.data.source || r.data.medium
    );

    let trafficSources: { name: string; sessions: number; users: number; newUsers: number; pageviews: number; bounceRate: number; avgDuration: number; conversions: number; addToCart: number; purchases: number; purchaseValue: number }[];

    if (currentDailySourceRecords.length > 0) {
      trafficSources = aggregateTrafficSources(currentDailySourceRecords);
    } else if (legacyDailySourceRecords.length > 0) {
      trafficSources = aggregateTrafficSources(legacyDailySourceRecords);
    } else {
      const isAllRange = datePreset === 'all';
      trafficSources = isAllRange
        ? aggregateTrafficSources(
            records.filter(r =>
              r.data.report_type === 'traffic_source' ||
              (!r.data.report_type && (r.data.source_medium || r.data.source || r.data.medium))
            )
          )
        : [];
    }

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
        purchaseValue: toNumber(r.data.total_revenue ?? r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue),
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const prevDailyData = previousDailyRecords
      .map(r => ({
        sessions: toNumber(r.data.sessions),
        users: toNumber(r.data.users),
        pageviews: toNumber(r.data.pageviews),
        conversions: toNumber(r.data.conversions ?? r.data.transactions ?? r.data.purchases),
        addToCart: toNumber(r.data.add_to_cart ?? r.data.add_to_carts),
        purchases: toNumber(r.data.purchases ?? r.data.transactions ?? r.data.conversions),
        purchaseValue: toNumber(r.data.total_revenue ?? r.data.purchase_value ?? r.data.purchase_revenue ?? r.data.revenue),
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

    const calculateTotalsFromDaily = (data: typeof dailyData) => ({
      sessions: data.reduce((sum, d) => sum + d.sessions, 0),
      users: data.reduce((sum, d) => sum + d.users, 0),
      newUsers: 0,
      pageviews: data.reduce((sum, d) => sum + d.pageviews, 0),
      conversions: data.reduce((sum, d) => sum + d.conversions, 0),
      addToCart: data.reduce((sum, d) => sum + d.addToCart, 0),
      purchases: data.reduce((sum, d) => sum + d.purchases, 0),
      purchaseValue: data.reduce((sum, d) => sum + d.purchaseValue, 0),
      avgBounceRate: '0',
    });

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

    // Classify traffic into organic vs paid
    const classifyTraffic = (sourceName: string): 'organic' | 'paid' | 'other' => {
      const lower = sourceName.toLowerCase();
      if (lower.includes('organic') || lower.includes('אורגני')) return 'organic';
      if (lower.includes('cpc') || lower.includes('paid') || lower.includes('ppc') || lower.includes('ממומן') || lower.includes('cpm') || lower.includes('cpv') || lower.includes('display') || lower.includes('retargeting') || lower.includes('remarketing')) return 'paid';
      if (lower.includes('google') && !lower.includes('organic')) {
        if (lower.includes('cpc') || lower.includes('paid')) return 'paid';
      }
      return 'other';
    };

    // Prefer channel_group records — they match GA Traffic Acquisition exactly
    // Filter by date range so the organic/paid breakdown respects the selected period
    const channelGroupRecords = records.filter(r => {
      if (r.data.report_type !== 'channel_group') return false;
      if (!r.data.date) return false; // skip legacy records without date
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
    let organicSessions: number;
    let paidSessions: number;
    let otherSessions: number;
    let organicUsers: number;
    let paidUsers: number;
    let organicConversions: number;
    let paidConversions: number;

    if (channelGroupRecords.length > 0) {
      const cgSum = (keyword: string, field: string) =>
        channelGroupRecords
          .filter(r => String(r.data.channel_group || '').toLowerCase().includes(keyword))
          .reduce((sum, r) => sum + (Number(r.data[field]) || 0), 0);
      organicSessions = cgSum('organic search', 'sessions');
      paidSessions = cgSum('paid search', 'sessions') + cgSum('paid social', 'sessions') + cgSum('display', 'sessions');
      otherSessions = channelGroupRecords
        .filter(r => {
          const cg = String(r.data.channel_group || '').toLowerCase();
          return !cg.includes('organic search') && !cg.includes('paid search') && !cg.includes('paid social') && !cg.includes('display');
        })
        .reduce((sum, r) => sum + (Number(r.data.sessions) || 0), 0);
      organicUsers = cgSum('organic search', 'users');
      paidUsers = cgSum('paid search', 'users') + cgSum('paid social', 'users') + cgSum('display', 'users');
      // Conversions: prefer key_events (matches GA "Key events" column), fallback to conversions, then purchases
      const cgConvSum = (keyword: string) =>
        channelGroupRecords
          .filter(r => String(r.data.channel_group || '').toLowerCase().includes(keyword))
          .reduce((sum, r) => {
            const ke = Number(r.data.key_events) || 0;
            const cv = Number(r.data.conversions) || 0;
            const pu = Number(r.data.purchases) || 0;
            return sum + (ke || cv || pu);
          }, 0);
      organicConversions = cgConvSum('organic search');
      paidConversions = cgConvSum('paid search') + cgConvSum('paid social') + cgConvSum('display');
      // Other conversions (Unassigned, Direct, Referral, Email, SMS, Cross-network, etc.)
      var otherConversions = channelGroupRecords
        .filter(r => {
          const cg = String(r.data.channel_group || '').toLowerCase();
          return !cg.includes('organic search') && !cg.includes('paid search') && !cg.includes('paid social') && !cg.includes('display');
        })
        .reduce((sum, r) => {
          const ke = Number(r.data.key_events) || 0;
          const cv = Number(r.data.conversions) || 0;
          const pu = Number(r.data.purchases) || 0;
          return sum + (ke || cv || pu);
        }, 0);
    } else {
      var otherConversions = 0;
      // Fallback: classify from trafficSources (daily_source based)
      organicSessions = trafficSources.filter(s => classifyTraffic(s.name) === 'organic').reduce((sum, s) => sum + s.sessions, 0);
      paidSessions = trafficSources.filter(s => classifyTraffic(s.name) === 'paid').reduce((sum, s) => sum + s.sessions, 0);
      otherSessions = trafficSources.filter(s => classifyTraffic(s.name) === 'other').reduce((sum, s) => sum + s.sessions, 0);
      organicUsers = trafficSources.filter(s => classifyTraffic(s.name) === 'organic').reduce((sum, s) => sum + s.users, 0);
      paidUsers = trafficSources.filter(s => classifyTraffic(s.name) === 'paid').reduce((sum, s) => sum + s.users, 0);
      organicConversions = trafficSources.filter(s => classifyTraffic(s.name) === 'organic').reduce((sum, s) => sum + s.conversions, 0);
      paidConversions = trafficSources.filter(s => classifyTraffic(s.name) === 'paid').reduce((sum, s) => sum + s.conversions, 0);
    }

    const trafficBreakdown = { organicSessions, paidSessions, otherSessions, organicUsers, paidUsers, organicConversions, paidConversions, otherConversions };

    // Phone call events - always use date-filtered event_total records for accurate per-period counts
    const dateFilteredEventRecords = records.filter(r => {
      const reportType = r.data.report_type;
      if (reportType !== 'event_total') return false;
      if (!r.data.date) return true;
      try {
        const recordDate = parseISO(r.data.date);
        const start = new Date(currentRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentRange.end);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(recordDate, { start, end });
      } catch {
        return true;
      }
    });

    const eventSourceRecords = dateFilteredEventRecords;

    const phoneCallEvents: { eventName: string; total: number }[] = [];
    const phoneEventMap = new Map<string, number>();
    for (const r of eventSourceRecords) {
      const eventName = (r.data.event_name || '').toLowerCase();
      if (eventName.includes('phone') || eventName.includes('call') || eventName.includes('tel') || eventName.includes('click_to_call') || eventName.includes('maskyoo')) {
        const displayName = r.data.event_name || 'Unknown';
        const keyEvents = Number(r.data.key_events) || 0;
        const eventCount = Number(r.data.event_count) || 0;
        const count = Math.max(eventCount, keyEvents);
        phoneEventMap.set(displayName, (phoneEventMap.get(displayName) ?? 0) + count);
      }
    }
    
    for (const [eventName, total] of phoneEventMap.entries()) {
      phoneCallEvents.push({ eventName, total });
    }
    phoneCallEvents.sort((a, b) => b.total - a.total);

    return { trafficSources, dailyData, topPages, totals, prevTotals, trafficBreakdown, phoneCallEvents };
  }, [records, currentRange.start, currentRange.end, previousRange.start, previousRange.end, showComparison, datePreset]);

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
      purchaseValue: source.purchaseValue,
      fill: COLORS[index % COLORS.length],
    }));

  const datePresetOptions = [
    { value: 'all', label: 'כל התקופה' },
    { value: 'today', label: 'היום' },
    { value: 'yesterday', label: 'אתמול' },
    { value: 'this_week', label: 'השבוע' },
    { value: 'last_week', label: 'שבוע שעבר' },
    { value: 'last_7_days', label: '7 ימים אחרונים' },
    { value: 'last_14_days', label: '14 יום אחרונים' },
    { value: 'last_30_days', label: '30 יום אחרונים' },
    { value: 'this_month', label: 'החודש' },
    { value: 'last_month', label: 'חודש שעבר' },
    { value: 'last_90_days', label: '90 יום אחרונים' },
    { value: 'last_180_days', label: '6 חודשים אחרונים' },
    { value: 'last_365_days', label: 'שנה אחרונה' },
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
          {usesExternalFilter ? (
            <Badge variant="outline" className="text-xs">
              {datePresetOptions.find((option) => option.value === datePreset)?.label || '30 יום אחרונים'}
            </Badge>
          ) : (
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
          )}
        </div>

        {!usesExternalFilter && datePreset === 'custom' && (
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

        <div className="flex items-center gap-2">
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

      {/* Report Mode Toggle */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">סוג דוח:</Label>
        <ToggleGroup type="single" value={reportMode} onValueChange={(v) => { 
          if (v) {
            const newMode = v as 'ecommerce' | 'leads';
            setReportMode(newMode);
            if (tableId) {
              supabase.functions.invoke('crm-tables', {
                method: 'PATCH',
                body: { table_id: tableId, integration_settings: { default_report_mode: newMode } },
              }).catch(console.error);
            }
            if (dashboardId) {
              supabase
                .from('crm_dashboards')
                .select('settings')
                .eq('id', dashboardId)
                .single()
                .then(({ data }) => {
                  const currentSettings = (data?.settings as Record<string, unknown>) || {};
                  supabase
                    .from('crm_dashboards')
                    .update({ settings: { ...currentSettings, default_report_mode: newMode } })
                    .eq('id', dashboardId)
                    .then(() => {});
                });
            }
          }
        }}>
          <ToggleGroupItem value="ecommerce" className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <ShoppingCart className="h-4 w-4" />
            איקומרס
          </ToggleGroupItem>
          <ToggleGroupItem value="leads" className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <UserCheck className="h-4 w-4" />
            לידים
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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

        {reportMode === 'ecommerce' ? (
          <>
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
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">המרות (לידים)</span>
                </div>
                <p className="text-2xl font-bold mt-1">{formatNumber(totals.conversions)}</p>
                <ChangeIndicator current={totals.conversions} previous={prevTotals?.conversions} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">שיעור המרה</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {totals.sessions > 0 ? ((totals.conversions / totals.sessions) * 100).toFixed(2) : '0'}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">המרות למשתמש</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {totals.users > 0 ? ((totals.conversions / totals.users) * 100).toFixed(2) : '0'}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Organic vs Paid Breakdown */}
      {(trafficBreakdown.organicUsers > 0 || trafficBreakdown.paidUsers > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">אורגני מול ממומן</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Leaf className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">משתמשים אורגני</span>
                </div>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatNumber(trafficBreakdown.organicUsers)}</p>
                {totals.users > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {((trafficBreakdown.organicUsers / totals.users) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Megaphone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">משתמשים ממומן</span>
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatNumber(trafficBreakdown.paidUsers)}</p>
                {totals.users > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {((trafficBreakdown.paidUsers / totals.users) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Leaf className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">המרות אורגני</span>
                </div>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatNumber(trafficBreakdown.organicConversions)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Megaphone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">המרות ממומן</span>
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatNumber(trafficBreakdown.paidConversions)}</p>
              </div>
            </div>
            {trafficBreakdown.otherConversions > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-right">
                ℹ️ {formatNumber(trafficBreakdown.otherConversions)} המרות נוספות מסווגות תחת ערוצים אחרים (Direct, Referral, Email, Unassigned וכו') ואינן נכללות באורגני/ממומן.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      )}


      {/* Total Phone Calls */}
      {phoneCallEvents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-950/40">
                <MousePointerClick className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">📞 סה״כ שיחות טלפון מהאתר</p>
                <p className="text-3xl font-bold">
                  {formatNumber(phoneCallEvents.reduce((sum, e) => sum + e.total, 0))}
                </p>
                {phoneCallEvents.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {phoneCallEvents.map(e => `${e.eventName}: ${formatNumber(e.total)}`).join(' | ')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-lg text-sm" dir="rtl">
                            <p className="font-medium">{d.name}</p>
                            <p>סשנים: {formatNumber(d.value)}</p>
                            {d.purchaseValue > 0 && <p>שווי רכישות: {formatCurrency(d.purchaseValue)}</p>}
                          </div>
                        );
                      }}
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
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="truncate max-w-[120px]">{entry.name}</span>
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
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={false}
                  />
                  {reportMode === 'ecommerce' ? (
                    <Line 
                      type="monotone" 
                      dataKey="purchases" 
                      name="רכישות"
                      stroke="#EF4444" 
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : (
                    <Line 
                      type="monotone" 
                      dataKey="conversions" 
                      name="המרות (לידים)"
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {reportMode === 'ecommerce' ? 'מקורות תנועה - סשנים ושווי רכישות' : 'מקורות תנועה - סשנים והמרות'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficSources.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 160 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150} 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  orientation="right"
                  tick={{ fill: 'currentColor', textAnchor: 'start' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'שווי רכישות') return formatCurrency(value);
                    return formatNumber(value);
                  }}
                  contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                />
                <Bar dataKey="sessions" name="סשנים" radius={[0, 4, 4, 0]}>
                  {trafficSources.slice(0, 10).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
                {reportMode === 'ecommerce' ? (
                  <Bar dataKey="purchaseValue" name="שווי רכישות" radius={[0, 4, 4, 0]} opacity={0.6}>
                    {trafficSources.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-pv-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                ) : (
                  <Bar dataKey="conversions" name="המרות" radius={[0, 4, 4, 0]} opacity={0.6}>
                    {trafficSources.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-cv-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                )}
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
                  {reportMode === 'ecommerce' ? (
                    <>
                      <th className="text-center py-2 px-3 font-medium">הוספה לעגלה</th>
                      <th className="text-center py-2 px-3 font-medium">רכישות</th>
                      <th className="text-center py-2 px-3 font-medium">שווי רכישות</th>
                    </>
                  ) : (
                    <>
                      <th className="text-center py-2 px-3 font-medium">שיעור המרה</th>
                    </>
                  )}
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
                    <td className="text-center py-2 px-3">{Number(source.bounceRate).toFixed(1)}%</td>
                    <td className="text-center py-2 px-3">{Number(source.avgDuration).toFixed(1)}s</td>
                    <td className="text-center py-2 px-3">
                      {source.conversions > 0 ? (
                        <Badge variant="secondary">{source.conversions}</Badge>
                      ) : '-'}
                    </td>
                    {reportMode === 'ecommerce' ? (
                      <>
                        <td className="text-center py-2 px-3">{formatNumber(source.addToCart)}</td>
                        <td className="text-center py-2 px-3">{formatNumber(source.purchases)}</td>
                        <td className="text-center py-2 px-3">{formatCurrency(source.purchaseValue)}</td>
                      </>
                    ) : (
                      <>
                        <td className="text-center py-2 px-3">
                          {source.sessions > 0 ? ((source.conversions / source.sessions) * 100).toFixed(2) + '%' : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {trafficSources.length === 0 && (
                  <tr>
                    <td colSpan={reportMode === 'ecommerce' ? 11 : 9} className="text-center py-8 text-muted-foreground">
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
                      <td className="text-center py-2 px-3">{Number(page.avgDuration).toFixed(1)}s</td>
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
