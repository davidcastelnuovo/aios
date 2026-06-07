import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowRight, Facebook, ShoppingCart, FileSpreadsheet, TrendingUp, TrendingDown, Minus, RefreshCw, Building2, Globe, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";
import { AgencyDashboardContent } from "@/components/dynamic-tables/AgencyDashboardContent";
import { ShareDashboardDialog } from "@/components/dynamic-tables/ShareDashboardDialog";
import { useTenant } from "@/contexts/TenantContext";
import { GoogleAnalyticsDashboard } from "@/components/dynamic-tables/GoogleAnalyticsDashboard";
import { SeoDashboardView } from "@/components/dynamic-tables/SeoDashboardView";
import { SeoDashboardWithGa } from "@/components/dynamic-tables/SeoDashboardWithGa";
import { SeoReportTabs } from "@/components/dynamic-tables/SeoReportTabs";
import { WooCommerceDashboard } from "@/components/dynamic-tables/WooCommerceDashboard";
import { getExplicitLeadFieldsFromData, getLeadsFromData } from "@/lib/adsMetrics";
import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const DATE_FILTERS = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'this_week', label: 'השבוע' },
  { value: 'last_week', label: 'שבוע שעבר' },
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_14_days', label: '14 יום אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'last_70_days', label: '70 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
  { value: 'custom', label: 'טווח מותאם אישית' },
];

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  google_ads: { name: 'Google Ads', color: 'text-red-500', bgColor: 'bg-red-100' },
  google_analytics: { name: 'Analytics', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  google_search_console: { name: 'Search Console', color: 'text-green-500', bgColor: 'bg-green-100' },
};

type CampaignType = 'leads' | 'ecommerce';
type PlatformFilter = 'all' | 'facebook' | 'google_ads' | 'google_analytics' | 'seo' | 'woocommerce';

const getCampaignType = (integrationType?: string | null, integrationSettings?: any): CampaignType => {
  if (integrationType === 'facebook_ecommerce') return 'ecommerce';
  if (integrationType === 'google_ads') {
    return integrationSettings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  }
  // For facebook_insights, don't assume — will be determined dynamically from data
  return 'leads';
};

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;

const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getUsersFromData = (data: any) => Number(data?.users) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;

const isAdsPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(source);
const isAnalyticsPlatform = (source: string) => source === 'google_analytics';
const isFacebookPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce'].includes(source);
const normalizePlatformKey = (source: string) => isFacebookPlatform(source) ? 'facebook_insights' : source;

const matchesPlatformFilter = (integrationType: string, filter: PlatformFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'facebook') return isFacebookPlatform(integrationType);
  if (filter === 'google_ads') return integrationType === 'google_ads';
  if (filter === 'google_analytics') return isAnalyticsPlatform(integrationType);
  return true;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.round(num).toString();
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(num);

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

export default function DashboardView() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { currentTenantId } = useTenant();
  const [dateFilter, setDateFilter] = useState('last_7_days');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const customFromStr = customDateRange.from ? format(customDateRange.from, 'yyyy-MM-dd') : '';
  const customToStr = customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : '';
  const isCustomReady = dateFilter !== 'custom' || (!!customFromStr && !!customToStr);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const didSetSeoDefaultRef = useRef(false);

  // Fetch dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['crm-dashboard', dashboardId],
    queryFn: async () => {
      if (!dashboardId) throw new Error('No dashboard ID');
      const { data, error } = await supabase
        .from('crm_dashboards')
        .select('*, clients(name), agencies(name)')
        .eq('id', dashboardId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!dashboardId,
  });

  const isAgencyDashboard = (dashboard as any)?.dashboard_type === 'agency';
  const isOrganizationDashboard = (dashboard as any)?.dashboard_type === 'organization';
  const isAgencyLikeDashboard = isAgencyDashboard || isOrganizationDashboard;

  // For organization dashboards: load all agencies (own + shared cross-tenant)
  const { data: orgAgencies = [] } = useQuery({
    queryKey: ['org-dashboard-agencies', currentTenantId, isOrganizationDashboard],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data: shared } = await supabase
        .from('agency_tenant_access')
        .select('agency_id')
        .eq('accessing_tenant_id', currentTenantId);
      const sharedIds = (shared || []).map((r: any) => r.agency_id);
      let query = supabase.from('agencies').select('id, name').order('name');
      if (sharedIds.length > 0) {
        query = query.or(`tenant_id.eq.${currentTenantId},id.in.(${sharedIds.join(',')})`);
      } else {
        query = query.eq('tenant_id', currentTenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId && isOrganizationDashboard,
  });

  const [selectedOrgAgencyId, setSelectedOrgAgencyId] = useState<string>("");
  useEffect(() => {
    if (isOrganizationDashboard && !selectedOrgAgencyId && orgAgencies.length > 0) {
      setSelectedOrgAgencyId(orgAgencies[0].id);
    }
  }, [isOrganizationDashboard, orgAgencies, selectedOrgAgencyId]);

  // Fetch tables for the client
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-for-dashboard', dashboard?.client_id],
    queryFn: async () => {
      if (!dashboard?.client_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', { method: 'GET' });
      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      return allTables.filter((t: any) => t.client_id === dashboard.client_id);
    },
    enabled: !!dashboard?.client_id,
  });

  // Fetch fields for all tables (for raw table display)
  const { data: tableFields = {} } = useQuery({
    queryKey: ['crm-fields-dashboard', tables.map((t: any) => t.id).join(',')],
    queryFn: async () => {
      if (tables.length === 0) return {};
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fieldsMap: Record<string, any[]> = {};
      await Promise.all(tables.map(async (table: any) => {
        const response = await supabase.functions.invoke(`crm-fields?table_id=${table.id}`, { method: 'GET' });
        if (!response.error) {
          const fields = (response.data as any)?.fields || [];
          fieldsMap[table.id] = (fields as any[]).sort((a: any, b: any) => a.position - b.position);
        }
      }));
      return fieldsMap;
    },
    enabled: tables.length > 0,
  });

  // Fetch records from all tables
  const { data: allRecords = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['crm-records-dashboard', tables.map((t: any) => t.id).join(','), dateFilter, customFromStr, customToStr],
    queryFn: async () => {
      if (tables.length === 0) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Deduplicate Facebook tables: if both facebook_insights AND facebook_ecommerce exist,
      // skip facebook_insights to avoid double-counting spend/impressions/clicks
      const hasFbEcommerce = tables.some((t: any) => t.integration_type === 'facebook_ecommerce');
      const hasFbInsights = tables.some((t: any) => t.integration_type === 'facebook_insights');
      const skipFbInsights = hasFbEcommerce && hasFbInsights;

      const tablesToFetch = skipFbInsights
        ? tables.filter((t: any) => t.integration_type !== 'facebook_insights')
        : tables;

      const recordsPromises = tablesToFetch.map(async (table: any) => {
        const params = new URLSearchParams({ table_id: table.id, date_filter: dateFilter });
        if (dateFilter === 'custom' && customFromStr && customToStr) {
          params.set('date_from', customFromStr);
          params.set('date_to', customToStr);
        }
        const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, { method: 'GET' });
        if (response.error) {
          console.error('Error fetching records for table', table.id, response.error);
          return [];
        }
        const records = Array.isArray(response.data) ? response.data : [];
        return records.map((r: any) => ({
          ...r,
          _source: table.integration_type,
          _tableName: table.name,
          _tableId: table.id,
          _integrationType: table.integration_type,
          _campaignType: getCampaignType(table.integration_type, table.integration_settings),
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0 && isCustomReady,
  });

  // Check if client has SEO (Ahrefs) reports
  const { data: hasSeoReports = false } = useQuery({
    queryKey: ['has-seo-reports', dashboard?.client_id],
    queryFn: async () => {
      if (!dashboard?.client_id || !currentTenantId) return false;
      const { count, error } = await supabase
        .from('ahrefs_reports')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', dashboard.client_id)
        .eq('tenant_id', currentTenantId)
        .limit(1);
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!dashboard?.client_id && !!currentTenantId,
  });

  // SEO clients default to "last 30 days" (monthly SEO reports)
  useEffect(() => {
    if (didSetSeoDefaultRef.current) return;
    if (hasSeoReports) {
      setDateFilter('last_30_days');
      didSetSeoDefaultRef.current = true;
    }
  }, [hasSeoReports]);


  const { data: hasWooCommerce = false } = useQuery({
    queryKey: ['has-woocommerce', dashboard?.client_id, currentTenantId],
    queryFn: async () => {
      if (!dashboard?.client_id || !currentTenantId) return false;
      const { count, error } = await (supabase
        .from('social_media_wordpress_sites' as any)
        .select('id', { count: 'exact', head: true })
        .eq('client_id', dashboard.client_id)
        .eq('tenant_id', currentTenantId)
        .eq('woocommerce_enabled', true)
        .eq('is_active', true)
        .limit(1));
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!dashboard?.client_id && !!currentTenantId,
  });

  // WooCommerce summary range — UTC boundaries to match Woo admin & WooCommerceDashboard.
  // last_7_days = most recent COMPLETED Sunday→Saturday week (UTC).
  // Other relative ranges end YESTERDAY (UTC).
  const wooDateRange = useMemo(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    let start = new Date(Date.UTC(y, m, d - 1, 0, 0, 0, 0));
    let end = new Date(Date.UTC(y, m, d - 1, 23, 59, 59, 999));
    switch (dateFilter) {
      case 'today':
        start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
        break;
      case 'yesterday':
        break;
      case 'last_7_days': {
        const yesterday = new Date(Date.UTC(y, m, d - 1));
        const dow = yesterday.getUTCDay();
        const daysSinceSat = (dow + 1) % 7;
        const sat = new Date(Date.UTC(y, m, d - 1 - daysSinceSat, 23, 59, 59, 999));
        const sun = new Date(Date.UTC(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate() - 6, 0, 0, 0, 0));
        start = sun; end = sat;
        break;
      }
      case 'last_14_days': start = new Date(Date.UTC(y, m, d - 14, 0, 0, 0, 0)); break;
      case 'last_30_days': start = new Date(Date.UTC(y, m, d - 30, 0, 0, 0, 0)); break;
      case 'last_70_days': start = new Date(Date.UTC(y, m, d - 70, 0, 0, 0, 0)); break;
      case 'this_week': {
        // Week starts Sunday (locale: he)
        const dow = now.getUTCDay(); // 0=Sun..6=Sat
        start = new Date(Date.UTC(y, m, d - dow, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
        break;
      }
      case 'last_week': {
        const dow = now.getUTCDay();
        const lastSun = new Date(Date.UTC(y, m, d - dow - 7, 0, 0, 0, 0));
        const lastSat = new Date(Date.UTC(y, m, d - dow - 1, 23, 59, 59, 999));
        start = lastSun; end = lastSat;
        break;
      }
      case 'this_month':
        start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
        break;
      case 'last_month':
        start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        break;
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          start = new Date(Date.UTC(
            customDateRange.from.getFullYear(), customDateRange.from.getMonth(), customDateRange.from.getDate(),
            0, 0, 0, 0
          ));
          end = new Date(Date.UTC(
            customDateRange.to.getFullYear(), customDateRange.to.getMonth(), customDateRange.to.getDate(),
            23, 59, 59, 999
          ));
        }
        break;
      default: start = new Date(Date.UTC(y, m, d - 7, 0, 0, 0, 0));
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateFilter, customDateRange.from, customDateRange.to]);

  const { data: wooSummary = { revenue: 0, orders: 0 } } = useQuery({
    queryKey: ['woo-summary-for-totals', dashboard?.client_id, currentTenantId, dateFilter, customFromStr, customToStr],
    queryFn: async () => {
      if (!dashboard?.client_id || !currentTenantId) return { revenue: 0, orders: 0 };
      const { data: sites } = await (supabase
        .from('social_media_wordpress_sites' as any)
        .select('id')
        .eq('client_id', dashboard.client_id)
        .eq('tenant_id', currentTenantId)
        .eq('woocommerce_enabled', true)
        .eq('is_active', true));
      const siteIds = (sites as any[] || []).map((s: any) => s.id);
      if (siteIds.length === 0) return { revenue: 0, orders: 0 };
      const { data: orders } = await (supabase
        .from('woocommerce_orders' as any)
        .select('total, status')
        .in('site_id', siteIds)
        .gte('date_created', wooDateRange.start)
        .lte('date_created', wooDateRange.end)
        .limit(5000));
      const validStatuses = ['completed', 'processing', 'on-hold'];
      const valid = ((orders as any[]) || []).filter((o: any) => validStatuses.includes(o.status));
      const revenue = valid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      return { revenue, orders: valid.length };
    },
    enabled: !!dashboard?.client_id && !!currentTenantId && hasWooCommerce,
  });

  // Available platforms for tab rendering
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t: any) => {
      if (t.integration_type) set.add(t.integration_type);
    });
    const platforms: PlatformFilter[] = [];
    if (set.has('facebook_insights') || set.has('facebook_ecommerce')) platforms.push('facebook');
    if (set.has('google_ads')) platforms.push('google_ads');
    if (set.has('google_analytics')) platforms.push('google_analytics');
    if (hasSeoReports) platforms.push('seo');
    if (hasWooCommerce) platforms.push('woocommerce');
    return platforms;
  }, [tables, hasSeoReports, hasWooCommerce]);

  // Filter records by platform tab AND only use daily aggregate records for Analytics
  // IMPORTANT: Use only report_type='daily' for aggregation (KPI, charts).
  // report_type='daily_source' breaks down by traffic source and would cause double-counting.
  const filteredRecords = useMemo(() => {
    return allRecords.filter((record: any) => {
      const source = record._source || 'unknown';
      // Platform filter
      if (!matchesPlatformFilter(source, platformFilter)) return false;
      // For Analytics: only use 'daily' records for accurate totals
      if (isAnalyticsPlatform(source)) {
        const data = record.data || {};
        // Only include report_type='daily' (aggregate per day)
        // Exclude: traffic_source (no date), daily_source (per-source breakdown = double counting), top_pages
        if (data.report_type !== 'daily') return false;
      }
      return true;
    });
  }, [allRecords, platformFilter]);

  // All analytics records (unfiltered by report_type) for GoogleAnalyticsDashboard component
  const allAnalyticsRecords = useMemo(() => {
    return allRecords
      .filter((r: any) => isAnalyticsPlatform(r._source || ''))
      .map((r: any) => ({ id: r.id, data: r.data }));
  }, [allRecords]);


  const campaignTypeByPlatform: Record<string, CampaignType> = useMemo(() => {
    const map: Record<string, CampaignType> = {};
    // Track platforms where the user explicitly set campaign_type — those should NOT be auto-overridden
    const explicitlySet = new Set<string>();
    // First set defaults from table settings
    tables.forEach((t: any) => {
      const key = t?.integration_type || 'unknown';
      const explicitType = t?.integration_settings?.campaign_type;
      if (explicitType === 'leads' || explicitType === 'ecommerce') {
        map[key] = explicitType;
        explicitlySet.add(key);
        return;
      }
      const ct = getCampaignType(t?.integration_type, t?.integration_settings);
      if (ct === 'ecommerce') map[key] = 'ecommerce';
    });
    // Then override by scanning actual data for ecommerce signals — but ONLY for platforms not explicitly set by user
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (explicitlySet.has(source)) return; // user explicitly chose — don't override
      if (map[source] === 'ecommerce') return; // already detected
      const d = record.data || {};
      if (Number(d.purchases) > 0 || Number(d.purchase_value) > 0 || Number(d.add_to_cart) > 0 ||
          String(d.campaign_type || '').toLowerCase() === 'ecommerce') {
        map[source] = 'ecommerce';
      }
    });
    // Default remaining to leads
    tables.forEach((t: any) => {
      const key = t?.integration_type || 'unknown';
      if (!map[key]) map[key] = 'leads';
    });
    return map;
  }, [tables, allRecords]);

  const dashboardCampaignType: CampaignType = useMemo(() => {
    const types = Object.values(campaignTypeByPlatform);
    return types.some((t) => t === 'ecommerce') ? 'ecommerce' : 'leads';
  }, [campaignTypeByPlatform]);

  // Calculate summary metrics by platform (using filtered records)
  const summaryByPlatform = useMemo(() => {
    const platforms: Record<string, any> = {};
    
    filteredRecords.forEach((record: any) => {
      const rawSource = record._source || 'unknown';
      const source = normalizePlatformKey(rawSource);
      if (!platforms[source]) {
        platforms[source] = { spend: 0, impressions: 0, clicks: 0, sessions: 0, users: 0, results: 0, leads: 0, revenue: 0, addToCart: 0, roas: 0, cpl: 0, recordCount: 0 };
      }
      
      const data = record.data || {};
      const campaignType: CampaignType = campaignTypeByPlatform[rawSource] || campaignTypeByPlatform[source] || record._campaignType || 'leads';

      if (isAnalyticsPlatform(source)) {
        platforms[source].sessions += getSessionsFromData(data);
        platforms[source].users += getUsersFromData(data);
        platforms[source].results += getPurchasesFromData(data);
        platforms[source].revenue += getRevenueFromData(data);
        platforms[source].addToCart += getAddToCartFromData(data);
      } else {
        platforms[source].spend += getSpendFromData(data);
        platforms[source].impressions += Number(data.impressions) || 0;
        platforms[source].clicks += Number(data.clicks) || 0;
        if (campaignType === 'ecommerce') {
          platforms[source].results += getPurchasesFromData(data);
          platforms[source].revenue += getRevenueFromData(data);
          // Only count explicit lead fields for ecommerce (not conversions which are purchases)
          platforms[source].leads += getExplicitLeadFieldsFromData(data);
        } else {
          const leads = getLeadsFromData(data);
          platforms[source].leads += leads;
          platforms[source].results += leads;
        }
      }
      platforms[source].recordCount += 1;
    });

    Object.keys(platforms).forEach(key => {
      if (isAnalyticsPlatform(key)) return;
      // For merged Facebook platform, check if any Facebook type was ecommerce
      const ct: CampaignType = isFacebookPlatform(key)
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

  // Calculate total ads spend from ALL records (regardless of platform filter)
  // This ensures Analytics tab can still show spend and ROAS
  const globalAdsMetrics = useMemo(() => {
    let spend = 0, impressions = 0;
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (isAdsPlatform(source)) {
        const data = record.data || {};
        if (data.report_type && data.report_type !== 'daily') return;
        spend += getSpendFromData(data);
        impressions += Number(data.impressions) || 0;
      }
    });
    return { spend, impressions };
  }, [allRecords]);

  // Total summary
  const totalSummary = useMemo(() => {
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0, totalLeads = 0;
    let adsSpend = 0, analyticsRevenue = 0, analyticsPurchases = 0, analyticsAddToCart = 0, analyticsSessions = 0, analyticsUsers = 0;

    Object.entries(summaryByPlatform).forEach(([platform, data]: [string, any]) => {
      if (isAnalyticsPlatform(platform)) {
        analyticsRevenue += data.revenue;
        analyticsPurchases += data.results;
        analyticsAddToCart += data.addToCart;
        analyticsSessions += data.sessions;
        analyticsUsers += data.users || 0;
      } else if (isAdsPlatform(platform)) {
        totalSpend += data.spend;
        totalImpressions += data.impressions;
        totalClicks += data.clicks;
        totalResults += data.results;
        totalLeads += data.leads || 0;
        adsSpend += data.spend;
      }
    });

    // When on Analytics tab, ads platforms are filtered out, so use globalAdsMetrics
    const effectiveSpend = totalSpend > 0 ? totalSpend : globalAdsMetrics.spend;
    const effectiveAdsSpend = adsSpend > 0 ? adsSpend : globalAdsMetrics.spend;
    const effectiveImpressions = totalImpressions > 0 ? totalImpressions : globalAdsMetrics.impressions;

    // WooCommerce is the source of truth for revenue when available.
    // GA revenue is shown as informational only and NOT summed with Woo.
    const wooRev = wooSummary.revenue || 0;
    const bottomLineRevenue = wooRev > 0 ? wooRev : analyticsRevenue;

    return {
      spend: effectiveSpend, impressions: effectiveImpressions, clicks: totalClicks, results: totalResults, leads: totalLeads,
      revenue: bottomLineRevenue,
      revenueAnalytics: analyticsRevenue,
      revenueWoo: wooRev,
      ordersWoo: wooSummary.orders || 0,
      roas_spend: effectiveAdsSpend,
      roas_value: bottomLineRevenue,
      analyticsPurchases, analyticsAddToCart, analyticsSessions, analyticsUsers,
    };
  }, [summaryByPlatform, globalAdsMetrics, wooSummary]);

  const combinedRoas = totalSummary.roas_spend > 0 ? totalSummary.roas_value / totalSummary.roas_spend : 0;
  const combinedCpl = totalSummary.results > 0 ? totalSummary.spend / totalSummary.results : 0;

  // Analytics source breakdown - aggregated by channel category
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
    allRecords.forEach((record: any) => {
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
  }, [allRecords]);

  // Traffic Acquisition by Channel Group
  const channelGroupBreakdown = useMemo(() => {
    const channels: Record<string, { sessions: number; engagedSessions: number; engagementRate: number; avgDuration: number; eventsPerSession: number; users: number; purchases: number; revenue: number; rateSum: number; durationSum: number; eventsSum: number; count: number }> = {};
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAnalyticsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type !== 'channel_group') return;
      
      const ch = data.channel_group || 'Unknown';
      if (!channels[ch]) channels[ch] = { sessions: 0, engagedSessions: 0, engagementRate: 0, avgDuration: 0, eventsPerSession: 0, users: 0, purchases: 0, revenue: 0, rateSum: 0, durationSum: 0, eventsSum: 0, count: 0 };
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
  }, [allRecords]);

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

  // Campaign breakdown for "All" tab summary
  const campaignBreakdown = useMemo(() => {
    if (platformFilter !== 'all') return [];
    
    const campaigns: Record<string, { campaign: string; spend: number; impressions: number; clicks: number; leads: number; revenue: number; purchases: number }> = {};
    
    allRecords.forEach((record: any) => {
      const source = record._source || 'unknown';
      if (!isAdsPlatform(source)) return;
      const data = record.data || {};
      if (data.report_type && data.report_type !== 'daily') return;
      const campaignName = data.campaign_name || data.campaign || 'ללא שם קמפיין';
      
      if (!campaigns[campaignName]) {
        campaigns[campaignName] = { campaign: campaignName, spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, purchases: 0 };
      }
      
      campaigns[campaignName].spend += getSpendFromData(data);
      campaigns[campaignName].impressions += Number(data.impressions) || 0;
      campaigns[campaignName].clicks += Number(data.clicks) || Number(data.link_clicks) || 0;
      campaigns[campaignName].leads += getLeadsFromData(data);
      campaigns[campaignName].revenue += getRevenueFromData(data);
      campaigns[campaignName].purchases += getPurchasesFromData(data);
    });
    
    return Object.values(campaigns).sort((a, b) => b.spend - a.spend);
  }, [allRecords, platformFilter]);

  const campaignTotals = useMemo(() => {
    return campaignBreakdown.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      leads: acc.leads + c.leads,
      revenue: acc.revenue + c.revenue,
      purchases: acc.purchases + c.purchases,
    }), { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, purchases: 0 });
  }, [campaignBreakdown]);

  // Get raw records and fields for platform-specific tabs
  const platformRawData = useMemo(() => {
    if (platformFilter === 'all') return { records: [], fields: [], tableIds: [] };
    
    // Find matching tables
    const matchingTables = tables.filter((t: any) => {
      if (platformFilter === 'facebook') return isFacebookPlatform(t.integration_type);
      if (platformFilter === 'google_ads') return t.integration_type === 'google_ads';
      if (platformFilter === 'google_analytics') return t.integration_type === 'google_analytics';
      return false;
    });
    
    const tableIds = matchingTables.map((t: any) => t.id);
    
    // Combine fields from matching tables (dedup by key)
    const fieldsMap = new Map<string, any>();
    matchingTables.forEach((t: any) => {
      const fields = tableFields[t.id] || [];
      fields.forEach((f: any) => {
        if (!fieldsMap.has(f.key)) {
          fieldsMap.set(f.key, f);
        }
      });
    });
    const fields = Array.from(fieldsMap.values()).sort((a: any, b: any) => a.position - b.position);
    
    // Get matching records
    const records = allRecords.filter((r: any) => tableIds.includes(r._tableId));
    
    return { records, fields, tableIds };
  }, [platformFilter, tables, tableFields, allRecords]);

  // Facebook campaign summary - aggregate all Facebook records by campaign name
  const facebookCampaignSummary = useMemo(() => {
    if (platformFilter !== 'facebook') return [];
    const map: Record<string, { name: string; impressions: number; clicks: number; spend: number; addToCart: number; purchases: number; revenue: number }> = {};
    
    const fbRecords = allRecords.filter((r: any) => isFacebookPlatform(r._source || ''));
    fbRecords.forEach((r: any) => {
      const d = r.data || {};
      const name = d.campaign_name || d.campaign || 'ללא שם';
      if (!map[name]) {
        map[name] = { name, impressions: 0, clicks: 0, spend: 0, addToCart: 0, purchases: 0, revenue: 0 };
      }
      map[name].impressions += Number(d.impressions) || 0;
      map[name].clicks += Number(d.clicks) || 0;
      map[name].spend += getSpendFromData(d);
      map[name].addToCart += getAddToCartFromData(d);
      map[name].purchases += getPurchasesFromData(d);
      map[name].revenue += getRevenueFromData(d);
    });
    
    return Object.values(map).sort((a, b) => b.spend - a.spend);
  }, [platformFilter, allRecords]);

  // Google Ads campaign summary - aggregate all Google Ads records by campaign name
  const googleAdsCampaignSummary = useMemo(() => {
    if (platformFilter !== 'google_ads') return [];
    const map: Record<string, {
      name: string;
      campaign_id: string;
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
      conversions_value: number;
    }> = {};

    const gaRecords = allRecords.filter((r: any) => r._source === 'google_ads');
    gaRecords.forEach((r: any) => {
      const d = r.data || {};
      const name = d.campaign_name || 'ללא שם';
      const key = String(d.campaign_id || name);
      if (!map[key]) {
        map[key] = {
          name,
          campaign_id: String(d.campaign_id || ''),
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          conversions_value: 0,
        };
      }
      map[key].impressions += Number(d.impressions) || 0;
      map[key].clicks += Number(d.clicks) || 0;
      map[key].spend += Number(d.cost) || Number(d.spend) || 0;
      map[key].conversions += Number(d.conversions) || 0;
      map[key].conversions_value += Number(d.conversions_value) || 0;
    });

    return Object.values(map).sort((a, b) => b.spend - a.spend);
  }, [platformFilter, allRecords]);

  // Google Ads totals (KPI cards)
  const googleAdsTotals = useMemo(() => {
    return googleAdsCampaignSummary.reduce(
      (acc, c) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        spend: acc.spend + c.spend,
        conversions: acc.conversions + c.conversions,
        conversions_value: acc.conversions_value + c.conversions_value,
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversions_value: 0 }
    );
  }, [googleAdsCampaignSummary]);

  // Google Ads campaign type — driven strictly by table integration_settings.campaign_type.
  // If any associated Google Ads table is set to 'ecommerce', treat the whole tab as ecommerce.
  const googleAdsCampaignType: 'leads' | 'ecommerce' = useMemo(() => {
    const gaTables = (tables || []).filter((t: any) => t.integration_type === 'google_ads');
    if (gaTables.some((t: any) => t.integration_settings?.campaign_type === 'ecommerce')) {
      return 'ecommerce';
    }
    return 'leads';
  }, [tables]);

  // Group records by date for table
  const recordsByDate = useMemo(() => {
    const byDate: Record<string, any[]> = {};
    filteredRecords.forEach((record: any) => {
      const date = record.data?.date || 'unknown';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(record);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 30);
  }, [filteredRecords]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const syncToast = toast.loading('מסנכרן נתונים מכל המקורות...');
    try {
      // Compute date range for analytics-style syncs (GA / GSC).
      // ALWAYS sync at least the last 90 days (regardless of display filter)
      // so switching the dashboard to a short window doesn't wipe history.
      const computeRange = () => {
        const now = new Date();
        const end = new Date(now);
        const MIN_SYNC_DAYS = 90;
        const start = new Date(now);
        let days = MIN_SYNC_DAYS;
        switch (dateFilter) {
          case 'last_70_days': days = Math.max(70, MIN_SYNC_DAYS); break;
          case 'last_90_days': days = Math.max(90, MIN_SYNC_DAYS); break;
          case 'last_180_days': days = 180; break;
          case 'last_365_days': days = 365; break;
          // All shorter ranges still pull MIN_SYNC_DAYS to preserve history.
          default: days = MIN_SYNC_DAYS;
        }
        start.setDate(start.getDate() - days);
        return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
      };
      const { startDate, endDate } = computeRange();

      // Build a sync task per table based on integration_type
      const tableTasks = (tables as any[]).map((t: any) => {
        switch (t.integration_type) {
          case 'facebook_insights':
            return { label: 'Facebook', promise: supabase.functions.invoke('sync-facebook-insights', { method: 'POST', body: { table_id: t.id } }) };
          case 'facebook_ecommerce':
            return { label: 'Facebook Ecom', promise: supabase.functions.invoke('sync-facebook-ecommerce', { method: 'POST', body: { table_id: t.id } }) };
          case 'google_ads':
            return { label: 'Google Ads', promise: supabase.functions.invoke('sync-google-ads-data', { method: 'POST', body: { table_id: t.id } }) };
          case 'google_analytics':
            return { label: 'Google Analytics', promise: supabase.functions.invoke('sync-google-analytics-data', { method: 'POST', body: { tableId: t.id, startDate, endDate } }) };
          case 'google_search_console':
            return { label: 'Search Console', promise: supabase.functions.invoke('sync-google-search-console-data', { method: 'POST', body: { tableId: t.id, startDate, endDate } }) };
          default:
            return null;
        }
      }).filter(Boolean) as { label: string; promise: Promise<any> }[];

      // Fetch WooCommerce sites for this client and sync each
      const wooTasks: { label: string; promise: Promise<any> }[] = [];
      if (dashboard?.client_id && currentTenantId) {
        const { data: sites } = await supabase
          .from('social_media_wordpress_sites' as any)
          .select('id, site_name')
          .eq('client_id', dashboard.client_id)
          .eq('tenant_id', currentTenantId)
          .eq('woocommerce_enabled', true)
          .eq('is_active', true);
        ((sites as any[]) || []).forEach((s: any) => {
          wooTasks.push({
            label: `WooCommerce (${s.site_name})`,
            promise: supabase.functions.invoke('sync-woocommerce-data', { body: { site_id: s.id } }),
          });
        });
      }

      const allTasks = [...tableTasks, ...wooTasks];

      if (allTasks.length === 0) {
        await refetchRecords();
        toast.success('הנתונים רועננו', { id: syncToast });
        return;
      }

      const results = await Promise.allSettled(allTasks.map(t => t.promise));
      const failed: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any)?.error)) {
          failed.push(allTasks[i].label);
        }
      });

      // Reload data from DB
      await refetchRecords();

      if (failed.length === 0) {
        toast.success(`סונכרנו ${allTasks.length} מקורות נתונים בהצלחה`, { id: syncToast });
      } else {
        toast.warning(`סונכרנו ${allTasks.length - failed.length}/${allTasks.length}. נכשלו: ${failed.join(', ')}`, { id: syncToast });
      }
    } catch (error: any) {
      toast.error('שגיאה ברענון: ' + (error?.message || 'שגיאה לא ידועה'), { id: syncToast });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (dashboardLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">הדשבורד לא נמצא</h3>
          <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לניהול דוחות
          </Button>
        </Card>
      </div>
    );
  }

  // Detect if there's actual Analytics data (any GA records present)
  const hasAnalyticsData = allRecords.some((r: any) => isAnalyticsPlatform(r._source));
  const showAnalyticsCards = (platformFilter === 'all' || platformFilter === 'google_analytics') && hasAnalyticsData;
  const showAdsCards = platformFilter === 'all' || platformFilter === 'facebook' || platformFilter === 'google_ads';

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath('/dynamic-tables'))} className="mb-2">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{dashboard.name}</h1>
            {isAgencyDashboard && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                דשבורד סוכנות
              </Badge>
            )}
            {isOrganizationDashboard && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                דשבורד ארגון
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            {isAgencyDashboard ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>{(dashboard as any).agencies?.name}</span>
              </>
            ) : isOrganizationDashboard ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>{orgAgencies.length} סוכנויות</span>
              </>
            ) : (
              <>
                <span>{(dashboard as any).clients?.name}</span>
                {(dashboard as any).agencies?.name && (
                  <>
                    <span>•</span>
                    <span>{(dashboard as any).agencies?.name}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOrganizationDashboard && (
            <Select value={selectedOrgAgencyId} onValueChange={setSelectedOrgAgencyId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="בחר סוכנות" />
              </SelectTrigger>
              <SelectContent>
                {orgAgencies.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isAgencyLikeDashboard && currentTenantId && (
            <ShareDashboardDialog dashboardId={dashboardId!} dashboardName={dashboard.name} tenantId={currentTenantId} />
          )}
          {!isAgencyLikeDashboard && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`ml-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              רענן נתונים
            </Button>
          )}
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); if (v === 'custom') setCalendarOpen(true); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dateFilter === 'custom' && (
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
                  onSelect={(range: any) => {
                    setCustomDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) setCalendarOpen(false);
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Agency / Organization Dashboard Content */}
      {isAgencyDashboard ? (
        <AgencyDashboardContent
          agencyId={dashboard.agency_id!}
          agencyName={(dashboard as any).agencies?.name || ''}
          dateFilter={dateFilter}
          customFrom={customFromStr}
          customTo={customToStr}
        />
      ) : isOrganizationDashboard ? (
        selectedOrgAgencyId ? (
          <AgencyDashboardContent
            key={selectedOrgAgencyId}
            agencyId={selectedOrgAgencyId}
            agencyName={orgAgencies.find((a: any) => a.id === selectedOrgAgencyId)?.name || ''}
            dateFilter={dateFilter}
            customFrom={customFromStr}
            customTo={customToStr}
          />
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            לא נמצאו סוכנויות בארגון
          </Card>
        )
      ) : (
        <>
          {/* Platform Tabs */}
          {availablePlatforms.length > 0 && (
            <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  📊 הכל
                </TabsTrigger>
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
                {availablePlatforms.includes('seo') && (
                  <TabsTrigger value="seo" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-green-600" />
                    SEO
                  </TabsTrigger>
                )}
                {availablePlatforms.includes('woocommerce') && (
                  <TabsTrigger value="woocommerce" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    WooCommerce
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          )}

          {tablesLoading || recordsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : platformFilter === 'woocommerce' ? (
            /* WooCommerce tab */
            dashboard?.client_id && currentTenantId ? (
              <WooCommerceDashboard clientId={dashboard.client_id} tenantId={currentTenantId} dateFilter={dateFilter} customFrom={customFromStr} customTo={customToStr} />
            ) : null
          ) : tables.length === 0 ? (
            <Card className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">אין טבלאות משויכות ללקוח זה</h3>
              <p className="text-muted-foreground mb-4">צור טבלאות ושייך אותן ללקוח כדי לראות נתונים בדשבורד</p>
              <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>עבור לניהול דוחות</Button>
            </Card>
          ) : platformFilter === 'seo' ? (
            /* SEO tab: render full SEO report with Ahrefs + GSC + Analytics tabs.
               Pass clientId only — SeoReportTabs resolves the cross-tenant scope itself
               via useSeoScope, so shared-agency clients (e.g. YTS) load correctly
               regardless of which tenant the user opened the dashboard from. */
            dashboard?.client_id ? (
              <SeoReportTabs clientId={dashboard.client_id} />
            ) : null
          ) : platformFilter === 'google_analytics' ? (
            /* Analytics tab: render the same GoogleAnalyticsDashboard used in standalone table view */
            <GoogleAnalyticsDashboard
              records={allAnalyticsRecords}
              externalDateFilter={dateFilter}
              dashboardId={dashboardId}
              defaultReportMode={(dashboard?.settings as any)?.default_report_mode}
            />
          ) : (
            <>
              {/* Summary Cards - only show in All and Analytics tabs */}
              {(platformFilter === 'all') && (
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
                          <p className="text-sm text-muted-foreground">
                            {totalSummary.revenueWoo > 0 ? 'הכנסות (WooCommerce)' : 'הכנסות (Analytics)'}
                          </p>
                          <p className="text-3xl font-bold mt-2">{formatCurrency(totalSummary.revenue)}</p>
                          {totalSummary.revenueWoo > 0 && totalSummary.revenueAnalytics > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              להשוואה · GA מדווח: {formatCurrency(totalSummary.revenueAnalytics)}
                            </p>
                          )}
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
                              {isEcom && (
                                <>
                                  <TableHead className="text-right">הוספות לעגלה</TableHead>
                                  <TableHead className="text-right">רכישות</TableHead>
                                  <TableHead className="text-right">ערך רכישות</TableHead>
                                  <TableHead className="text-right">ROAS</TableHead>
                                </>
                              )}
                              {!isEcom && (
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
                              const leads = allRecords
                                .filter((r: any) => isFacebookPlatform(r._source || '') && (r.data?.campaign_name === c.name || r.data?.campaign === c.name))
                                .reduce((sum: number, r: any) => sum + getLeadsFromData(r.data || {}), 0);
                              const cpl = leads > 0 ? c.spend / leads : 0;

                              return (
                                <TableRow key={i}>
                                  <TableCell className="font-medium max-w-[300px]">{c.name}</TableCell>
                                  <TableCell>{formatNumber(c.impressions)}</TableCell>
                                  <TableCell>{formatNumber(c.clicks)}</TableCell>
                                  <TableCell>{formatCurrency(c.spend)}</TableCell>
                                  {isEcom && (
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
                                  )}
                                  {!isEcom && (
                                    <>
                                      <TableCell className={leads > 0 ? 'text-green-600 font-medium' : ''}>{formatNumber(leads)}</TableCell>
                                      <TableCell>{cpl > 0 ? formatCurrency(cpl) : '-'}</TableCell>
                                    </>
                                  )}
                                </TableRow>
                              );
                            })}
                            {/* Totals row */}
                            <TableRow className="bg-muted/50 font-bold border-t-2">
                              <TableCell>סה"כ</TableCell>
                              <TableCell>{formatNumber(totals.impressions)}</TableCell>
                              <TableCell>{formatNumber(totals.clicks)}</TableCell>
                              <TableCell>{formatCurrency(totals.spend)}</TableCell>
                              {isEcom && (
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
                              )}
                              {!isEcom && (() => {
                                const totalLeads = facebookCampaignSummary.reduce((sum, c) => {
                                  return sum + allRecords
                                    .filter((r: any) => isFacebookPlatform(r._source || '') && (r.data?.campaign_name === c.name || r.data?.campaign === c.name))
                                    .reduce((leadSum: number, r: any) => leadSum + getLeadsFromData(r.data || {}), 0);
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
                      <p className="text-xs text-muted-foreground mt-3 px-1">
                        * נתוני רכישות וערך רכישות מבוססים על דיווח פייסבוק (כולל ייחוס צפייה וחלון 7 ימים), ועשויים להיות גבוהים מנתוני Analytics בשל ספירה כפולה בין קמפיינים. ה-ROAS הכללי בשורת הסה"כ של הדשבורד מחושב לפי הכנסות Analytics בלבד.
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Google Ads Campaign Summary (KPIs + per-campaign aggregation) */}
              {platformFilter === 'google_ads' && (
                <>
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 auto-rows-fr">
                    <Card className="h-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                      <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-muted-foreground">הוצאה כוללת</p>
                        <p className="text-3xl font-bold mt-2">{formatCurrency(googleAdsTotals.spend)}</p>
                      </CardContent>
                    </Card>
                    <Card className="h-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                      <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-muted-foreground">חשיפות</p>
                        <p className="text-3xl font-bold mt-2">{formatNumber(googleAdsTotals.impressions)}</p>
                      </CardContent>
                    </Card>
                    <Card className="h-full bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
                      <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-muted-foreground">קליקים</p>
                        <p className="text-3xl font-bold mt-2">{formatNumber(googleAdsTotals.clicks)}</p>
                      </CardContent>
                    </Card>
                    {googleAdsCampaignType === 'ecommerce' ? (
                      <>
                        <Card className="h-full bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                          <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <p className="text-sm text-muted-foreground">רכישות</p>
                            <p className="text-3xl font-bold mt-2">{formatNumber(googleAdsTotals.conversions)}</p>
                          </CardContent>
                        </Card>
                        <Card className="h-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                          <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <p className="text-sm text-muted-foreground">הכנסות</p>
                            <p className="text-3xl font-bold mt-2">{formatCurrency(googleAdsTotals.conversions_value)}</p>
                          </CardContent>
                        </Card>
                        <Card className="h-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
                          <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <p className="text-sm text-muted-foreground">ROAS</p>
                            <p className="text-3xl font-bold mt-2">
                              {googleAdsTotals.spend > 0
                                ? (googleAdsTotals.conversions_value / googleAdsTotals.spend).toFixed(2)
                                : '-'}
                            </p>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <>
                        <Card className="h-full bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                          <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <p className="text-sm text-muted-foreground">המרות</p>
                            <p className="text-3xl font-bold mt-2">{formatNumber(googleAdsTotals.conversions)}</p>
                          </CardContent>
                        </Card>
                        <Card className="h-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
                          <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <p className="text-sm text-muted-foreground">עלות להמרה</p>
                            <p className="text-3xl font-bold mt-2">
                              {googleAdsTotals.conversions > 0
                                ? formatCurrency(googleAdsTotals.spend / googleAdsTotals.conversions)
                                : '-'}
                            </p>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>

                  {googleAdsCampaignSummary.length > 0 && (() => {
                    const totalCtr = googleAdsTotals.impressions > 0
                      ? (googleAdsTotals.clicks / googleAdsTotals.impressions) * 100
                      : 0;
                    const totalCpc = googleAdsTotals.clicks > 0
                      ? googleAdsTotals.spend / googleAdsTotals.clicks
                      : 0;
                    const totalCpa = googleAdsTotals.conversions > 0
                      ? googleAdsTotals.spend / googleAdsTotals.conversions
                      : 0;
                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            {getIntegrationIcon('google_ads')}
                            סיכום קמפיינים - Google Ads
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
                                  <TableHead className="text-right">CTR</TableHead>
                                  <TableHead className="text-right">CPC</TableHead>
                                  <TableHead className="text-right">הוצאה</TableHead>
                                  {googleAdsCampaignType === 'ecommerce' ? (
                                    <>
                                      <TableHead className="text-right">רכישות</TableHead>
                                      <TableHead className="text-right">הכנסות</TableHead>
                                      <TableHead className="text-right">ROAS</TableHead>
                                      <TableHead className="text-right">AOV</TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead className="text-right">המרות</TableHead>
                                      <TableHead className="text-right">עלות להמרה</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {googleAdsCampaignSummary.map((c, i) => {
                                  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                                  const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                                  const cpa = c.conversions > 0 ? c.spend / c.conversions : 0;
                                  const roas = c.spend > 0 ? c.conversions_value / c.spend : 0;
                                  const aov = c.conversions > 0 ? c.conversions_value / c.conversions : 0;
                                  return (
                                    <TableRow key={i}>
                                      <TableCell className="font-medium max-w-[300px]">{c.name}</TableCell>
                                      <TableCell>{formatNumber(c.impressions)}</TableCell>
                                      <TableCell>{formatNumber(c.clicks)}</TableCell>
                                      <TableCell>{ctr.toFixed(2)}%</TableCell>
                                      <TableCell>{cpc > 0 ? formatCurrency(cpc) : '-'}</TableCell>
                                      <TableCell>{formatCurrency(c.spend)}</TableCell>
                                      {googleAdsCampaignType === 'ecommerce' ? (
                                        <>
                                          <TableCell className={c.conversions > 0 ? 'text-green-600 font-medium' : ''}>
                                            {formatNumber(c.conversions)}
                                          </TableCell>
                                          <TableCell className={c.conversions_value > 0 ? 'text-green-600 font-medium' : ''}>
                                            {formatCurrency(c.conversions_value)}
                                          </TableCell>
                                          <TableCell>{roas > 0 ? roas.toFixed(2) : '-'}</TableCell>
                                          <TableCell>{aov > 0 ? formatCurrency(aov) : '-'}</TableCell>
                                        </>
                                      ) : (
                                        <>
                                          <TableCell className={c.conversions > 0 ? 'text-green-600 font-medium' : ''}>
                                            {formatNumber(c.conversions)}
                                          </TableCell>
                                          <TableCell>{cpa > 0 ? formatCurrency(cpa) : '-'}</TableCell>
                                        </>
                                      )}
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="bg-muted/50 font-bold border-t-2">
                                  <TableCell>סה"כ</TableCell>
                                  <TableCell>{formatNumber(googleAdsTotals.impressions)}</TableCell>
                                  <TableCell>{formatNumber(googleAdsTotals.clicks)}</TableCell>
                                  <TableCell>{totalCtr.toFixed(2)}%</TableCell>
                                  <TableCell>{totalCpc > 0 ? formatCurrency(totalCpc) : '-'}</TableCell>
                                  <TableCell>{formatCurrency(googleAdsTotals.spend)}</TableCell>
                                  {googleAdsCampaignType === 'ecommerce' ? (
                                    <>
                                      <TableCell className="text-green-600">{formatNumber(googleAdsTotals.conversions)}</TableCell>
                                      <TableCell className="text-green-600">{formatCurrency(googleAdsTotals.conversions_value)}</TableCell>
                                      <TableCell>{googleAdsTotals.spend > 0 ? (googleAdsTotals.conversions_value / googleAdsTotals.spend).toFixed(2) : '-'}</TableCell>
                                      <TableCell>{googleAdsTotals.conversions > 0 ? formatCurrency(googleAdsTotals.conversions_value / googleAdsTotals.conversions) : '-'}</TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="text-green-600">{formatNumber(googleAdsTotals.conversions)}</TableCell>
                                      <TableCell>{totalCpa > 0 ? formatCurrency(totalCpa) : '-'}</TableCell>
                                    </>
                                  )}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {googleAdsCampaignSummary.length === 0 && (
                    <Card className="p-12 text-center">
                      <p className="text-muted-foreground">אין נתוני Google Ads בטווח התאריכים הנבחר</p>
                    </Card>
                  )}
                </>
              )}

              {platformFilter !== 'all' && platformFilter !== 'facebook' && platformFilter !== 'google_ads' && platformRawData.fields.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {platformFilter === 'google_ads' ? 'נתוני Google Ads' : 'נתוני Analytics'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {platformRawData.fields.map((field: any) => (
                              <TableHead key={field.key} className="text-right whitespace-nowrap">
                                {field.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {platformRawData.records
                            .sort((a: any, b: any) => {
                              const dateA = a.data?.date || '';
                              const dateB = b.data?.date || '';
                              return dateB.localeCompare(dateA);
                            })
                            .map((record: any, i: number) => (
                              <TableRow key={record.id || i}>
                                {platformRawData.fields.map((field: any) => {
                                  const val = record.data?.[field.key];
                                  let displayVal = val;
                                  if (val === null || val === undefined) {
                                    displayVal = '-';
                                  } else if (typeof val === 'number') {
                                    if (['spend', 'cost', 'revenue', 'purchase_value', 'conversions_value', 'conversion_value', 'cpl', 'cost_per_lead', 'cpc', 'cpm'].includes(field.key)) {
                                      displayVal = formatCurrency(val);
                                    } else if (['roas', 'engagement_rate', 'ctr'].includes(field.key)) {
                                      displayVal = val.toFixed(2);
                                    } else if (['bounce_rate', 'avg_session_duration', 'pages_per_session', 'events_per_session'].includes(field.key)) {
                                      displayVal = field.key.includes('rate') ? val.toFixed(1) + '%' : val.toFixed(1) + 's';
                                    } else {
                                      displayVal = formatNumber(val);
                                    }
                                  }
                                  return (
                                    <TableCell key={field.key} className="whitespace-nowrap">
                                      {displayVal}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          {platformRawData.records.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={platformRawData.fields.length} className="text-center text-muted-foreground py-8">
                                אין נתונים בטווח התאריכים הנבחר
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableHead className="text-right">סשנים</TableHead>
                                <TableHead className="text-right">סשנים יחודיים</TableHead>
                                <TableHead className="text-right">הוספה לעגלה</TableHead>
                                <TableHead className="text-right">רכישות</TableHead>
                                <TableHead className="text-right">הכנסות</TableHead>
                                <TableHead className="text-right">ROAS</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead className="text-right">קליקים</TableHead>
                                <TableHead className="text-right">CPC</TableHead>
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
                                {dashboardCampaignType === 'ecommerce' ? (
                                  <>
                                    <TableCell>{isAnalytics ? formatNumber(metrics.sessions) : '-'}</TableCell>
                                    <TableCell>{isAnalytics ? formatNumber(metrics.users) : '-'}</TableCell>
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
                                    <TableCell>{isAnalytics ? '-' : formatNumber(metrics.clicks)}</TableCell>
                                    <TableCell>{isAnalytics || !metrics.clicks ? '-' : formatCurrency(metrics.spend / metrics.clicks)}</TableCell>
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
                            {dashboardCampaignType === 'ecommerce' ? (
                              <>
                                <TableCell>{formatNumber(totalSummary.analyticsSessions)}</TableCell>
                                <TableCell>{formatNumber(totalSummary.analyticsUsers)}</TableCell>
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
                                <TableCell>{formatNumber(totalSummary.clicks)}</TableCell>
                                <TableCell>{totalSummary.clicks > 0 ? formatCurrency(totalSummary.spend / totalSummary.clicks) : '-'}</TableCell>
                                <TableCell>{formatNumber(totalSummary.results)}</TableCell>
                                <TableCell>{formatCurrency(combinedCpl)}</TableCell>
                              </>
                            )}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 px-1">
                      * נתוני רכישות וערך רכישות של פייסבוק מבוססים על דיווח פייסבוק (כולל ייחוס צפייה וחלון 7 ימים), ועשויים להיות גבוהים מנתוני Analytics בשל ספירה כפולה בין קמפיינים. ה-ROAS הכללי בשורת הסה"כ מחושב לפי הכנסות Analytics בלבד.
                    </p>
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
                          {analyticsSourceBreakdown.map((source) => {
                            return (
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
                            );
                          })}
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
                          {/* Totals row */}
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

                  {/* Spend chart for ads-only view */}
                  {!dashboardCampaignType.includes('ecommerce') && showAdsCards && (
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

                  {/* Leads chart for leads campaigns */}
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
        </>
      )}
    </div>
  );
}
